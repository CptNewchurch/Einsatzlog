import { describe, expect, it } from 'vitest';
import { nutzung, sortiereNachNutzung } from '../src/domain/katalogLogik';
import type { Dienst, Einsatz, KatalogEintrag, Uebung } from '../src/domain/types';

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

describe('Nutzung von Wachen, Standorten und Übungsarten', () => {
  const dienst = (rest: Partial<Dienst>): Dienst => ({ sollBeginn: 1, sollEnde: 2, beginn: 1, ende: 2, ...rest });
  const dienste = [
    dienst({ id: 1, wacheId: 10 }),
    dienst({ id: 2, wacheId: 10 }),
    dienst({ id: 3, wacheId: 20, zusatzdienst: true }),
    dienst({ id: 4, wacheId: 20, uebungsdienst: true }),
    dienst({ id: 5, wacheId: 21, uebungsdienst: true }),
  ];

  it('Wachen zählen nur die Regeldienste, Standorte die Zusatz- und Übungsdienste', () => {
    expect([...nutzung('wache', dienste, [])]).toEqual([[10, 2]]);
    expect([...nutzung('standort', dienste, [])]).toEqual([[20, 2], [21, 1]]);
  });

  it('Übungsarten zählen die Übungen, Feuerwehr-Maßnahmen die Einsätze', () => {
    const uebungen: Uebung[] = [
      { dienstId: 1, beginn: 1, ende: 2, artId: 7 },
      { dienstId: 1, beginn: 3, ende: 4, artId: 7 },
      { dienstId: 4, beginn: 1, ende: 2, artId: 8 },
    ];
    expect([...nutzung('uebungsart', dienste, [], uebungen)]).toEqual([[7, 2], [8, 1]]);
    const fw = [
      einsatz({ typ: 'F', massnahmen: [{ massnahmeId: 30, anzahl: 2, durchfuehrung: 'befehl' }] }),
      einsatz({ typ: 'H', massnahmen: [{ massnahmeId: 30, anzahl: 1, durchfuehrung: 'befehl' }, { massnahmeId: 31, anzahl: 1, durchfuehrung: 'befehl' }] }),
    ];
    expect([...nutzung('fwmassnahme', [], fw)]).toEqual([[30, 2], [31, 1]]);
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
