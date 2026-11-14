import {
  bereichVon,
  TYPEN,
  type Bereich,
  type Dienst,
  type Einsatz,
  type KatalogEintrag,
  type MassnahmeArt,
  type Typ,
} from './types';
import { berechneDienstZeiten, dienstSaldo } from './zeiten';

// Einsätze zählen nach ihrer Alarmierung, Dienste und Dienstzeiten nach dem Dienstbeginn.
// Ein Dienst über Silvester kann damit Einsätze in zwei Jahren enthalten.

export interface StatFilter {
  /** Kalenderjahr oder null für alle Jahre. */
  jahr: number | null;
  bereich: Bereich | 'alle';
  /** Regeldienste, Zusatzdienste oder alle. */
  dienstart: 'alle' | 'regel' | 'zusatz';
}

export interface BereichsWert {
  label: string;
  rd: number;
  fw: number;
}

export interface Zeitsummen {
  dienstMin: number;
  einsatzMin: number;
  rueckfahrtMin: number;
  wacheMin: number;
  ohneStatus2: number;
  ueberlappungen: number;
}

export interface Ueberstunden {
  /** Überstunden minus Minusstunden. */
  saldoMin: number;
  plusMin: number;
  /** Minusstunden als positive Zahl. */
  minusMin: number;
  diensteMitPlus: number;
  diensteMitMinus: number;
  /** Saldo je Monat (Jahresansicht) oder je Kalenderjahr (Gesamt). */
  verlauf: { label: string; min: number }[];
}

export interface Feuerwehrwerte {
  einsaetze: number;
  mig: number;
  atemschutz: number;
  atemschutzMin: number;
}

export interface StichwortWert {
  typ: Typ;
  kategorieId: number;
  n: number;
  medianMin: number | null;
}

export interface Statistik {
  anzahl: number;
  rd: number;
  fw: number;
  dienste: number;
  einsaetzeProDienst: number | null;
  medianEinsatzMin: number | null;
  medianRdMin: number | null;
  medianFwMin: number | null;
  zeiten: Zeitsummen;
  ueberstunden: Ueberstunden;
  verlauf: BereichsWert[];
  wochentag: BereichsWert[];
  tageszeit: BereichsWert[];
  typ: { typ: Typ; n: number }[];
  stichworte: StichwortWert[];
  kraefte: { text: string; n: number }[];
  nachalarmiert: number;
  mitNachforderung: number;
  vonMirNachgefordert: number;
  feuerwehr: Feuerwehrwerte;
}

export const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const WOCHENTAGE_MO = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function median(werte: readonly number[]): number | null {
  if (werte.length === 0) return null;
  const s = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mitte] : (s[mitte - 1] + s[mitte]) / 2;
}

/** Jahre mit Daten, neueste zuerst. */
export function verfuegbareJahre(dienste: readonly Dienst[], einsaetze: readonly Einsatz[]): number[] {
  const jahre = new Set<number>();
  dienste.forEach((d) => jahre.add(new Date(d.beginn).getFullYear()));
  einsaetze.forEach((e) => jahre.add(new Date(e.alarm).getFullYear()));
  return [...jahre].sort((a, b) => b - a);
}

const leer = (label: string): BereichsWert => ({ label, rd: 0, fw: 0 });

function zaehle(w: BereichsWert, bereich: Bereich) {
  if (bereich === 'RD') w.rd += 1;
  else w.fw += 1;
}

export function einsatzMinuten(e: Pick<Einsatz, 'alarm' | 'status1'>): number {
  return (e.status1 - e.alarm) / 60_000;
}

const dienstPasst = (d: Dienst, filter: StatFilter) =>
  filter.dienstart === 'alle' || (filter.dienstart === 'zusatz') === !!d.zusatzdienst;

/** Die Einsätze, die zu Jahr, Bereich und Dienstart des Filters passen. */
export function waehleEinsaetze(
  alleDienste: readonly Dienst[],
  alleEinsaetze: readonly Einsatz[],
  filter: StatFilter,
): Einsatz[] {
  const ids = new Set(alleDienste.filter((d) => dienstPasst(d, filter)).map((d) => d.id!));
  return alleEinsaetze.filter(
    (e) =>
      (filter.jahr == null || new Date(e.alarm).getFullYear() === filter.jahr) &&
      ids.has(e.dienstId) &&
      (filter.bereich === 'alle' || bereichVon(e.typ) === filter.bereich),
  );
}

