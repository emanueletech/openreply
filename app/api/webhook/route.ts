import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  parseCommentEvents,
  verifyWebhookSignature,
} from "@/lib/meta/webhook";
import { processInstagramWebhook } from "@/lib/queue/process-webhook";


export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { success: false, error: "Verification failed" },
    { status: 403 }
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    // Only a request that carried a signature is worth recording. One without
    // the header never came from Meta, which signs every delivery: it is a
    // scanner that found a public endpoint, and alerting on those teaches the
    // reader to ignore the channel — the same reasoning as
    // EXPECTED_META_SUBCODES in scripts/alerts.ts. A signature that is present
    // but does not match is the case this record was written for: the usual
    // symptom of FACEBOOK_APP_SECRET holding the wrong app's signing key.
    if (signature) {
      await prisma.operationalEvent
        .create({
          data: {
            source: "SYSTEM",
            level: "WARNING",
            message: "Webhook signature verification failed",
            payload: {
              hadSignatureHeader: true,
              bodyLength: rawBody.length,
              bodyPreview: rawBody.slice(0, 200),
            },
          },
        })
        .catch(() => {});
    }
    return NextResponse.json(
      { success: false, error: "Invalid signature" },
      { status: 401 }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  try {
    await processInstagramWebhook({ payload: payload as Parameters<typeof parseCommentEvents>[0], provider: 'META' });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
