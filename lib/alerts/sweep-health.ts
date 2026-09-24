/**
 * Quando un comment sweep fallito merita una notifica.
 *
 * Il reconciler scrive un evento per campagna, quindi un solo giro andato a
 * vuoto — tipicamente un `fetch failed` verso Meta, cioè la rete del NAS per
 * qualche secondo — produce una raffica di WARNING per un guasto che al giro
 * dopo non esiste più. Notificarli tutti insegna a ignorare il canale, che è
 * il contrario di quello che serve quando il guasto è vero.
 */

/** Il prefisso con cui il reconciler apre ogni riga di sweep. */
export const SWEEP_MESSAGE_PREFIX = 'Comment sweep "';

/**
 * Vero solo se gli errori coprono più di un giro di sweep: due eventi distanti
 * almeno `persistMs` non possono venire dallo stesso passaggio del worker.
 */
export function sweepFailurePersists(
  timestamps: Date[],
  persistMs: number
): boolean {
  if (timestamps.length < 2) return false;
  const times = timestamps.map((d) => d.getTime()).sort((a, b) => a - b);
  return times[times.length - 1] - times[0] >= persistMs;
}
