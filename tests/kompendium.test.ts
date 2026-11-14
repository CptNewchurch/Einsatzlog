import { describe, expect, it } from 'vitest';
import { MASSNAHMEN, MEDIKAMENTE } from '../src/db/seed';
import { EINORDNUNG, REGIONEN, REGIONEN_MIT_DATEN, durchfuehrungVon, empfehlung } from '../src/domain/kompendium';

const seedKeys = [...MASSNAHMEN, ...MEDIKAMENTE].map((m) => m.key);

describe('Kompendium Rheinisch-Bergischer Kreis', () => {
  it('jede Startlisten-Maßnahme ist eingeordnet, außer Sauerstoff', () => {
    const fehlt = seedKeys.filter((k) => !(k in EINORDNUNG.GL));
    expect(fehlt).toEqual(['med:sauerstoff']);
  });

  it('die Einordnung kennt nur Schlüssel der Startliste', () => {
    const unbekannt = Object.keys(EINORDNUNG.GL).filter((k) => !seedKeys.includes(k));
    expect(unbekannt).toEqual([]);
  });

  it('Schlüssel sind eindeutig', () => {
    expect(new Set(seedKeys).size).toBe(seedKeys.length);
  });

  it('Region „GL“ ist bekannt und als einzige mit Daten hinterlegt', () => {
    expect(REGIONEN.some((r) => r.code === 'GL')).toBe(true);
    expect(REGIONEN_MIT_DATEN.map((r) => r.code)).toEqual(['GL']);
  });
});

describe('Empfehlung der Rechtsgrundlage', () => {
  it('★ ist vorabdelegiert', () => {
    expect(empfehlung('GL', 'med:naloxon')?.vorgabe).toBe('vorab');
    expect(empfehlung('GL', 'med:glucose')?.vorgabe).toBe('vorab'); // RettAss ★
    expect(empfehlung('GL', 'inv:cpap')?.vorgabe).toBe('vorab');
  });

  it('ohne ★ bleibt nur die eigenverantwortliche Durchführung nach § 2a', () => {
    const e = empfehlung('GL', 'med:heparin')!;
    expect(e.vorgabe).toBe('eigen');
    expect(e.text).toMatch(/§ 2a/);
    expect(empfehlung('GL', 'inv:io')?.vorgabe).toBe('eigen');
    expect(empfehlung('GL', 'inv:iv')?.vorgabe).toBe('eigen'); // RS ohne ★
  });

  it('Notarzt-Level heißt: auf Anordnung', () => {
    expect(empfehlung('GL', 'med:lidocain')?.vorgabe).toBe('arzt');
    expect(empfehlung('GL', 'med:metamizol')?.vorgabe).toBe('arzt');
  });

  it('wechselnde Einordnung liefert keine Vorgabe, aber die Varianten', () => {
    const e = empfehlung('GL', 'med:epinephrin')!;
    expect(e.vorgabe).toBeNull();
    expect(e.varianten.length).toBeGreaterThan(5);
    expect(e.varianten.find((v) => v.kontext === 'Reanimation Erwachsene')?.durchfuehrung).toBe('vorab');
    expect(e.varianten.find((v) => v.kontext === 'Anaphylaxie i.m. unter 6 Jahre')?.durchfuehrung).toBe('eigen');
    const morphin = empfehlung('GL', 'med:morphin')!;
    expect(morphin.vorgabe).toBeNull();
    expect(morphin.varianten.map((v) => v.durchfuehrung)).toEqual(['vorab', 'arzt']);
  });

  it('nicht geführte Maßnahmen sagen das, ohne Vorgabe', () => {
    const e = empfehlung('GL', 'med:fentanyl')!;
    expect(e.vorgabe).toBeNull();
    expect(e.text).toMatch(/nicht geführt/);
    expect(e.varianten).toEqual([]);
  });

  it('ohne Region, ohne Schlüssel oder ohne Daten gibt es keine Aussage', () => {
    expect(empfehlung(undefined, 'med:naloxon')).toBeNull();
    expect(empfehlung('GL', undefined)).toBeNull();
    expect(empfehlung('GL', 'med:sauerstoff')).toBeNull();
    expect(empfehlung('D', 'med:naloxon')).toBeNull();
  });

  it('Abbildung Level und Stern auf die Rechtsgrundlage', () => {
    expect(durchfuehrungVon({ level: 'RS', stern: true })).toBe('vorab');
    expect(durchfuehrungVon({ level: 'RettAss', stern: false })).toBe('eigen');
    expect(durchfuehrungVon({ level: 'Notarzt', stern: false })).toBe('arzt');
  });
});
