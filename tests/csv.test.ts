import { describe, expect, it } from 'vitest';
import { csvDateiname, csvFeld, csvText, erzeugeDiensteCsv, erzeugeEinsaetzeCsv } from '../src/db/csv';
import { zeitpunkt } from '../src/domain/time';
import type { Dienst, Einsatz, KatalogEintrag } from '../src/domain/types';

const T = (datum: string, h: number, m = 0) => zeitpunkt(datum, h, m);

const katalog = new Map<number, KatalogEintrag>([
  [1, { id: 1, typ: 'kategorie', name: 'Chirurgisch', aktiv: true }],
  [2, { id: 2, typ: 'wache', name: 'FRW 1 (Paffrather Straße)', aktiv: true }],
  [3, { id: 3, typ: 'massnahme', name: 'Epinephrin', aktiv: true, art: 'medikament' }],
  [4, { id: 4, typ: 'ressource', name: 'Notarzt (NEF)', aktiv: true }],
  [5, { id: 5, typ: 'diagnose', name: 'Rückenschmerzen', aktiv: true }],
  [6, { id: 6, typ: 'diagnose', name: 'Akutes Koronarsyndrom (AKS)', aktiv: true }],
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

  it('schreibt Dienste mit Über-/Minusstunden', () => {
    const zeilen = erzeugeDiensteCsv([dienst], [einsatz], katalog, true).trim().split('\r\n');
    const w = zeilen[1].split(';');
    expect(w[0]).toBe('14.11.2026');
    expect(w[1]).toBe('Regeldienst');
    expect(w[2]).toBe('FRW 1 (Paffrather Straße)');
    expect(w[9]).toBe('35'); // 15 min früher + 20 min später
    expect(w[10]).toBe('1');
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
  });
});
