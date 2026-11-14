import { AUSGANG_INFO, type AlarmBewertung, type Ausgang, type Einsatz, type Typ } from './types';

/** NACA-Score I–VII mit kurzer Erläuterung für die Auswahl. */
export const NACA_INFO: { wert: number; roemisch: string; kurz: string }[] = [
  { wert: 1, roemisch: 'I', kurz: 'Geringfügige Störung' },
  { wert: 2, roemisch: 'II', kurz: 'Leichte Störung, ambulante Abklärung' },
  { wert: 3, roemisch: 'III', kurz: 'Mäßig schwer, stationäre Behandlung' },
  { wert: 4, roemisch: 'IV', kurz: 'Schwer, Lebensgefahr möglich' },
  { wert: 5, roemisch: 'V', kurz: 'Akute Lebensgefahr' },
  { wert: 6, roemisch: 'VI', kurz: 'Reanimation' },
  { wert: 7, roemisch: 'VII', kurz: 'Tod' },
];

/** Gruppen für die Auswertung: wie schwer waren die Patienten. */
export type NacaGruppe = 'leicht' | 'maessig' | 'schwer' | 'kritisch';
export const NACA_GRUPPEN: readonly NacaGruppe[] = ['leicht', 'maessig', 'schwer', 'kritisch'];

export const NACA_GRUPPE_INFO: Record<NacaGruppe, { kurz: string; bereich: string }> = {
  leicht: { kurz: 'Leicht', bereich: 'I–II' },
  maessig: { kurz: 'Mäßig', bereich: 'III' },
  schwer: { kurz: 'Schwer', bereich: 'IV–V' },
  kritisch: { kurz: 'Kritisch', bereich: 'VI–VII' },
};

/** Ordnet einen NACA-Wert (1–7) automatisch einer Gruppe zu. */
export function nacaGruppe(naca: number): NacaGruppe {
  if (naca <= 2) return 'leicht';
  if (naca === 3) return 'maessig';
  if (naca <= 5) return 'schwer';
  return 'kritisch';
}

/** Bis NACA II (leichte Störung) ist ein Notarzt in der Regel nicht nötig. */
export const NACA_LEICHT_MAX = 2;
/** Ab NACA IV ist eine Lebensbedrohung möglich: Das spricht für einen Notarzt. */
export const NACA_NOTARZT_AB = 4;

export interface BewertungsVorschlag {
  bewertung: AlarmBewertung;
  grund: string;
}

/**
 * Schlägt aus Ergebnis, NACA und Stichwort vor, ob zu hoch oder zu niedrig alarmiert wurde.
 * Nur ein Vorschlag: Die Bewertung setzt der Anwender selbst.
 */
export function bewertungVorschlag(e: { typ: Typ; naca?: number | null; ausgang?: Ausgang | null }): BewertungsVorschlag | null {
  if (e.ausgang && AUSGANG_INFO[e.ausgang].uebertriage) {
    return {
      bewertung: 'hoch',
      grund: e.ausgang === 'transportdienst' ? 'Reiner Transport ohne Notfall.' : 'Keine medizinische Notlage.',
    };
  }
  if (e.typ === 'N' && e.naca != null && e.naca <= NACA_LEICHT_MAX) {
    return { bewertung: 'hoch', grund: 'Notarztstichwort bei NACA I–II.' };
  }
  if (e.typ === 'R' && e.naca != null && e.naca >= NACA_NOTARZT_AB) {
    return { bewertung: 'niedrig', grund: 'RTW-Stichwort, aber Lebensgefahr möglich (NACA IV–VII).' };
  }
  return null;
}

/**
 * Gilt für die Auswertung: die eigene Bewertung, sonst „zu hoch“ bei Ergebnissen,
 * die per Definition kein Rettungsmittel gebraucht hätten (Nur Transport, Hilfeleistung).
 */
export function bewertungVon(e: Pick<Einsatz, 'alarmBewertung' | 'ausgang'>): AlarmBewertung | null {
  if (e.alarmBewertung) return e.alarmBewertung;
  return e.ausgang && AUSGANG_INFO[e.ausgang].uebertriage ? 'hoch' : null;
}
