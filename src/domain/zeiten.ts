import { MIN } from './time';
import type { Dienst, Einsatz, Uebung } from './types';

export type ZeitEinsatz = Pick<Einsatz, 'alarm' | 'status1' | 'status2' | 'folgeAusStatus1'>;
export type ZeitUebung = Pick<Uebung, 'beginn' | 'ende'>;

/** Fasst sich überschneidende Zeiträume zusammen und beschneidet sie auf [von, bis]. */
export function vereinigeZeitraeume(liste: readonly ZeitUebung[], von: number, bis: number): [number, number][] {
  const teile = liste
    .map((u): [number, number] => [Math.max(u.beginn, von), Math.min(u.ende, bis)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const aus: [number, number][] = [];
  for (const [a, b] of teile) {
    const letzte = aus[aus.length - 1];
    if (letzte && a <= letzte[1]) letzte[1] = Math.max(letzte[1], b);
    else aus.push([a, b]);
  }
  return aus;
}

function ueberdeckung(zeitraeume: readonly [number, number][], von: number, bis: number): number {
  let ms = 0;
  for (const [a, b] of zeitraeume) ms += Math.max(0, Math.min(b, bis) - Math.max(a, von));
  return ms;
}

/**
 * Ende der Rückfahrt: Status 2. Wurde das Fahrzeug aus Status 1 heraus neu alarmiert (kein Status 2),
 * endet sie mit dieser Alarmierung. Sonst ist es Status 1.
 * `naechsterAlarm` ist die Alarmierung des folgenden Einsatzes im selben Dienst.
 */
export function rueckfahrtEnde(e: ZeitEinsatz, naechsterAlarm: number | undefined): number {
  if (e.status2 != null) return Math.max(e.status1, e.status2);
  if (e.folgeAusStatus1 && naechsterAlarm != null && naechsterAlarm > e.status1) return naechsterAlarm;
  return e.status1;
}

/** Zeit, in der ein Einsatz lief oder die Rückfahrt dauerte: Alarmierung bis Status 2 (bzw. bis zur Neualarmierung aus Status 1). */
export function einsatzZeitraeume(einsaetze: readonly ZeitEinsatz[], von: number, bis: number): [number, number][] {
  const liste = [...einsaetze].sort((a, b) => a.alarm - b.alarm);
  return vereinigeZeitraeume(
    liste.map((e, i) => ({ beginn: e.alarm, ende: rueckfahrtEnde(e, liste[i + 1]?.alarm) })),
    von,
    bis,
  );
}

/** Wie viele Millisekunden der Zeiträume `a` nicht in `b` liegen. Beide Listen müssen zusammengefasst sein. */
export function laengeOhne(a: readonly [number, number][], b: readonly [number, number][]): number {
  let ms = 0;
  for (const [von, bis] of a) ms += bis - von - ueberdeckung(b, von, bis);
  return ms;
}

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
  /** Status 1 bis Status 2, bei Alarmierung aus Status 1 bis zur nächsten Alarmierung (Einsätze ohne beides fehlen). */
  rueckfahrtMin: number;
  /** Status 2 bis zur nächsten Alarmierung (und je nach Einstellung Dienstanfang und -ende), ohne die Übungszeit. */
  wacheMin: number;
  /** Zeit, in der auf Wache geübt wurde. Sie gehört nicht mehr zur Wachzeit. */
  uebungMin: number;
  einsaetze: number;
  mitStatus2: number;
  /** Einsätze ohne Status 2, bei denen er fehlt. Wer danach aus Status 1 alarmiert wurde, zählt nicht dazu. */
  ohneStatus2: number;
  /** Einsätze, nach denen das Fahrzeug aus Status 1 heraus neu alarmiert wurde (kein Status 2). */
  ausStatus1: number;
  /** Nächste Alarmierung vor dem Status 1 des vorigen Einsatzes. */
  ueberlappungen: number;
  /** Status 2 liegt nach der nächsten Alarmierung (z. B. auf der Rückfahrt neu alarmiert). */
  status2NachAlarm: number;
}

/**
 * Teilt einen Dienst in Einsatz-, Rückfahrt- und Wachzeit.
 *
 * Wachzeit = Status 2 bis zur nächsten Alarmierung. Einsätze ohne Status 2 liefern keine Wachzeit.
 * Wurde das Fahrzeug danach aus Status 1 heraus alarmiert, gibt es keine Wachzeit, und die Zeit von
 * Status 1 bis zur nächsten Alarmierung zählt als Rückfahrt. Der fehlende Status 2 ist dann in Ordnung.
 * Mit `randZaehltAlsWache` zählen zusätzlich Dienstbeginn bis zur ersten Alarmierung und der
 * letzte Status 2 bis Dienstende (ohne Einsätze: der ganze Dienst).
 * Übungen in der Schicht werden getrennt ausgewiesen und aus der Wachzeit herausgerechnet. Das gilt
 * unabhängig davon, ob der Dienstrand als Wache zählt. Zeit, in der geübt wurde, während ein Einsatz
 * lief oder die Rückfahrt dauerte, bleibt dort, wo sie ist.
 * In einem reinen Übungsdienst zählt die ganze Zeit außerhalb von Einsatz und Rückfahrt als Übung.
 */
export function berechneDienstZeiten(
  dienst: Pick<Dienst, 'beginn' | 'ende' | 'uebungsdienst'>,
  einsaetze: readonly ZeitEinsatz[],
  randZaehltAlsWache: boolean,
  uebungen: readonly ZeitUebung[] = [],
): DienstZeiten {
  const liste = [...einsaetze].sort((a, b) => a.alarm - b.alarm);
  const { beginn, ende } = dienst;
  const uebungsdienst = !!dienst.uebungsdienst;
  const rand = randZaehltAlsWache;
  // Im Übungsdienst wird die ganze Dienstzeit geübt, nicht nur das, was als Übung erfasst ist.
  const geuebt = uebungsdienst ? vereinigeZeitraeume([{ beginn, ende }], beginn, ende) : vereinigeZeitraeume(uebungen, beginn, ende);
  let einsatzMs = 0;
  let rueckMs = 0;
  let wacheMs = 0;
  /** Zeit auf Wache zwischen von und bis, ohne die Zeit, in der geübt wurde. */
  const wache = (von: number, bis: number) => {
    const laenge = Math.max(0, bis - von);
    wacheMs += laenge - Math.min(laenge, ueberdeckung(geuebt, von, bis));
  };
  let mitStatus2 = 0;
  let ohneStatus2 = 0;
  let ausStatus1 = 0;
  let ueberlappungen = 0;
  let status2NachAlarm = 0;

  if (rand) {
    const bis = liste.length > 0 ? Math.min(Math.max(liste[0].alarm, beginn), ende) : ende;
    wache(beginn, bis);
  }

  liste.forEach((e, i) => {
    einsatzMs += Math.max(0, e.status1 - e.alarm);
    const naechster = liste[i + 1];
    if (naechster && naechster.alarm < e.status1) ueberlappungen += 1;

    if (e.status2 == null) {
      if (e.folgeAusStatus1) {
        ausStatus1 += 1;
        rueckMs += Math.max(0, rueckfahrtEnde(e, naechster?.alarm) - e.status1);
      } else {
        ohneStatus2 += 1;
      }
      return;
    }
    mitStatus2 += 1;
    rueckMs += Math.max(0, e.status2 - e.status1);

    const bisRoh = naechster ? naechster.alarm : rand ? ende : null;
    if (bisRoh == null) return;
    if (bisRoh < e.status2) {
      status2NachAlarm += 1;
      return;
    }
    wache(Math.max(e.status2, beginn), Math.min(bisRoh, ende));
  });

  const uebungMs = laengeOhne(geuebt, einsatzZeitraeume(liste, beginn, ende));
  const runde = (ms: number) => Math.round(ms / MIN);
  return {
    dienstMin: runde(ende - beginn),
    einsatzMin: runde(einsatzMs),
    rueckfahrtMin: runde(rueckMs),
    wacheMin: runde(wacheMs),
    uebungMin: runde(uebungMs),
    einsaetze: liste.length,
    mitStatus2,
    ohneStatus2,
    ausStatus1,
    ueberlappungen,
    status2NachAlarm,
  };
}
