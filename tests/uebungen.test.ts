import { describe, expect, it } from 'vitest';
import { berechneStatistik, verfuegbareJahre } from '../src/domain/stats';
import { berechneUebungen, berechneUebungsMassnahmen, uebungMinuten, vorschlagAtemschutzMin, waehleUebungen } from '../src/domain/uebungen';
import { MIN, zeitpunkt } from '../src/domain/time';
import { dienstartVon, hatPlan, type Dienst, type Einsatz, type KatalogEintrag, type Uebung } from '../src/domain/types';

const T = (datum: string, h: number, m = 0) => zeitpunkt(datum, h, m);

const katalog = new Map<number, KatalogEintrag>([
  [1, { id: 1, typ: 'uebungsart', name: 'Atemschutzübung', aktiv: true, bereich: 'FW' }],
  [2, { id: 2, typ: 'uebungsart', name: 'Reanimation', aktiv: true, bereich: 'RD' }],
  [3, { id: 3, typ: 'uebungsart', name: 'Dienstsport', aktiv: true }],
]);

// Dienst 1: Regeldienst, Dienst 2: Zusatzdienst, Dienst 3: Übungsdienst von 08:00 bis 16:00 (480 min),
// Dienst 4: Übungsdienst im Vorjahr.
const dienste: Dienst[] = [
  { id: 1, sollBeginn: T('2026-11-14', 7, 30), sollEnde: T('2026-11-15', 7, 30), beginn: T('2026-11-14', 7, 30), ende: T('2026-11-15', 7, 30) },
  { id: 2, zusatzdienst: true, sollBeginn: T('2026-03-20', 18), sollEnde: T('2026-03-21', 2), beginn: T('2026-03-20', 18), ende: T('2026-03-21', 2) },
  { id: 3, uebungsdienst: true, sollBeginn: T('2026-05-09', 8), sollEnde: T('2026-05-09', 16), beginn: T('2026-05-09', 8), ende: T('2026-05-09', 16) },
  { id: 4, uebungsdienst: true, sollBeginn: T('2025-05-10', 8), sollEnde: T('2025-05-10', 12), beginn: T('2025-05-10', 8), ende: T('2025-05-10', 12) },
];

const uebungen: Uebung[] = [
  { id: 1, dienstId: 1, beginn: T('2026-11-14', 14), ende: T('2026-11-14', 15, 30), artId: 1 }, // 90 min in der Schicht
  { id: 2, dienstId: 1, beginn: T('2026-11-14', 18), ende: T('2026-11-14', 19), artId: 2 }, // 60 min in der Schicht
  { id: 3, dienstId: 2, beginn: T('2026-03-20', 19), ende: T('2026-03-20', 20), artId: 3 }, // 60 min im Zusatzdienst
  { id: 4, dienstId: 3, beginn: T('2026-05-09', 8), ende: T('2026-05-09', 11, 30), artId: 1 }, // 210 min
  { id: 5, dienstId: 3, beginn: T('2026-05-09', 12, 30), ende: T('2026-05-09', 16), artId: 3 }, // 210 min, Mittagspause bleibt offen
  { id: 6, dienstId: 4, beginn: T('2025-05-10', 8), ende: T('2025-05-10', 12), artId: 1 }, // 240 min im Vorjahr
];

const alle = { jahr: 2026, bereich: 'alle', dienstart: 'alle' } as const;

describe('Dienstart', () => {
  it('unterscheidet Regel-, Zusatz- und Übungsdienst', () => {
    expect(dienste.map(dienstartVon)).toEqual(['regel', 'zusatz', 'uebung', 'uebung']);
    expect(dienste.map(hatPlan)).toEqual([true, false, false, false]);
  });
});

