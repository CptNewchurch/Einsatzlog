import { einsatzZeitraeume, laengeOhne, vereinigeZeitraeume, type ZeitEinsatz } from './zeiten';
import { MIN } from './time';
import { dienstPasst, type StatFilter } from './stats';
import type { Bereich, Dienst, KatalogEintrag, Uebung } from './types';

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

  liste.forEach((u) => {
    const min = uebungMinuten(u);
    const dienst = dienstMap.get(u.dienstId)!;
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
    nachArt: [...arten.values()].sort((a, b) => b.minuten - a.minuten || a.name.localeCompare(b.name, 'de')),
  };
}
