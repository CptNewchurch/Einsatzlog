import { describe, expect, it } from 'vitest';
import {
  berechneDienstEingabe,
  dienstArt,
  sollDauerStunden,
  sollText,
  weichtAb,
  type DienstEingabe,
} from '../src/domain/dienst';
import { dienstSaldo } from '../src/domain/zeiten';
import { endeNachDauer, zeitpunkt } from '../src/domain/time';

const T = (datum: string, h: number, m = 0) => zeitpunkt(datum, h, m);

const standard: DienstEingabe = {
  datum: '2026-11-14',
  beginnUhr: '07:30',
  dauerStunden: 24,
  istBeginn: '',
  istEnde: '',
};

function zeiten(e: Partial<DienstEingabe>) {
  const r = berechneDienstEingabe({ ...standard, ...e });
  expect(r.fehler).toEqual({});
  return r.zeiten!;
}

describe('Dienstzeiten aus der Eingabe', () => {
  it('24-h-Dienst 07:30 bis 07:30 ohne Abweichung', () => {
    const z = zeiten({});
    expect(z.sollBeginn).toBe(T('2026-11-14', 7, 30));
    expect(z.sollEnde).toBe(T('2026-11-15', 7, 30));
    expect(z.beginn).toBe(z.sollBeginn);
    expect(z.ende).toBe(z.sollEnde);
    expect(dienstSaldo(z).saldoMin).toBe(0);
    expect(weichtAb(z)).toBe(false);
  });

  it('Überstunden: früher angetreten und länger geblieben', () => {
    const z = zeiten({ istBeginn: '07:10', istEnde: '07:50' });
    expect(z.beginn).toBe(T('2026-11-14', 7, 10));
    expect(z.ende).toBe(T('2026-11-15', 7, 50));
    expect(dienstSaldo(z)).toEqual({ vorMin: 20, nachMin: 20, saldoMin: 40 });
    expect(weichtAb(z)).toBe(true);
  });

  it('Minusstunden: früher abgelöst', () => {
    const z = zeiten({ istEnde: '05:00' });
    expect(z.ende).toBe(T('2026-11-15', 5, 0));
    expect(dienstSaldo(z).saldoMin).toBe(-150);
  });

  it('Minusstunden: später angetreten', () => {
    const z = zeiten({ istBeginn: '8' });
    expect(z.beginn).toBe(T('2026-11-14', 8, 0));
    expect(dienstSaldo(z).saldoMin).toBe(-30);
  });

  it('12-h-Dienst und anderer Beginn', () => {
    const tag = zeiten({ dauerStunden: 12 });
    expect(tag.sollEnde).toBe(T('2026-11-14', 19, 30));
    const nacht = zeiten({ beginnUhr: '19:30', dauerStunden: 12, istEnde: '7:45' });
    expect(nacht.sollEnde).toBe(T('2026-11-15', 7, 30));
    expect(nacht.ende).toBe(T('2026-11-15', 7, 45));
    expect(dienstSaldo(nacht).saldoMin).toBe(15);
  });

  it('Umstellung auf Winterzeit: Wanduhr-Dauer, kein Saldo', () => {
    const z = zeiten({ datum: '2026-10-24' });
    expect(z.sollEnde).toBe(T('2026-10-25', 7, 30));
    expect(dienstSaldo(z).saldoMin).toBe(0);
  });

  it('meldet Fehler am richtigen Feld', () => {
    expect(berechneDienstEingabe({ ...standard, datum: '' }).fehler.datum).toBeTruthy();
    expect(berechneDienstEingabe({ ...standard, beginnUhr: '99' }).fehler.beginnUhr).toBeTruthy();
    expect(berechneDienstEingabe({ ...standard, dauerStunden: 0 }).fehler.dauer).toBeTruthy();
    expect(berechneDienstEingabe({ ...standard, dauerStunden: 60 }).fehler.dauer).toBeTruthy();
    expect(berechneDienstEingabe({ ...standard, istBeginn: 'abc' }).fehler.istBeginn).toBeTruthy();
    expect(berechneDienstEingabe({ ...standard, istEnde: '99:99' }).fehler.istEnde).toBeTruthy();
    expect(berechneDienstEingabe({ ...standard, istEnde: '8' }).zeiten).not.toBeNull();
  });

  it('das Ende muss nach dem Antritt liegen', () => {
    const r = berechneDienstEingabe({ ...standard, dauerStunden: 12, istBeginn: '7:30', istEnde: '7:30' });
    // Ende 07:30 liegt im Fenster des 12-h-Dienstes genau 12 h vor dem geplanten Ende 19:30 = Beginn
    expect(r.zeiten).toBeNull();
    expect(r.fehler.istEnde).toMatch(/nach dem Dienstantritt/);
  });
});

describe('Dienstart und Anzeige', () => {
  const d24 = { sollBeginn: T('2026-11-14', 7, 30), sollEnde: T('2026-11-15', 7, 30) };
  const d12 = { sollBeginn: T('2026-11-14', 7, 30), sollEnde: T('2026-11-14', 19, 30) };
  const nacht = { sollBeginn: T('2026-11-14', 19, 30), sollEnde: T('2026-11-15', 7, 30) };

  it('erkennt 24 h und 12 h zum üblichen Beginn', () => {
    expect(dienstArt(d24, '07:30')).toBe('24');
    expect(dienstArt(d12, '07:30')).toBe('12');
    expect(dienstArt(nacht, '07:30')).toBe('andere');
    expect(dienstArt(d24, '19:30')).toBe('andere');
  });

  it('beschreibt den Plan', () => {
    expect(sollText(d24)).toBe('24 h · 07:30–07:30');
    expect(sollText(nacht)).toBe('12 h · 19:30–07:30');
    expect(sollDauerStunden({ sollBeginn: T('2026-11-14', 8), sollEnde: T('2026-11-14', 8, 20) })).toBeNull();
    expect(sollDauerStunden({ sollBeginn: T('2026-10-24', 7, 30), sollEnde: endeNachDauer(T('2026-10-24', 7, 30), 24) })).toBe(24);
  });
});
