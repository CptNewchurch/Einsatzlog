import { describe, expect, it } from 'vitest';
import { csvDateiname, csvFeld, csvText, erzeugeDiensteCsv, erzeugeEinsaetzeCsv, erzeugeUebungenCsv } from '../src/db/csv';
import { zeitpunkt } from '../src/domain/time';
import type { Dienst, Einsatz, KatalogEintrag, Uebung } from '../src/domain/types';

const T = (datum: string, h: number, m = 0) => zeitpunkt(datum, h, m);

const katalog = new Map<number, KatalogEintrag>([
  [1, { id: 1, typ: 'kategorie', name: 'Chirurgisch', aktiv: true }],
  [2, { id: 2, typ: 'wache', name: 'FRW 1 (Paffrather Straße)', aktiv: true }],
  [3, { id: 3, typ: 'massnahme', name: 'Epinephrin', aktiv: true, art: 'medikament' }],
  [4, { id: 4, typ: 'ressource', name: 'Notarzt (NEF)', aktiv: true }],
  [5, { id: 5, typ: 'diagnose', name: 'Rückenschmerzen', aktiv: true }],
  [6, { id: 6, typ: 'diagnose', name: 'Akutes Koronarsyndrom (AKS)', aktiv: true }],
  [7, { id: 7, typ: 'uebungsart', name: 'Atemschutzübung', aktiv: true, bereich: 'FW' }],
  [8, { id: 8, typ: 'standort', name: 'Feuerwehrschule', aktiv: true }],
  [9, { id: 9, typ: 'fwmassnahme', name: 'Löschangriff im Innenangriff', aktiv: true, gruppe: 'brand' }],
]);

const dienst: Dienst = {
  id: 1,
  sollBeginn: T('2026-11-14', 7, 30),
  sollEnde: T('2026-11-15', 7, 30),
  beginn: T('2026-11-14', 7, 15),
  ende: T('2026-11-15', 7, 50),
  wacheId: 2,
};

const einsatz: Einsatz = {
  id: 1,
  dienstId: 1,
  typ: 'R',
  kategorieId: 1,
  kraefteRtw: 1,
  kraefteNef: 0,
  alarm: T('2026-11-14', 9),
  status1: T('2026-11-14', 9, 40),
  status2: T('2026-11-14', 9, 55),
  nachforderungen: [{ ressourceId: 4, vonMir: true }],
  massnahmen: [{ massnahmeId: 3, anzahl: 2, durchfuehrung: 'vorab' }],
  notiz: 'Name; "Zitat"',
  ausgang: 'ambulant',
  naca: 2,
  diagnoseId: 5,
  leitstelleDiagnoseId: 6,
  alarmBewertung: 'hoch',
};

