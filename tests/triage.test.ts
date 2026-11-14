import { describe, expect, it } from 'vitest';
import { bewertungVon, bewertungVorschlag, nacaGruppe } from '../src/domain/triage';
import { berechneTriage } from '../src/domain/triageStats';
import { zeitpunkt } from '../src/domain/time';
import type { Einsatz, KatalogEintrag } from '../src/domain/types';

const katalog = new Map<number, KatalogEintrag>([
  [1, { id: 1, typ: 'kategorie', name: 'Internistisch', aktiv: true }],
  [5, { id: 5, typ: 'diagnose', name: 'Rückenschmerzen', aktiv: true }],
  [6, { id: 6, typ: 'diagnose', name: 'Akutes Koronarsyndrom (AKS)', aktiv: true }],
  [7, { id: 7, typ: 'diagnose', name: 'Sturz', aktiv: true }],
]);

let zaehler = 0;
function einsatz(rest: Partial<Einsatz>): Einsatz {
  zaehler += 1;
  const alarm = zeitpunkt('2026-11-14', 8, 0) + zaehler * 3_600_000;
  return { id: zaehler, dienstId: 1, typ: 'R', kategorieId: 1, alarm, status1: alarm + 30 * 60_000, ...rest };
}

describe('NACA-Gruppen', () => {
  it('ordnet jeden Wert automatisch einer Gruppe zu', () => {
    expect([1, 2].map(nacaGruppe)).toEqual(['leicht', 'leicht']);
    expect(nacaGruppe(3)).toBe('maessig');
    expect([4, 5].map(nacaGruppe)).toEqual(['schwer', 'schwer']);
    expect([6, 7].map(nacaGruppe)).toEqual(['kritisch', 'kritisch']);
  });
});

describe('Vorschlag zur Alarmierung', () => {
  it('Notarztstichwort bei leichter Erkrankung: zu hoch', () => {
    expect(bewertungVorschlag({ typ: 'N', naca: 1 })?.bewertung).toBe('hoch');
    expect(bewertungVorschlag({ typ: 'N', naca: 2 })?.bewertung).toBe('hoch');
    expect(bewertungVorschlag({ typ: 'N', naca: 3 })).toBeNull();
  });

  it('RTW-Stichwort bei möglicher Lebensgefahr: zu niedrig', () => {
    expect(bewertungVorschlag({ typ: 'R', naca: 4 })?.bewertung).toBe('niedrig');
    expect(bewertungVorschlag({ typ: 'R', naca: 7 })?.bewertung).toBe('niedrig');
    expect(bewertungVorschlag({ typ: 'R', naca: 3 })).toBeNull();
    expect(bewertungVorschlag({ typ: 'N', naca: 6 })).toBeNull();
  });

  it('Nur Transport und Hilfeleistung: zu hoch, egal welches Stichwort', () => {
    expect(bewertungVorschlag({ typ: 'R', ausgang: 'transportdienst' })?.bewertung).toBe('hoch');
    expect(bewertungVorschlag({ typ: 'N', ausgang: 'hilfeleistung', naca: 6 })?.bewertung).toBe('hoch');
  });

  it('macht ohne Angaben oder bei Fehleinsatz keinen Vorschlag', () => {
    expect(bewertungVorschlag({ typ: 'N' })).toBeNull();
    expect(bewertungVorschlag({ typ: 'R', ausgang: 'fehleinsatz' })).toBeNull();
    expect(bewertungVorschlag({ typ: 'R', ausgang: 'ambulant', naca: null })).toBeNull();
  });
});

describe('Bewertung für die Auswertung', () => {
  it('die eigene Bewertung geht vor', () => {
    expect(bewertungVon({ alarmBewertung: 'passend', ausgang: 'transportdienst' })).toBe('passend');
    expect(bewertungVon({ alarmBewertung: 'niedrig' })).toBe('niedrig');
  });

  it('ohne eigene Bewertung zählen Nur Transport und Hilfeleistung als zu hoch', () => {
    expect(bewertungVon({ ausgang: 'transportdienst' })).toBe('hoch');
    expect(bewertungVon({ ausgang: 'hilfeleistung' })).toBe('hoch');
  });

  it('alles andere bleibt unbewertet, auch bei auffälligem NACA', () => {
    expect(bewertungVon({ ausgang: 'transport' })).toBeNull();
    expect(bewertungVon({})).toBeNull();
  });
});

