import { describe, expect, it } from 'vitest';
import { berechneDienstZeiten, einsatzZeitraeume, laengeOhne, rueckfahrtEnde, vereinigeZeitraeume } from '../src/domain/zeiten';
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

describe('Übungen in der Schicht', () => {
  const einsaetze = [
    { alarm: T(14, 9, 0), status1: T(14, 9, 40), status2: T(14, 9, 55) },
    { alarm: T(14, 12, 0), status1: T(14, 12, 30), status2: T(14, 12, 45) },
  ];

  it('wandert aus der Wachzeit in die Übungszeit, die Summe bleibt', () => {
    const ohne = berechneDienstZeiten(dienst, einsaetze, true);
    const mit = berechneDienstZeiten(dienst, einsaetze, true, [{ beginn: T(14, 10), ende: T(14, 11, 30) }]);
    expect(mit.uebungMin).toBe(90);
    expect(mit.wacheMin).toBe(ohne.wacheMin - 90);
    expect(mit.einsatzMin).toBe(ohne.einsatzMin);
    expect(mit.einsatzMin + mit.rueckfahrtMin + mit.wacheMin + mit.uebungMin).toBe(mit.dienstMin);
  });

  it('überlappende Übungen zählen nur einmal', () => {
    const z = berechneDienstZeiten(dienst, einsaetze, true, [
      { beginn: T(14, 10), ende: T(14, 11) },
      { beginn: T(14, 10, 30), ende: T(14, 11, 30) },
    ]);
    expect(z.uebungMin).toBe(90);
  });

  it('Zeit im Einsatz oder auf der Rückfahrt bleibt dort', () => {
    // 08:30–10:30: davon 09:00–09:55 Einsatz und Rückfahrt, es bleiben 08:30–09:00 und 09:55–10:30
    const z = berechneDienstZeiten(dienst, einsaetze, true, [{ beginn: T(14, 8, 30), ende: T(14, 10, 30) }]);
    expect(z.uebungMin).toBe(30 + 35);
    expect(z.einsatzMin).toBe(70);
    expect(z.rueckfahrtMin).toBe(30);
    expect(z.einsatzMin + z.rueckfahrtMin + z.wacheMin + z.uebungMin).toBe(z.dienstMin);
  });

  it('zählt auch bei ausgeschaltetem Dienstrand, wenn vor dem ersten Einsatz geübt wurde', () => {
    // Ohne Dienstrand ist die Zeit bis 09:00 keine Wachzeit, die Übung bleibt trotzdem eine Übung.
    const z = berechneDienstZeiten(dienst, einsaetze, false, [{ beginn: T(14, 7, 30), ende: T(14, 8, 30) }]);
    expect(z.uebungMin).toBe(60);
    expect(z.wacheMin).toBe(125);
    const ohneUebung = berechneDienstZeiten(dienst, einsaetze, false);
    expect(ohneUebung.uebungMin).toBe(0);
    expect(ohneUebung.wacheMin).toBe(125);
  });

  it('schneidet Übungen auf den Dienst zu', () => {
    const z = berechneDienstZeiten(dienst, [], true, [{ beginn: T(14, 6), ende: T(14, 8) }, { beginn: T(15, 6, 30), ende: T(15, 9) }]);
    expect(z.uebungMin).toBe(60 + 30);
    expect(z.wacheMin).toBe(24 * 60 - 90);
  });

  it('ohne Übungen ist alles wie bisher', () => {
    expect(berechneDienstZeiten(dienst, einsaetze, true, []).uebungMin).toBe(0);
    expect(berechneDienstZeiten(dienst, einsaetze, true)).toEqual(berechneDienstZeiten(dienst, einsaetze, true, []));
  });
});

describe('Übungsdienst', () => {
  const uebungsdienst = { beginn: T(14, 8), ende: T(14, 16), uebungsdienst: true };

  it('die ganze Dienstzeit zählt als Übung, auch ohne erfasste Übung und ohne Dienstrand', () => {
    const z = berechneDienstZeiten(uebungsdienst, [], false);
    expect(z.dienstMin).toBe(480);
    expect(z.uebungMin).toBe(480);
    expect(z.wacheMin).toBe(0);
  });

  it('Einsatz und Rückfahrt zählen nicht als Übung', () => {
    const z = berechneDienstZeiten(uebungsdienst, [{ alarm: T(14, 10), status1: T(14, 10, 30), status2: T(14, 10, 50) }], false);
    expect(z.einsatzMin).toBe(30);
    expect(z.rueckfahrtMin).toBe(20);
    expect(z.uebungMin).toBe(480 - 50);
    expect(z.wacheMin).toBe(0);
  });

  it('erfasste Übungen ändern daran nichts', () => {
    const z = berechneDienstZeiten(uebungsdienst, [], true, [{ beginn: T(14, 8), ende: T(14, 10) }]);
    expect(z.uebungMin).toBe(480);
  });
});

