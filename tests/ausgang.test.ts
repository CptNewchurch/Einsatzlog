import { describe, expect, it } from 'vitest';
import { bewertungVon, bewertungVorschlag } from '../src/domain/triage';
import { berechneTriage, transportZahlen } from '../src/domain/triageStats';
import { zeitpunkt } from '../src/domain/time';
import { AUSGAENGE_RD, AUSGANG_INFO, ausgangBrauchtNotarzt, type Ausgang, type Einsatz, type KatalogEintrag } from '../src/domain/types';

const katalog = new Map<number, KatalogEintrag>([[1, { id: 1, typ: 'kategorie', name: 'Internistisch', aktiv: true }]]);

let zaehler = 0;
function einsatz(rest: Partial<Einsatz>): Einsatz {
  zaehler += 1;
  const alarm = zeitpunkt('2026-11-14', 8, 0) + zaehler * 3_600_000;
  return { id: zaehler, dienstId: 1, typ: 'N', kategorieId: 1, alarm, status1: alarm + 30 * 60_000, ...rest };
}

const mit: Ausgang = 'transportMitNotarzt';
const ohne: Ausgang = 'transportOhneNotarzt';
const beide: Ausgang[] = [mit, ohne];

describe('Ergebnisse im Rettungsdienst', () => {
  it('Auswahl und Beschreibung führen dieselben Ergebnisse in derselben Reihenfolge', () => {
    // Das Formular folgt AUSGAENGE_RD, die Statistik sortiert ihre Zeilen nach AUSGANG_INFO.
    expect(Object.keys(AUSGANG_INFO)).toEqual([...AUSGAENGE_RD]);
  });

  it('jedes Ergebnis hat eine eigene Bezeichnung', () => {
    // Die Statistik ordnet ihre Zeilen über die Bezeichnung zu.
    const namen = AUSGAENGE_RD.map((a) => AUSGANG_INFO[a].kurz);
    expect(new Set(namen).size).toBe(namen.length);
  });

  it('als zu hohe Alarmierung zählen nur „Nur Transport“ und Hilfeleistung', () => {
    expect(AUSGAENGE_RD.filter((a) => AUSGANG_INFO[a].uebertriage)).toEqual(['transportdienst', 'hilfeleistung']);
  });
});

describe('Ergebnisse „Transport mit NA“ und „Transport ohne NA“', () => {
  it('stehen in der Auswahl direkt hinter „Transport“ und vor „Ambulant versorgt“', () => {
    expect(AUSGAENGE_RD.slice(0, 4)).toEqual(['transport', mit, ohne, 'ambulant']);
  });

  it('heißen so und sind von Transport und ambulanter Versorgung getrennt', () => {
    expect(AUSGANG_INFO[mit].kurz).toBe('Transport mit NA');
    expect(AUSGANG_INFO[ohne].kurz).toBe('Transport ohne NA');
    for (const a of beide) {
      expect(AUSGANG_INFO[a].kurz).not.toBe(AUSGANG_INFO.transport.kurz);
      expect(AUSGANG_INFO[a].kurz).not.toBe(AUSGANG_INFO.ambulant.kurz);
    }
  });

  it('setzen einen Notarzt vor Ort voraus, kein anderes Ergebnis tut das', () => {
    expect(AUSGAENGE_RD.filter(ausgangBrauchtNotarzt)).toEqual(beide);
    expect(ausgangBrauchtNotarzt('transport')).toBe(false);
    expect(ausgangBrauchtNotarzt(null)).toBe(false);
    expect(ausgangBrauchtNotarzt(undefined)).toBe(false);
  });

  it('zählen nicht als zu hohe Alarmierung', () => {
    for (const a of beide) {
      expect(AUSGANG_INFO[a].uebertriage).toBe(false);
      expect(bewertungVon({ ausgang: a })).toBeNull();
      expect(bewertungVorschlag({ typ: 'N', naca: 4, ausgang: a })).toBeNull();
    }
  });

  it('die eigene Bewertung der Alarmierung geht auch hier vor', () => {
    for (const a of beide) expect(bewertungVon({ ausgang: a, alarmBewertung: 'passend' })).toBe('passend');
  });

  it('der Hinweis beim einfachen „Transport“ nennt beide mit ihrer aktuellen Bezeichnung', () => {
    for (const a of beide) expect(AUSGANG_INFO.transport.lang).toContain(`„${AUSGANG_INFO[a].kurz}“`);
  });
});

