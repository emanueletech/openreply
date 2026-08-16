"use client";

/**
 * Import Campaigns Page
 *
 * Paste a CSV of everything except the post. Each row is queued and opened in
 * the campaign builder prefilled and editable, one at a time, so you review
 * each campaign and pick its reel before saving.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { parseCsv } from "@/lib/utils/csv";
import { IMPORT_QUEUE_KEY, IMPORT_ACCOUNT_KEY } from "@/lib/import-queue";

const SAMPLE = `keywords,dm_message,public_reply,tracked_url,opening_dm,opening_dm_button
"yc","eccolo qui: {link}","inviato, controlla i messaggi","https://events.ycombinator.com/startup-school-2026","ciao! tocca qui sotto per il link","manda il link"
"LINK,SHOP","prendilo qui: {link}","ti ho scritto in DM",,,`;

export default function ImportCampaignsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) {
          const next = payload.data.instagramAccounts ?? [];
          setAccounts(next);
          setSelectedAccountId(next[0]?.id ?? "");
        }
      })
      .catch(() => setAccounts([]));
  }, []);

  function startImport() {
    setError(null);
    const parsed = parseCsv(csv);
    if (parsed.length === 0) {
      setError("Incolla un CSV con la riga di intestazione e almeno una campagna.");
      return;
    }

    const rows = [];
    for (let i = 0; i < parsed.length; i++) {
      const r = parsed[i];
      const keywords = (r.keywords ?? "")
        .split(/[,;]/)
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10);
      const dmMessage = (r.dm_message ?? r.message ?? "").trim();
      if (keywords.length === 0 || !dmMessage) {
        setError(`Row ${i + 1} is missing keywords or a message.`);
        return;
      }
      rows.push({
        name: (r.name ?? "").trim(),
        keywords,
        dmMessage,
        publicReply: (r.public_reply ?? "").trim(),
        trackedUrl: (r.tracked_url ?? "").trim(),
        openingDmMessage: (r.opening_dm ?? "").trim(),
        openingDmButtonLabel: (r.opening_dm_button ?? "").trim(),
      });
    }

    try {
      window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(rows));
      if (selectedAccountId) {
        window.localStorage.setItem(IMPORT_ACCOUNT_KEY, selectedAccountId);
      }
    } catch {
      setError("Non è stato possibile preparare l'importazione in questo browser.");
      return;
    }
    router.push("/campaigns/new");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Importa campagne</h1>
        <p className="text-sm text-muted mt-1">
          Serve a creare più campagne in una volta sola, partendo da un foglio
          di calcolo invece di compilare il builder una campagna alla volta.
          Incolla un CSV con una riga per campagna: ogni riga si apre nel
          builder già compilata e modificabile, così la controlli e scegli il
          reel prima di salvare. Le colonne obbligatorie sono{" "}
          <code className="text-accent">keywords</code> e{" "}
          <code className="text-accent">dm_message</code>. Facoltative:{" "}
          <code className="text-accent">name</code>,{" "}
          <code className="text-accent">public_reply</code>,{" "}
          <code className="text-accent">tracked_url</code>,{" "}
          <code className="text-accent">opening_dm</code>,{" "}
          <code className="text-accent">opening_dm_button</code>. Le parole
          chiave vanno tutte in una cella, separate da virgole. Usa{" "}
          <code className="text-accent">{"{link}"}</code> nel messaggio per inserire il link tracciato.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {accounts.length > 1 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Account Instagram
          </label>
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            includeAll={false}
            label="Account"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">CSV</label>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={SAMPLE}
          rows={10}
          className="w-full px-4 py-3 rounded bg-surface border border-border text-sm font-mono text-foreground placeholder:text-zinc-600 focus:border-accent/40 focus:outline-none resize-y"
        />
        <button
          type="button"
          onClick={() => setCsv(SAMPLE)}
          className="text-xs text-muted hover:text-foreground"
        >
          Compila con un esempio
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={startImport}
          className="px-5 py-2 rounded bg-accent text-sm font-medium text-white hover:bg-accent-hover"
        >
          Controlla e importa
        </button>
        <button
          onClick={() => router.push("/campaigns")}
          className="px-5 py-2 rounded text-sm text-muted hover:text-foreground border border-border"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
