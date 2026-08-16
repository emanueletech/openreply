"use client";

import { useState } from "react";
import { FRASI_PRONTE, type TipoFrase } from "@/lib/frasi-pronte";

// Riga di frasi pronte da infilare in un campo con un clic.
// Aggiunta locale (non fa parte di OpenReply originale): sta tutta qui dentro,
// così un aggiornamento della repo non se la porta via.
//
// Le classi ricalcano quelle già usate nel builder — bordo `border-border`,
// testo `text-muted` che schiarisce al passaggio — per non stonare col resto.
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
  const frasi = FRASI_PRONTE[tipo] ?? [];
  if (frasi.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        className="text-xs font-medium text-accent hover:underline"
      >
        {aperto ? "Nascondi le frasi pronte" : etichetta}
      </button>

      {aperto && (
        <div className="mt-2 flex flex-wrap gap-2">
          {frasi.map((frase) => (
            <button
              key={frase}
              type="button"
              // sostituisce il contenuto del campo: si sceglie una frase e la si
              // ritocca, invece di accodarne una dietro l'altra per sbaglio
              onClick={() => {
                onScegli(frase);
                setAperto(false);
              }}
              title={frase}
              className="max-w-full truncate rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent/40 hover:text-foreground"
            >
              {frase}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
