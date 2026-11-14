import { hatPlan, type Dienst, type Einsatz, type KatalogEintrag, type KatalogTyp, type Typ, type Uebung } from './types';

/** Entfernt Leerraum an den Rändern und doppelte Leerzeichen. */
export function normName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** Vergleichsschlüssel: ohne Groß-/Kleinschreibung. */
export function nameKey(s: string): string {
  return normName(s).toLocaleLowerCase('de-DE');
}

/** Wie oft ein Katalogeintrag je Typ verwendet wird (Anzahl der Einsätze, Dienste bzw. Übungen). */
export function nutzung(
  typ: KatalogTyp,
  dienste: readonly Dienst[],
  einsaetze: readonly Einsatz[],
  uebungen: readonly Uebung[] = [],
): Map<number, number> {
  const m = new Map<number, number>();
  const plus = (id: number | undefined) => {
    if (id != null) m.set(id, (m.get(id) ?? 0) + 1);
  };
  switch (typ) {
    case 'kategorie':
      einsaetze.forEach((e) => plus(e.kategorieId));
      break;
    case 'massnahme':
    case 'fwmassnahme':
      einsaetze.forEach((e) => new Set((e.massnahmen ?? []).map((x) => x.massnahmeId)).forEach(plus));
      break;
    case 'diagnose':
      einsaetze.forEach((e) => new Set([e.diagnoseId, e.leitstelleDiagnoseId]).forEach(plus));
      break;
    case 'ressource':
      einsaetze.forEach((e) => new Set((e.nachforderungen ?? []).map((x) => x.ressourceId)).forEach(plus));
      break;
    case 'fahrzeug':
      dienste.forEach((d) => plus(d.fahrzeugId));
      einsaetze.forEach((e) => plus(e.fahrzeugId));
      break;
    case 'rolle':
      dienste.forEach((d) => plus(d.rolleId));
      einsaetze.forEach((e) => plus(e.rolleId));
      break;
    case 'wache':
      dienste.forEach((d) => hatPlan(d) && plus(d.wacheId));
      break;
    case 'standort':
      dienste.forEach((d) => !hatPlan(d) && plus(d.wacheId));
      break;
    case 'uebungsart':
      uebungen.forEach((u) => plus(u.artId));
      break;
    case 'tag':
      einsaetze.forEach((e) => new Set(e.tagIds ?? []).forEach(plus));
      break;
  }
  return m;
}

/** Kategorien-Nutzung nur für einen Stichwort-Typ (R-Chirurgisch zählt nicht für N-Chirurgisch). */
export function kategorieNutzungFuerTyp(einsaetze: readonly Einsatz[], typ: Typ): Map<number, number> {
  const m = new Map<number, number>();
  einsaetze.forEach((e) => {
    if (e.typ === typ) m.set(e.kategorieId, (m.get(e.kategorieId) ?? 0) + 1);
  });
  return m;
}

/** Häufig genutzte zuerst, bei Gleichstand in der Reihenfolge, in der die Einträge angelegt wurden. */
export function sortiereNachNutzung<T extends KatalogEintrag>(
  eintraege: readonly T[],
  zaehler: ReadonlyMap<number, number>,
): T[] {
  return [...eintraege].sort((a, b) => {
    const d = (zaehler.get(b.id!) ?? 0) - (zaehler.get(a.id!) ?? 0);
    return d !== 0 ? d : (a.id ?? 0) - (b.id ?? 0);
  });
}
