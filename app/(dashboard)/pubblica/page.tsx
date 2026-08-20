"use client";

/**
 * Pubblica
 *
 * Un video, una copertina, quattro campi: da qui partono i tre post su Buffer
 * (Instagram, TikTok, YouTube) e la campagna commento→DM che si aggancerà al
 * reel appena pubblicato.
 *
 * Pensata per il telefono: i campi che cambiano di rado (filamento, stampante,
 * piatto) restano memorizzati e si ripresentano già compilati. Il form non è
 * controllato — i valori si leggono dal DOM al momento dell'invio, così i campi
 * memorizzati si ripristinano senza far ripartire un render.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const MEMORIA = "pubblica:ultimi-valori";
const RUBRICA = "pubblica:gia-usati";
const RICORDATI = ["filamento", "stampante", "plate"] as const;
const MAX_RUBRICA = 8;

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none";

interface Job {
  id: string;
  stato: string;
  post: Record<string, string>;
  errori: string[];
  keyword: string;
}

const AVANZAMENTO: Record<string, string> = {
  "in coda": "In coda",
  encoding: "Applico la copertina al video",
  caption: "Preparo le caption",
  buffer: "Creo i post su Buffer",
  openreply: "Apro la campagna commento→DM",
  fatto: "Fatto",
  errore: "Errore",
};

export default function PubblicaPage() {
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [caricamento, setCaricamento] = useState(0);
  const [invio, setInvio] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [anteprima, setAnteprima] = useState<Record<string, string> | null>(null);
  const [generando, setGenerando] = useState(false);
  const [rubrica, setRubrica] = useState<Record<string, string[]>>({});
  const [marchi, setMarchi] = useState<string[]>([]);
  const [canale, setCanale] = useState<"IG" | "TIKTOK" | "YT">("IG");
  const attesaAnteprima = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let salvati: Record<string, string> = {};
    try {
      salvati = JSON.parse(localStorage.getItem(MEMORIA) || "{}");
    } catch {
      salvati = {}; // memoria illeggibile: si ripiega sui default del servizio
    }

    const compila = (valori: Record<string, string>) => {
      for (const chiave of RICORDATI) {
        const campo = form.current?.elements.namedItem(chiave);
        if (campo instanceof HTMLInputElement && !campo.value && valori[chiave]) {
          campo.value = valori[chiave];
        }
      }
    };

    compila(salvati);
    // Quello che non è memorizzato qui viene dai default di config.txt, così al
    // primo uso su un dispositivo nuovo i campi non sono vuoti.
    fetch("/api/pubblica?config=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        compila(d);
        setMarchi(String(d.marchi || "").split(/\s+/).filter(Boolean));
      })
      .catch(() => {})
      .finally(() => {
        try {
          setRubrica(JSON.parse(localStorage.getItem(RUBRICA) || "{}"));
        } catch {
          // rubrica illeggibile: restano i suggerimenti che arrivano dal servizio
        }
      });
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const seguiJob = useCallback((id: string) => {
    const chiedi = async () => {
      try {
        const res = await fetch(`/api/pubblica?job=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const dati = await res.json();
        if (!res.ok) throw new Error(dati.error || "Stato non disponibile");
        setJob(dati);
        if (dati.stato !== "fatto" && dati.stato !== "errore") {
          timer.current = setTimeout(chiedi, 2000);
        }
      } catch (e) {
        setErrore(e instanceof Error ? e.message : String(e));
      }
    };
    chiedi();
  }, []);

  /** Ricalcola le caption mentre si scrive, senza pubblicare nulla. */
  const chiediAnteprima = () => {
    if (attesaAnteprima.current) clearTimeout(attesaAnteprima.current);
    attesaAnteprima.current = setTimeout(async () => {
      if (!form.current) return;
      const corpo = new FormData(form.current);
      corpo.delete("video");
      corpo.delete("cover");
      try {
        const res = await fetch("/api/pubblica?anteprima=1", {
          method: "POST",
          body: corpo,
        });
        if (res.ok) setAnteprima(await res.json());
      } catch {
        // l'anteprima è un di più: se non arriva, il form resta usabile
      }
    }, 400);
  };

  useEffect(() => {
    chiediAnteprima();
    return () => {
      if (attesaAnteprima.current) clearTimeout(attesaAnteprima.current);
    };
  }, []);

  /** Fa scrivere a Claude la riga di descrizione e la mette nel campo. */
  const generaDescrizione = async () => {
    if (!form.current) return;
    const dati = new FormData(form.current);
    if (!String(dati.get("titolo") || "").trim()) {
      setErrore("Serve almeno il titolo per far scrivere la descrizione");
      return;
    }
    setErrore(null);
    setGenerando(true);
    try {
      const corpo = new FormData();
      for (const chiave of ["titolo", "note", "tempo", "filamento"]) {
        corpo.append(chiave, String(dati.get(chiave) ?? ""));
      }
      const res = await fetch("/api/pubblica?genera=1", { method: "POST", body: corpo });
      const risposta = await res.json();
      if (!res.ok) throw new Error(risposta.detail || risposta.error || "Non riuscito");
      const campo = form.current.elements.namedItem("descrizione");
      if (campo instanceof HTMLTextAreaElement) campo.value = risposta.descrizione;
      chiediAnteprima();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerando(false);
    }
  };

  const invia = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const corpo = new FormData(e.currentTarget);

    const memoria: Record<string, string> = {};
    const nuovaRubrica: Record<string, string[]> = { ...rubrica };
    for (const chiave of RICORDATI) {
      const valore = String(corpo.get(chiave) ?? "").trim();
      memoria[chiave] = valore;
      if (valore) {
        // La rubrica tiene i valori già usati, non solo l'ultimo: i marchi
        // ruotano, e riscrivere una menzione a memoria è come sbagliarla.
        const usati = (nuovaRubrica[chiave] || []).filter((v) => v !== valore);
        nuovaRubrica[chiave] = [valore, ...usati].slice(0, MAX_RUBRICA);
      }
    }
    localStorage.setItem(MEMORIA, JSON.stringify(memoria));
    localStorage.setItem(RUBRICA, JSON.stringify(nuovaRubrica));
    setRubrica(nuovaRubrica);

    // Un file input vuoto finisce comunque in FormData come file da 0 byte: va
    // tolto, altrimenti il servizio crede di aver ricevuto una copertina.
    const cover = corpo.get("cover");
    if (cover instanceof File && cover.size === 0) corpo.delete("cover");

    setErrore(null);
    setJob(null);
    setInvio(true);
    setCaricamento(0);

    // XHR e non fetch: serve l'avanzamento dell'upload, che su un reel da
    // decine di MB è l'unica cosa che dice che sta succedendo qualcosa.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/pubblica");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        setCaricamento(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = () => {
      setInvio(false);
      try {
        const dati = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) {
          throw new Error(dati.error || dati.detail || "Invio fallito");
        }
        seguiJob(dati.job);
      } catch (err) {
        setErrore(err instanceof Error ? err.message : "Risposta non leggibile");
      }
    };
    xhr.onerror = () => {
      setInvio(false);
      setErrore("Caricamento interrotto");
    };
    xhr.send(corpo);
  };

  const lavorando =
    invio || (job !== null && job.stato !== "fatto" && job.stato !== "errore");

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      <div>
        <h1 className="text-xl font-semibold">Pubblica</h1>
        <p className="mt-1 text-sm text-muted">
          Un video e quattro campi: i post partono su Instagram, TikTok e
          YouTube, e la campagna si aggancia da sola al reel appena esce.
        </p>
      </div>

      <form
        ref={form}
        onSubmit={invia}
        onInput={chiediAnteprima}
        className="space-y-4"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium">Video</label>
          <input type="file" name="video" accept="video/*" required className={INPUT} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Copertina</label>
          <input type="file" name="cover" accept="image/*" className={INPUT} />
          <p className="text-xs text-muted">
            Diventa il primo fotogramma del video: è l&apos;unico modo per avere
            una copertina scelta da te su Instagram e TikTok.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Titolo</label>
            <input name="titolo" required placeholder="HelixCore" className={INPUT} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Parola chiave</label>
            <input name="keyword" required placeholder="Spin" className={INPUT} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Tempo di stampa</label>
          <input name="tempo" placeholder="3.8 hours" className={INPUT} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Descrizione</label>
            <button
              type="button"
              onClick={generaDescrizione}
              disabled={generando}
              className="rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground disabled:opacity-50"
            >
              {generando ? "Scrivo…" : "Scrivi con Claude"}
            </button>
          </div>
          <textarea
            name="descrizione"
            rows={2}
            placeholder="Una riga sul modello: cosa fa, come si muove, cos'è stato difficile"
            className={INPUT}
            onInput={chiediAnteprima}
          />
          <input
            name="note"
            placeholder="Per Claude: cosa si vede nel video (non finisce nella caption)"
            className={INPUT}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Link al modello</label>
          <input name="link" placeholder="https://makerworld.com/..." className={INPUT} />
        </div>

        <details className="rounded-lg border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted">
            Filamento, stampante e piatto
          </summary>
          <div className="mt-3 space-y-3">
            {RICORDATI.map((chiave) => (
              <div key={chiave} className="space-y-1">
                <label className="text-sm font-medium capitalize">{chiave}</label>
                <input name={chiave} list={`suggerimenti-${chiave}`} className={INPUT} />
                <datalist id={`suggerimenti-${chiave}`}>
                  {[...(rubrica[chiave] || []), ...marchi].map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
            ))}
            <p className="text-xs text-muted">
              Restano memorizzati su questo dispositivo e si ripresentano già
              compilati la prossima volta. Scrivendo compaiono i valori già usati
              e i marchi che tagghi più spesso: Instagram non permette di cercare
              i profili da fuori, quindi la rubrica è l&apos;unico modo per non
              sbagliare una menzione a memoria.
            </p>
          </div>
        </details>

        <button
          type="submit"
          disabled={lavorando}
          className="w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {lavorando ? "In corso…" : "Pubblica"}
        </button>
      </form>

      {anteprima && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Come verrà</span>
            <div className="ml-auto flex gap-1">
              {(["IG", "TIKTOK", "YT"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCanale(c)}
                  className={
                    canale === c
                      ? "rounded border border-accent/40 bg-accent/10 px-2 py-1 text-xs text-foreground"
                      : "rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
                  }
                >
                  {c === "IG" ? "Instagram" : c === "TIKTOK" ? "TikTok" : "YouTube"}
                </button>
              ))}
            </div>
          </div>
          <pre className="whitespace-pre-wrap break-words text-sm text-muted">
            {anteprima[canale]}
          </pre>
          <p className="text-xs text-muted">
            {canale === "IG"
              ? "La parola chiave compare solo qui: è questo commento che fa partire il DM."
              : "Qui la parola chiave non c'è: chi commenta su questo canale non riceverebbe nulla."}
          </p>
        </div>
      )}

      {invio && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full border border-border">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${caricamento}%` }}
            />
          </div>
          <p className="text-xs text-muted">Carico il video: {caricamento}%</p>
        </div>
      )}

      {errore && (
        <div className="rounded border border-error/20 bg-error/10 p-3 text-sm text-error">
          {errore}
        </div>
      )}

      {job && (
        <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{AVANZAMENTO[job.stato] ?? job.stato}</span>
            {job.stato === "fatto" && <span className="text-accent">✓</span>}
          </div>

          {Object.keys(job.post || {}).length > 0 && (
            <p className="text-muted">
              Post creati: {Object.keys(job.post).join(", ")}
            </p>
          )}

          {job.stato === "fatto" && (
            <p className="text-muted">
              Commenta «{job.keyword}» sotto il post per provare la campagna.
            </p>
          )}

          {job.errori?.length > 0 && (
            <ul className="list-inside list-disc text-error">
              {job.errori.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
