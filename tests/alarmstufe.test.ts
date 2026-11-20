import { describe, expect, it } from 'vitest';
import { AAO_STICHWORTE } from '../src/db/seed';
import {
  AAO_STUFEN,
  ALARMSTUFEN,
  aaoStufe,
  istAlarmstufe,
  MAX_ALARMSTUFE,
  stufeKraefte,
  stufeText,
  stufeVon,
} from '../src/domain/alarmstufe';
import { berechneAlarmstufen } from '../src/domain/stats';
import { zeitpunkt } from '../src/domain/time';
import type { Einsatz, KatalogEintrag } from '../src/domain/types';

const T = (h: number, m = 0) => zeitpunkt('2026-11-14', h, m);

describe('Alarmstufen: Grundlagen', () => {
  it('kennt die Stufen 0 bis 6', () => {
    expect(ALARMSTUFEN).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(MAX_ALARMSTUFE).toBe(6);
    for (const n of [0, 3, 6]) expect(istAlarmstufe(n), String(n)).toBe(true);
    for (const n of [-1, 7, 2.5, NaN, '3', null, undefined]) expect(istAlarmstufe(n), String(n)).toBe(false);
  });

  it('beschriftet Stufe und Kräfte wie die AAO', () => {
    expect(stufeText(3)).toBe('Stufe 3');
    expect(stufeKraefte(0)).toBe('HLF');
    expect(stufeKraefte(1)).toBe('1 Staffel');
    expect(stufeKraefte(2)).toBe('2 Staffeln');
    expect(stufeKraefte(6)).toBe('6 Staffeln');
  });
});

describe('Alarmstufen: Stufen der AAO', () => {
  it('hat zu jeder Stufe einen Eintrag je Typ', () => {
    for (const typ of ['F', 'H', 'ABC'] as const) expect(AAO_STUFEN[typ]).toHaveLength(ALARMSTUFEN.length);
  });

  it('enthält genau die Stichworte der Startlisten', () => {
    for (const typ of ['F', 'H', 'ABC'] as const) {
      const ausStufen = AAO_STUFEN[typ].flat();
      expect([...ausStufen].sort(), typ).toEqual([...AAO_STICHWORTE[typ]].sort());
      expect(new Set(ausStufen).size, `${typ}: doppelter Name`).toBe(ausStufen.length);
    }
  });

  it('liefert die Stufe zum Stichwort', () => {
    expect(aaoStufe('F', 'Abfalltonne')).toBe(0);
    expect(aaoStufe('F', 'PKW')).toBe(1);
    expect(aaoStufe('F', 'LKW')).toBe(2);
    expect(aaoStufe('F', 'Gebäude')).toBe(3);
    expect(aaoStufe('F', 'Dachstuhl')).toBe(4);
    expect(aaoStufe('F', 'Gewerbebetrieb')).toBe(5);
    expect(aaoStufe('F', 'Krankenhaus')).toBe(6);
    expect(aaoStufe('H', 'First Responder')).toBe(0);
    expect(aaoStufe('H', 'P Tür')).toBe(1);
    expect(aaoStufe('H', 'VU Bus')).toBe(4);
    expect(aaoStufe('H', 'Bahnunfall')).toBe(5);
    expect(aaoStufe('ABC', 'Ölspur Feuerwehr')).toBe(0);
    expect(aaoStufe('ABC', 'Gas')).toBe(3);
  });

  it('gleicher Name, andere Stufe je Typ (Bahn, VU)', () => {
    expect(aaoStufe('F', 'Bahn')).toBe(5);
    expect(aaoStufe('H', 'Bahn')).toBe(2);
    expect(aaoStufe('H', 'VU')).toBe(0);
    expect(aaoStufe('ABC', 'VU')).toBe(5);
  });

  it('„LKW (ABC)“ ist ein Feuer-Stichwort der Stufe 5', () => {
    expect(aaoStufe('F', 'LKW (ABC)')).toBe(5);
    expect(aaoStufe('ABC', 'LKW (ABC)')).toBeUndefined();
  });

  it('bei Menschenleben in Gefahr rücken für Gebäude, Keller und Dachstuhl vier Staffeln aus', () => {
    expect(aaoStufe('F', 'Gebäude', true)).toBe(4);
    expect(aaoStufe('F', 'Keller', true)).toBe(4);
    expect(aaoStufe('F', 'Dachstuhl', true)).toBe(4);
    expect(aaoStufe('F', 'Gebäude', false)).toBe(3);
    // andere Stichworte ändert MiG nicht, und nur beim Typ F
    expect(aaoStufe('F', 'PKW', true)).toBe(1);
    expect(aaoStufe('H', 'VU', true)).toBe(0);
  });

  it('ignoriert Groß- und Kleinschreibung und kennt unbekannte Stichworte nicht', () => {
    expect(aaoStufe('F', 'gebäude')).toBe(3);
    expect(aaoStufe('F', 'GEBÄUDE')).toBe(3);
    expect(aaoStufe('F', 'Eigenes Stichwort')).toBeUndefined();
    expect(aaoStufe('F', '')).toBeUndefined();
  });

  it('der Rettungsdienst hat keine Stufen', () => {
    expect(aaoStufe('R', 'Internistisch')).toBeUndefined();
    expect(aaoStufe('N', 'Internistisch')).toBeUndefined();
  });
});

