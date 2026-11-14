import { describe, expect, it } from 'vitest';
import {
  datumVorTagen,
  endeNachDauer,
  fmtDauer,
  fmtSaldo,
  fmtZeit,
  maskUhrzeit,
  minutenZwischen,
  naechsteUhrzeit,
  normalisiereUhrzeit,
  parseUhrzeit,
  regelUhrzeit,
  uhrzeitImFenster,
  uhrzeitNahe,
  zeitpunkt,
} from '../src/domain/time';

const t = (datum: string, h: number, m: number) => zeitpunkt(datum, h, m);

describe('Uhrzeit-Eingabe', () => {
  it('versteht verschiedene Schreibweisen', () => {
    expect(parseUhrzeit('7')).toEqual({ h: 7, m: 0 });
    expect(parseUhrzeit('743')).toEqual({ h: 7, m: 43 });
    expect(parseUhrzeit('07:43')).toEqual({ h: 7, m: 43 });
    expect(parseUhrzeit('1830')).toEqual({ h: 18, m: 30 });
    expect(parseUhrzeit('00:05')).toEqual({ h: 0, m: 5 });
  });
  it('lehnt Unsinn ab', () => {
    expect(parseUhrzeit('')).toBeNull();
    expect(parseUhrzeit('2460')).toBeNull();
    expect(parseUhrzeit('25:00')).toBeNull();
    expect(parseUhrzeit('12:75')).toBeNull();
    expect(parseUhrzeit('12345')).toBeNull();
  });
  it('maskiert und normalisiert', () => {
    expect(maskUhrzeit('1')).toBe('1');
    expect(maskUhrzeit('143')).toBe('1:43');
    expect(maskUhrzeit('1430')).toBe('14:30');
    expect(maskUhrzeit('14:30 uhr')).toBe('14:30');
    expect(normalisiereUhrzeit('743')).toBe('07:43');
    expect(normalisiereUhrzeit('x')).toBe('x');
  });
});

describe('Zeitpunkte über Mitternacht', () => {
  it('findet Status 1 nach Mitternacht am Folgetag', () => {
    const alarm = t('2026-11-14', 23, 40);
    const s1 = naechsteUhrzeit(0, 25, alarm, false);
    expect(minutenZwischen(alarm, s1)).toBe(45);
    expect(fmtZeit(s1)).toBe('00:25');
  });
  it('bleibt am selben Tag, wenn die Zeit später liegt', () => {
    const alarm = t('2026-11-14', 10, 0);
    expect(minutenZwischen(alarm, naechsteUhrzeit(10, 30, alarm, false))).toBe(30);
  });
  it('strikt: gleiche Uhrzeit springt auf den Folgetag, nicht strikt bleibt sie', () => {
    const alarm = t('2026-11-14', 10, 0);
    expect(minutenZwischen(alarm, naechsteUhrzeit(10, 0, alarm, false))).toBe(0);
    expect(minutenZwischen(alarm, naechsteUhrzeit(10, 0, alarm, true))).toBe(24 * 60);
  });
  it('findet die Alarmierung im Dienstfenster (früheste Möglichkeit)', () => {
    const beginn = t('2026-11-14', 7, 0);
    const ende = t('2026-11-15', 7, 0);
    expect(fmtZeit(uhrzeitImFenster(2, 15, beginn, ende)!)).toBe('02:15');
    expect(uhrzeitImFenster(2, 15, beginn, ende)).toBe(t('2026-11-15', 2, 15));
    expect(uhrzeitImFenster(9, 0, beginn, ende)).toBe(t('2026-11-14', 9, 0));
    expect(uhrzeitImFenster(7, 0, beginn, ende)).toBe(beginn);
  });
  it('liefert null außerhalb eines kurzen Dienstes', () => {
    const beginn = t('2026-11-14', 7, 0);
    const ende = t('2026-11-14', 19, 0);
    expect(uhrzeitImFenster(3, 0, beginn, ende)).toBeNull();
  });
});

