import { describe, expect, it } from 'vitest';
import { berechneMassnahmen, berechneStatistik, median, verfuegbareJahre, waehleEinsaetze } from '../src/domain/stats';
import { zeitpunkt } from '../src/domain/time';
import type { Dienst, Einsatz, KatalogEintrag } from '../src/domain/types';

const T = (datum: string, h: number, m = 0) => zeitpunkt(datum, h, m);

// Dienst 1: 07:15–07:50 statt 07:30–07:30 (+15 min vorher, +20 min nachher), Dienst 2 wie geplant,
// Dienst 3: früher abgelöst um 05:00 (−150 min), Dienst 4: Zusatzdienst ohne Plan.
const dienste: Dienst[] = [
  { id: 1, sollBeginn: T('2026-11-14', 7, 30), sollEnde: T('2026-11-15', 7, 30), beginn: T('2026-11-14', 7, 15), ende: T('2026-11-15', 7, 50) },
  { id: 2, sollBeginn: T('2025-12-31', 7, 30), sollEnde: T('2026-01-01', 7, 30), beginn: T('2025-12-31', 7, 30), ende: T('2026-01-01', 7, 30) },
];

const mehr: Dienst[] = [
  ...dienste,
  { id: 3, sollBeginn: T('2026-03-10', 7, 30), sollEnde: T('2026-03-11', 7, 30), beginn: T('2026-03-10', 7, 30), ende: T('2026-03-11', 5, 0) },
  { id: 4, zusatzdienst: true, sollBeginn: T('2026-03-20', 18), sollEnde: T('2026-03-21', 2), beginn: T('2026-03-20', 18), ende: T('2026-03-21', 3) },
];

const einsaetze: Einsatz[] = [
  { id: 1, dienstId: 1, typ: 'R', kategorieId: 10, kraefteRtw: 1, kraefteNef: 0, alarm: T('2026-11-14', 9), status1: T('2026-11-14', 9, 40), status2: T('2026-11-14', 9, 55) },
  { id: 2, dienstId: 1, typ: 'N', kategorieId: 11, kraefteRtw: 1, kraefteNef: 1, alarm: T('2026-11-15', 2, 15), status1: T('2026-11-15', 3, 15), nachforderungen: [{ ressourceId: 1, vonMir: true }] },
  { id: 3, dienstId: 1, typ: 'F', kategorieId: 20, mig: true, alarm: T('2026-11-14', 13), status1: T('2026-11-14', 14), nachalarmiert: true },
  { id: 4, dienstId: 2, typ: 'H', kategorieId: 21, alarm: T('2026-01-01', 0, 30), status1: T('2026-01-01', 0, 50) },
];

