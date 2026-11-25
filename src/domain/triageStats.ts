import { bewertungVon, NACA_GRUPPEN, NACA_INFO, NACA_LEICHT_MAX, NACA_NOTARZT_AB, nacaGruppe, type NacaGruppe } from './triage';
import { ergebnisHinweis } from './ausgangMigration';
import { AUSGAENGE_RD, bereichVon, BEWERTUNGEN, type AlarmBewertung, type Ausgang, type AusgangAlt, type Einsatz, type KatalogEintrag } from './types';

/** Auswertung von Ergebnis, Schweregrad (NACA), Diagnosen und der Frage, ob die Alarmierung zum Befund passte. */

export interface Anteil {
  n: number;
  von: number;
}

export interface DiagnoseWert {
  id: number;
  name: string;
  n: number;
}

export interface Abweichung {
  leitstelleId: number;
  diagnoseId: number;
  leitstelle: string;
  diagnose: string;
  n: number;
}

export interface TriageStatistik {
  /** Einsätze je Bereich im gewählten Zeitraum. */
  rd: number;
  fw: number;
  /** Ergebnis der Rettungsdiensteinsätze; `null` heißt „nicht erfasst“. */
  ergebnis: { ausgang: Ausgang | AusgangAlt | null; n: number }[];
  /** Einsätze, deren Ergebnis zu prüfen ist (veraltet oder ohne Stichwort). */
  ergebnisPruefen: number;
  ergebnisErfasst: number;
  /** Sonstige Hilfeleistungen nach Stichwort, häufigste zuerst; ohne Stichwort unter „Ohne Stichwort“. */
  hilfeleistungen: { name: string; n: number }[];
  fehleinsaetzeRd: number;
  fehleinsaetzeFw: number;
  /** Verteilung des NACA-Scores I–VII. */
  naca: { wert: number; roemisch: string; n: number }[];
  nacaErfasst: number;
  /** Schweregrad nach Alarmtyp: RTW-Stichwort (R) gegenüber Notarztstichwort (N). */
  nacaGruppen: { gruppe: NacaGruppe; r: number; n: number }[];
  /** Notarztstichworte, bei denen der Patient nur leicht erkrankt war (NACA I–II). */
  notarztBeiLeicht: Anteil;
  /** RTW-Stichworte, bei denen der Patient schwer erkrankt war (NACA IV–VII). */
  rtwBeiSchwer: Anteil;
  /** Häufigste Verdachtsdiagnosen vor Ort. */
  diagnosen: DiagnoseWert[];
  diagnosenErfasst: number;
  /** Eigene Bewertung der Alarmierung; „Sonstige Hilfeleistung“ zählt von selbst als zu hoch. */
  bewertung: Record<AlarmBewertung, number>;
  bewertet: number;
  /** Einsätze, bei denen Leitstellen-Verdacht und Diagnose vor Ort beide erfasst sind. */
  vergleichbar: number;
  /** Davon: Verdacht und Befund unterscheiden sich. */
  abweichend: number;
  abweichungen: Abweichung[];
}

/**
 * Transporte insgesamt, aufgeteilt nach Notarztbegleitung (NA). Ambulante Versorgung (Transportverzicht)
 * zählt nicht dazu; ihre Summe steht getrennt, mit der Aufteilung nach NA und RTW.
 */
export function transportZahlen(ergebnis: TriageStatistik['ergebnis']): {
  gesamt: number;
  mitNa: number;
  ohneNa: number;
  ambulant: number;
  ambulantNa: number;
  ambulantRtw: number;
  tod: number;
} {
  const n = (a: Ausgang | AusgangAlt) => ergebnis.find((e) => e.ausgang === a)?.n ?? 0;
  // Veraltete Ergebnisse zählen mit, bis du sie genauer erfasst hast: „Transport“ als Transport ohne Angabe, „Verstorben“ als Tod.
  const mitNa = n('transportMitNotarzt');
  const ohneNa = n('transportOhneNotarzt');
  const ambulantNa = n('ambulantNotarzt');
  const ambulantRtw = n('ambulantRtw');
  return {
    gesamt: mitNa + ohneNa + n('transport'),
    mitNa,
    ohneNa,
    ambulant: ambulantNa + ambulantRtw + n('ambulant'),
    ambulantNa,
    ambulantRtw,
    tod: n('todEinsatzstelle') + n('todAufgefunden') + n('verstorben'),
  };
}

const istNaca = (n: number | undefined): n is number => n != null && Number.isInteger(n) && n >= 1 && n <= NACA_INFO.length;

