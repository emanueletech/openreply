/**
 * Modelli preimpostati per le righe della scheda.
 *
 * Nascono come righe di `config.txt` nel servizio di pubblicazione e arrivano
 * alla pagina assieme ai valori di default:
 *
 *   preset_<gruppo>_<nome>: <etichetta> | campo=valore | campo=valore
 *
 * `gruppo` è il campo su cui compaiono i pulsanti (`stampante`, `filamento`,
 * `plate`); un preset può però riempire **più** campi, ed è il motivo per cui
 * esiste: l'hashtag del marchio e la sua menzione sono la stessa scelta, e
 * tenerli separati è il modo di pubblicare un post con la U1 e `#bambulab`.
 *
 * `hashtag` è l'unico campo virtuale: non è una riga della scheda, lo somma la
 * pagina in `hashtag_extra` tenendo separato il contributo di ogni gruppo.
 *
 * Perché i preset stanno nel servizio e non qui: `caption.py` e `config.txt`
 * sono l'unico posto dove vive la forma della caption, e un valore scritto in
 * due posti prima o poi diverge.
 */

export interface Preset {
  /** `preset_stampante_u1`: identifica il pulsante acceso. */
  id: string;
  /** Il nome sul pulsante: «U1», «H2C». */
  etichetta: string;
  /** Campi della scheda da riempire, più l'eventuale `hashtag`. */
  campi: Record<string, string>;
}

const PREFISSO = "preset_";

/** Una menzione da sola chiede di scrivere il resto: `@esun3dprinting PLA`. */
function daCompletare(valore: string): boolean {
  return /^@[\w.]+$/.test(valore);
}

/**
 * Il testo da mettere nel campo. Lo spazio dopo una menzione nuda non è un
 * vezzo: `config.txt` passa da `strip()`, quindi senza di esso il materiale
 * digitato subito dopo si attaccherebbe all'handle e la menzione non esisterebbe
 * più.
 */
export function valoreDaScrivere(valore: string): string {
  return daCompletare(valore) ? `${valore} ` : valore;
}

/**
 * Quali preset corrispondono a ciò che i campi contengono già.
 *
 * Serve quando i valori tornano dalla memoria del dispositivo: senza questo la
 * stampante si ripresenterebbe compilata ma senza l'hashtag del suo marchio,
 * che è l'unica cosa che il preset tiene insieme al valore.
 */
export function riconosciPreset(
  gruppi: Record<string, Preset[]>,
  valoreDi: (campo: string) => string
): { attivi: Record<string, string>; hashtag: Record<string, string> } {
  const attivi: Record<string, string> = {};
  const hashtag: Record<string, string> = {};

  for (const [gruppo, lista] of Object.entries(gruppi)) {
    const valore = valoreDi(gruppo).trim();
    if (!valore) continue;
    const trovato = lista.find((p) => (p.campi[gruppo] ?? "").trim() === valore);
    if (!trovato) continue;
    attivi[gruppo] = trovato.id;
    if (trovato.campi.hashtag) hashtag[gruppo] = trovato.campi.hashtag;
  }

  return { attivi, hashtag };
}

/** `{ stampante: [H2C, U1], filamento: [...] }`, nell'ordine di config.txt. */
export function leggiPreset(
  config: Record<string, unknown>
): Record<string, Preset[]> {
  const gruppi: Record<string, Preset[]> = {};

  for (const [chiave, valore] of Object.entries(config)) {
    if (!chiave.startsWith(PREFISSO) || typeof valore !== "string") continue;

    const resto = chiave.slice(PREFISSO.length);
    const taglio = resto.indexOf("_");
    // Il gruppo è il nome di un campo della scheda, che non ha underscore: il
    // resto della chiave è il nome del preset e serve solo a distinguerlo.
    if (taglio <= 0 || taglio === resto.length - 1) continue;
    const gruppo = resto.slice(0, taglio);

    const parti = valore.split("|").map((p) => p.trim());
    const etichetta = parti.shift() ?? "";
    if (!etichetta) continue;

    const campi: Record<string, string> = {};
    for (const parte of parti) {
      const uguale = parte.indexOf("=");
      if (uguale <= 0) continue;
      const nome = parte.slice(0, uguale).trim();
      if (nome) campi[nome] = parte.slice(uguale + 1).trim();
    }
    // Un preset che non riempie niente sarebbe un pulsante che non fa niente.
    if (Object.keys(campi).length === 0) continue;

    (gruppi[gruppo] ??= []).push({ id: chiave, etichetta, campi });
  }

  return gruppi;
}