describe('Alarmstufen: Stufe eines Einsatzes', () => {
  it('nimmt die eingetragene Stufe, sonst die der AAO', () => {
    expect(stufeVon({ typ: 'F', alarmstufe: 5 }, 'Gebäude')).toEqual({ stufe: 5, aao: 3 });
    expect(stufeVon({ typ: 'F' }, 'Gebäude')).toEqual({ stufe: 3, aao: 3 });
    expect(stufeVon({ typ: 'F', mig: true }, 'Gebäude')).toEqual({ stufe: 4, aao: 4 });
    expect(stufeVon({ typ: 'F', alarmstufe: 0 }, 'Gebäude')).toEqual({ stufe: 0, aao: 3 });
  });

  it('ohne bekanntes Stichwort bleibt nur die eingetragene Stufe', () => {
    expect(stufeVon({ typ: 'F', alarmstufe: 2 }, 'Eigenes Stichwort')).toEqual({ stufe: 2, aao: undefined });
    expect(stufeVon({ typ: 'F' }, 'Eigenes Stichwort')).toEqual({ stufe: undefined, aao: undefined });
    expect(stufeVon({ typ: 'F' }, undefined)).toEqual({ stufe: undefined, aao: undefined });
  });

  it('eine ungültige eingetragene Stufe zählt nicht', () => {
    expect(stufeVon({ typ: 'F', alarmstufe: 9 }, 'Gebäude').stufe).toBe(3);
    expect(stufeVon({ typ: 'F', alarmstufe: -1 }, 'Gebäude').stufe).toBe(3);
  });

  it('im Rettungsdienst gibt es keine Stufe, auch wenn eine eingetragen ist', () => {
    expect(stufeVon({ typ: 'R', alarmstufe: 2 }, 'Internistisch')).toEqual({});
    expect(stufeVon({ typ: 'N' }, 'Internistisch')).toEqual({});
  });
});

describe('Alarmstufen: Auswertung', () => {
  const kat = (id: number, name: string, typen: KatalogEintrag['typen']): [number, KatalogEintrag] => [
    id,
    { id, typ: 'kategorie', name, aktiv: true, typen },
  ];
  const katalog = new Map<number, KatalogEintrag>([
    kat(10, 'Internistisch', ['R', 'N']),
    kat(20, 'Gebäude', ['F']),
    kat(21, 'PKW', ['F']),
    kat(22, 'Gas', ['ABC']),
    kat(23, 'Eigenes Stichwort', ['F']),
  ]);
  /** Ein Einsatz von `h`:00 Uhr mit `min` Minuten Dauer. */
  const e = (typ: Einsatz['typ'], kategorieId: number, min: number, extra: Partial<Einsatz> = {}): Einsatz => ({
    dienstId: 1,
    typ,
    kategorieId,
    alarm: T(9),
    status1: T(9) + min * 60_000,
    ...extra,
  });

  const einsaetze: Einsatz[] = [
    e('F', 20, 30), // Gebäude ohne Eintrag: Stufe 3 der AAO
    e('F', 20, 60, { mig: true }), // Gebäude mit MiG: Stufe 4 der AAO
    e('F', 20, 90, { alarmstufe: 5 }), // höher als die AAO (3)
    e('F', 21, 20, { alarmstufe: 0 }), // niedriger als die AAO (1)
    e('ABC', 22, 50), // Gas: Stufe 3 der AAO
    e('F', 23, 15), // unbekanntes Stichwort, keine Stufe
    e('F', 23, 40, { alarmstufe: 2 }), // unbekanntes Stichwort mit Stufe
    e('R', 10, 45, { alarmstufe: 6 }), // Rettungsdienst zählt nicht
  ];

  it('zählt die Feuerwehr-Einsätze je Stufe', () => {
    const s = berechneAlarmstufen(einsaetze, katalog);
    expect(s.zeilen.map((z) => z.stufe)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(s.zeilen.map((z) => z.n)).toEqual([1, 0, 1, 2, 1, 1, 0]);
    expect(s.mitStufe).toBe(6);
    expect(s.ohneStufe).toBe(1);
  });

  it('rechnet Zeit und Median je Stufe', () => {
    const s = berechneAlarmstufen(einsaetze, katalog);
    const stufe3 = s.zeilen[3];
    expect(stufe3.minuten).toBe(80); // 30 + 50
    expect(stufe3.medianMin).toBe(40);
    expect(s.zeilen[5].minuten).toBe(90);
    expect(s.zeilen[1]).toEqual({ stufe: 1, n: 0, minuten: 0, medianMin: null });
  });

  it('vergleicht mit der AAO', () => {
    const s = berechneAlarmstufen(einsaetze, katalog);
    expect(s.hoeher).toBe(1);
    expect(s.niedriger).toBe(1);
  });

  it('nennt die höchste vorkommende Stufe', () => {
    expect(berechneAlarmstufen(einsaetze, katalog).hoechste).toEqual({ stufe: 5, n: 1 });
    expect(berechneAlarmstufen([e('F', 20, 30), e('F', 20, 40, { alarmstufe: 3 })], katalog).hoechste).toEqual({ stufe: 3, n: 2 });
  });

  it('rechnet auch nur mit Rettungsdienst oder ohne Einsätze, ohne zu scheitern', () => {
    const leer = berechneAlarmstufen([], katalog);
    expect(leer.mitStufe).toBe(0);
    expect(leer.ohneStufe).toBe(0);
    expect(leer.hoechste).toBeNull();
    expect(leer.zeilen).toHaveLength(7);
    const nurRd = berechneAlarmstufen([e('R', 10, 30), e('N', 10, 30)], katalog);
    expect(nurRd.mitStufe).toBe(0);
    expect(nurRd.hoechste).toBeNull();
  });

  it('ein Stichwort, das aus dem Katalog verschwunden ist, braucht eine eingetragene Stufe', () => {
    const s = berechneAlarmstufen([e('F', 99, 30), e('F', 99, 30, { alarmstufe: 4 })], katalog);
    expect(s.ohneStufe).toBe(1);
    expect(s.zeilen[4].n).toBe(1);
  });
});
