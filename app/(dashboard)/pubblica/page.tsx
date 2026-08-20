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
const RICORDATI = ["filamento", "stampante", "plate"] as const;

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

  useEffect(() => {
    let salvati: Record<string, string> = {};
    try {
      salvati = JSON.parse(localStorage.getItem(MEMORIA) || "{}");
    } catch {
      return; // memoria illeggibile: si riparte dai campi vuoti, non è un errore
    }
    for (const chiave of RICORDATI) {
      const campo = form.current?.elements.namedItem(chiave);
      if (campo instanceof HTMLInputElement && salvati[chiave]) {
        campo.value = salvati[chiave];
      }
    }
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

  const invia = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const corpo = new FormData(e.currentTarget);

    const memoria: Record<string, string> = {};
    for (const chiave of RICORDATI) memoria[chiave] = String(corpo.get(chiave) ?? "");
    localStorage.setItem(MEMORIA, JSON.stringify(memoria));

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

      <form ref={form} onSubmit={invia} className="space-y-4">
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
                <input name={chiave} className={INPUT} />
              </div>
            ))}
            <p className="text-xs text-muted">
              Restano memorizzati su questo dispositivo e si ripresentano già
              compilati la prossima volta.
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
