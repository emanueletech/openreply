/**
 * Defaults the app fills in when a campaign leaves a field empty.
 *
 * They live here rather than inline because the same value is needed by the
 * builder, the preview and the worker: three copies drifted apart, and a
 * follower ended up with an English follow gate carrying an Italian button.
 *
 * English on purpose: the ready-made phrases in lib/frasi-pronte.ts are
 * English too, so message and button now speak the same language.
 */
export const DEFAULT_FOLLOW_BUTTON_LABEL = "I'm following";
