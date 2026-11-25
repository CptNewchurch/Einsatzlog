import { describe, expect, it } from 'vitest';
import { bewertungVon, bewertungVorschlag } from '../src/domain/triage';
import { berechneTriage, transportZahlen } from '../src/domain/triageStats';
import { zeitpunkt } from '../src/domain/time';
import { AUSGAENGE_RD, AUSGANG_INFO, ausgangBrauchtNotarzt, type Ausgang, type Einsatz, type KatalogEintrag } from '../src/domain/types';
import { AUSGANG_ALT_INFO, ergebnisHinweis, istAusgangAlt, migriereAusgang } from '../src/domain/ausgangMigration';

const katalog = new Map<number, KatalogEintrag>([[1, { id: 1, typ: 'kategorie', name: 'Internistisch', aktiv: true }]]);

let zaehler = 0;
function einsatz(rest: Partial<Einsatz>): Einsatz {
  zaehler += 1;
  const alarm = zeitpunkt('2026-11-14', 8, 0) + zaehler * 3_600_000;
  return { id: zaehler, dienstId: 1, typ: 'N', kategorieId: 1, alarm, status1: alarm + 30 * 60_000, ...rest };
}

const mit: Ausgang = 'transportMitNotarzt';
const ohne: Ausgang = 'transportOhneNotarzt';

describe('Ergebnisse im Rettungsdienst', () => {
  it('Auswahl und Beschreibung führen dieselben Ergebnisse in derselben Reihenfolge', () => {
    // Das Formular folgt AUSGAENGE_RD, die Statistik sortiert ihre Zeilen nach AUSGANG_INFO.
    expect(Object.keys(AUSGANG_INFO)).toEqual([...AUSGAENGE_RD]);
  });

  it('die Auswahl hat genau die gewünschten Ergebnisse in dieser Reihenfolge', () => {
    expect(AUSGAENGE_RD.map((a) => AUSGANG_INFO[a].kurz)).toEqual([
      'Transport mit NA',
      'Transport ohne NA',
      'Ambulant NA',
      'Ambulant RTW',
      'Transportverweigerung',
      'Fehleinsatz',
      'Tod an Einsatzstelle',
      'Tod aufgefunden',
      'Sonstige Hilfeleistung',
    ]);
  });

  it('jedes Ergebnis hat eine eigene Bezeichnung, auch gegenüber den veralteten', () => {
    // Die Statistik ordnet ihre Zeilen über die Bezeichnung zu.
    const namen = [...AUSGAENGE_RD.map((a) => AUSGANG_INFO[a].kurz), ...Object.values(AUSGANG_ALT_INFO).map((i) => i.kurz)];
    expect(new Set(namen).size).toBe(namen.length);
  });

  it('als zu hohe Alarmierung zählt nur die sonstige Hilfeleistung, dazu das alte „Nur Transport“', () => {
    expect(AUSGAENGE_RD.filter((a) => AUSGANG_INFO[a].uebertriage)).toEqual(['hilfeleistung']);
    expect(bewertungVon({ ausgang: 'transportdienst' })).toBe('hoch');
  });

  it('einen Notarzt vor Ort setzen nur Transport mit NA und Ambulant NA voraus', () => {
    expect(AUSGAENGE_RD.filter(ausgangBrauchtNotarzt)).toEqual([mit, 'ambulantNotarzt']);
    expect(ausgangBrauchtNotarzt(ohne)).toBe(false);
    expect(ausgangBrauchtNotarzt('ambulantRtw')).toBe(false);
    expect(ausgangBrauchtNotarzt('transport')).toBe(false);
    expect(ausgangBrauchtNotarzt(null)).toBe(false);
    expect(ausgangBrauchtNotarzt(undefined)).toBe(false);
  });

  it('Transport und ambulante Versorgung ändern die Bewertung der Alarmierung nicht', () => {
    for (const a of ['transportMitNotarzt', 'transportOhneNotarzt', 'ambulantNotarzt', 'ambulantRtw', 'todEinsatzstelle', 'todAufgefunden', 'verweigerung'] as const) {
      expect(bewertungVon({ ausgang: a })).toBeNull();
      expect(bewertungVorschlag({ typ: 'N', naca: 4, ausgang: a })).toBeNull();
      expect(bewertungVon({ ausgang: a, alarmBewertung: 'passend' })).toBe('passend');
    }
  });
});

