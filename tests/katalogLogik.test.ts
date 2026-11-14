import { describe, expect, it } from 'vitest';
import { nutzung, sortiereNachNutzung } from '../src/domain/katalogLogik';
import type { Einsatz, KatalogEintrag } from '../src/domain/types';

const einsatz = (rest: Partial<Einsatz>): Einsatz => ({ dienstId: 1, typ: 'N', kategorieId: 1, alarm: 1, status1: 2, ...rest });

describe('Nutzung der Diagnosen', () => {
  it('zählt Verdachtsdiagnose und Leitstellen-Verdacht, gleiche Diagnose nur einmal je Einsatz', () => {
    const n = nutzung('diagnose', [], [
      einsatz({ diagnoseId: 5, leitstelleDiagnoseId: 6 }),
      einsatz({ diagnoseId: 6, leitstelleDiagnoseId: 6 }),
      einsatz({ leitstelleDiagnoseId: 5 }),
      einsatz({}),
    ]);
    expect(n.get(5)).toBe(2);
    expect(n.get(6)).toBe(2);
    expect(n.size).toBe(2);
  });
});

describe('Reihenfolge der Vorschläge', () => {
  const eintrag = (id: number, name: string): KatalogEintrag => ({ id, typ: 'diagnose', name, aktiv: true });

  it('häufig genutzte zuerst, bei Gleichstand in der Reihenfolge der Anlage', () => {
    const liste = [eintrag(3, 'Anaphylaxie'), eintrag(1, 'Sturz'), eintrag(2, 'Dyspnoe'), eintrag(4, 'Zahnschmerzen')];
    const sortiert = sortiereNachNutzung(liste, new Map([[4, 3]]));
    expect(sortiert.map((k) => k.name)).toEqual(['Zahnschmerzen', 'Sturz', 'Dyspnoe', 'Anaphylaxie']);
  });
});
