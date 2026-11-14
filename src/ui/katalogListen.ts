import { useMemo } from 'react';
import { nutzung, sortiereNachNutzung } from '../domain/katalogLogik';
import type { Bereich, KatalogEintrag, KatalogTyp } from '../domain/types';
import { useDaten } from '../state/daten';

export interface KatalogListe {
  /** Aktive Einträge, häufig genutzte zuerst; mit Bereich nur passende (oder ohne Bereichsangabe). */
  vorschlaege: KatalogEintrag[];
  /** Alle aktiven Einträge, häufig genutzte zuerst. */
  alle: KatalogEintrag[];
  zaehler: Map<number, number>;
  /** Namen aller Einträge, auch archivierter. */
  namen: Map<number, string>;
}

/** Vorsortierte Listen für die Auswahl-Chips. */
export function useKatalogListe(
  typ: KatalogTyp,
  optionen: { bereich?: Bereich; filter?: (k: KatalogEintrag) => boolean } = {},
): KatalogListe {
  const { katalog, dienste, einsaetze, uebungen } = useDaten();
  const { bereich, filter } = optionen;
  return useMemo(() => {
    const zaehler = nutzung(typ, dienste, einsaetze, uebungen);
    const aktive = sortiereNachNutzung(
      katalog.filter((k) => k.typ === typ && k.aktiv && (!filter || filter(k))),
      zaehler,
    );
    const vorschlaege = bereich ? aktive.filter((k) => !k.bereich || k.bereich === bereich) : aktive;
    return {
      vorschlaege,
      alle: aktive,
      zaehler,
      namen: new Map(katalog.map((k) => [k.id!, k.name])),
    };
  }, [katalog, dienste, einsaetze, uebungen, typ, bereich, filter]);
}

/** Entfernt Schlüssel mit dem Wert undefined, damit nichts Leeres gespeichert wird. */
export function ohneLeere<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}
