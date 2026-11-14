// Suche nach einer neuen App-Version. Den Service Worker gibt es nur im gebauten Stand, in der Entwicklung nicht.

let registrierung: ServiceWorkerRegistration | undefined;
let letztePruefung = 0;
let lauscht = false;

export type UpdateErgebnis =
  /** Eine neue Version wird geladen; danach erscheint der Hinweis zum Aktualisieren. */
  | 'neu'
  | 'aktuell'
  | 'offline'
  /** Es gibt keinen Service Worker, z. B. in der Entwicklung. */
  | 'nicht-moeglich';

/** Sucht nach einer neuen Version. Mit Mindestabstand wird eine zu junge Suche übersprungen. */
export async function suchePruefeUpdate(mindestAbstandMs = 0): Promise<UpdateErgebnis> {
  if (!registrierung) return 'nicht-moeglich';
  if (mindestAbstandMs > 0 && Date.now() - letztePruefung < mindestAbstandMs) return 'aktuell';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  letztePruefung = Date.now();
  try {
    await registrierung.update();
  } catch {
    // Ohne Netz oder bei einem Serverfehler bleibt es bei der installierten Version.
    return 'offline';
  }
  return registrierung.installing || registrierung.waiting ? 'neu' : 'aktuell';
}

/**
 * Merkt sich die Registrierung. Ab dann sucht die App nach einer neuen Version, sobald du zu ihr zurückkehrst
 * (höchstens alle zehn Minuten). Der Browser prüft nicht von sich aus oft genug, wenn die App lange im Hintergrund liegt.
 */
export function merkeRegistrierung(r: ServiceWorkerRegistration): void {
  registrierung = r;
  if (lauscht) return;
  lauscht = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void suchePruefeUpdate(10 * 60_000);
  });
}
