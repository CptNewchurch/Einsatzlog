import { einsatzZeitraeume, laengeOhne, vereinigeZeitraeume, type ZeitEinsatz } from './zeiten';
import { MIN } from './time';
import { dienstPasst, type StatFilter } from './stats';
import type { Bereich, Dienst, FwGruppe, KatalogEintrag, MassnahmeArt, Uebung } from './types';

/** Dauer einer Übung in Minuten. */
export const uebungMinuten = (u: Pick<Uebung, 'beginn' | 'ende'>): number => Math.round((u.ende - u.beginn) / MIN);

/**
 * Die Übungen, die zu Zeitraum, Bereich und Dienstart des Filters passen.
 * Der Bereich ergibt sich aus der Übungsart; Arten ohne Bereich passen zu beiden.
 * Die Dienstart ist die des Dienstes, zu dem die Übung gehört.
 */
export function waehleUebungen(
  dienste: readonly Dienst[],
  uebungen: readonly Uebung[],
  filter: StatFilter,
  katalog: ReadonlyMap<number, KatalogEintrag>,
): Uebung[] {
  const dienstMap = new Map(dienste.map((d) => [d.id!, d]));
  return uebungen.filter((u) => {
    const dienst = dienstMap.get(u.dienstId);
    if (!dienst || !dienstPasst(dienst, filter)) return false;
    if (filter.jahr != null && new Date(u.beginn).getFullYear() !== filter.jahr) return false;
    if (filter.bereich !== 'alle') {
      const bereich = katalog.get(u.artId)?.bereich;
      if (bereich && bereich !== filter.bereich) return false;
    }
    return true;
  });
}

export interface UebungsZeile {
  artId: number;
  name: string;
  bereich?: Bereich;
  anzahl: number;
  minuten: number;
}

export interface UebungsStatistik {
  /** Erfasste Übungen. */
  anzahl: number;
  /** Übungszeit insgesamt: die erfassten Übungen plus der nicht aufgeschlüsselte Rest der Übungsdienste. */
  minuten: number;
  /** Erfasste Übungen in einer normalen Schicht (Regel- oder Zusatzdienst). */
  inSchicht: { anzahl: number; minuten: number };
  /** Reine Übungsdienste: Zahl der Dienste, erfasste Übungen darin und ihre Dienstzeit. */
  imUebungsdienst: { dienste: number; anzahl: number; minuten: number };
  /** Zeit in Übungsdiensten, die keiner erfassten Übung zugeordnet ist (z. B. Pausen). Nur ohne Bereichsfilter. */
  restMin: number;
  /** Übungen, die als Atemschutzeinsatz gewertet werden, mit der Zeit unter Atemschutz. */
  atemschutz: { anzahl: number; minuten: number };
  /** Nach Dauer, die längste Art zuerst. */
  nachArt: UebungsZeile[];
}

export function berechneUebungen(
  dienste: readonly Dienst[],
  uebungen: readonly Uebung[],
  filter: StatFilter,
  katalog: ReadonlyMap<number, KatalogEintrag>,
  einsaetze: readonly (ZeitEinsatz & { dienstId: number })[] = [],
): UebungsStatistik {
  const liste = waehleUebungen(dienste, uebungen, filter, katalog);
  const dienstMap = new Map(dienste.map((d) => [d.id!, d]));
  const inSchicht = { anzahl: 0, minuten: 0 };
  const imUebungsdienst = { dienste: 0, anzahl: 0, minuten: 0 };
  const arten = new Map<number, UebungsZeile>();
  const uebungsdienstIds = new Set<number>();
  const atemschutz = { anzahl: 0, minuten: 0 };

  liste.forEach((u) => {
    const min = uebungMinuten(u);
    const dienst = dienstMap.get(u.dienstId)!;
    if (u.atemschutz) {
      atemschutz.anzahl += 1;
      atemschutz.minuten += u.atemschutzMin ?? 0;
    }
    if (dienst.uebungsdienst) {
      imUebungsdienst.anzahl += 1;
      imUebungsdienst.minuten += min;
      uebungsdienstIds.add(u.dienstId);
    } else {
      inSchicht.anzahl += 1;
      inSchicht.minuten += min;
    }
    let z = arten.get(u.artId);
    if (!z) {
      const k = katalog.get(u.artId);
      z = { artId: u.artId, name: k?.name ?? '?', ...(k?.bereich ? { bereich: k.bereich } : {}), anzahl: 0, minuten: 0 };
      arten.set(u.artId, z);
    }
    z.anzahl += 1;
    z.minuten += min;
  });

  // Ohne Bereichsfilter zählt die ganze Dienstzeit der Übungsdienste, abzüglich Einsatz und Rückfahrt.
  // Was keine erfasste Übung abdeckt, bleibt als Rest.
  let restMs = 0;
  if (filter.bereich === 'alle') {
    const uebungenProDienst = new Map<number, Uebung[]>();
    uebungen.forEach((u) => uebungenProDienst.set(u.dienstId, [...(uebungenProDienst.get(u.dienstId) ?? []), u]));
    const einsaetzeProDienst = new Map<number, ZeitEinsatz[]>();
    einsaetze.forEach((e) => einsaetzeProDienst.set(e.dienstId, [...(einsaetzeProDienst.get(e.dienstId) ?? []), e]));
    dienste
      .filter((d) => d.uebungsdienst && dienstPasst(d, filter) && (filter.jahr == null || new Date(d.beginn).getFullYear() === filter.jahr))
      .forEach((d) => {
        const belegt = einsatzZeitraeume(einsaetzeProDienst.get(d.id!) ?? [], d.beginn, d.ende);
        const dienstUebung = laengeOhne([[d.beginn, d.ende]], belegt);
        const gedeckt = laengeOhne(vereinigeZeitraeume(uebungenProDienst.get(d.id!) ?? [], d.beginn, d.ende), belegt);
        restMs += Math.max(0, dienstUebung - gedeckt);
        uebungsdienstIds.add(d.id!);
      });
  }
  const restMin = Math.round(restMs / MIN);
  imUebungsdienst.dienste = uebungsdienstIds.size;
  imUebungsdienst.minuten += restMin;

  return {
    anzahl: liste.length,
    minuten: inSchicht.minuten + imUebungsdienst.minuten,
    inSchicht,
    imUebungsdienst,
    restMin,
    atemschutz,
    nachArt: [...arten.values()].sort((a, b) => b.minuten - a.minuten || a.name.localeCompare(b.name, 'de')),
  };
}

