import { describe, expect, it } from 'vitest';
import {
  filtereNacaBeispiele,
  gruppiereNacaBeispiele,
  NACA_BEISPIELE,
  NACA_FAECHER,
  suchKey,
  type NacaBeispiel,
} from '../src/domain/nacaBeispiele';
import { NACA_INFO } from '../src/domain/triage';

const je = (naca: number) => NACA_BEISPIELE.filter((b) => b.naca === naca);
const finde = (text: string, naca: number) => NACA_BEISPIELE.find((b) => b.text === text && b.naca === naca);

describe('NACA-Beispiele: Daten', () => {
  it('jeder Wert hat genug Beispiele', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(je(n).length, `NACA ${n}`).toBeGreaterThanOrEqual(15);
    expect(je(6).length).toBeGreaterThanOrEqual(5);
    expect(je(7).length).toBeGreaterThanOrEqual(3);
  });

  it('Werte, Fachgebiete und Texte sind gültig', () => {
    const faecher = new Set(NACA_FAECHER.map((f) => f.fach));
    for (const b of NACA_BEISPIELE) {
      expect(Number.isInteger(b.naca) && b.naca >= 1 && b.naca <= NACA_INFO.length, b.text).toBe(true);
      expect(faecher.has(b.fach), `${b.text}: Fachgebiet`).toBe(true);
      expect(b.text, 'Text getrimmt und nicht leer').toBe(b.text.trim());
      expect(b.text.length).toBeGreaterThan(2);
      for (const feld of [b.bedingung, b.auch]) {
        if (feld !== undefined) expect(feld, `${b.text}: Zusatzfeld`).toBe(feld.trim());
        if (feld !== undefined) expect(feld.length).toBeGreaterThan(0);
      }
    }
  });

  it('jedes Fachgebiet des Filters kommt vor', () => {
    for (const f of NACA_FAECHER) expect(NACA_BEISPIELE.some((b) => b.fach === f.fach), f.label).toBe(true);
  });

  it('keine doppelten Einträge', () => {
    const schluessel = NACA_BEISPIELE.map((b) => `${b.naca}|${b.text}|${b.bedingung ?? ''}`);
    expect(new Set(schluessel).size).toBe(schluessel.length);
  });

  it('Zeilen bleiben auf dem Handy lesbar kurz', () => {
    for (const b of NACA_BEISPIELE) {
      expect(b.text.length, b.text).toBeLessThanOrEqual(70);
      expect((b.bedingung ?? '').length, `${b.text}: Bedingung`).toBeLessThanOrEqual(90);
    }
  });

  it('Beispiele aus der Literatur stehen bei dem Wert, bei dem sie genannt werden', () => {
    const erwartet: [string, number][] = [
      ['Prellung', 1],
      ['Leichte Hautabschürfung', 1],
      ['Fingerfraktur', 2],
      ['Schulterluxation', 2],
      ['Exsikkose', 2],
      ['Oberschenkelfraktur', 3],
      ['Leichter Schlaganfall', 3],
      ['Rauchgasvergiftung', 3],
      ['Verdacht auf Myokardinfarkt', 4],
      ['Offene Schädelfraktur', 4],
      ['Wirbelverletzung mit neurologischen Ausfällen', 4],
      ['Medikamentenvergiftung', 4],
      ['Verlegung der Atemwege', 5],
      ['Rippenserienfraktur', 5],
      ['Apoplex', 5],
      ['Schädel-Hirn-Trauma III. Grades', 5],
      ['Erhebliche Opioidvergiftung', 5],
      ['Herzstillstand', 6],
      ['Kammerflimmern', 6],
      ['Tod nach erfolgloser Reanimation', 7],
    ];
    for (const [text, naca] of erwartet) {
      const b = finde(text, naca);
      expect(b, `${text} bei NACA ${naca}`).toBeDefined();
      expect(b?.lit, `${text}: Literatur-Kennzeichen`).toBe(true);
    }
  });

  it('der schwere Asthmaanfall steht bei IV und V, weil die Quellen abweichen', () => {
    expect(finde('Schwerer Asthmaanfall', 4)?.lit).toBe(true);
    expect(finde('Schwerer Asthmaanfall', 5)?.lit).toBe(true);
  });

  it('es gibt eine ausreichende Zahl von Beispielen aus der Literatur', () => {
    expect(NACA_BEISPIELE.filter((b) => b.lit).length).toBeGreaterThanOrEqual(30);
  });

  it('jeder Wert hat eine ausführliche Erklärung', () => {
    for (const n of NACA_INFO) {
      expect(n.lang.length, n.roemisch).toBeGreaterThan(3);
      expect(n.lang.endsWith('.'), n.roemisch).toBe(true);
    }
  });
});

