"use client";

import { useSearchParams } from "next/navigation";

type Tone = "error" | "warning" | "success";

const TONE_CLASSES: Record<Tone, string> = {
  error: "border-error/20 bg-error/10 text-error",
  warning: "border-warning/20 bg-warning/10 text-warning",
  success: "border-success/20 bg-success/10 text-success",
};

const MESSAGES: Record<string, { tone: Tone; title: string; detail: string }> = {
  denied: {
    tone: "warning",
    title: "Connessione a Instagram annullata",
    detail:
      "You declined the permission prompt on Instagram. Start again and accept all requested permissions.",
  },
  invalid: {
    tone: "error",
    title: "Connessione a Instagram scaduta",
    detail:
      "The login link was missing or older than 10 minutes. Click Connect Instagram to start a fresh attempt.",
  },
  forbidden: {
    tone: "error",
    title: "Non consentito",
    detail:
      "Solo i proprietari e gli amministratori dello spazio di lavoro possono collegare un account Instagram.",
  },
  already_connected: {
    tone: "warning",
    title: "Account già collegato",
    detail:
      "That Instagram account is connected to another workspace. Disconnect it there first, or connect a different account.",
  },
};

export function InstagramConnectNotice() {
  const searchParams = useSearchParams();
  const status = searchParams.get("instagram");

  if (!status) return null;

  if (status === "misconfigured") {
    const missing = (searchParams.get("missing") ?? "")
      .split(",")
      .filter(Boolean);

    return (
      <Notice tone="error" title="App Instagram non configurata">
        <p>
          Imposta{" "}
          {missing.length > 0
            ? "queste variabili d'ambiente"
            : "le variabili d'ambiente richieste"}{" "}
          e riavvia il server:
        </p>
        {missing.length > 0 && (
          <ul className="mt-2 space-y-1">
            {missing.map((name) => (
              <li key={name} className="font-mono text-xs">
                {name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2">
          Vedi <span className="font-mono text-xs">docs/setup.md</span> per sapere
          come ricavare ogni valore. Nota che{" "}
          <span className="font-mono text-xs">ENCRYPTION_KEY</span> deve essere una stringa esadecimale di 64 caratteri.
        </p>
      </Notice>
    );
  }

  if (status === "failed") {
    const reason = searchParams.get("reason");

    return (
      <Notice tone="error" title="Connessione a Instagram fallita">
        <p>
          Instagram ha accettato l&apos;accesso ma la connessione non è andata a
          buon fine. Di solito dipende da un URL di reindirizzamento che non
          combacia, oppure da un&apos;app a cui mancano i permessi necessari.
        </p>
        {reason && (
          <p className="mt-2 font-mono text-xs break-words opacity-80">
            {reason}
          </p>
        )}
      </Notice>
    );
  }

  const known = MESSAGES[status];
  if (!known) return null;

  return (
    <Notice tone={known.tone} title={known.title}>
      <p>{known.detail}</p>
    </Notice>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded border p-4 text-sm ${TONE_CLASSES[tone]}`}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 opacity-90">{children}</div>
    </div>
  );
}
