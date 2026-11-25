import { AUSGANG_INFO, type Ausgang, type AusgangAlt, type Einsatz } from './types';

/**
 * Ergebnisse aus Version 1.4.0 bis 1.6.0, die es heute nicht mehr zur Auswahl gibt. Sie bleiben gespeichert und
 * zählen weiter in der Statistik, werden aber in Liste und Einsatz markiert („Ergebnis prüfen“), damit du sie
 * genauer erfasst: Ob der Patient mit oder ohne NA transportiert wurde, ob ein Tod an der Einsatzstelle eintrat usw.
 */
export const AUSGANG_ALT_INFO: Record<AusgangAlt, { kurz: string; hinweis: string }> = {
  transport: { kurz: 'Transport', hinweis: 'Das Ergebnis „Transport“ gibt es nicht mehr. Wähle „Transport mit NA“ oder „Transport ohne NA“.' },
  ambulant: { kurz: 'Ambulant versorgt', hinweis: 'Das Ergebnis „Ambulant versorgt“ gibt es nicht mehr. Wähle „Ambulant NA“ oder „Ambulant RTW“.' },
  verstorben: { kurz: 'Verstorben', hinweis: 'Das Ergebnis „Verstorben“ gibt es nicht mehr. Wähle „Tod an Einsatzstelle“ oder „Tod aufgefunden“.' },
  transportdienst: { kurz: 'Nur Transport', hinweis: 'Das Ergebnis „Nur Transport“ gibt es nicht mehr. Wähle das passende Ergebnis, z. B. „Transport ohne NA“ oder „Sonstige Hilfeleistung“.' },
};

export const istAusgangAlt = (a: unknown): a is AusgangAlt => typeof a === 'string' && Object.prototype.hasOwnProperty.call(AUSGANG_ALT_INFO, a);

/** Gilt für neue und alte Ergebnisse. */
export function ausgangName(a: Ausgang | AusgangAlt): string {
  return istAusgangAlt(a) ? AUSGANG_ALT_INFO[a].kurz : AUSGANG_INFO[a].kurz;
}

/**
 * „Lehnt ab“ heißt jetzt „Transportverweigerung“ und meint dasselbe, wird also ohne Rückfrage umbenannt. Alles andere
 * bleibt, wie es ist.
 */
export function migriereAusgang<T extends { ausgang?: string }>(e: T): T {
  return e.ausgang === 'abgelehnt' ? { ...e, ausgang: 'verweigerung' } : e;
}

/**
 * Was am Ergebnis eines Rettungsdiensteinsatzes zu prüfen ist, oder `null`. Berechnet aus den gespeicherten Daten:
 * Ein veraltetes Ergebnis oder eine Hilfeleistung ohne Stichwort, für die es jetzt genauere Angaben gibt.
 * Neue Änderungen an Ergebnissen, die die Statistik betreffen, kommen hier dazu.
 */
export function ergebnisHinweis(e: Pick<Einsatz, 'ausgang' | 'hilfeleistungId'>): string | null {
  if (e.ausgang && istAusgangAlt(e.ausgang)) return AUSGANG_ALT_INFO[e.ausgang].hinweis;
  if (e.ausgang === 'hilfeleistung' && e.hilfeleistungId == null) return 'Bei „Sonstige Hilfeleistung“ fehlt das Stichwort, z. B. Tragehilfe.';
  return null;
}