describe('CSV', () => {
  it('maskiert Trennzeichen, Anführungszeichen und Zeilenumbrüche', () => {
    expect(csvFeld('a;b')).toBe('"a;b"');
    expect(csvFeld('sie sagte "ja"')).toBe('"sie sagte ""ja"""');
    expect(csvFeld('zwei\nZeilen')).toBe('"zwei\nZeilen"');
    expect(csvFeld(undefined)).toBe('');
    expect(csvFeld(true)).toBe('ja');
    expect(csvFeld(1.5)).toBe('1,5');
  });

  it('schützt vor Formeln in Tabellenprogrammen', () => {
    expect(csvFeld('=1+1')).toBe("'=1+1");
    expect(csvFeld('-5 min')).toBe("'-5 min");
    expect(csvFeld(-5)).toBe('-5');
  });

  it('beginnt mit dem UTF-8-Kennzeichen und endet mit Zeilenumbruch', () => {
    const t = csvText(['A', 'B'], [[1, 'x']]);
    expect(t.startsWith('﻿A;B\r\n')).toBe(true);
    expect(t.endsWith('1;x\r\n')).toBe(true);
  });

  it('schreibt einen Einsatz mit allen Angaben', () => {
    const zeilen = erzeugeEinsaetzeCsv([dienst], [einsatz], katalog).trim().split('\r\n');
    expect(zeilen).toHaveLength(2);
    const w = zeilen[1].split(';');
    expect(w.slice(0, 10)).toEqual(['14.11.2026', '09:00', '09:40', '09:55', '40', '15', 'R', 'R-Chirurgisch', '', 'R1N0']);
    expect(zeilen[1]).toContain('Notarzt (NEF) (von mir)');
    expect(zeilen[1]).toContain('Epinephrin 2× (Vorabdelegation)');
    expect(zeilen[1]).toContain('"Name; ""Zitat"""');
  });

  it('schreibt Ergebnis, NACA, Diagnosen und die Bewertung der Alarmierung', () => {
    const zeilen = erzeugeEinsaetzeCsv([dienst], [einsatz], katalog).trim().split('\r\n');
    const kopf = zeilen[0].split(';');
    const w = zeilen[1].split(';');
    const spalte = (n: string) => w[kopf.indexOf(n)];
    expect(spalte('Ergebnis')).toBe('Ambulant versorgt');
    expect(spalte('NACA')).toBe('II');
    expect(spalte('NACA-Gruppe')).toBe('Leicht');
    expect(spalte('Verdachtsdiagnose')).toBe('Rückenschmerzen');
    expect(spalte('Laut Leitstelle')).toBe('Akutes Koronarsyndrom (AKS)');
    expect(spalte('Bewertung Alarmierung')).toBe('Zu hoch');
  });

  it('wertet „Nur Transport“ ohne eigene Bewertung als zu hoch alarmiert', () => {
    const nurTransport: Einsatz = { ...einsatz, ausgang: 'transportdienst', alarmBewertung: undefined };
    const zeilen = erzeugeEinsaetzeCsv([dienst], [nurTransport], katalog).trim().split('\r\n');
    const kopf = zeilen[0].split(';');
    expect(zeilen[1].split(';')[kopf.indexOf('Bewertung Alarmierung')]).toBe('Zu hoch');
  });

  it.each([
    ['transportMitNotarzt', 'Transport mit NA'],
    ['transportOhneNotarzt', 'Transport ohne NA'],
  ] as const)('schreibt „%s“ als „%s“ mit Notarzt vor Ort und ohne Übertriage', (ausgang, name) => {
    const mitNotarzt: Einsatz = { ...einsatz, ausgang, notarztVorOrt: true, alarmBewertung: undefined };
    const zeilen = erzeugeEinsaetzeCsv([dienst], [mitNotarzt], katalog).trim().split('\r\n');
    const kopf = zeilen[0].split(';');
    const w = zeilen[1].split(';');
    expect(w[kopf.indexOf('Ergebnis')]).toBe(name);
    expect(w[kopf.indexOf('Notarzt vor Ort')]).toBe('ja');
    expect(w[kopf.indexOf('Bewertung Alarmierung')]).toBe('');
  });

  it('markiert „Danach aus Status 1 alarmiert“ nur ohne Status 2', () => {
    const spalte = (e: Einsatz) => {
      const zeilen = erzeugeEinsaetzeCsv([dienst], [e], katalog).trim().split('\r\n');
      return zeilen[1].split(';')[zeilen[0].split(';').indexOf('Danach aus Status 1 alarmiert')];
    };
    const ohne2: Einsatz = { ...einsatz, status2: undefined, notiz: undefined };
    expect(spalte({ ...ohne2, folgeAusStatus1: true })).toBe('ja');
    expect(spalte(ohne2)).toBe('');
    expect(spalte({ ...ohne2, status2: einsatz.status1 + 10 * 60_000, folgeAusStatus1: true })).toBe('');
  });

  it('schreibt Dienste mit Über-/Minusstunden', () => {
    const zeilen = erzeugeDiensteCsv([dienst], [einsatz], katalog, true).trim().split('\r\n');
    const w = zeilen[1].split(';');
    expect(w[0]).toBe('14.11.2026');
    expect(w[1]).toBe('Regeldienst');
    expect(w[2]).toBe('FRW 1 (Paffrather Straße)');
    expect(w[9]).toBe('35'); // 15 min früher + 20 min später
    expect(w[10]).toBe('1');
  });

  it('hat die Spalten für Übungen vor der Notiz', () => {
    const kopf = erzeugeDiensteCsv([dienst], [], katalog, true).split('\r\n')[0].replace('﻿', '').split(';');
    expect(kopf.slice(-3)).toEqual(['Übungen', 'Übung (min)', 'Notiz']);
  });

  it('lässt bei Zusatzdiensten Plan und Saldo leer', () => {
    const zusatz: Dienst = { ...dienst, id: 2, zusatzdienst: true, sollBeginn: dienst.beginn, sollEnde: dienst.ende };
    const w = erzeugeDiensteCsv([zusatz], [], katalog, true).trim().split('\r\n')[1].split(';');
    expect(w[1]).toBe('Zusatzdienst');
    expect(w[5]).toBe('');
    expect(w[9]).toBe('');
  });

  it('benennt Dateien mit Datum', () => {
    expect(csvDateiname('einsaetze', T('2026-11-14', 12))).toBe('einsatzlog-einsaetze-2026-11-14.csv');
    expect(csvDateiname('uebungen', T('2026-11-14', 12))).toBe('einsatzlog-uebungen-2026-11-14.csv');
  });

  it('schreibt Feuerwehr-Maßnahmen auf Befehl', () => {
    const fw: Einsatz = {
      id: 2,
      dienstId: 1,
      typ: 'F',
      kategorieId: 1,
      alarm: T('2026-11-14', 13),
      status1: T('2026-11-14', 14),
      massnahmen: [{ massnahmeId: 9, anzahl: 2, durchfuehrung: 'befehl' }],
    };
    const zeilen = erzeugeEinsaetzeCsv([dienst], [fw], katalog).trim().split('\r\n');
    const kopf = zeilen[0].split(';');
    expect(zeilen[1].split(';')[kopf.indexOf('Maßnahmen')]).toBe('Löschangriff im Innenangriff 2× (Auf Befehl)');
  });
});