/* ---------- Maßnahmen in Übungen ---------- */

export interface UebungsMassnahmeZeile {
  massnahmeId: number;
  name: string;
  /** Gruppe einer Feuerwehr-Maßnahme. */
  gruppe?: FwGruppe;
  /** Art einer Maßnahme im Rettungsdienst. */
  art?: MassnahmeArt;
  /** Wie oft durchgeführt (Summe der Anzahl). */
  anzahl: number;
  /** In wie vielen Übungen. */
  uebungen: number;
}

export interface UebungsMassnahmen {
  /** Maßnahmen aus der Liste der Feuerwehr, die häufigste zuerst. */
  fw: UebungsMassnahmeZeile[];
  /** Maßnahmen und Medikamente aus der Liste des Rettungsdienstes, die häufigste zuerst. */
  rd: UebungsMassnahmeZeile[];
  summe: { anzahl: number; uebungen: number; verschiedene: number };
}

/**
 * Was in Übungen durchgeführt wurde, getrennt nach Feuerwehr und Rettungsdienst.
 * Das ist eine eigene Auswertung: Maßnahmen aus Übungen zählen nicht im Maßnahmen-Nachweis der Einsätze.
 * Mit einem Bereich zählen nur Maßnahmen aus der Liste dieses Bereichs.
 */
export function berechneUebungsMassnahmen(
  uebungen: readonly Uebung[],
  katalog: ReadonlyMap<number, KatalogEintrag>,
  bereich: Bereich | 'alle' = 'alle',
): UebungsMassnahmen {
  const zeilen = new Map<number, UebungsMassnahmeZeile & { bereich: Bereich }>();
  let anzahl = 0;
  let mitMassnahmen = 0;
  uebungen.forEach((u) => {
    let gezaehlt = false;
    // Dieselbe Maßnahme kann mehrfach eingetragen sein; die Übung zählt je Maßnahme nur einmal.
    const gesehen = new Set<number>();
    (u.massnahmen ?? []).forEach((m) => {
      const k = katalog.get(m.massnahmeId);
      const b: Bereich = k?.typ === 'fwmassnahme' ? 'FW' : 'RD';
      if (bereich !== 'alle' && b !== bereich) return;
      let z = zeilen.get(m.massnahmeId);
      if (!z) {
        z = {
          massnahmeId: m.massnahmeId,
          name: k?.name ?? '?',
          bereich: b,
          ...(b === 'FW' ? { gruppe: k?.gruppe ?? 'sonstige' } : { art: k?.art ?? 'sonstige' }),
          anzahl: 0,
          uebungen: 0,
        };
        zeilen.set(m.massnahmeId, z);
      }
      z.anzahl += m.anzahl;
      if (!gesehen.has(m.massnahmeId)) z.uebungen += 1;
      gesehen.add(m.massnahmeId);
      anzahl += m.anzahl;
      gezaehlt = true;
    });
    if (gezaehlt) mitMassnahmen += 1;
  });
  const sortiert = [...zeilen.values()].sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, 'de'));
  const ohneBereich = ({ bereich: _b, ...rest }: UebungsMassnahmeZeile & { bereich: Bereich }): UebungsMassnahmeZeile => rest;
  return {
    fw: sortiert.filter((z) => z.bereich === 'FW').map(ohneBereich),
    rd: sortiert.filter((z) => z.bereich === 'RD').map(ohneBereich),
    summe: { anzahl, uebungen: mitMassnahmen, verschiedene: zeilen.size },
  };
}

/**
 * Minuten unter Atemschutz, die beim Einschalten vorgeschlagen werden: 20 Minuten wie im Einsatz,
 * bei einer kürzeren Übung deren Dauer in Fünferschritten (mindestens 5).
 */
export function vorschlagAtemschutzMin(dauerMin: number | null): number {
  if (dauerMin == null || dauerMin >= 20) return 20;
  return Math.max(5, Math.floor(dauerMin / 5) * 5);
}