describe('NACA-Beispiele: Suche', () => {
  it('vergleicht ohne Umlaute, Groß-/Kleinschreibung und Sonderzeichen', () => {
    expect(suchKey('SCHÄDEL-Hirn-Trauma')).toBe('schadel-hirn-trauma');
    expect(suchKey('  Fuß   bruch ')).toBe('fuss bruch');
    expect(suchKey('SpO₂')).toBe('spo2');
  });

  it('ohne Suche und Filter kommt alles zurück', () => {
    expect(filtereNacaBeispiele('')).toHaveLength(NACA_BEISPIELE.length);
    expect(filtereNacaBeispiele('   ')).toHaveLength(NACA_BEISPIELE.length);
  });

  it('findet über Suchbegriffe und Abkürzungen', () => {
    const werte = (s: string) => filtereNacaBeispiele(s).map((b) => b.naca);
    expect(filtereNacaBeispiele('AKS').map((b) => b.text)).toContain('Verdacht auf Myokardinfarkt');
    expect(werte('Herzinfarkt')).toEqual(expect.arrayContaining([4, 5]));
    expect(filtereNacaBeispiele('Hüftfraktur').map((b) => b.text)).toContain('Schenkelhalsfraktur');
    expect(werte('Unterzucker')).toEqual(expect.arrayContaining([2, 4, 5]));
    expect(filtereNacaBeispiele('COPD').length).toBeGreaterThanOrEqual(2);
    expect(filtereNacaBeispiele('SHT').map((b) => b.naca)).toEqual(expect.arrayContaining([3, 4, 5]));
  });

  it('findet auch Teile der Bedingung', () => {
    expect(filtereNacaBeispiele('Wortfetzen').map((b) => b.text)).toEqual(['Schwerer Asthmaanfall']);
  });

  it('Umlaute sind beim Suchen egal', () => {
    expect(filtereNacaBeispiele('schadel')).toEqual(filtereNacaBeispiele('Schädel'));
    expect(filtereNacaBeispiele('schadel').length).toBeGreaterThan(0);
    expect(filtereNacaBeispiele('uberdosis').length).toBeGreaterThan(0);
  });

  it('mehrere Wörter müssen alle passen', () => {
    const treffer = filtereNacaBeispiele('rippen fraktur');
    expect(treffer.length).toBeGreaterThanOrEqual(3);
    expect(treffer.every((b) => suchKey(`${b.text} ${b.bedingung ?? ''} ${b.auch ?? ''}`).includes('rippen'))).toBe(true);
    expect(filtereNacaBeispiele('rippen asthma')).toEqual([]);
  });

  it('ein Fachgebiet schränkt ein', () => {
    const gift = filtereNacaBeispiele('', 'vergiftung');
    expect(gift.length).toBeGreaterThanOrEqual(8);
    expect(gift.every((b) => b.fach === 'vergiftung')).toBe(true);
    const kombi = filtereNacaBeispiele('rauchgas', 'vergiftung');
    expect(kombi.length).toBeGreaterThanOrEqual(3);
    expect(filtereNacaBeispiele('rauchgas', 'psych')).toEqual([]);
  });

  it('ohne Treffer kommt eine leere Liste', () => {
    expect(filtereNacaBeispiele('xyzxyz')).toEqual([]);
  });

  it('behält die Reihenfolge der Liste', () => {
    const treffer = filtereNacaBeispiele('fraktur');
    const idx = treffer.map((b) => NACA_BEISPIELE.indexOf(b));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
});

describe('NACA-Beispiele: Gruppierung', () => {
  it('gruppiert aufsteigend nach NACA-Wert und verliert nichts', () => {
    const gruppen = gruppiereNacaBeispiele(NACA_BEISPIELE);
    expect(gruppen.map((g) => g.naca)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(gruppen.reduce((n, g) => n + g.eintraege.length, 0)).toBe(NACA_BEISPIELE.length);
    for (const g of gruppen) expect(g.eintraege.every((b) => b.naca === g.naca)).toBe(true);
  });

  it('ordnet innerhalb eines Werts nach Fachgebiet', () => {
    const reihenfolge = new Map(NACA_FAECHER.map((f, i) => [f.fach, i]));
    for (const g of gruppiereNacaBeispiele(NACA_BEISPIELE)) {
      const idx = g.eintraege.map((b) => reihenfolge.get(b.fach)!);
      expect(idx, `NACA ${g.naca}`).toEqual([...idx].sort((a, b) => a - b));
    }
  });

  it('lässt leere Werte weg', () => {
    const nur: NacaBeispiel[] = [{ naca: 5, fach: 'herz', text: 'A' }, { naca: 2, fach: 'herz', text: 'B' }];
    expect(gruppiereNacaBeispiele(nur).map((g) => g.naca)).toEqual([2, 5]);
    expect(gruppiereNacaBeispiele([])).toEqual([]);
  });
});