describe('Veraltete Ergebnisse werden zur Prüfung markiert', () => {
  it('„Lehnt ab“ heißt jetzt „Transportverweigerung“ und wird ohne Rückfrage umbenannt', () => {
    expect(migriereAusgang({ ausgang: 'abgelehnt' }).ausgang).toBe('verweigerung');
    expect(ergebnisHinweis({ ausgang: migriereAusgang({ ausgang: 'abgelehnt' }).ausgang as Ausgang })).toBeNull();
  });

  it('andere Ergebnisse bleiben unverändert', () => {
    for (const a of [...AUSGAENGE_RD, 'transport', 'ambulant', 'verstorben', 'transportdienst']) {
      expect(migriereAusgang({ ausgang: a }).ausgang).toBe(a);
    }
    expect(migriereAusgang<{ ausgang?: string }>({}).ausgang).toBeUndefined();
  });

  it.each(['transport', 'ambulant', 'verstorben', 'transportdienst'] as const)('„%s“ wird erkannt und mit Hinweis markiert', (alt) => {
    expect(istAusgangAlt(alt)).toBe(true);
    expect(ergebnisHinweis({ ausgang: alt })).toBe(AUSGANG_ALT_INFO[alt].hinweis);
  });

  it('die Hinweise nennen die heutigen Bezeichnungen', () => {
    expect(AUSGANG_ALT_INFO.transport.hinweis).toContain(`„${AUSGANG_INFO.transportMitNotarzt.kurz}“`);
    expect(AUSGANG_ALT_INFO.transport.hinweis).toContain(`„${AUSGANG_INFO.transportOhneNotarzt.kurz}“`);
    expect(AUSGANG_ALT_INFO.ambulant.hinweis).toContain(`„${AUSGANG_INFO.ambulantNotarzt.kurz}“`);
    expect(AUSGANG_ALT_INFO.ambulant.hinweis).toContain(`„${AUSGANG_INFO.ambulantRtw.kurz}“`);
    expect(AUSGANG_ALT_INFO.verstorben.hinweis).toContain(`„${AUSGANG_INFO.todEinsatzstelle.kurz}“`);
    expect(AUSGANG_ALT_INFO.verstorben.hinweis).toContain(`„${AUSGANG_INFO.todAufgefunden.kurz}“`);
  });

  it('aktuelle Ergebnisse brauchen keine Prüfung, eine Hilfeleistung ohne Stichwort schon', () => {
    for (const a of AUSGAENGE_RD.filter((x) => x !== 'hilfeleistung')) expect(ergebnisHinweis({ ausgang: a })).toBeNull();
    expect(ergebnisHinweis({})).toBeNull();
    expect(ergebnisHinweis({ ausgang: 'hilfeleistung' })).toMatch(/Stichwort/);
    expect(ergebnisHinweis({ ausgang: 'hilfeleistung', hilfeleistungId: 3 })).toBeNull();
  });
});