describe('Statistik', () => {
  it('zählt je Jahr nach Alarmierung', () => {
    const s = berechneStatistik(dienste, einsaetze, { jahr: 2026, bereich: 'alle', dienstart: 'alle' }, true);
    expect(s.anzahl).toBe(4);
    expect(s.rd).toBe(2);
    expect(s.fw).toBe(2);
    expect(s.dienste).toBe(1);
    const s25 = berechneStatistik(dienste, einsaetze, { jahr: 2025, bereich: 'alle', dienstart: 'alle' }, true);
    expect(s25.anzahl).toBe(0);
    expect(s25.dienste).toBe(1);
  });

  it('filtert nach Bereich, die Zeitaufteilung bleibt vollständig', () => {
    const alle = berechneStatistik(dienste, einsaetze, { jahr: 2026, bereich: 'alle', dienstart: 'alle' }, true);
    const rd = berechneStatistik(dienste, einsaetze, { jahr: 2026, bereich: 'RD', dienstart: 'alle' }, true);
    expect(rd.anzahl).toBe(2);
    expect(rd.fw).toBe(0);
    expect(rd.zeiten).toEqual(alle.zeiten);
  });

  it('verteilt auf Monate, Wochentage und Tageszeit', () => {
    const s = berechneStatistik(dienste, einsaetze, { jahr: 2026, bereich: 'alle', dienstart: 'alle' }, true);
    expect(s.verlauf[10].rd + s.verlauf[10].fw).toBe(3); // November
    expect(s.verlauf[0].fw).toBe(1); // Januar
    // 14.11.2026 ist ein Samstag, 15.11. ein Sonntag
    expect(s.wochentag[5].rd + s.wochentag[5].fw).toBe(2);
    expect(s.wochentag[6].rd).toBe(1);
    expect(s.tageszeit[1].rd).toBe(1); // 02:15
    expect(s.tageszeit[4].rd).toBe(1); // 09:00
  });

  it('Gesamtansicht zeigt Kalenderjahre', () => {
    const s = berechneStatistik(dienste, einsaetze, { jahr: null, bereich: 'alle', dienstart: 'alle' }, true);
    expect(s.verlauf.map((v) => v.label)).toEqual(['2025', '2026']);
    expect(s.verlauf[1].rd + s.verlauf[1].fw).toBe(4);
  });

  it('wertet Stichworte, Kräfteansatz und Nachforderungen aus', () => {
    const s = berechneStatistik(dienste, einsaetze, { jahr: 2026, bereich: 'alle', dienstart: 'alle' }, true);
    expect(s.kraefte).toEqual(expect.arrayContaining([{ text: 'R1N0', n: 1 }, { text: 'R1N1', n: 1 }]));
    expect(s.typ.find((t) => t.typ === 'N')!.n).toBe(1);
    expect(s.stichworte).toHaveLength(4);
    expect(s.nachalarmiert).toBe(1);
    expect(s.mitNachforderung).toBe(1);
    expect(s.vonMirNachgefordert).toBe(1);
  });

  it('berechnet Median und Einsätze je Dienst', () => {
    const s = berechneStatistik(dienste, einsaetze, { jahr: 2026, bereich: 'alle', dienstart: 'alle' }, true);
    expect(s.medianEinsatzMin).toBe(50); // Dauern 20, 40, 60, 60 -> (40 + 60) / 2
    expect(s.einsaetzeProDienst).toBe(4);
  });

  it('rechnet Über- und Minusstunden je Dienst und Monat', () => {
    const s = berechneStatistik(mehr, einsaetze, { jahr: 2026, bereich: 'alle', dienstart: 'alle' }, true);
    // Dienst 1: +15 + 20 = +35, Dienst 3: −150, Zusatzdienst zählt nicht
    expect(s.ueberstunden.plusMin).toBe(35);
    expect(s.ueberstunden.minusMin).toBe(150);
    expect(s.ueberstunden.saldoMin).toBe(-115);
    expect(s.ueberstunden.diensteMitPlus).toBe(1);
    expect(s.ueberstunden.diensteMitMinus).toBe(1);
    expect(s.ueberstunden.verlauf[10].min).toBe(35); // November
    expect(s.ueberstunden.verlauf[2].min).toBe(-150); // März
    expect(s.ueberstunden.verlauf[0].min).toBe(0); // Dienst 2 ist wie geplant
  });

  it('Gesamtansicht fasst die Überstunden je Kalenderjahr zusammen', () => {
    const s = berechneStatistik(mehr, einsaetze, { jahr: null, bereich: 'alle', dienstart: 'alle' }, true);
    expect(s.ueberstunden.verlauf.map((v) => v.label)).toEqual(['2025', '2026']);
    expect(s.ueberstunden.verlauf[1].min).toBe(-115);
  });

  it('trennt Regeldienste und Zusatzdienste', () => {
    const zusatzEinsatz: Einsatz = { id: 9, dienstId: 4, typ: 'R', kategorieId: 10, kraefteRtw: 1, kraefteNef: 0, alarm: T('2026-03-20', 20), status1: T('2026-03-20', 20, 30) };
    const alle = [...einsaetze, zusatzEinsatz];
    const regel = berechneStatistik(mehr, alle, { jahr: 2026, bereich: 'alle', dienstart: 'regel' }, true);
    const zusatz = berechneStatistik(mehr, alle, { jahr: 2026, bereich: 'alle', dienstart: 'zusatz' }, true);
    const beide = berechneStatistik(mehr, alle, { jahr: 2026, bereich: 'alle', dienstart: 'alle' }, true);
    expect(regel.anzahl).toBe(4);
    expect(regel.dienste).toBe(2);
    expect(zusatz.anzahl).toBe(1);
    expect(zusatz.dienste).toBe(1);
    expect(zusatz.zeiten.dienstMin).toBe(9 * 60);
    expect(zusatz.ueberstunden.saldoMin).toBe(0);
    expect(beide.anzahl).toBe(5);
    expect(beide.dienste).toBe(3);
  });

  it('Jahre mit Daten, neueste zuerst', () => {
    expect(verfuegbareJahre(dienste, einsaetze)).toEqual([2026, 2025]);
  });

  it('median', () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([1, 9, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('wertet Feuerwehr-Kennzahlen aus', () => {
    const fw: Einsatz[] = [
      ...einsaetze,
      { id: 7, dienstId: 1, typ: 'F', kategorieId: 20, alarm: T('2026-11-14', 16), status1: T('2026-11-14', 17), atemschutz: true, atemschutzMin: 25 },
      { id: 8, dienstId: 1, typ: 'F', kategorieId: 20, mig: true, alarm: T('2026-11-14', 18), status1: T('2026-11-14', 18, 30), atemschutz: true },
    ];
    const s = berechneStatistik(dienste, fw, { jahr: 2026, bereich: 'alle', dienstart: 'alle' }, true);
    expect(s.feuerwehr).toEqual({ einsaetze: 4, mig: 2, atemschutz: 2, atemschutzMin: 25 });
    const nurRd = berechneStatistik(dienste, fw, { jahr: 2026, bereich: 'RD', dienstart: 'alle' }, true);
    expect(nurRd.feuerwehr.einsaetze).toBe(0);
  });

  it('gibt für jedes Stichwort die mittlere Einsatzdauer an', () => {
    const doppelt: Einsatz[] = [
      ...einsaetze,
      { id: 7, dienstId: 1, typ: 'R', kategorieId: 10, kraefteRtw: 1, kraefteNef: 0, alarm: T('2026-11-14', 20), status1: T('2026-11-14', 21) },
    ];
    const s = berechneStatistik(dienste, doppelt, { jahr: 2026, bereich: 'alle', dienstart: 'alle' }, true);
    const r = s.stichworte.find((x) => x.typ === 'R' && x.kategorieId === 10)!;
    expect(r.n).toBe(2);
    expect(r.medianMin).toBe(50); // 40 und 60 Minuten
  });
});

describe('Auswahl für die Nachweise', () => {
  it('folgt Jahr, Bereich und Dienstart des Filters', () => {
    const alle = waehleEinsaetze(dienste, einsaetze, { jahr: 2026, bereich: 'alle', dienstart: 'alle' });
    expect(alle.map((e) => e.id)).toEqual([1, 2, 3, 4]);
    expect(waehleEinsaetze(dienste, einsaetze, { jahr: 2026, bereich: 'FW', dienstart: 'alle' }).map((e) => e.id)).toEqual([3, 4]);
    expect(waehleEinsaetze(dienste, einsaetze, { jahr: 2026, bereich: 'alle', dienstart: 'zusatz' })).toEqual([]);
  });
});

describe('Maßnahmen-Nachweis', () => {
  const katalog = new Map<number, KatalogEintrag>([
    [1, { id: 1, typ: 'massnahme', name: 'Epinephrin', aktiv: true, art: 'medikament' }],
    [2, { id: 2, typ: 'massnahme', name: 'i.v.-Zugang', aktiv: true, art: 'invasiv' }],
    [3, { id: 3, typ: 'massnahme', name: 'Reanimation', aktiv: true, art: 'sonstige' }],
  ]);
  const basis = { dienstId: 1, typ: 'R' as const, kategorieId: 10, alarm: 0, status1: 60_000 };

  it('zählt je Maßnahme und trennt nach Durchführung', () => {
    const liste: Einsatz[] = [
      { ...basis, id: 1, massnahmen: [{ massnahmeId: 1, anzahl: 2, durchfuehrung: 'vorab' }, { massnahmeId: 2, anzahl: 1, durchfuehrung: 'eigen' }] },
      { ...basis, id: 2, massnahmen: [{ massnahmeId: 1, anzahl: 1, durchfuehrung: 'eigen' }, { massnahmeId: 3, anzahl: 1 }] },
      { ...basis, id: 3, massnahmen: [{ massnahmeId: 1, anzahl: 1, durchfuehrung: 'arzt' }] },
      { ...basis, id: 4 },
    ];
    const m = berechneMassnahmen(liste, katalog);
    expect(m.summe).toEqual({ anzahl: 6, vorab: 2, eigen: 2, arzt: 1, einsaetze: 3 });
    const epi = m.zeilen[0];
    expect(epi).toMatchObject({ name: 'Epinephrin', art: 'medikament', anzahl: 4, einsaetze: 3, vorab: 2, eigen: 1, arzt: 1, ohne: 0 });
    expect(m.zeilen.map((z) => z.name)).toEqual(['Epinephrin', 'i.v.-Zugang', 'Reanimation']);
    expect(m.zeilen[2].ohne).toBe(1);
  });

  it('kommt ohne Maßnahmen zurecht', () => {
    expect(berechneMassnahmen([{ ...basis, id: 1 }], katalog)).toEqual({
      zeilen: [],
      summe: { anzahl: 0, vorab: 0, eigen: 0, arzt: 0, einsaetze: 0 },
    });
  });
});