describe('Zeiträume', () => {
  it('fasst zusammen, sortiert und beschneidet', () => {
    expect(
      vereinigeZeitraeume(
        [{ beginn: 50, ende: 80 }, { beginn: 0, ende: 20 }, { beginn: 10, ende: 30 }, { beginn: 90, ende: 120 }, { beginn: 5, ende: 5 }],
        0,
        100,
      ),
    ).toEqual([[0, 30], [50, 80], [90, 100]]);
  });

  it('Einsatzzeit reicht bis Status 2, ohne Status 2 bis Status 1', () => {
    expect(
      einsatzZeitraeume(
        [
          { alarm: 10, status1: 20, status2: 30 },
          { alarm: 50, status1: 60 },
        ],
        0,
        100,
      ),
    ).toEqual([[10, 30], [50, 60]]);
  });

  it('rechnet die Länge ohne einen anderen Zeitraum', () => {
    expect(laengeOhne([[0, 100]], [[10, 20], [90, 120]])).toBe(80);
    expect(laengeOhne([[0, 10], [50, 60]], [])).toBe(20);
  });
});

describe('Stichwort', () => {
  it('baut den Stichworttext', () => {
    expect(stichwortText('R', 'Chirurgisch')).toBe('R-Chirurgisch');
    expect(stichwortText('F', 'Gebäude', true)).toBe('F-Gebäude MIG');
    expect(stichwortText('H', 'P Tür', true)).toBe('H-P Tür');
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

describe('Alarmierung aus Status 1', () => {
  const erster = { alarm: T(14, 9, 0), status1: T(14, 9, 40), folgeAusStatus1: true };
  const zweiter = { alarm: T(14, 10, 0), status1: T(14, 10, 30), status2: T(14, 10, 45) };

  it('zählt die Zeit bis zur nächsten Alarmierung als Rückfahrt, ohne Wachzeit und ohne „Status 2 fehlt“', () => {
    const z = berechneDienstZeiten(dienst, [erster, zweiter], true);
    expect(z.ausStatus1).toBe(1);
    expect(z.ohneStatus2).toBe(0);
    expect(z.mitStatus2).toBe(1);
    expect(z.einsatzMin).toBe(40 + 30);
    // 09:40–10:00 (20) + 10:30–10:45 (15)
    expect(z.rueckfahrtMin).toBe(35);
    // 07:00–09:00 (120) + 10:45–07:00 (1215), dazwischen keine Wache
    expect(z.wacheMin).toBe(120 + 1215);
  });

  it('ohne den Schalter bleibt der fehlende Status 2 ein Fehlen', () => {
    const z = berechneDienstZeiten(dienst, [{ alarm: erster.alarm, status1: erster.status1 }, zweiter], true);
    expect(z.ausStatus1).toBe(0);
    expect(z.ohneStatus2).toBe(1);
    expect(z.rueckfahrtMin).toBe(15);
  });

  it('der Schalter wirkt nicht, wenn ein Status 2 eingetragen ist', () => {
    const z = berechneDienstZeiten(dienst, [{ ...erster, status2: T(14, 9, 55) }, zweiter], true);
    expect(z.ausStatus1).toBe(0);
    expect(z.rueckfahrtMin).toBe(15 + 15);
  });

  it('als letzter Einsatz des Dienstes gibt es keine Rückfahrtzeit, der fehlende Status 2 zählt trotzdem nicht als fehlend', () => {
    const z = berechneDienstZeiten(dienst, [erster], true);
    expect(z.ausStatus1).toBe(1);
    expect(z.ohneStatus2).toBe(0);
    expect(z.rueckfahrtMin).toBe(0);
  });

  it('rueckfahrtEnde: Status 2, sonst nächste Alarmierung, sonst Status 1', () => {
    expect(rueckfahrtEnde({ ...erster, status2: T(14, 9, 50) }, T(14, 10))).toBe(T(14, 9, 50));
    expect(rueckfahrtEnde(erster, T(14, 10))).toBe(T(14, 10));
    expect(rueckfahrtEnde(erster, undefined)).toBe(erster.status1);
    expect(rueckfahrtEnde(erster, T(14, 9, 30))).toBe(erster.status1);
    expect(rueckfahrtEnde({ alarm: erster.alarm, status1: erster.status1 }, T(14, 10))).toBe(erster.status1);
  });

  it('eine Übung in dieser Zeit zählt als Einsatz bzw. Rückfahrt, nicht als Übung', () => {
    const zeitraeume = einsatzZeitraeume([zweiter, erster], dienst.beginn, dienst.ende);
    expect(zeitraeume).toEqual([[T(14, 9, 0), T(14, 10, 45)]]);
  });
});