describe('Auswertung der Ergebnisse', () => {
  const liste: Einsatz[] = [
    einsatz({ typ: 'N', ausgang: mit, notarztVorOrt: true, naca: 5 }),
    einsatz({ typ: 'N', ausgang: mit, notarztVorOrt: true, naca: 4 }),
    einsatz({ typ: 'N', ausgang: ohne, notarztVorOrt: true, naca: 4 }),
    einsatz({ typ: 'R', ausgang: ohne }),
    einsatz({ typ: 'N', ausgang: 'ambulantNotarzt', notarztVorOrt: true, naca: 2 }),
    einsatz({ typ: 'R', ausgang: 'ambulantRtw', naca: 1 }),
    einsatz({ typ: 'R', ausgang: 'ambulantRtw', naca: 1 }),
    einsatz({ typ: 'R', ausgang: 'verweigerung' }),
    einsatz({ typ: 'N', ausgang: 'todEinsatzstelle', notarztVorOrt: true }),
    einsatz({ typ: 'R', ausgang: 'todAufgefunden' }),
    einsatz({ typ: 'R', ausgang: 'hilfeleistung', hilfeleistungId: 10 }),
    einsatz({ typ: 'R', ausgang: 'hilfeleistung', hilfeleistungId: 10 }),
    einsatz({ typ: 'R', ausgang: 'hilfeleistung', hilfeleistungId: 11 }),
    einsatz({ typ: 'R', ausgang: 'hilfeleistung' }),
    einsatz({ typ: 'R' }),
    einsatz({ typ: 'F', ausgang: 'fehleinsatz' }),
  ];
  const kat = new Map<number, KatalogEintrag>([
    ...katalog,
    [10, { id: 10, typ: 'hilfeleistung', name: 'Tragehilfe', aktiv: true }],
    [11, { id: 11, typ: 'hilfeleistung', name: 'Türöffnung', aktiv: true }],
  ]);
  const t = berechneTriage(liste, kat);
  const n = (a: Ausgang | null) => t.ergebnis.find((e) => e.ausgang === a)?.n;

  it('zählt jedes Ergebnis getrennt', () => {
    expect(n(mit)).toBe(2);
    expect(n(ohne)).toBe(2);
    expect(n('ambulantNotarzt')).toBe(1);
    expect(n('ambulantRtw')).toBe(2);
    expect(n('verweigerung')).toBe(1);
    expect(n('todEinsatzstelle')).toBe(1);
    expect(n('todAufgefunden')).toBe(1);
    expect(n('hilfeleistung')).toBe(4);
    expect(n(null)).toBe(1);
  });

  it('die Summe über alle Ergebnisse ergibt die Rettungsdiensteinsätze', () => {
    expect(t.rd).toBe(15);
    expect(t.ergebnisErfasst).toBe(14);
    expect(t.ergebnis.reduce((summe, e) => summe + e.n, 0)).toBe(t.rd);
  });

  it('führt neue Ergebnisse auch ohne passende Einsätze mit 0', () => {
    const leer = berechneTriage([einsatz({ typ: 'R', ausgang: ohne })], kat);
    for (const a of AUSGAENGE_RD.filter((x) => x !== ohne)) expect(leer.ergebnis.find((e) => e.ausgang === a)).toEqual({ ausgang: a, n: 0 });
  });

  it('Transport, ambulante Versorgung und Tod werden getrennt zusammengefasst', () => {
    expect(transportZahlen(t.ergebnis)).toEqual({ gesamt: 4, mitNa: 2, ohneNa: 2, ambulant: 3, ambulantNa: 1, ambulantRtw: 2, tod: 2 });
    expect(transportZahlen([])).toEqual({ gesamt: 0, mitNa: 0, ohneNa: 0, ambulant: 0, ambulantNa: 0, ambulantRtw: 0, tod: 0 });
  });

  it('die sonstigen Hilfeleistungen stehen nach Stichwort, häufigste zuerst, ohne Stichwort getrennt', () => {
    expect(t.hilfeleistungen).toEqual([
      { name: 'Tragehilfe', n: 2 },
      { name: 'Ohne Stichwort', n: 1 },
      { name: 'Türöffnung', n: 1 },
    ]);
  });

  it('die Hilfeleistung zählt als zu hohe Alarmierung, der Rest ändert die Bewertung nicht', () => {
    expect(t.bewertung).toEqual({ passend: 0, hoch: 4, niedrig: 0 });
  });

  it('zählt Einsätze mit zu prüfendem Ergebnis: veraltet oder Hilfeleistung ohne Stichwort', () => {
    expect(t.ergebnisPruefen).toBe(1);
    const alt = berechneTriage(
      [einsatz({ typ: 'R', ausgang: 'transport' }), einsatz({ typ: 'R', ausgang: 'verstorben' }), einsatz({ typ: 'N', ausgang: 'ambulant', notarztVorOrt: true }), einsatz({ typ: 'R', ausgang: 'transportdienst' })],
      kat,
    );
    expect(alt.ergebnisPruefen).toBe(4);
  });

  it('veraltete Ergebnisse zählen in ihrer groben Gruppe mit, bis sie genauer erfasst sind', () => {
    const alt = berechneTriage(
      [einsatz({ typ: 'R', ausgang: 'transport' }), einsatz({ typ: 'R', ausgang: ohne }), einsatz({ typ: 'R', ausgang: 'verstorben' }), einsatz({ typ: 'R', ausgang: 'ambulant' })],
      kat,
    );
    expect(transportZahlen(alt.ergebnis)).toMatchObject({ gesamt: 2, mitNa: 0, ohneNa: 1, ambulant: 1, tod: 1 });
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
