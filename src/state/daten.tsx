import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { mergeEinstellungen } from '../db/einstellungen';
import { sorgeFuerStartlisten } from '../db/seed';
import { stichwortText } from '../domain/stichwort';
import { fmtDatumKurz } from '../domain/time';
import type { Dienst, Einsatz, Einstellungen, KatalogEintrag } from '../domain/types';

export interface Daten {
  /** Neueste zuerst. */
  dienste: Dienst[];
  /** Neueste zuerst. */
  einsaetze: Einsatz[];
  katalog: KatalogEintrag[];
  einst: Einstellungen;
  katalogMap: Map<number, KatalogEintrag>;
  dienstMap: Map<number, Dienst>;
  /** Einsätze je Dienst, älteste zuerst. */
  einsaetzeNachDienst: Map<number, Einsatz[]>;
}

const DatenContext = createContext<Daten | null>(null);

export function useDaten(): Daten {
  const d = useContext(DatenContext);
  if (!d) throw new Error('useDaten außerhalb des DatenProvider');
  return d;
}

export function DatenProvider({ children }: { children: ReactNode }) {
  const dienste = useLiveQuery(() => db.dienste.orderBy('beginn').reverse().toArray(), []);
  const einsaetze = useLiveQuery(() => db.einsaetze.orderBy('alarm').reverse().toArray(), []);
  const katalog = useLiveQuery(() => db.katalog.toArray(), []);
  const einstRoh = useLiveQuery(async () => (await db.meta.get('einstellungen'))?.value ?? null, []);

  useEffect(() => {
    void sorgeFuerStartlisten();
    // Bittet den Browser, die Daten nicht von selbst zu löschen (z. B. bei wenig Speicherplatz).
    void navigator.storage?.persist?.();
  }, []);

  const wert = useMemo<Daten | null>(() => {
    if (!dienste || !einsaetze || !katalog || einstRoh === undefined) return null;
    const nachDienst = new Map<number, Einsatz[]>();
    [...einsaetze].reverse().forEach((e) => {
      const l = nachDienst.get(e.dienstId);
      if (l) l.push(e);
      else nachDienst.set(e.dienstId, [e]);
    });
    return {
      dienste,
      einsaetze,
      katalog,
      einst: mergeEinstellungen(einstRoh),
      katalogMap: new Map(katalog.map((k) => [k.id!, k])),
      dienstMap: new Map(dienste.map((d) => [d.id!, d])),
      einsaetzeNachDienst: nachDienst,
    };
  }, [dienste, einsaetze, katalog, einstRoh]);

  if (!wert) return <div className="laden" role="status">Lädt …</div>;
  return <DatenContext.Provider value={wert}>{children}</DatenContext.Provider>;
}

export const katalogName = (d: Daten, id: number | undefined): string =>
  id == null ? '' : (d.katalogMap.get(id)?.name ?? '?');

/** „R-Chirurgisch“ oder „F-Gebäude MIG“. */
export function einsatzTitel(d: Daten, e: Einsatz): string {
  return stichwortText(e.typ, katalogName(d, e.kategorieId), e.mig);
}

/** „Sa 14.11. · FRW 1 (Paffrather Straße)“ – bei Zusatzdiensten mit Stadt oder Organisation. */
export function dienstTitel(d: Daten, dienst: Dienst): string {
  const ort = katalogName(d, dienst.wacheId);
  return `${fmtDatumKurz(dienst.beginn)}${ort ? ` · ${ort}` : ''}`;
}

/** Der Dienst, der gerade läuft, sonst null. */
export function laufenderDienst(d: Daten, jetzt = Date.now()): Dienst | null {
  return d.dienste.find((x) => x.beginn <= jetzt && jetzt <= x.ende) ?? null;
}
