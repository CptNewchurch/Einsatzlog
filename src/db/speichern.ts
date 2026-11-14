import { db } from './db';
import { sorgeFuerStartlisten } from './seed';
import { speichereEinstellungen } from './einstellungen';
import { hatPlan, type Dienst, type Einsatz, type Uebung } from '../domain/types';

export async function speichereDienst(eingabe: Dienst): Promise<number> {
  // Zusatz- und Übungsdienste haben keinen Plan: Soll = Ist, und sie prägen keine Vorbelegung für Regeldienste.
  const dienst: Dienst = hatPlan(eingabe)
    ? eingabe
    : { ...eingabe, sollBeginn: eingabe.beginn, sollEnde: eingabe.ende };
  const id = await db.dienste.put(dienst);
  await speichereEinstellungen({
    letzterDienstId: id,
    ...(hatPlan(dienst)
      ? {
          ...(dienst.wacheId != null ? { standardWacheId: dienst.wacheId } : {}),
          ...(dienst.fahrzeugId != null ? { standardFahrzeugId: dienst.fahrzeugId } : {}),
          ...(dienst.rolleId != null ? { standardRolleId: dienst.rolleId } : {}),
        }
      : {}),
  });
  return id;
}

/**
 * Setzt das Dienstende später, z. B. weil ein Einsatz über das geplante Ende hinausging.
 * Beim Regeldienst bleibt der Plan stehen (daraus ergeben sich die Überstunden), bei Zusatz- und Übungsdiensten gilt Soll = Ist.
 */
export async function verlaengereDienst(id: number, ende: number): Promise<void> {
  await db.transaction('rw', db.dienste, async () => {
    const d = await db.dienste.get(id);
    if (!d || ende <= d.ende) return;
    await db.dienste.update(id, hatPlan(d) ? { ende } : { ende, sollEnde: ende });
  });
}

/** Löscht einen Dienst samt aller seiner Einsätze und Übungen. Liefert die Zahl der gelöschten Einsätze. */
export async function loescheDienst(id: number): Promise<number> {
  return db.transaction('rw', db.dienste, db.einsaetze, db.uebungen, async () => {
    const anzahl = await db.einsaetze.where('dienstId').equals(id).delete();
    await db.uebungen.where('dienstId').equals(id).delete();
    await db.dienste.delete(id);
    return anzahl;
  });
}

export async function speichereUebung(uebung: Uebung): Promise<number> {
  const id = await db.uebungen.put(uebung);
  await speichereEinstellungen({ letzterDienstId: uebung.dienstId });
  return id;
}

export async function loescheUebung(id: number): Promise<void> {
  await db.uebungen.delete(id);
}

export async function speichereEinsatz(einsatz: Einsatz): Promise<number> {
  return db.transaction('rw', db.einsaetze, db.katalog, db.meta, async () => {
    const id = await db.einsaetze.put(einsatz);
    const kat = await db.katalog.get(einsatz.kategorieId);
    if (kat && !(kat.typen ?? []).includes(einsatz.typ)) {
      await db.katalog.update(kat.id!, { typen: [...(kat.typen ?? []), einsatz.typ] });
    }
    return id;
  }).then(async (id) => {
    await speichereEinstellungen({ letzterDienstId: einsatz.dienstId });
    return id;
  });
}

export async function loescheEinsatz(id: number): Promise<void> {
  await db.einsaetze.delete(id);
}

/** Entfernt alle Dienste, Einsätze und Übungen und stellt die Startlisten wieder her. */
export async function loescheAlleDaten(): Promise<void> {
  await db.transaction('rw', db.dienste, db.einsaetze, db.uebungen, db.katalog, db.meta, async () => {
    await Promise.all([db.dienste.clear(), db.einsaetze.clear(), db.uebungen.clear(), db.katalog.clear(), db.meta.clear()]);
  });
  await sorgeFuerStartlisten();
}