export function berechneTriage(einsaetze: readonly Einsatz[], katalog: ReadonlyMap<number, KatalogEintrag>): TriageStatistik {
  const name = (id: number) => katalog.get(id)?.name ?? '?';
  const ergebnis = new Map<Ausgang | AusgangAlt | null, number>([[null, 0], ...AUSGAENGE_RD.map((a): [Ausgang, number] => [a, 0])]);
  const naca = NACA_INFO.map((n) => ({ wert: n.wert, roemisch: n.roemisch, n: 0 }));
  const gruppen = new Map<NacaGruppe, { r: number; n: number }>(NACA_GRUPPEN.map((g) => [g, { r: 0, n: 0 }]));
  const diagnosen = new Map<number, number>();
  const hilfe = new Map<string, number>();
  const paare = new Map<string, Abweichung>();
  const bewertung = Object.fromEntries(BEWERTUNGEN.map((b) => [b, 0])) as Record<AlarmBewertung, number>;
  const notarztBeiLeicht: Anteil = { n: 0, von: 0 };
  const rtwBeiSchwer: Anteil = { n: 0, von: 0 };
  let pruefen = 0;
  let rd = 0;
  let fw = 0;
  let fehleinsaetzeRd = 0;
  let fehleinsaetzeFw = 0;
  let vergleichbar = 0;
  let abweichend = 0;

  einsaetze.forEach((e) => {
    if (bereichVon(e.typ) === 'FW') {
      fw += 1;
      if (e.ausgang === 'fehleinsatz') fehleinsaetzeFw += 1;
      return;
    }
    rd += 1;
    const a = e.ausgang ?? null;
    if (ergebnisHinweis(e)) pruefen += 1;
    ergebnis.set(a, (ergebnis.get(a) ?? 0) + 1);
    if (a === 'fehleinsatz') fehleinsaetzeRd += 1;
    if (a === 'hilfeleistung') {
      const h = e.hilfeleistungId != null ? name(e.hilfeleistungId) : 'Ohne Stichwort';
      hilfe.set(h, (hilfe.get(h) ?? 0) + 1);
    }

    if (istNaca(e.naca)) {
      naca[e.naca - 1].n += 1;
      const g = gruppen.get(nacaGruppe(e.naca))!;
      if (e.typ === 'N') {
        g.n += 1;
        notarztBeiLeicht.von += 1;
        if (e.naca <= NACA_LEICHT_MAX) notarztBeiLeicht.n += 1;
      } else {
        g.r += 1;
        rtwBeiSchwer.von += 1;
        if (e.naca >= NACA_NOTARZT_AB) rtwBeiSchwer.n += 1;
      }
    }

    if (e.diagnoseId != null) diagnosen.set(e.diagnoseId, (diagnosen.get(e.diagnoseId) ?? 0) + 1);

    const b = bewertungVon(e);
    if (b) bewertung[b] += 1;

    if (e.leitstelleDiagnoseId != null && e.diagnoseId != null) {
      vergleichbar += 1;
      if (e.leitstelleDiagnoseId !== e.diagnoseId) {
        abweichend += 1;
        const key = `${e.leitstelleDiagnoseId}>${e.diagnoseId}`;
        const p = paare.get(key);
        if (p) p.n += 1;
        else
          paare.set(key, {
            leitstelleId: e.leitstelleDiagnoseId,
            diagnoseId: e.diagnoseId,
            leitstelle: name(e.leitstelleDiagnoseId),
            diagnose: name(e.diagnoseId),
            n: 1,
          });
      }
    }
  });

  const erfasst = [...ergebnis.entries()].reduce((summe, [a, n]) => summe + (a === null ? 0 : n), 0);
  return {
    rd,
    fw,
    ergebnis: [...ergebnis.entries()].map(([ausgang, n]) => ({ ausgang, n })),
    ergebnisErfasst: erfasst,
    ergebnisPruefen: pruefen,
    hilfeleistungen: [...hilfe].map(([h, n]) => ({ name: h, n })).sort((x, y) => y.n - x.n || x.name.localeCompare(y.name, 'de')),
    fehleinsaetzeRd,
    fehleinsaetzeFw,
    naca,
    nacaErfasst: naca.reduce((summe, n) => summe + n.n, 0),
    nacaGruppen: NACA_GRUPPEN.map((gruppe) => ({ gruppe, ...gruppen.get(gruppe)! })),
    notarztBeiLeicht,
    rtwBeiSchwer,
    diagnosen: [...diagnosen.entries()]
      .map(([id, n]) => ({ id, name: name(id), n }))
      .sort((x, y) => y.n - x.n || x.name.localeCompare(y.name, 'de')),
    diagnosenErfasst: [...diagnosen.values()].reduce((summe, n) => summe + n, 0),
    bewertung,
    bewertet: BEWERTUNGEN.reduce((summe, b) => summe + bewertung[b], 0),
    vergleichbar,
    abweichend,
    abweichungen: [...paare.values()].sort((x, y) => y.n - x.n || x.leitstelle.localeCompare(y.leitstelle, 'de')),
  };
}