export function berechneStatistik(
  alleDienste: readonly Dienst[],
  alleEinsaetze: readonly Einsatz[],
  filter: StatFilter,
  randZaehltAlsWache: boolean,
): Statistik {
  const imJahr = (ms: number) => filter.jahr == null || new Date(ms).getFullYear() === filter.jahr;

  const dienste = alleDienste.filter((d) => imJahr(d.beginn) && dienstPasst(d, filter));
  const einsaetze = waehleEinsaetze(alleDienste, alleEinsaetze, filter);

  // Zeitaufteilung: alle Einsätze der Dienste im Zeitraum, unabhängig vom Bereichsfilter.
  const proDienst = new Map<number, Einsatz[]>();
  alleEinsaetze.forEach((e) => {
    const l = proDienst.get(e.dienstId);
    if (l) l.push(e);
    else proDienst.set(e.dienstId, [e]);
  });
  const zeiten: Zeitsummen = {
    dienstMin: 0,
    einsatzMin: 0,
    rueckfahrtMin: 0,
    wacheMin: 0,
    ohneStatus2: 0,
    ueberlappungen: 0,
  };
  dienste.forEach((d) => {
    const z = berechneDienstZeiten(d, proDienst.get(d.id!) ?? [], randZaehltAlsWache);
    zeiten.dienstMin += z.dienstMin;
    zeiten.einsatzMin += z.einsatzMin;
    zeiten.rueckfahrtMin += z.rueckfahrtMin;
    zeiten.wacheMin += z.wacheMin;
    zeiten.ohneStatus2 += z.ohneStatus2;
    zeiten.ueberlappungen += z.ueberlappungen;
  });

  // Verlauf: Monate eines Jahres, sonst Kalenderjahre.
  let verlauf: BereichsWert[];
  let verlaufIndex: (ms: number) => number;
  if (filter.jahr != null) {
    verlauf = MONATE_KURZ.map(leer);
    verlaufIndex = (ms) => new Date(ms).getMonth();
  } else {
    const jahre = verfuegbareJahre(alleDienste, alleEinsaetze).sort((a, b) => a - b);
    const erstes = jahre[0] ?? new Date().getFullYear();
    const letztes = jahre[jahre.length - 1] ?? erstes;
    verlauf = Array.from({ length: letztes - erstes + 1 }, (_, i) => leer(String(erstes + i)));
    verlaufIndex = (ms) => new Date(ms).getFullYear() - erstes;
  }
  const ueberstunden: Ueberstunden = {
    saldoMin: 0,
    plusMin: 0,
    minusMin: 0,
    diensteMitPlus: 0,
    diensteMitMinus: 0,
    verlauf: verlauf.map((v) => ({ label: v.label, min: 0 })),
  };
  // Über- und Minusstunden gibt es nur im Regeldienst; ein Zusatzdienst hat keinen Plan.
  dienste.filter((d) => !d.zusatzdienst).forEach((d) => {
    const { saldoMin } = dienstSaldo(d);
    ueberstunden.saldoMin += saldoMin;
    if (saldoMin > 0) {
      ueberstunden.plusMin += saldoMin;
      ueberstunden.diensteMitPlus += 1;
    } else if (saldoMin < 0) {
      ueberstunden.minusMin -= saldoMin;
      ueberstunden.diensteMitMinus += 1;
    }
    const vi = verlaufIndex(d.beginn);
    if (ueberstunden.verlauf[vi]) ueberstunden.verlauf[vi].min += saldoMin;
  });
  const wochentag = WOCHENTAGE_MO.map(leer);
  const tageszeit = Array.from({ length: 12 }, (_, i) => leer(`${String(i * 2).padStart(2, '0')}–${String(i * 2 + 2).padStart(2, '0')}`));
  const typZaehler = new Map<Typ, number>(TYPEN.map((t) => [t, 0]));
  const stichwortZaehler = new Map<string, { typ: Typ; kategorieId: number; n: number; dauern: number[] }>();
  const kraefteZaehler = new Map<string, number>();
  const dauerAlle: number[] = [];
  const dauerRd: number[] = [];
  const dauerFw: number[] = [];
  let rd = 0;
  let fw = 0;
  let nachalarmiert = 0;
  let mitNachforderung = 0;
  let vonMir = 0;
  const feuerwehr: Feuerwehrwerte = { einsaetze: 0, mig: 0, atemschutz: 0, atemschutzMin: 0 };

  einsaetze.forEach((e) => {
    const bereich = bereichVon(e.typ);
    const d = new Date(e.alarm);
    if (bereich === 'RD') rd += 1;
    else fw += 1;
    const vi = verlaufIndex(e.alarm);
    if (verlauf[vi]) zaehle(verlauf[vi], bereich);
    zaehle(wochentag[(d.getDay() + 6) % 7], bereich);
    zaehle(tageszeit[Math.floor(d.getHours() / 2)], bereich);
    typZaehler.set(e.typ, (typZaehler.get(e.typ) ?? 0) + 1);

    const dauer = einsatzMinuten(e);
    const key = `${e.typ}|${e.kategorieId}`;
    const s = stichwortZaehler.get(key);
    if (s) {
      s.n += 1;
      s.dauern.push(dauer);
    } else stichwortZaehler.set(key, { typ: e.typ, kategorieId: e.kategorieId, n: 1, dauern: [dauer] });

    if (bereich === 'RD' && e.kraefteRtw != null && e.kraefteNef != null) {
      const k = `R${e.kraefteRtw}N${e.kraefteNef}`;
      kraefteZaehler.set(k, (kraefteZaehler.get(k) ?? 0) + 1);
    }

    dauerAlle.push(dauer);
    (bereich === 'RD' ? dauerRd : dauerFw).push(dauer);

    if (bereich === 'FW') {
      feuerwehr.einsaetze += 1;
      if (e.mig) feuerwehr.mig += 1;
      if (e.atemschutz) {
        feuerwehr.atemschutz += 1;
        feuerwehr.atemschutzMin += e.atemschutzMin ?? 0;
      }
    }

    if (e.nachalarmiert) nachalarmiert += 1;
    if (e.nachforderungen && e.nachforderungen.length > 0) {
      mitNachforderung += 1;
      if (e.nachforderungen.some((n) => n.vonMir)) vonMir += 1;
    }
  });

  return {
    anzahl: einsaetze.length,
    rd,
    fw,
    dienste: dienste.length,
    einsaetzeProDienst: dienste.length > 0 ? einsaetze.length / dienste.length : null,
    medianEinsatzMin: median(dauerAlle),
    medianRdMin: median(dauerRd),
    medianFwMin: median(dauerFw),
    zeiten,
    ueberstunden,
    verlauf,
    wochentag,
    tageszeit,
    typ: TYPEN.map((t) => ({ typ: t, n: typZaehler.get(t) ?? 0 })),
    stichworte: [...stichwortZaehler.values()]
      .map(({ dauern, ...rest }) => ({ ...rest, medianMin: median(dauern) }))
      .sort((a, b) => b.n - a.n),
    kraefte: [...kraefteZaehler.entries()].map(([text, n]) => ({ text, n })).sort((a, b) => b.n - a.n),
    nachalarmiert,
    mitNachforderung,
    vonMirNachgefordert: vonMir,
    feuerwehr,
  };
}

