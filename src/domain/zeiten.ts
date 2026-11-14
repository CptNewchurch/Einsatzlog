import { MIN } from './time';
import type { Dienst, Einsatz } from './types';

export type ZeitEinsatz = Pick<Einsatz, 'alarm' | 'status1' | 'status2'>;

export interface DienstSaldo {
  /** Minuten, die du vor dem geplanten Beginn angetreten bist (negativ: später angetreten). */
  vorMin: number;
  /** Minuten, die du nach dem geplanten Ende geblieben bist (negativ: früher abgelöst). */
  nachMin: number;
  /** Summe: positiv = Überstunden, negativ = Minusstunden. */
  saldoMin: number;
}

/** Überstunden oder Minusstunden eines Dienstes: Ist-Zeiten gegen die geplanten Zeiten. */
export function dienstSaldo(d: Pick<Dienst, 'sollBeginn' | 'sollEnde' | 'beginn' | 'ende'>): DienstSaldo {
  const vorMin = Math.round((d.sollBeginn - d.beginn) / MIN);
  const nachMin = Math.round((d.ende - d.sollEnde) / MIN);
  return { vorMin, nachMin, saldoMin: vorMin + nachMin };
}

export interface DienstZeiten {
  dienstMin: number;
  /** Alarmierung bis Status 1. */
  einsatzMin: number;
  /** Status 1 bis Status 2 (nur Einsätze mit Status 2). */
  rueckfahrtMin: number;
  /** Status 2 bis zur nächsten Alarmierung (und je nach Einstellung Dienstanfang und -ende). */
  wacheMin: number;
  einsaetze: number;
  mitStatus2: number;
  ohneStatus2: number;
  /** Nächste Alarmierung vor dem Status 1 des vorigen Einsatzes. */
  ueberlappungen: number;
  /** Status 2 liegt nach der nächsten Alarmierung (z. B. auf der Rückfahrt neu alarmiert). */
  status2NachAlarm: number;
}

/**
 * Teilt einen Dienst in Einsatz-, Rückfahrt- und Wachzeit.
 *
 * Wachzeit = Status 2 bis zur nächsten Alarmierung. Einsätze ohne Status 2 liefern keine Wachzeit.
 * Mit `randZaehltAlsWache` zählen zusätzlich Dienstbeginn bis zur ersten Alarmierung und der
 * letzte Status 2 bis Dienstende (ohne Einsätze: der ganze Dienst).
 */
export function berechneDienstZeiten(
  dienst: Pick<Dienst, 'beginn' | 'ende'>,
  einsaetze: readonly ZeitEinsatz[],
  randZaehltAlsWache: boolean,
): DienstZeiten {
  const liste = [...einsaetze].sort((a, b) => a.alarm - b.alarm);
  const { beginn, ende } = dienst;
  let einsatzMs = 0;
  let rueckMs = 0;
  let wacheMs = 0;
  let mitStatus2 = 0;
  let ohneStatus2 = 0;
  let ueberlappungen = 0;
  let status2NachAlarm = 0;

  if (randZaehltAlsWache) {
    const bis = liste.length > 0 ? Math.min(Math.max(liste[0].alarm, beginn), ende) : ende;
    wacheMs += Math.max(0, bis - beginn);
  }

  liste.forEach((e, i) => {
    einsatzMs += Math.max(0, e.status1 - e.alarm);
    const naechster = liste[i + 1];
    if (naechster && naechster.alarm < e.status1) ueberlappungen += 1;

    if (e.status2 == null) {
      ohneStatus2 += 1;
      return;
    }
    mitStatus2 += 1;
    rueckMs += Math.max(0, e.status2 - e.status1);

    const bisRoh = naechster ? naechster.alarm : randZaehltAlsWache ? ende : null;
    if (bisRoh == null) return;
    if (bisRoh < e.status2) {
      status2NachAlarm += 1;
      return;
    }
    const von = Math.max(e.status2, beginn);
    const bis = Math.min(bisRoh, ende);
    wacheMs += Math.max(0, bis - von);
  });

  const runde = (ms: number) => Math.round(ms / MIN);
  return {
    dienstMin: runde(ende - beginn),
    einsatzMin: runde(einsatzMs),
    rueckfahrtMin: runde(rueckMs),
    wacheMin: runde(wacheMs),
    einsaetze: liste.length,
    mitStatus2,
    ohneStatus2,
    ueberlappungen,
    status2NachAlarm,
  };
}
