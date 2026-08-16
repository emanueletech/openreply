"use client";

import { useEffect, useState } from "react";
import { FRASI_PRONTE, LINGUE, type Lingua, type TipoFrase } from "@/lib/frasi-pronte";

const CHIAVE_LINGUA = "openreply:lingua-frasi";

// Riga di frasi pronte da infilare in un campo con un clic, in italiano o in
// inglese. Aggiunta locale (non fa parte di OpenReply originale).
//
// La lingua scelta resta memorizzata nel browser: chi scrive quasi sempre in
// una lingua sola non deve rimetterla a ogni campo, ma può cambiarla al volo
// quando prepara una campagna per un pubblico diverso.
export function FrasiPronte({
  tipo,
  onScegli,
  etichetta = "Frasi pronte",
}: {
  tipo: TipoFrase;
  onScegli: (frase: string) => void;
  etichetta?: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [lingua, setLingua] = useState<Lingua>("it");

  useEffect(() => {
    try {
      const salvata = window.localStorage.getItem(CHIAVE_LINGUA);
      if (salvata === "it" || salvata === "en") setLingua(salvata);
    } catch {
      // localStorage negato (navigazione privata): resta l'italiano
    }
  }, []);

  function cambiaLingua(nuova: Lingua) {
    setLingua(nuova);
    try {
      window.localStorage.setItem(CHIAVE_LINGUA, nuova);
    } catch {
      // se non si può memorizzare, vale solo per questa sessione
    }
  }

  const frasi = FRASI_PRONTE[lingua][tipo] ?? [];
  if (frasi.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setAperto((v) => !v)}
          className="text-xs font-medium text-accent hover:underline"
        >
          {aperto ? "Nascondi le frasi pronte" : etichetta}
        </button>

        {aperto && (
          <div className="flex items-center gap-1">
            {LINGUE.map(({ codice, etichetta: nome }) => (
              <button
                key={codice}
                type="button"
                onClick={() => cambiaLingua(codice)}
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  lingua === codice
                    ? "bg-accent/10 font-medium text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {aperto && (
        <div className="mt-2 flex w-full flex-wrap gap-2">
          {frasi.map((frase) => (
            <button
              key={frase}
              type="button"
              onClick={() => {
                onScegli(frase);
                setAperto(false);
              }}
              title={frase}
              // min-w-0 è indispensabile: in un contenitore flex un elemento
              // non scende sotto la larghezza del proprio testo, e una frase
              // lunga allargherebbe l'intera pagina costringendo a scorrere
              // di lato sul telefono. Con questo il testo viene troncato e
              // resta dentro lo schermo.
              className="min-w-0 max-w-full shrink truncate rounded-full border border-border px-3 py-1 text-left text-xs text-muted hover:border-accent/40 hover:text-foreground"
            >
              {frase}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