describe('Übungsstatistik', () => {
  it('zählt Dauer und Anzahl, getrennt nach Schicht und Übungsdienst', () => {
    const u = berechneUebungen(dienste, uebungen, alle, katalog);
    expect(uebungMinuten(uebungen[0])).toBe(90);
    expect(u.anzahl).toBe(5);
    expect(u.inSchicht).toEqual({ anzahl: 3, minuten: 210 });
    // 420 min erfasst plus 60 min Mittagspause, die keiner Übung zugeordnet sind
    expect(u.imUebungsdienst).toEqual({ dienste: 1, anzahl: 2, minuten: 480 });
    expect(u.restMin).toBe(60);
    expect(u.minuten).toBe(210 + 480);
  });

  it('listet die Arten nach Dauer, die längste zuerst', () => {
    const u = berechneUebungen(dienste, uebungen, alle, katalog);
    expect(u.nachArt.map((a) => [a.name, a.anzahl, a.minuten])).toEqual([
      ['Atemschutzübung', 2, 300],
      ['Dienstsport', 2, 270],
      ['Reanimation', 1, 60],
    ]);
  });

  it('der Rest zählt nur ohne Bereichsfilter', () => {
    const fw = berechneUebungen(dienste, uebungen, { ...alle, bereich: 'FW' }, katalog);
    // Reanimation (RD) fällt weg, „Dienstsport“ ohne Bereich bleibt in beiden Bereichen
    expect(fw.nachArt.map((a) => a.name)).toEqual(['Atemschutzübung', 'Dienstsport']);
    expect(fw.restMin).toBe(0);
    expect(fw.imUebungsdienst.minuten).toBe(420);
    const rd = berechneUebungen(dienste, uebungen, { ...alle, bereich: 'RD' }, katalog);
    expect(rd.nachArt.map((a) => a.name)).toEqual(['Dienstsport', 'Reanimation']);
  });

  it('filtert nach Jahr und Dienstart des Dienstes', () => {
    expect(berechneUebungen(dienste, uebungen, { ...alle, jahr: 2025 }, katalog)).toMatchObject({ anzahl: 1, minuten: 240, restMin: 0 });
    expect(berechneUebungen(dienste, uebungen, { ...alle, jahr: null }, katalog).anzahl).toBe(6);

    const regel = berechneUebungen(dienste, uebungen, { ...alle, dienstart: 'regel' }, katalog);
    expect(regel).toMatchObject({ anzahl: 2, minuten: 150, restMin: 0 });
    const zusatz = berechneUebungen(dienste, uebungen, { ...alle, dienstart: 'zusatz' }, katalog);
    expect(zusatz.anzahl).toBe(1);
    const nurUebungsdienst = berechneUebungen(dienste, uebungen, { ...alle, dienstart: 'uebung' }, katalog);
    expect(nurUebungsdienst).toMatchObject({ anzahl: 2, minuten: 480, restMin: 60 });
    expect(nurUebungsdienst.inSchicht.anzahl).toBe(0);
  });

  it('ein Übungsdienst ohne erfasste Übung zählt ganz als nicht aufgeschlüsselt', () => {
    const u = berechneUebungen([dienste[2]], [], alle, katalog);
    expect(u).toMatchObject({ anzahl: 0, minuten: 480, restMin: 480 });
    expect(u.imUebungsdienst.dienste).toBe(1);
  });

  it('überlappende Übungen im Übungsdienst decken die Zeit nur einmal ab', () => {
    const doppelt: Uebung[] = [
      { id: 1, dienstId: 3, beginn: T('2026-05-09', 8), ende: T('2026-05-09', 12), artId: 1 },
      { id: 2, dienstId: 3, beginn: T('2026-05-09', 10), ende: T('2026-05-09', 14), artId: 3 },
    ];
    const u = berechneUebungen([dienste[2]], doppelt, alle, katalog);
    // Erfasst sind 8 h, abgedeckt sind aber nur 6 h (08:00–14:00); es bleiben 2 h Rest
    expect(u.restMin).toBe(120);
    expect(u.anzahl).toBe(2);
  });

  it('Einsätze im Übungsdienst zählen nicht als Übung und vergrößern den Rest nicht', () => {
    const einsatz: Einsatz = { id: 1, dienstId: 3, typ: 'H', kategorieId: 1, alarm: T('2026-05-09', 11, 30), status1: T('2026-05-09', 12), status2: T('2026-05-09', 12, 30) };
    const u = berechneUebungen(dienste, uebungen, alle, katalog, [einsatz]);
    // Von der Mittagspause (11:30–12:30) liegt alles im Einsatz einschließlich Rückfahrt
    expect(u.restMin).toBe(0);
    expect(u.imUebungsdienst.minuten).toBe(420);
  });

  it('ohne Dienst ist eine Übung nicht auswertbar', () => {
    const waise: Uebung = { id: 9, dienstId: 99, beginn: T('2026-05-09', 8), ende: T('2026-05-09', 9), artId: 1 };
    expect(waehleUebungen(dienste, [waise], alle, katalog)).toEqual([]);
  });
});

