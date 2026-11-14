import { describe, expect, it } from 'vitest';
import { berechneDienstZeiten } from '../src/domain/zeiten';
import { kraefteText, standardKraefte, stichwortText } from '../src/domain/stichwort';
import { MIN, zeitpunkt } from '../src/domain/time';

const T = (tag: number, h: number, m = 0) => zeitpunkt(`2026-11-${String(tag).padStart(2, '0')}`, h, m);
const dienst = { beginn: T(14, 7), ende: T(15, 7) };

describe('Wachzeit', () => {
  it('ohne Einsätze zählt der ganze Dienst als Wache (mit Dienstrand)', () => {
    const z = berechneDienstZeiten(dienst, [], true);
    expect(z.dienstMin).toBe(24 * 60);
    expect(z.wacheMin).toBe(24 * 60);
    expect(z.einsatzMin).toBe(0);
  });

  it('ohne Dienstrand bleibt die Wachzeit ohne Einsätze 0', () => {
    expect(berechneDienstZeiten(dienst, [], false).wacheMin).toBe(0);
  });

  it('rechnet Einsatz-, Rückfahrt- und Wachzeit', () => {
    const einsaetze = [
      { alarm: T(14, 9, 0), status1: T(14, 9, 40), status2: T(14, 9, 55) },
      { alarm: T(14, 12, 0), status1: T(14, 12, 30), status2: T(14, 12, 45) },
    ];
    const z = berechneDienstZeiten(dienst, einsaetze, true);
    expect(z.einsatzMin).toBe(70);
    expect(z.rueckfahrtMin).toBe(30);
    // 07:00–09:00 (120) + 09:55–12:00 (125) + 12:45–07:00 (1095)
    expect(z.wacheMin).toBe(120 + 125 + 1095);
    expect(z.einsatzMin + z.rueckfahrtMin + z.wacheMin).toBe(z.dienstMin);
  });

  it('zählt Wachzeit nur bis zur nächsten Alarmierung, ohne Dienstrand', () => {
    const einsaetze = [
      { alarm: T(14, 9, 0), status1: T(14, 9, 40), status2: T(14, 9, 55) },
      { alarm: T(14, 12, 0), status1: T(14, 12, 30), status2: T(14, 12, 45) },
    ];
    const z = berechneDienstZeiten(dienst, einsaetze, false);
    expect(z.wacheMin).toBe(125);
  });

  it('Einsatz ohne Status 2 liefert keine Wachzeit und wird gezählt', () => {
    const einsaetze = [
      { alarm: T(14, 9, 0), status1: T(14, 9, 40) },
      { alarm: T(14, 12, 0), status1: T(14, 12, 30), status2: T(14, 12, 45) },
    ];
    const z = berechneDienstZeiten(dienst, einsaetze, true);
    expect(z.ohneStatus2).toBe(1);
    expect(z.mitStatus2).toBe(1);
    expect(z.wacheMin).toBe(120 + 1095);
  });

  it('Einsatz über Mitternacht: Zeiten stimmen', () => {
    const einsaetze = [{ alarm: T(14, 23, 40), status1: T(15, 0, 25), status2: T(15, 0, 40) }];
    const z = berechneDienstZeiten(dienst, einsaetze, true);
    expect(z.einsatzMin).toBe(45);
    expect(z.rueckfahrtMin).toBe(15);
    expect(z.wacheMin).toBe(16 * 60 + 40 + 6 * 60 + 20);
  });

  it('erkennt Überschneidungen und Status 2 nach der nächsten Alarmierung', () => {
    const einsaetze = [
      { alarm: T(14, 10, 0), status1: T(14, 11, 0), status2: T(14, 11, 30) },
      { alarm: T(14, 10, 30), status1: T(14, 10, 50), status2: T(14, 11, 0) },
    ];
    const z = berechneDienstZeiten(dienst, einsaetze, true);
    expect(z.ueberlappungen).toBe(1);
    expect(z.status2NachAlarm).toBe(1);
    expect(z.wacheMin).toBeGreaterThanOrEqual(0);
  });

  it('schneidet Zeiten nach Dienstende ab', () => {
    const einsaetze = [{ alarm: T(15, 6, 30), status1: T(15, 7, 30), status2: T(15, 7, 45) }];
    const z = berechneDienstZeiten(dienst, einsaetze, true);
    expect(z.wacheMin).toBe(23 * 60 + 30);
  });

  it('ist unabhängig von der Reihenfolge der Einsätze', () => {
    const a = { alarm: T(14, 9, 0), status1: T(14, 9, 40), status2: T(14, 9, 55) };
    const b = { alarm: T(14, 12, 0), status1: T(14, 12, 30), status2: T(14, 12, 45) };
    expect(berechneDienstZeiten(dienst, [b, a], true)).toEqual(berechneDienstZeiten(dienst, [a, b], true));
  });

  it('rundet erst am Ende (keine Minutenfehler bei vielen Einsätzen)', () => {
    const einsaetze = Array.from({ length: 10 }, (_, i) => ({
      alarm: T(14, 8 + i, 0) + 20_000,
      status1: T(14, 8 + i, 30) + 20_000,
    }));
    const z = berechneDienstZeiten(dienst, einsaetze, true);
    expect(z.einsatzMin).toBe(300);
    expect(MIN).toBe(60_000);
  });
});

describe('Stichwort', () => {
  it('baut den Stichworttext', () => {
    expect(stichwortText('R', 'Chirurgisch')).toBe('R-Chirurgisch');
    expect(stichwortText('F', 'Gebäude', true)).toBe('F-Gebäude MIG');
    expect(stichwortText('H', 'P-Tür', true)).toBe('H-P-Tür');
  });
  it('baut den Kräfteansatz', () => {
    expect(kraefteText(1, 0)).toBe('R1N0');
    expect(kraefteText(1, 1)).toBe('R1N1');
  });
  it('belegt Kräfte je Typ vor', () => {
    expect(standardKraefte('R')).toEqual({ rtw: 1, nef: 0 });
    expect(standardKraefte('N')).toEqual({ rtw: 1, nef: 1 });
    expect(standardKraefte('F')).toBeNull();
  });
});
