// Zeit-Helfer. Zeitstempel sind absolute Millisekunden; Uhrzeiten werden in lokaler Zeit
// (Europe/Berlin auf dem Gerät) eingegeben und angezeigt. Dauern ergeben sich aus der
// Differenz der absoluten Zeitstempel und sind damit über Mitternacht und Zeitumstellung korrekt.

export const MIN = 60_000;
export const STUNDE = 60 * MIN;

const pad = (n: number) => String(n).padStart(2, '0');

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function fmtZeit(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDatum(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** „Sa 14.11.“ */
export function fmtDatumKurz(ms: number): string {
  const d = new Date(ms);
  return `${WOCHENTAGE[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

/** „Sa 14.11., 02:15“ */
export function fmtDatumZeit(ms: number): string {
  return `${fmtDatumKurz(ms)}, ${fmtZeit(ms)}`;
}

/** 47 min, 2 h, 1 h 05 min */
export function fmtDauer(minuten: number): string {
  const m = Math.round(minuten);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${pad(r)} min`;
}

/** 12,5 h */
export function fmtStunden(minuten: number): string {
  return `${(minuten / 60).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

/** Ganze Zahl mit deutschem Tausenderpunkt. */
export function fmtZahl(n: number): string {
  return Math.round(n).toLocaleString('de-DE');
}

export function wochentagKurz(ms: number): string {
  return WOCHENTAGE[new Date(ms).getDay()];
}

/** Erlaubt „7“, „743“, „7:43“, „07.43“, „1830“. */
export function parseUhrzeit(text: string): { h: number; m: number } | null {
  const ziffern = text.replace(/\D/g, '');
  if (ziffern.length === 0 || ziffern.length > 4) return null;
  const h = ziffern.length <= 2 ? Number(ziffern) : Number(ziffern.slice(0, ziffern.length - 2));
  const m = ziffern.length <= 2 ? 0 : Number(ziffern.slice(-2));
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** Maske während der Eingabe: nur Ziffern, Doppelpunkt vor den letzten zwei Ziffern. */
export function maskUhrzeit(roh: string): string {
  const z = roh.replace(/\D/g, '').slice(0, 4);
  return z.length > 2 ? `${z.slice(0, z.length - 2)}:${z.slice(-2)}` : z;
}

/** Vollständig formatiert („7:43“ -> „07:43“), sonst unverändert. */
export function normalisiereUhrzeit(text: string): string {
  const p = parseUhrzeit(text);
  return p ? `${pad(p.h)}:${pad(p.m)}` : text;
}

/** Datum für <input type="date"> („2026-11-14“), lokal. */
export function datumInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** „JJJJ-MM-TT“ von vor `tage` Kalendertagen, unabhängig von Zeitumstellungen. */
export function datumVorTagen(ms: number, tage: number): string {
  const d = new Date(ms);
  return datumInput(new Date(d.getFullYear(), d.getMonth(), d.getDate() - tage, 12).getTime());
}

/** Lokaler Zeitpunkt aus „JJJJ-MM-TT“ und Uhrzeit. */
export function zeitpunkt(datum: string, h: number, m: number): number {
  const [j, mo, t] = datum.split('-').map(Number);
  return new Date(j, mo - 1, t, h, m, 0, 0).getTime();
}

export function tagesbeginn(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Erster Zeitpunkt ab `bezug` mit der lokalen Uhrzeit h:m.
 * `strikt`: derselbe Zeitpunkt zählt nicht (z. B. Status 1 muss nach der Alarmierung liegen).
 * Dadurch genügt die Uhrzeit, auch wenn der Einsatz über Mitternacht geht.
 */
export function naechsteUhrzeit(h: number, m: number, bezug: number, strikt: boolean): number {
  const d = new Date(bezug);
  let tag = 0;
  let t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime();
  while (strikt ? t <= bezug : t < bezug) {
    tag += 1;
    t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + tag, h, m, 0, 0).getTime();
  }
  return t;
}

/** Zeitpunkt mit der Uhrzeit h:m innerhalb [von, bis], der früheste Treffer. Sonst null. */
export function uhrzeitImFenster(h: number, m: number, von: number, bis: number): number | null {
  const start = new Date(von);
  for (let i = 0; i < 4; i++) {
    const t = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, h, m, 0, 0).getTime();
    if (t >= von && t <= bis) return t;
    if (t > bis) break;
  }
  return null;
}

/**
 * Zeitpunkt mit der Uhrzeit h:m, der höchstens 12 Stunden von `bezug` entfernt liegt (Fenster
 * [bezug − 12 h, bezug + 12 h)). So genügt für Antritt und Ende die Uhrzeit: 07:10 zum geplanten
 * Beginn 07:30 ist der gleiche Tag, 07:50 zum geplanten Ende 07:30 liegt dahinter. Bei genau
 * 12 Stunden Abstand gilt der frühere Zeitpunkt.
 */
export function uhrzeitNahe(h: number, m: number, bezug: number): number {
  const d = new Date(bezug);
  const von = bezug - 12 * STUNDE;
  const bis = bezug + 12 * STUNDE;
  let beste = bezug;
  let abstand = Infinity;
  for (let i = -1; i <= 1; i++) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i, h, m, 0, 0).getTime();
    if (t >= von && t < bis) return t;
    const a = Math.abs(t - bezug);
    if (a < abstand) {
      abstand = a;
      beste = t;
    }
  }
  return beste;
}

/** Üblicher Dienstbeginn aus „HH:MM“; ungültige Werte ergeben 07:30. */
export function regelUhrzeit(text: string | undefined): { h: number; m: number } {
  return (text ? parseUhrzeit(text) : null) ?? { h: 7, m: 30 };
}

/** „+1 h 05 min“, „−45 min“, „±0“ – mit echtem Minuszeichen. */
export function fmtSaldo(minuten: number): string {
  const m = Math.round(minuten);
  if (m === 0) return '±0';
  return `${m > 0 ? '+' : '−'}${fmtDauer(Math.abs(m))}`;
}

/** Dienstende nach `stunden` Stunden Wanduhrzeit: 24 h ab 07:00 enden am Folgetag um 07:00. */
export function endeNachDauer(beginn: number, stunden: number): number {
  const d = new Date(beginn);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + stunden, d.getMinutes(), 0, 0).getTime();
}

export function minutenZwischen(von: number, bis: number): number {
  return Math.round((bis - von) / MIN);
}