describe('Übungen in der Gesamtstatistik', () => {
  it('Übungen zählen nicht als Einsatz, ihre Zeit steht getrennt in der Zeitaufteilung', () => {
    const einsatz: Einsatz = { id: 1, dienstId: 1, typ: 'R', kategorieId: 10, kraefteRtw: 1, kraefteNef: 0, alarm: T('2026-11-14', 9), status1: T('2026-11-14', 9, 40), status2: T('2026-11-14', 9, 55) };
    const s = berechneStatistik(dienste, [einsatz], alle, true, uebungen);
    expect(s.anzahl).toBe(1);
    expect(s.dienste).toBe(3);
    // Regeldienst: 24 h = 40 min Einsatz + 15 min Rückfahrt + 150 min Übung + Rest Wache
    expect(s.zeiten.einsatzMin).toBe(40);
    expect(s.zeiten.rueckfahrtMin).toBe(15);
    // Zusatzdienst (60 min) + Regeldienst (150 min) + Übungsdienst (480 min)
    expect(s.zeiten.uebungMin).toBe(150 + 60 + 480);
    expect(s.zeiten.wacheMin).toBe(24 * 60 - 40 - 15 - 150 + (8 * 60 - 60));
    expect(s.zeiten.einsatzMin + s.zeiten.rueckfahrtMin + s.zeiten.wacheMin + s.zeiten.uebungMin).toBe(s.zeiten.dienstMin);
  });

  it('Übungsdienste haben keinen Plan und erzeugen keine Über- oder Minusstunden', () => {
    const verkuerzt: Dienst[] = [dienste[2]].map((d) => ({ ...d, ende: T('2026-05-09', 14) }));
    const s = berechneStatistik(verkuerzt, [], alle, true, []);
    expect(s.ueberstunden).toMatchObject({ plusMin: 0, minusMin: 0, saldoMin: 0 });
  });

  it('der Dienstart-Filter „uebung“ zeigt nur Übungsdienste', () => {
    const s = berechneStatistik(dienste, [], { ...alle, dienstart: 'uebung' }, true, uebungen);
    expect(s.dienste).toBe(1);
    expect(s.zeiten.dienstMin).toBe(480);
    expect(s.zeiten.uebungMin).toBe(480);
    expect(s.zeiten.wacheMin).toBe(0);
  });

  it('Jahre kommen auch aus Übungen', () => {
    expect(verfuegbareJahre([], [], [{ beginn: T('2024-01-10', 10) }])).toEqual([2024]);
  });
});

describe('Hilfsgrößen', () => {
  it('Minuten sind ganze Minuten', () => {
    expect(uebungMinuten({ beginn: 0, ende: 90 * MIN + 20_000 })).toBe(90);
  });
});

describe('Atemschutz in Übungen', () => {
  // Zwei Übungen in der Schicht (Nr. 1, 4) und eine im Vorjahr (Nr. 6) werden als Atemschutzeinsatz gewertet.
  const mitAtemschutz: Uebung[] = uebungen.map((u) =>
    u.id === 1 ? { ...u, atemschutz: true, atemschutzMin: 25 } : u.id === 4 ? { ...u, atemschutz: true, atemschutzMin: 40 } : u.id === 6 ? { ...u, atemschutz: true, atemschutzMin: 30 } : u,
  );

  it('zählt nur Übungen, die als Atemschutzeinsatz gewertet werden, mit der Zeit unter Atemschutz', () => {
    expect(berechneUebungen(dienste, uebungen, alle, katalog).atemschutz).toEqual({ anzahl: 0, minuten: 0 });
    expect(berechneUebungen(dienste, mitAtemschutz, alle, katalog).atemschutz).toEqual({ anzahl: 2, minuten: 65 });
  });

  it('folgt Jahr, Dienstart und Bereich des Filters', () => {
    expect(berechneUebungen(dienste, mitAtemschutz, { ...alle, jahr: null }, katalog).atemschutz).toEqual({ anzahl: 3, minuten: 95 });
    expect(berechneUebungen(dienste, mitAtemschutz, { ...alle, jahr: 2025 }, katalog).atemschutz).toEqual({ anzahl: 1, minuten: 30 });
    expect(berechneUebungen(dienste, mitAtemschutz, { ...alle, dienstart: 'regel' }, katalog).atemschutz).toEqual({ anzahl: 1, minuten: 25 });
    expect(berechneUebungen(dienste, mitAtemschutz, { ...alle, dienstart: 'uebung' }, katalog).atemschutz).toEqual({ anzahl: 1, minuten: 40 });
    // beide Übungen haben die Art „Atemschutzübung“ (Feuerwehr): im Bereich Rettungsdienst fallen sie weg
    expect(berechneUebungen(dienste, mitAtemschutz, { ...alle, bereich: 'RD' }, katalog).atemschutz).toEqual({ anzahl: 0, minuten: 0 });
    expect(berechneUebungen(dienste, mitAtemschutz, { ...alle, bereich: 'FW' }, katalog).atemschutz).toEqual({ anzahl: 2, minuten: 65 });
  });

  it('ohne Minutenangabe zählt die Übung, aber ohne Zeit', () => {
    const ohneMinuten = uebungen.map((u) => (u.id === 1 ? { ...u, atemschutz: true } : u));
    expect(berechneUebungen(dienste, ohneMinuten, alle, katalog).atemschutz).toEqual({ anzahl: 1, minuten: 0 });
  });

  it('schlägt höchstens 20 Minuten vor, bei kurzen Übungen deren Dauer in Fünferschritten', () => {
    expect(vorschlagAtemschutzMin(null)).toBe(20);
    expect(vorschlagAtemschutzMin(210)).toBe(20);
    expect(vorschlagAtemschutzMin(20)).toBe(20);
    expect(vorschlagAtemschutzMin(19)).toBe(15);
    expect(vorschlagAtemschutzMin(12)).toBe(10);
    expect(vorschlagAtemschutzMin(3)).toBe(5);
  });
});