describe('Sommerzeit', () => {
  it('24-h-Dienst am Tag der Umstellung auf Winterzeit dauert 25 Stunden', () => {
    const beginn = t('2026-10-24', 7, 0);
    const ende = endeNachDauer(beginn, 24);
    expect(ende).toBe(t('2026-10-25', 7, 0));
    expect(minutenZwischen(beginn, ende)).toBe(25 * 60);
  });
  it('Einsatz über die Umstellung nutzt absolute Zeit', () => {
    // Nacht 25.10.2026: 02:30 Sommerzeit -> 02:15 Winterzeit.
    const alarm = t('2026-10-25', 1, 50);
    const s1 = naechsteUhrzeit(2, 15, alarm, true);
    expect(minutenZwischen(alarm, s1)).toBeGreaterThanOrEqual(25);
    expect(minutenZwischen(alarm, s1)).toBeLessThanOrEqual(85);
  });
});

describe('Dauer-Anzeige', () => {
  it('formatiert Minuten und Stunden', () => {
    expect(fmtDauer(0)).toBe('0 min');
    expect(fmtDauer(47)).toBe('47 min');
    expect(fmtDauer(60)).toBe('1 h');
    expect(fmtDauer(65)).toBe('1 h 05 min');
    expect(fmtDauer(125)).toBe('2 h 05 min');
  });
});

describe('Ist-Zeiten rund um den Plan', () => {
  const sollBeginn = t('2026-11-14', 7, 30);
  const sollEnde = t('2026-11-15', 7, 30);

  it('Antritt: früher oder später am selben Tag', () => {
    expect(uhrzeitNahe(7, 10, sollBeginn)).toBe(t('2026-11-14', 7, 10));
    expect(uhrzeitNahe(8, 0, sollBeginn)).toBe(t('2026-11-14', 8, 0));
    expect(uhrzeitNahe(23, 50, sollBeginn)).toBe(t('2026-11-13', 23, 50));
  });

  it('Ende: länger geblieben oder früher abgelöst', () => {
    expect(uhrzeitNahe(7, 50, sollEnde)).toBe(t('2026-11-15', 7, 50));
    expect(uhrzeitNahe(5, 0, sollEnde)).toBe(t('2026-11-15', 5, 0));
    expect(uhrzeitNahe(19, 30, sollEnde)).toBe(t('2026-11-14', 19, 30)); // genau 12 h früher
    expect(uhrzeitNahe(20, 0, sollEnde)).toBe(t('2026-11-14', 20, 0));
    expect(uhrzeitNahe(19, 29, sollEnde)).toBe(t('2026-11-15', 19, 29));
  });

  it('formatiert Salden mit echtem Minuszeichen', () => {
    expect(fmtSaldo(0)).toBe('±0');
    expect(fmtSaldo(35)).toBe('+35 min');
    expect(fmtSaldo(65)).toBe('+1 h 05 min');
    expect(fmtSaldo(-150)).toBe('−2 h 30 min');
  });

  it('liest den üblichen Dienstbeginn', () => {
    expect(regelUhrzeit('07:30')).toEqual({ h: 7, m: 30 });
    expect(regelUhrzeit('19:30')).toEqual({ h: 19, m: 30 });
    expect(regelUhrzeit(undefined)).toEqual({ h: 7, m: 30 });
    expect(regelUhrzeit('kaputt')).toEqual({ h: 7, m: 30 });
  });
});

describe('Kalendertage', () => {
  it('Gestern ist auch an Tagen mit Zeitumstellung der Vortag', () => {
    // 29.03.2026: Umstellung auf Sommerzeit, der Tag hat nur 23 Stunden.
    expect(datumVorTagen(t('2026-03-29', 0, 30), 1)).toBe('2026-03-28');
    expect(datumVorTagen(t('2026-03-30', 0, 30), 1)).toBe('2026-03-29');
    expect(datumVorTagen(t('2026-10-26', 0, 30), 1)).toBe('2026-10-25');
    expect(datumVorTagen(t('2026-11-14', 9, 0), 0)).toBe('2026-11-14');
  });
});
