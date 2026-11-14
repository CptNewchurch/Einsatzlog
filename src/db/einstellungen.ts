import { db } from './db';
import { STANDARD_EINSTELLUNGEN, type Einstellungen } from '../domain/types';

const KEY = 'einstellungen';
export const THEME_SCHLUESSEL = 'einsatzlog.theme';

export function mergeEinstellungen(roh: unknown): Einstellungen {
  const gespeichert = roh && typeof roh === 'object' ? (roh as Partial<Einstellungen>) : {};
  return { ...STANDARD_EINSTELLUNGEN, ...gespeichert };
}

export async function ladeEinstellungen(): Promise<Einstellungen> {
  const e = await db.meta.get(KEY);
  return mergeEinstellungen(e?.value);
}

export async function speichereEinstellungen(patch: Partial<Einstellungen>): Promise<Einstellungen> {
  const neu = await db.transaction('rw', db.meta, async () => {
    const aktuell = mergeEinstellungen((await db.meta.get(KEY))?.value);
    const n = { ...aktuell, ...patch };
    await db.meta.put({ key: KEY, value: n });
    return n;
  });
  spiegleTheme(neu.theme);
  return neu;
}

/** Das Farbschema liegt zusätzlich im localStorage, damit es vor dem ersten Zeichnen bekannt ist. */
export function spiegleTheme(theme: string): void {
  try {
    localStorage.setItem(THEME_SCHLUESSEL, theme);
  } catch {
    /* Speicher nicht verfügbar – dann gilt beim Start das Systemschema. */
  }
}