describe('Maßnahmen in Übungen', () => {
  const liste = new Map<number, KatalogEintrag>([
    ...katalog,
    [10, { id: 10, typ: 'fwmassnahme', name: 'Löschangriff im Innenangriff', aktiv: true, gruppe: 'brand' }],
    [11, { id: 11, typ: 'fwmassnahme', name: 'Erkundung', aktiv: true, gruppe: 'brand' }],
    [12, { id: 12, typ: 'massnahme', name: 'i.v.-Zugang', aktiv: true, art: 'invasiv' }],
    [13, { id: 13, typ: 'massnahme', name: 'Epinephrin', aktiv: true, art: 'medikament' }],
  ]);
  const mitMassnahmen: Uebung[] = uebungen.map((u) =>
    u.id === 1
      ? { ...u, massnahmen: [{ massnahmeId: 10, anzahl: 2 }, { massnahmeId: 12, anzahl: 1 }] }
      : u.id === 2
        ? { ...u, massnahmen: [{ massnahmeId: 12, anzahl: 3 }, { massnahmeId: 13, anzahl: 1 }] }
        : u.id === 4
          ? { ...u, massnahmen: [{ massnahmeId: 10, anzahl: 1 }, { massnahmeId: 11, anzahl: 1 }] }
          : u,
  );
  const imJahr = waehleUebungen(dienste, mitMassnahmen, alle, liste);

  it('trennt Feuerwehr und Rettungsdienst und zählt Anzahl und Übungen, die häufigste zuerst', () => {
    const m = berechneUebungsMassnahmen(imJahr, liste);
    expect(m.fw.map((z) => [z.name, z.anzahl, z.uebungen])).toEqual([
      ['Löschangriff im Innenangriff', 3, 2],
      ['Erkundung', 1, 1],
    ]);
    expect(m.rd.map((z) => [z.name, z.anzahl, z.uebungen])).toEqual([
      ['i.v.-Zugang', 4, 2],
      ['Epinephrin', 1, 1],
    ]);
    expect(m.fw[0]).toMatchObject({ gruppe: 'brand' });
    expect(m.rd[0]).toMatchObject({ art: 'invasiv' });
    expect(m.summe).toEqual({ anzahl: 9, uebungen: 3, verschiedene: 4 });
  });

  it('mit Bereich zählen nur Maßnahmen aus der Liste dieses Bereichs', () => {
    const fw = berechneUebungsMassnahmen(imJahr, liste, 'FW');
    expect(fw.rd).toEqual([]);
    expect(fw.summe).toEqual({ anzahl: 4, uebungen: 2, verschiedene: 2 });
    const rd = berechneUebungsMassnahmen(imJahr, liste, 'RD');
    expect(rd.fw).toEqual([]);
    expect(rd.summe).toEqual({ anzahl: 5, uebungen: 2, verschiedene: 2 });
  });

  it('dieselbe Maßnahme mehrfach in einer Übung zählt die Übung nur einmal', () => {
    const doppelt: Uebung[] = [{ ...uebungen[0], massnahmen: [{ massnahmeId: 10, anzahl: 1 }, { massnahmeId: 10, anzahl: 2 }] }];
    const m = berechneUebungsMassnahmen(doppelt, liste);
    expect(m.fw).toEqual([{ massnahmeId: 10, name: 'Löschangriff im Innenangriff', gruppe: 'brand', anzahl: 3, uebungen: 1 }]);
    expect(m.summe).toEqual({ anzahl: 3, uebungen: 1, verschiedene: 1 });
  });

  it('Übungen ohne Maßnahmen und unbekannte Einträge stören nicht', () => {
    expect(berechneUebungsMassnahmen(uebungen, liste).summe).toEqual({ anzahl: 0, uebungen: 0, verschiedene: 0 });
    const unbekannt = berechneUebungsMassnahmen([{ ...uebungen[0], massnahmen: [{ massnahmeId: 99, anzahl: 1 }] }], liste);
    expect(unbekannt.rd.map((z) => z.name)).toEqual(['?']);
  });

  it('zählt Übungs-Maßnahmen nicht in der Einsatzstatistik mit', () => {
    const s = berechneStatistik(dienste, [], alle, true, mitMassnahmen);
    expect(s.anzahl).toBe(0);
    expect(s.feuerwehr).toEqual({ einsaetze: 0, mig: 0, atemschutz: 0, atemschutzMin: 0 });
  });
});
