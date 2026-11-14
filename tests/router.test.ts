import { describe, expect, it } from 'vitest';
import { katalogPfad, parseRoute, tabVon } from '../src/router';

describe('Routen für Dienste', () => {
  it('Regeldienst, Zusatzdienst und Übungsdienst anlegen', () => {
    expect(parseRoute('#/dienst/neu')).toEqual({ name: 'dienstNeu' });
    expect(parseRoute('#/dienst/neu/zusatz')).toEqual({ name: 'dienstNeu', zusatz: true });
    expect(parseRoute('#/dienst/neu/uebung')).toEqual({ name: 'dienstNeu', uebung: true });
  });

  it('Dienst ansehen und bearbeiten', () => {
    expect(parseRoute('#/dienst/12')).toEqual({ name: 'dienst', id: 12 });
    expect(parseRoute('#/dienst/12/bearbeiten')).toEqual({ name: 'dienstBearbeiten', id: 12 });
    expect(parseRoute('#/dienst/12/bearbeiten?zeiten=1')).toEqual({ name: 'dienstBearbeiten', id: 12, zeiten: true });
  });

  it('weist unvollständige Pfade ab', () => {
    expect(parseRoute('#/dienst/neu/etwas')).toEqual({ name: 'unbekannt' });
    expect(parseRoute('#/dienst/abc')).toEqual({ name: 'unbekannt' });
  });
});

describe('Routen für Einsätze und Übungen', () => {
  it('neuer Einsatz mit Dienst und Einsatzart', () => {
    expect(parseRoute('#/einsatz/neu')).toEqual({ name: 'einsatzNeu' });
    expect(parseRoute('#/einsatz/neu?dienst=3')).toEqual({ name: 'einsatzNeu', dienstId: 3 });
    expect(parseRoute('#/einsatz/neu?dienst=3&typ=ABC')).toEqual({ name: 'einsatzNeu', dienstId: 3, typ: 'ABC' });
    // Unbekannte Einsatzart und Übung sind keine Einsatztypen und werden ignoriert.
    expect(parseRoute('#/einsatz/neu?dienst=3&typ=X')).toEqual({ name: 'einsatzNeu', dienstId: 3 });
    expect(parseRoute('#/einsatz/neu?typ=uebung')).toEqual({ name: 'einsatzNeu' });
    expect(parseRoute('#/einsatz/7')).toEqual({ name: 'einsatz', id: 7 });
  });

  it('neue Übung und Übung bearbeiten', () => {
    expect(parseRoute('#/uebung/neu')).toEqual({ name: 'uebungNeu' });
    expect(parseRoute('#/uebung/neu?dienst=5')).toEqual({ name: 'uebungNeu', dienstId: 5 });
    expect(parseRoute('#/uebung/9')).toEqual({ name: 'uebung', id: 9 });
    expect(parseRoute('#/uebung/9/mehr')).toEqual({ name: 'unbekannt' });
    expect(parseRoute('#/uebung/x')).toEqual({ name: 'unbekannt' });
  });

  it('Übungen gehören zum Reiter „Einsätze“', () => {
    expect(tabVon(parseRoute('#/uebung/neu?dienst=1'))).toBe('einsaetze');
    expect(tabVon(parseRoute('#/uebung/9'))).toBe('einsaetze');
    expect(tabVon(parseRoute('#/einsatz/neu'))).toBe('einsaetze');
    expect(tabVon(parseRoute('#/dienst/4'))).toBe('dienste');
  });
});

describe('Routen für Listen', () => {
  it('kennt Feuerwehr-Maßnahmen und Übungsarten', () => {
    expect(parseRoute('#/mehr/kataloge/fw-massnahmen')).toEqual({ name: 'katalog', typ: 'fwmassnahme' });
    expect(parseRoute('#/mehr/kataloge/uebungsarten')).toEqual({ name: 'katalog', typ: 'uebungsart' });
    expect(katalogPfad('fwmassnahme')).toBe('/mehr/kataloge/fw-massnahmen');
    expect(katalogPfad('uebungsart')).toBe('/mehr/kataloge/uebungsarten');
  });

  it('jeder Listentyp hat einen Pfad, der zu ihm zurückführt', () => {
    (['kategorie', 'diagnose', 'massnahme', 'fwmassnahme', 'ressource', 'fahrzeug', 'rolle', 'wache', 'standort', 'uebungsart', 'tag'] as const).forEach((typ) => {
      expect(parseRoute(`#${katalogPfad(typ)}`)).toEqual({ name: 'katalog', typ });
    });
  });
});
