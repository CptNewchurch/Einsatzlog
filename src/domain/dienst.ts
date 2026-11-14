import { endeNachDauer, fmtZeit, parseUhrzeit, regelUhrzeit, STUNDE, uhrzeitNahe, zeitpunkt } from './time';
import type { Dienst } from './types';

// Aus den Eingaben des Dienstformulars werden geplante (Soll) und tatsächliche (Ist) Zeiten.
// Soll: Datum, Beginn-Uhrzeit und Dauer. Ist: nur wenn du abweichst (leer = wie geplant).

export interface DienstEingabe {
  /** „JJJJ-MM-TT“ des geplanten Dienstbeginns. */
  datum: string;
  /** Geplanter Beginn als „HH:MM“. */
  beginnUhr: string;
  /** Geplante Dauer in Stunden (24, 12, …). */
  dauerStunden: number;
  /** Tatsächlicher Antritt als Uhrzeit, leer = wie geplant. */
  istBeginn: string;
  /** Tatsächliches Ende als Uhrzeit, leer = wie geplant. */
  istEnde: string;
}

export type DienstZeitFeld = 'datum' | 'beginnUhr' | 'dauer' | 'istBeginn' | 'istEnde';

export interface DienstZeiten4 {
  sollBeginn: number;
  sollEnde: number;
  beginn: number;
  ende: number;
}

export interface DienstZeitenErgebnis {
  zeiten: DienstZeiten4 | null;
  fehler: Partial<Record<DienstZeitFeld, string>>;
}

/** Längster erlaubter Dienst in Stunden. */
export const MAX_DIENST_STUNDEN = 48;

export function berechneDienstEingabe(e: DienstEingabe): DienstZeitenErgebnis {
  const fehler: DienstZeitenErgebnis['fehler'] = {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.datum)) fehler.datum = 'Datum angeben.';
  const start = parseUhrzeit(e.beginnUhr);
  if (!start) fehler.beginnUhr = 'Uhrzeit wie 07:30 eingeben.';
  if (!Number.isFinite(e.dauerStunden) || e.dauerStunden < 1 || e.dauerStunden > MAX_DIENST_STUNDEN) {
    fehler.dauer = `Dauer zwischen 1 und ${MAX_DIENST_STUNDEN} Stunden.`;
  }
  if (fehler.datum || fehler.beginnUhr || fehler.dauer || !start) return { zeiten: null, fehler };

  const sollBeginn = zeitpunkt(e.datum, start.h, start.m);
  const sollEnde = endeNachDauer(sollBeginn, e.dauerStunden);

  let beginn = sollBeginn;
  if (e.istBeginn.trim() !== '') {
    const p = parseUhrzeit(e.istBeginn);
    if (p) beginn = uhrzeitNahe(p.h, p.m, sollBeginn);
    else fehler.istBeginn = 'Uhrzeit wie 07:10 eingeben.';
  }
  let ende = sollEnde;
  if (e.istEnde.trim() !== '') {
    const p = parseUhrzeit(e.istEnde);
    if (p) ende = uhrzeitNahe(p.h, p.m, sollEnde);
    else fehler.istEnde = 'Uhrzeit wie 07:50 eingeben.';
  }
  if (fehler.istBeginn || fehler.istEnde) return { zeiten: null, fehler };

  if (ende <= beginn) {
    fehler.istEnde = 'Das Dienstende muss nach dem Dienstantritt liegen.';
    return { zeiten: null, fehler };
  }
  if (ende - beginn > MAX_DIENST_STUNDEN * STUNDE + STUNDE) {
    fehler.istEnde = `Ein Dienst dauert höchstens ${MAX_DIENST_STUNDEN} Stunden.`;
    return { zeiten: null, fehler };
  }
  return { zeiten: { sollBeginn, sollEnde, beginn, ende }, fehler };
}

/** Geplante Dauer in ganzen Stunden (Wanduhr), z. B. 24 oder 12; sonst null. */
export function sollDauerStunden(d: Pick<Dienst, 'sollBeginn' | 'sollEnde'>): number | null {
  for (let h = 1; h <= MAX_DIENST_STUNDEN; h++) {
    if (endeNachDauer(d.sollBeginn, h) === d.sollEnde) return h;
  }
  return null;
}

export type DienstArt = '24' | '12' | 'andere';

/** 24-h- und 12-h-Dienste zum üblichen Beginn sind die Standardarten, alles andere ist „andere“. */
export function dienstArt(d: Pick<Dienst, 'sollBeginn' | 'sollEnde'>, regelBeginn: string | undefined): DienstArt {
  const r = regelUhrzeit(regelBeginn);
  const b = new Date(d.sollBeginn);
  if (b.getHours() !== r.h || b.getMinutes() !== r.m) return 'andere';
  const h = sollDauerStunden(d);
  return h === 24 ? '24' : h === 12 ? '12' : 'andere';
}

/** „24 h · 07:30–07:30“ */
export function sollText(d: Pick<Dienst, 'sollBeginn' | 'sollEnde'>): string {
  const h = sollDauerStunden(d);
  const zeiten = `${fmtZeit(d.sollBeginn)}–${fmtZeit(d.sollEnde)}`;
  return h ? `${h} h · ${zeiten}` : zeiten;
}

/** Weicht die Ist-Zeit von der geplanten ab? */
export function weichtAb(d: Pick<Dienst, 'sollBeginn' | 'sollEnde' | 'beginn' | 'ende'>): boolean {
  return d.beginn !== d.sollBeginn || d.ende !== d.sollEnde;
}