describe('Auswertung Ergebnis und Alarmierung', () => {
  const liste: Einsatz[] = [
    // N-Internistisch „V. a. AKS“, vor Ort Rückenschmerzen seit drei Wochen
    einsatz({ typ: 'N', naca: 1, ausgang: 'ambulant', diagnoseId: 5, leitstelleDiagnoseId: 6 }),
    // Verdacht bestätigt
    einsatz({ typ: 'N', naca: 4, ausgang: 'transport', diagnoseId: 6, leitstelleDiagnoseId: 6 }),
    einsatz({ typ: 'R', naca: 5, ausgang: 'transport', diagnoseId: 7 }),
    einsatz({ typ: 'R', ausgang: 'transportdienst' }),
    einsatz({ typ: 'R', ausgang: 'hilfeleistung', alarmBewertung: 'passend' }),
    einsatz({ typ: 'R' }),
    einsatz({ typ: 'F', ausgang: 'fehleinsatz' }),
    einsatz({ typ: 'H' }),
  ];
  const t = berechneTriage(liste, katalog);

  it('trennt Rettungsdienst und Feuerwehr', () => {
    expect(t.rd).toBe(6);
    expect(t.fw).toBe(2);
    expect(t.fehleinsaetzeFw).toBe(1);
    expect(t.fehleinsaetzeRd).toBe(0);
  });

  it('zählt das Ergebnis, nicht erfasste getrennt', () => {
    const n = (a: string | null) => t.ergebnis.find((e) => e.ausgang === a)?.n;
    expect(n('transport')).toBe(2);
    expect(n('ambulant')).toBe(1);
    expect(n('transportdienst')).toBe(1);
    expect(n('hilfeleistung')).toBe(1);
    expect(n('fehleinsatz')).toBe(0);
    expect(n(null)).toBe(1);
    expect(t.ergebnisErfasst).toBe(5);
  });

  it('verteilt den NACA-Score und ordnet ihn dem Alarmtyp zu', () => {
    expect(t.naca.map((n) => n.n)).toEqual([1, 0, 0, 1, 1, 0, 0]);
    expect(t.nacaErfasst).toBe(3);
    const gruppe = (g: string) => t.nacaGruppen.find((x) => x.gruppe === g)!;
    expect(gruppe('leicht')).toMatchObject({ r: 0, n: 1 });
    expect(gruppe('maessig')).toMatchObject({ r: 0, n: 0 });
    expect(gruppe('schwer')).toMatchObject({ r: 1, n: 1 });
  });

  it('findet Notarztstichworte bei leichter und RTW-Stichworte bei schwerer Erkrankung', () => {
    expect(t.notarztBeiLeicht).toEqual({ n: 1, von: 2 });
    expect(t.rtwBeiSchwer).toEqual({ n: 1, von: 1 });
  });

  it('listet die häufigsten Verdachtsdiagnosen', () => {
    expect(t.diagnosen.map((d) => [d.name, d.n])).toEqual([
      ['Akutes Koronarsyndrom (AKS)', 1],
      ['Rückenschmerzen', 1],
      ['Sturz', 1],
    ]);
    expect(t.diagnosenErfasst).toBe(3);
  });

  it('wertet die Bewertung aus: eigene Angabe oder automatisch zu hoch', () => {
    expect(t.bewertung).toEqual({ passend: 1, hoch: 1, niedrig: 0 });
    expect(t.bewertet).toBe(2);
  });

  it('hält die Abweichung zwischen Leitstelle und Befund fest', () => {
    expect(t.vergleichbar).toBe(2);
    expect(t.abweichend).toBe(1);
    expect(t.abweichungen).toEqual([
      { leitstelleId: 6, diagnoseId: 5, leitstelle: 'Akutes Koronarsyndrom (AKS)', diagnose: 'Rückenschmerzen', n: 1 },
    ]);
  });

  it('zählt gleiche Abweichungen zusammen und sortiert nach Häufigkeit', () => {
    const mehr = berechneTriage(
      [
        einsatz({ typ: 'N', diagnoseId: 5, leitstelleDiagnoseId: 6 }),
        einsatz({ typ: 'N', diagnoseId: 5, leitstelleDiagnoseId: 6 }),
        einsatz({ typ: 'N', diagnoseId: 7, leitstelleDiagnoseId: 6 }),
      ],
      katalog,
    );
    expect(mehr.abweichungen.map((a) => [a.diagnose, a.n])).toEqual([
      ['Rückenschmerzen', 2],
      ['Sturz', 1],
    ]);
  });

  it('ignoriert ungültige NACA-Werte und kommt ohne Einsätze zurecht', () => {
    const komisch = berechneTriage([einsatz({ typ: 'R', naca: 9 }), einsatz({ typ: 'R', naca: 0 })], katalog);
    expect(komisch.nacaErfasst).toBe(0);
    const leer = berechneTriage([], katalog);
    expect(leer.rd + leer.fw + leer.bewertet + leer.abweichend).toBe(0);
    expect(leer.naca).toHaveLength(7);
    expect(leer.nacaGruppen).toHaveLength(4);
  });
});
