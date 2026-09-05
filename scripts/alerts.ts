/**
 * Telegram alerts for the failures nobody notices.
 *
 * Everything that has gone wrong on this instance went wrong quietly: webhooks
 * that stopped being delivered for 24 hours, comments that matched no campaign
 * and were dropped, a link nobody could open. The database recorded all of it
 * and no one was reading. This closes that gap.
 *
 * Deliberately narrow: it only reports things that are already stored, and it
 * never touches Instagram. If it breaks, nothing else stops.
 *
 * State lives in Redis, not in the schema: adding a "notified" column would
 * mean a migration on a fork that has to stay mergeable with upstream. Keys
 * expire on their own, so nothing accumulates.
 */

import { prisma } from "@/lib/db/client";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://redis:6379", {
  maxRetriesPerRequest: null,
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/** How long a sent alert is remembered, so the same one is not repeated. */
const SEEN_TTL_SECONDS = 7 * 24 * 3600;
/** Silence longer than this means the webhook delivery has stopped. */
const WEBHOOK_SILENCE_HOURS = Number(process.env.ALERT_WEBHOOK_SILENCE_HOURS ?? 6);
/** Warn this many days before the Instagram token expires. */
const TOKEN_WARN_DAYS = Number(process.env.ALERT_TOKEN_WARN_DAYS ?? 12);
const INTERVAL_MS = Number(process.env.ALERT_INTERVAL_MS ?? 15 * 60_000);

async function send(text: string): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!r.ok) console.error("[alerts] Telegram ha risposto", r.status);
    return r.ok;
  } catch (error) {
    console.error("[alerts] invio fallito:", (error as Error).message);
    return false;
  }
}

/** True the first time this key is seen; false afterwards. */
async function firstTime(key: string): Promise<boolean> {
  const set = await redis.set(`alert:${key}`, "1", "EX", SEEN_TTL_SECONDS, "NX");
  return set === "OK";
}

/**
 * Alerts that describe a state rather than an event — webhooks silent, token
 * expiring — have to clear themselves, or you are left wondering whether the
 * problem is still there. Fires once when it starts, once when it ends.
 */
async function stateAlert(key: string, bad: boolean, onBad: string, onGood: string) {
  const flag = `alert:state:${key}`;
  const wasBad = (await redis.get(flag)) === "1";
  if (bad && !wasBad) {
    if (await send(onBad)) await redis.set(flag, "1");
  } else if (!bad && wasBad) {
    if (await send(onGood)) await redis.del(flag);
  }
}

async function checkWebhookSilence() {
  const last = await prisma.webhookEvent.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return;

  const hours = (Date.now() - last.createdAt.getTime()) / 3600_000;
  await stateAlert(
    "webhook-silence",
    hours >= WEBHOOK_SILENCE_HOURS,
    `⚠️ <b>Nessun webhook da ${Math.floor(hours)} ore</b>\n\n` +
      `Instagram non sta consegnando eventi: i commenti li recupera il polling entro 5 minuti, ` +
      `ma i tap dei bottoni (follow gate e link finale) si perdono.\n\n` +
      `Di solito si risolve ri-eseguendo la sottoscrizione dei webhook.`,
    `✅ <b>Webhook tornati a funzionare</b>\n\nLe consegne da Instagram sono riprese.`
  );
}

async function checkToken() {
  const accounts = await prisma.instagramAccount.findMany({
    select: { username: true, tokenExpiresAt: true },
  });

  for (const a of accounts) {
    if (!a.tokenExpiresAt) continue;
    const days = Math.floor((a.tokenExpiresAt.getTime() - Date.now()) / 86400_000);
    await stateAlert(
      `token-${a.username}`,
      days <= TOKEN_WARN_DAYS,
      `⚠️ <b>Token Instagram in scadenza</b>\n\n` +
        `@${a.username} scade fra ${days} giorni (${a.tokenExpiresAt.toISOString().slice(0, 10)}).\n\n` +
        `Il rinnovo è automatico entro 10 giorni dalla scadenza: se questo avviso resta, ` +
        `il rinnovo non sta funzionando e le automazioni si fermeranno senza altri errori.`,
      `✅ <b>Token Instagram rinnovato</b>\n\n@${a.username} è di nuovo valido a lungo.`
    );
  }
}

async function checkFailedDms() {
  const failed = await prisma.dmLog.findMany({
    where: {
      status: "FAILED",
      createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
    },
    select: {
      id: true,
      commenterName: true,
      commentText: true,
      errorMessage: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  for (const dm of failed) {
    if (!(await firstTime(`dm:${dm.id}`))) continue;
    await send(
      `❌ <b>DM non inviato</b>\n\n` +
        `A: @${dm.commenterName ?? "?"}\n` +
        `Commento: ${(dm.commentText ?? "").slice(0, 60)}\n` +
        `Errore: ${(dm.errorMessage ?? "nessun dettaglio").slice(0, 200)}\n\n` +
        `La finestra per rispondere a un commento è di 7 giorni: entro quel termine ` +
        `si può ancora rimediare a mano.`
    );
  }
}

async function checkOperationalErrors() {
  const events = await prisma.operationalEvent.findMany({
    where: {
      level: { in: ["ERROR", "WARNING"] },
      createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
    },
    select: { id: true, level: true, message: true, source: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  for (const e of events) {
    if (!(await firstTime(`event:${e.id}`))) continue;
    await send(
      `${e.level === "ERROR" ? "❌" : "⚠️"} <b>${e.level} — ${e.source}</b>\n\n` +
        `${e.message.slice(0, 300)}`
    );
  }
}

async function runOnce() {
  // Each check is independent: one failing must not silence the others.
  for (const [name, check] of [
    ["webhook", checkWebhookSilence],
    ["token", checkToken],
    ["dm", checkFailedDms],
    ["eventi", checkOperationalErrors],
  ] as const) {
    try {
      await check();
    } catch (error) {
      console.error(`[alerts] controllo ${name} fallito:`, (error as Error).message);
    }
  }
}

async function main() {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("[alerts] TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID mancanti: esco");
    process.exit(1);
  }
  console.log(`[alerts] avviato, un giro ogni ${Math.round(INTERVAL_MS / 60000)} minuti`);

  await runOnce();
  setInterval(() => void runOnce(), INTERVAL_MS);
}

void main();
