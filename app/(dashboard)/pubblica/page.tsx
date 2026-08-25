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
const INCLUSI = "pubblica:righe-incluse";
const JOB_IN_CORSO = "pubblica:job-in-corso";
const RICORDATI = ["filamento", "stampante", "plate", "extra"] as const;
const MAX_RUBRICA = 8;

/** `extra` è una riga libera: esce nella caption esattamente com'è scritta. */
const ETICHETTE: Record<(typeof RICORDATI)[number], string> = {
  filamento: "Filamento",
  stampante: "Stampante",
  plate: "Piatto",
  extra: "Riga libera",
};

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
  // Caption riscritte a mano, per canale. Una volta toccata, la caption non
  // viene più rigenerata: sarebbe sgradevole veder sparire ciò che hai scritto
  // solo perché hai corretto il tempo di stampa.
  const [riscritte, setRiscritte] = useState<Record<string, string>>({});
  const [rubrica, setRubrica] = useState<Record<string, string[]>>({});
  const [marchi, setMarchi] = useState<string[]>([]);
  const [quando, setQuando] = useState<"subito" | "data" | "coda">("subito");
  const [dataOra, setDataOra] = useState("");
  const [canale, setCanale] = useState<"IG" | "TIKTOK" | "YT">("IG");
  const [inclusi, setInclusi] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(RICORDATI.map((c) => [c, c !== "extra"]))
  );
  const attesaAnteprima = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** I campi che l'utente ha deselezionato, come li vuole il servizio. */
  const campiEsclusi = () => RICORDATI.filter((c) => !inclusi[c]).join(",");

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
        try {
          const spunte = JSON.parse(localStorage.getItem(INCLUSI) || "null");
          if (spunte) setInclusi((precedenti) => ({ ...precedenti, ...spunte }));
        } catch {
          // spunte illeggibili: tutto incluso tranne la riga libera, come al primo uso
        }
      });
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /** Durante l'upload il browser chiede conferma prima di lasciare la pagina. */
  useEffect(() => {
    if (!invio) return;
    const avvisa = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [invio]);

  const seguiJob = useCallback((id: string) => {
    // Il job vive sul servizio, non qui: se iOS scarica la pagina durante un
    // encode lungo, al rientro basta l'id per riagganciarsi invece di credere
    // che la pubblicazione sia andata persa.
    localStorage.setItem(JOB_IN_CORSO, id);
    const chiedi = async () => {
      try {
        const res = await fetch(`/api/pubblica?job=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const dati = await res.json();
        if (res.status === 404) {
          // Job ripulito dal servizio: senza questo, all'apertura successiva
          // resterebbe un avanzamento che non avanza mai.
          localStorage.removeItem(JOB_IN_CORSO);
          return;
        }
        if (!res.ok) throw new Error(dati.error || "Stato non disponibile");
        setJob(dati);
        if (dati.stato !== "fatto" && dati.stato !== "errore") {
          timer.current = setTimeout(chiedi, 2000);
        } else {
          localStorage.removeItem(JOB_IN_CORSO);
        }
      } catch (e) {
        setErrore(e instanceof Error ? e.message : String(e));
      }
    };
    chiedi();
  }, []);

  /** Un job lasciato a metà da una visita precedente si riprende da solo. */
  useEffect(() => {
    const rimasto = localStorage.getItem(JOB_IN_CORSO);
    if (rimasto) seguiJob(rimasto);
  }, [seguiJob]);

  /** Ricalcola le caption mentre si scrive, senza pubblicare nulla. */
  const chiediAnteprima = () => {
    if (attesaAnteprima.current) clearTimeout(attesaAnteprima.current);
    attesaAnteprima.current = setTimeout(async () => {
      if (!form.current) return;
      const corpo = new FormData(form.current);
      corpo.delete("video");
      corpo.delete("cover");
      corpo.set("escludi", campiEsclusi());
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
    // Anche al cambio delle spunte: l'anteprima deve mostrare la caption senza
    // le righe tolte, altrimenti la spunta sembra non fare niente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inclusi]);

  const invia = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const corpo = new FormData(e.currentTarget);

    const memoria: Record<string, string> = {};
    const nuovaRubrica: Record<string, string[]> = { ...rubrica };
    for (const chiave of RICORDATI) {
      // Dal DOM e non da FormData: un campo deselezionato è `disabled`, quindi
      // in FormData non c'è — e la memoria si svuoterebbe a ogni pubblicazione.
      const campo = e.currentTarget.elements.namedItem(chiave);
      const valore =
        campo instanceof HTMLInputElement ? campo.value.trim() : "";
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
    localStorage.setItem(INCLUSI, JSON.stringify(inclusi));
    setRubrica(nuovaRubrica);

    // Una riga tolta va detta al servizio: lasciarla fuori e basta la farebbe
    // ricadere sul default di config.txt, che è il contrario di toglierla.
    corpo.set("escludi", campiEsclusi());

    // Solo le caption davvero riscritte: le altre le costruisce il servizio dal
    // template, come sempre.
    for (const [sigla, campo] of [
      ["IG", "caption_ig"],
      ["TIKTOK", "caption_tiktok"],
      ["YT", "caption_yt"],
    ] as const) {
      if (riscritte[sigla] !== undefined) corpo.set(campo, riscritte[sigla]);
    }

    // Un file input vuoto finisce comunque in FormData come file da 0 byte: va
    // tolto, altrimenti il servizio crede di aver ricevuto una copertina.
    const cover = corpo.get("cover");
    if (cover instanceof File && cover.size === 0) corpo.delete("cover");

    // "coda" = campo vuoto, ed è Buffer a scegliere lo slot per ogni canale.
    // La data arriva dal browser nel fuso locale: il servizio la vuole in UTC.
    if (quando === "subito") {
      corpo.set("quando", "subito");
    } else if (quando === "data") {
      if (!dataOra) {
        setErrore("Scegli data e ora, oppure passa a Subito o In coda");
        return;
      }
      corpo.set("quando", new Date(dataOra).toISOString());
    }

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
          <label className="text-sm font-medium">Descrizione</label>
          <textarea
            name="descrizione"
            rows={2}
            placeholder="Una riga sul modello: cosa fa, come si muove, cos'è stato difficile"
            className={INPUT}
            onInput={chiediAnteprima}
          />
          <p className="text-xs text-muted">
            Finisce sotto il titolo. Se preferisci, lasciala vuota e scrivi
            direttamente nella caption qui sotto: quella comanda.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Link al modello</label>
          <input name="link" placeholder="https://makerworld.com/..." className={INPUT} />
        </div>

        <details className="rounded-lg border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted">
            Righe della scheda ({RICORDATI.filter((c) => inclusi[c]).length} su{" "}
            {RICORDATI.length})
          </summary>
          <div className="mt-3 space-y-3">
            {RICORDATI.map((chiave) => (
              <div key={chiave} className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={inclusi[chiave] ?? true}
                    onChange={(e) => {
                      const agg = { ...inclusi, [chiave]: e.target.checked };
                      setInclusi(agg);
                      localStorage.setItem(INCLUSI, JSON.stringify(agg));
                    }}
                    className="h-4 w-4 accent-accent"
                  />
                  {ETICHETTE[chiave]}
                </label>
                <input
                  name={chiave}
                  list={`suggerimenti-${chiave}`}
                  disabled={!(inclusi[chiave] ?? true)}
                  placeholder={
                    chiave === "extra"
                      ? "Una riga in più, con la sua emoji: 🔩 Nozzle: 0.4 mm"
                      : undefined
                  }
                  onChange={chiediAnteprima}
                  className={`${INPUT} disabled:opacity-40`}
                />
                <datalist id={`suggerimenti-${chiave}`}>
                  {[...(rubrica[chiave] || []), ...marchi].map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
            ))}
            <p className="text-xs text-muted">
              La spunta decide se la riga esce nella caption: toglierla la fa
              sparire davvero, senza far ricomparire il valore di default. I
              valori restano memorizzati su questo dispositivo e si ripresentano
              già compilati la prossima volta, spunta compresa. Scrivendo
              compaiono i valori già usati e i marchi che tagghi più spesso:
              Instagram non permette di cercare i profili da fuori, quindi la
              rubrica è l&apos;unico modo per non sbagliare una menzione a
              memoria.
            </p>
          </div>
        </details>

        <div className="space-y-2 rounded-lg border border-border px-3 py-2.5">
          <span className="text-sm font-medium">Quando</span>
          <div className="flex gap-1">
            {(
              [
                ["subito", "Subito"],
                ["data", "Data e ora"],
                ["coda", "In coda"],
              ] as const
            ).map(([valore, etichetta]) => (
              <button
                key={valore}
                type="button"
                onClick={() => setQuando(valore)}
                className={
                  quando === valore
                    ? "flex-1 rounded border border-accent/40 bg-accent/10 px-2 py-1.5 text-xs text-foreground"
                    : "flex-1 rounded border border-border px-2 py-1.5 text-xs text-muted hover:text-foreground"
                }
              >
                {etichetta}
              </button>
            ))}
          </div>

          {quando === "data" && (
            <input
              type="datetime-local"
              value={dataOra}
              onChange={(e) => setDataOra(e.target.value)}
              className={INPUT}
            />
          )}

          <p className="text-xs text-muted">
            {quando === "coda"
              ? "Ogni canale prende il primo slot libero della sua programmazione Buffer, quindi i tre post escono a orari diversi."
              : "Stessa ora su Instagram, TikTok e YouTube."}
          </p>
        </div>

        <button
          type="submit"
          disabled={lavorando}
          className="w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {lavorando ? "In corso…" : quando === "subito" ? "Pubblica ora" : "Pubblica"}
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
          <textarea
            value={riscritte[canale] ?? anteprima[canale] ?? ""}
            onChange={(e) =>
              setRiscritte({ ...riscritte, [canale]: e.target.value })
            }
            rows={14}
            spellCheck={false}
            className={`${INPUT} font-mono text-[13px] leading-snug`}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {canale === "IG"
                ? "La parola chiave compare solo qui: è questo commento che fa partire il DM."
                : canale === "YT"
                  ? "Su YouTube la prima riga diventa il titolo del video: se la riscrivi, tienila come titolo."
                  : "Qui la parola chiave non c'è: chi commenta su questo canale non riceverebbe nulla."}
            </p>
            {riscritte[canale] !== undefined && (
              <button
                type="button"
                onClick={() => {
                  const resto = { ...riscritte };
                  delete resto[canale];
                  setRiscritte(resto);
                }}
                className="shrink-0 rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
              >
                Rigenera
              </button>
            )}
          </div>
          {riscritte[canale] !== undefined && (
            <p className="text-xs text-accent">
              Scritta a mano: da qui in poi i campi qui sopra non la toccano più.
            </p>
          )}
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
          <p className="text-xs text-muted">
            Resta su questa schermata finché la barra non è piena: il
            caricamento è l&apos;unico passo che non si può riprendere. Dopo,
            il lavoro prosegue sul server e puoi tornare quando vuoi.
          </p>
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
