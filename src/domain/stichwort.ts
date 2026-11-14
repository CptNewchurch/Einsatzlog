import { bereichVon, type Bereich, type Typ } from './types';

export interface TypInfo {
  typ: Typ;
  bereich: Bereich;
  /** Kurzer Klartext für die Auswahl. */
  kurz: string;
  /** Ausführliche Beschreibung für Screenreader und Hinweise. */
  lang: string;
}

export const TYP_INFO: Record<Typ, TypInfo> = {
  R: { typ: 'R', bereich: 'RD', kurz: 'RTW', lang: 'R: primärer Einsatz für den RTW' },
  N: { typ: 'N', bereich: 'RD', kurz: 'Notarzt', lang: 'N: primärer Einsatz für oder mit dem Notarzt' },
  F: { typ: 'F', bereich: 'FW', kurz: 'Feuer', lang: 'F: Feuer' },
  H: { typ: 'H', bereich: 'FW', kurz: 'Hilfe', lang: 'H: Hilfeleistung' },
  ABC: { typ: 'ABC', bereich: 'FW', kurz: 'Gefahrstoff', lang: 'ABC: atomare, biologische oder chemische Gefahren' },
};

export const BEREICH_NAME: Record<Bereich, string> = {
  RD: 'Rettungsdienst',
  FW: 'Feuerwehr',
};

/** Initial alarmierter Kräfteansatz, z. B. R1N0 oder R1N1. */
export function kraefteText(rtw: number, nef: number): string {
  return `R${rtw}N${nef}`;
}

/** Vorbelegung des Kräfteansatzes je Typ; Feuerwehr-Typen haben keinen. */
export function standardKraefte(typ: Typ): { rtw: number; nef: number } | null {
  if (typ === 'R') return { rtw: 1, nef: 0 };
  if (typ === 'N') return { rtw: 1, nef: 1 };
  return null;
}

/** „R-Chirurgisch“, „N-Internistisch“, „F-Gebäude MIG“, „H-P-Tür“. */
export function stichwortText(typ: Typ, kategorie: string, mig?: boolean): string {
  return `${typ}-${kategorie}${typ === 'F' && mig ? ' MIG' : ''}`;
}

export { bereichVon };