describe('CSV mit Übungen', () => {
  const uebungsdienst: Dienst = {
    id: 3,
    uebungsdienst: true,
    wacheId: 8,
    sollBeginn: T('2026-05-09', 8),
    sollEnde: T('2026-05-09', 16),
    beginn: T('2026-05-09', 8),
    ende: T('2026-05-09', 16),
  };
  const uebung: Uebung = { id: 1, dienstId: 3, beginn: T('2026-05-09', 8), ende: T('2026-05-09', 11, 30), artId: 7, thema: 'Übungsstrecke; Brandcontainer' };
  const inSchicht: Uebung = { id: 2, dienstId: 1, beginn: T('2026-11-14', 14), ende: T('2026-11-14', 15, 30), artId: 7 };

  it('schreibt jede Übung mit Art, Bereich, Thema und dem Dienst', () => {
    const zeilen = erzeugeUebungenCsv([dienst, uebungsdienst], [inSchicht, uebung], katalog).trim().split('\r\n');
    const kopf = zeilen[0].split(';');
    expect(kopf).toEqual([
      'Datum', 'Beginn', 'Ende', 'Dauer (min)', 'Art', 'Bereich', 'Thema', 'Ort', 'Dienst', 'Dienstart', 'Wache / Standort',
      'Atemschutz', 'Atemschutz (min)', 'Maßnahmen', 'Notiz',
    ]);
    // nach Zeit sortiert: erst die Mai-Übung, dann die vom November
    expect(zeilen[1]).toBe(['09.05.2026', '08:00', '11:30', '210', 'Atemschutzübung', 'Feuerwehr', '"Übungsstrecke; Brandcontainer"', '', '09.05.2026', 'Übungsdienst', 'Feuerwehrschule', '', '', '', ''].join(';'));
    const w = zeilen[2].split(';');
    expect(w.slice(0, 5)).toEqual(['14.11.2026', '14:00', '15:30', '90', 'Atemschutzübung']);
    expect(w[kopf.indexOf('Dienstart')]).toBe('Regeldienst');
    expect(w[kopf.indexOf('Wache / Standort')]).toBe('FRW 1 (Paffrather Straße)');
  });

  it('schreibt Ort, Atemschutz und Maßnahmen einer Übung', () => {
    const mit: Uebung = {
      ...uebung,
      thema: 'Übungsstrecke',
      ortId: 8,
      atemschutz: true,
      atemschutzMin: 35,
      massnahmen: [
        { massnahmeId: 9, anzahl: 2 },
        { massnahmeId: 3, anzahl: 1 },
      ],
    };
    const zeilen = erzeugeUebungenCsv([dienst, uebungsdienst], [mit, inSchicht], katalog).trim().split('\r\n');
    const kopf = zeilen[0].split(';');
    const spalte = (z: string, n: string) => z.split(';')[kopf.indexOf(n)];
    expect(spalte(zeilen[1], 'Ort')).toBe('Feuerwehrschule');
    expect(spalte(zeilen[1], 'Atemschutz')).toBe('ja');
    expect(spalte(zeilen[1], 'Atemschutz (min)')).toBe('35');
    // Maßnahmen ohne Rechtsgrundlage: nur Name und Anzahl
    expect(spalte(zeilen[1], 'Maßnahmen')).toBe('Löschangriff im Innenangriff 2×, Epinephrin 1×');
    // ohne Angaben bleiben die Felder leer
    expect(spalte(zeilen[2], 'Ort')).toBe('');
    expect(spalte(zeilen[2], 'Atemschutz')).toBe('');
    expect(spalte(zeilen[2], 'Atemschutz (min)')).toBe('');
    expect(spalte(zeilen[2], 'Maßnahmen')).toBe('');
  });

  it('Übungsdienste haben in der Dienste-Liste keinen Plan und keinen Saldo, aber Übungszeit', () => {
    const zeilen = erzeugeDiensteCsv([dienst, uebungsdienst], [einsatz], katalog, true, [uebung]).trim().split('\r\n');
    const kopf = zeilen[0].split(';');
    const zeile = zeilen[1].split(';');
    const spalte = (n: string) => zeile[kopf.indexOf(n)];
    expect(spalte('Dienstart')).toBe('Übungsdienst');
    expect(spalte('Wache / Standort')).toBe('Feuerwehrschule');
    expect(spalte('Geplanter Beginn')).toBe('');
    expect(spalte('Über-/Minusstunden (min)')).toBe('');
    expect(spalte('Übungen')).toBe('1');
    expect(spalte('Übung (min)')).toBe('480'); // die ganze Dienstzeit
    const regel = zeilen[2].split(';');
    expect(regel[kopf.indexOf('Dienstart')]).toBe('Regeldienst');
    expect(regel[kopf.indexOf('Übungen')]).toBe('');
    expect(regel[kopf.indexOf('Übung (min)')]).toBe('');
  });
});