/* ---------- Maßnahmen-Nachweis ---------- */

export interface MassnahmenZeile {
  massnahmeId: number;
  name: string;
  art: MassnahmeArt;
  /** Wie oft durchgeführt (Summe der Anzahl). */
  anzahl: number;
  /** In wie vielen Einsätzen. */
  einsaetze: number;
  vorab: number;
  eigen: number;
  arzt: number;
  /** Ohne Angabe der Durchführung. */
  ohne: number;
}

export interface MassnahmenStatistik {
  zeilen: MassnahmenZeile[];
  summe: { anzahl: number; vorab: number; eigen: number; arzt: number; einsaetze: number };
}

/** Nachweis der Maßnahmen und Medikamente, getrennt nach Vorabdelegation, eigenverantwortlich und auf Anordnung. */
export function berechneMassnahmen(
  einsaetze: readonly Einsatz[],
  katalog: ReadonlyMap<number, KatalogEintrag>,
): MassnahmenStatistik {
  const zeilen = new Map<number, MassnahmenZeile>();
  const summe = { anzahl: 0, vorab: 0, eigen: 0, arzt: 0, einsaetze: 0 };
  einsaetze.forEach((e) => {
    const liste = e.massnahmen ?? [];
    if (liste.length > 0) summe.einsaetze += 1;
    liste.forEach((m) => {
      const k = katalog.get(m.massnahmeId);
      let z = zeilen.get(m.massnahmeId);
      if (!z) {
        z = {
          massnahmeId: m.massnahmeId,
          name: k?.name ?? '?',
          art: k?.art ?? 'sonstige',
          anzahl: 0,
          einsaetze: 0,
          vorab: 0,
          eigen: 0,
          arzt: 0,
          ohne: 0,
        };
        zeilen.set(m.massnahmeId, z);
      }
      z.anzahl += m.anzahl;
      z.einsaetze += 1;
      summe.anzahl += m.anzahl;
      if (m.durchfuehrung === 'vorab') {
        z.vorab += m.anzahl;
        summe.vorab += m.anzahl;
      } else if (m.durchfuehrung === 'eigen') {
        z.eigen += m.anzahl;
        summe.eigen += m.anzahl;
      } else if (m.durchfuehrung === 'arzt') {
        z.arzt += m.anzahl;
        summe.arzt += m.anzahl;
      } else z.ohne += m.anzahl;
    });
  });
  return {
    zeilen: [...zeilen.values()].sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, 'de')),
    summe,
  };
}