describe('Auswertung mit Transport mit und ohne NA', () => {
  const liste: Einsatz[] = [
    // Der Notarzt behandelt vor Ort und begleitet den Transport
    einsatz({ typ: 'N', ausgang: mit, notarztVorOrt: true, naca: 5 }),
    einsatz({ typ: 'N', ausgang: mit, notarztVorOrt: true, naca: 4 }),
    // Der Notarzt behandelt vor Ort, der Patient wird ohne ihn transportiert
    einsatz({ typ: 'N', ausgang: ohne, notarztVorOrt: true, naca: 4 }),
    einsatz({ typ: 'N', ausgang: ohne, notarztVorOrt: true, naca: 3 }),
    // Transport ganz ohne Notarzt
    einsatz({ typ: 'R', ausgang: 'transport' }),
    // Der Notarzt behandelt, der Patient wird nicht transportiert
    einsatz({ typ: 'N', ausgang: 'ambulant', notarztVorOrt: true, naca: 2 }),
    einsatz({ typ: 'R', ausgang: 'ambulant', naca: 1 }),
    einsatz({ typ: 'R' }),
    einsatz({ typ: 'F', ausgang: 'fehleinsatz' }),
  ];
  const t = berechneTriage(liste, katalog);
  const n = (a: Ausgang | null) => t.ergebnis.find((e) => e.ausgang === a)?.n;

  it('zählt sie getrennt voneinander, vom einfachen Transport und von der ambulanten Versorgung', () => {
    expect(n(mit)).toBe(2);
    expect(n(ohne)).toBe(2);
    expect(n('transport')).toBe(1);
    expect(n('ambulant')).toBe(2);
    expect(n(null)).toBe(1);
  });

  it('rechnet sie zu den erfassten Ergebnissen des Rettungsdienstes', () => {
    expect(t.rd).toBe(8);
    expect(t.ergebnisErfasst).toBe(7);
    expect(t.ergebnis.reduce((summe, e) => summe + e.n, 0)).toBe(t.rd);
  });

  it('führt sie auch ohne passende Einsätze mit 0', () => {
    const leer = berechneTriage([einsatz({ typ: 'R', ausgang: 'transport' })], katalog);
    for (const a of beide) expect(leer.ergebnis.find((e) => e.ausgang === a)).toEqual({ ausgang: a, n: 0 });
  });

  it('verschiebt die Bewertung der Alarmierung nicht', () => {
    expect(t.bewertung).toEqual({ passend: 0, hoch: 0, niedrig: 0 });
    expect(t.bewertet).toBe(0);
  });

  it('die Kennzahl „Transport“ zählt alle drei Transportarten, aber nicht die ambulante Versorgung', () => {
    expect(transportZahlen(t.ergebnis)).toEqual({ gesamt: 5, mitNa: 2, ohneNa: 2 });
  });

  it('der einfache Transport gehört zur Gesamtzahl, steht aber nicht unter „davon“', () => {
    const nur = berechneTriage([einsatz({ typ: 'R', ausgang: 'transport' }), einsatz({ typ: 'R', ausgang: 'transport' })], katalog);
    expect(transportZahlen(nur.ergebnis)).toEqual({ gesamt: 2, mitNa: 0, ohneNa: 0 });
  });

  it('ohne Transporte ist die Kennzahl 0', () => {
    const keine = berechneTriage([einsatz({ typ: 'R', ausgang: 'ambulant' })], katalog);
    expect(transportZahlen(keine.ergebnis)).toEqual({ gesamt: 0, mitNa: 0, ohneNa: 0 });
    expect(transportZahlen([])).toEqual({ gesamt: 0, mitNa: 0, ohneNa: 0 });
  });
});

describe('Bereiche', () => {
  it('statistikBereich beschränkt die Auswertung auf den genutzten Bereich', async () => {
    const { statistikBereich } = await import('../src/domain/types');
    expect(statistikBereich('beide')).toBe('alle');
    expect(statistikBereich(undefined)).toBe('alle');
    expect(statistikBereich('rd')).toBe('RD');
    expect(statistikBereich('fw')).toBe('FW');
  });

  it('Einstellungen ohne oder mit ungültigem Bereich fallen auf „beide“ zurück', async () => {
    const { mergeEinstellungen } = await import('../src/db/einstellungen');
    expect(mergeEinstellungen(undefined).bereiche).toBe('beide');
    expect(mergeEinstellungen({ bereiche: 'xyz' }).bereiche).toBe('beide');
    expect(mergeEinstellungen({ bereiche: 'fw' }).bereiche).toBe('fw');
  });
});
