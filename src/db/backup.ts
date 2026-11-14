import { db } from './db';
import { mergeEinstellungen, speichereEinstellungen, spiegleTheme } from './einstellungen';
import { SEED_VERSION } from './seed';
import { TYPEN, type Dienst, type Einsatz, type Einstellungen, type KatalogEintrag } from '../domain/types';

export const BACKUP_APP = 'einsatzlog';
export const BACKUP_VERSION = 1;

export interface BackupDatei {
  app: typeof BACKUP_APP;
  version: number;
  exportiertAm: number;
  daten: {
    dienste: Dienst[];
    einsaetze: Einsatz[];
    katalog: KatalogEintrag[];
    einstellungen: Einstellungen;
  };
}

export class BackupFehler extends Error {}

const KATALOG_TYPEN = ['kategorie', 'rolle', 'fahrzeug', 'wache', 'standort', 'massnahme', 'diagnose', 'ressource', 'tag'];

export async function erzeugeBackup(jetzt = Date.now()): Promise<BackupDatei> {
  const [dienste, einsaetze, katalog, einst] = await Promise.all([
    db.dienste.orderBy('beginn').toArray(),
    db.einsaetze.orderBy('alarm').toArray(),
    db.katalog.toArray(),
    db.meta.get('einstellungen'),
  ]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportiertAm: jetzt,
    daten: { dienste, einsaetze, katalog, einstellungen: mergeEinstellungen(einst?.value) },
  };
}

export function backupDateiname(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `einsatzlog-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const istObjekt = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Prüft eine geladene Datei vollständig, bevor irgendetwas überschrieben wird. */
export function pruefeBackup(roh: unknown): BackupDatei {
  if (!istObjekt(roh) || roh.app !== BACKUP_APP) {
    throw new BackupFehler('Das ist keine Einsatzlog-Sicherung.');
  }
  if (!istZahl(roh.version) || roh.version > BACKUP_VERSION) {
    throw new BackupFehler('Die Sicherung stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.');
  }
  const daten = roh.daten;
  if (!istObjekt(daten) || !Array.isArray(daten.dienste) || !Array.isArray(daten.einsaetze) || !Array.isArray(daten.katalog)) {
    throw new BackupFehler('Die Sicherung ist unvollständig.');
  }

  const dienstIds = new Set<number>();
  const dienste: Dienst[] = daten.dienste.map((d, i) => {
    const gueltig =
      istObjekt(d) &&
      istZahl(d.id) &&
      istZahl(d.beginn) &&
      istZahl(d.ende) &&
      d.ende > d.beginn &&
      (d.sollBeginn == null || istZahl(d.sollBeginn)) &&
      (d.sollEnde == null || istZahl(d.sollEnde));
    if (!gueltig) throw new BackupFehler(`Dienst Nr. ${i + 1} in der Sicherung ist ungültig.`);
    const dienst = d as unknown as Dienst;
    const sollBeginn = dienst.sollBeginn ?? dienst.beginn;
    const sollEnde = dienst.sollEnde ?? dienst.ende;
    if (sollEnde <= sollBeginn) throw new BackupFehler(`Dienst Nr. ${i + 1} in der Sicherung ist ungültig.`);
    dienstIds.add(dienst.id!);
    // Ältere Sicherungen kennen nur Ist-Zeiten: Soll = Ist, also weder Über- noch Minusstunden.
    return { ...dienst, sollBeginn, sollEnde };
  });

  const katalogIds = new Set<number>();
  daten.katalog.forEach((k, i) => {
    if (!istObjekt(k) || !istZahl(k.id) || typeof k.name !== 'string' || !KATALOG_TYPEN.includes(k.typ as string)) {
      throw new BackupFehler(`Listeneintrag Nr. ${i + 1} in der Sicherung ist ungültig.`);
    }
    katalogIds.add(k.id);
  });

  daten.einsaetze.forEach((e, i) => {
    if (
      !istObjekt(e) ||
      !istZahl(e.id) ||
      !istZahl(e.dienstId) ||
      !istZahl(e.kategorieId) ||
      !TYPEN.includes(e.typ as never) ||
      !istZahl(e.alarm) ||
      !istZahl(e.status1) ||
      e.status1 <= e.alarm ||
      (e.status2 != null && (!istZahl(e.status2) || e.status2 < e.status1))
    ) {
      throw new BackupFehler(`Einsatz Nr. ${i + 1} in der Sicherung ist ungültig.`);
    }
    if (!dienstIds.has(e.dienstId)) {
      throw new BackupFehler(`Einsatz Nr. ${i + 1} gehört zu einem Dienst, der in der Sicherung fehlt.`);
    }
    if (!katalogIds.has(e.kategorieId)) {
      throw new BackupFehler(`Einsatz Nr. ${i + 1} verweist auf ein Stichwort, das in der Sicherung fehlt.`);
    }
  });

  return {
    app: BACKUP_APP,
    version: roh.version,
    exportiertAm: istZahl(roh.exportiertAm) ? roh.exportiertAm : Date.now(),
    daten: {
      dienste,
      einsaetze: daten.einsaetze as unknown as Einsatz[],
      katalog: daten.katalog as unknown as KatalogEintrag[],
      einstellungen: mergeEinstellungen(daten.einstellungen),
    },
  };
}

export function leseBackupText(text: string): BackupDatei {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    throw new BackupFehler('Die Datei lässt sich nicht lesen. Ist es eine .json-Sicherung aus Einsatzlog?');
  }
  return pruefeBackup(roh);
}

/** Ersetzt alle Daten durch den Inhalt der Sicherung – ganz oder gar nicht. */
export async function stelleWiederHer(datei: BackupDatei): Promise<{ dienste: number; einsaetze: number; katalog: number }> {
  const { dienste, einsaetze, katalog, einstellungen } = datei.daten;
  await db.transaction('rw', db.dienste, db.einsaetze, db.katalog, db.meta, async () => {
    await Promise.all([db.dienste.clear(), db.einsaetze.clear(), db.katalog.clear(), db.meta.clear()]);
    await db.dienste.bulkAdd(dienste);
    await db.einsaetze.bulkAdd(einsaetze);
    await db.katalog.bulkAdd(katalog);
    await db.meta.bulkPut([
      { key: 'einstellungen', value: einstellungen },
      { key: 'seedVersion', value: SEED_VERSION },
    ]);
  });
  spiegleTheme(einstellungen.theme);
  return { dienste: dienste.length, einsaetze: einsaetze.length, katalog: katalog.length };
}

/** Merkt sich, wann zuletzt gesichert wurde (für die Erinnerung). */
export async function merkeBackupZeitpunkt(ms = Date.now()): Promise<void> {
  await speichereEinstellungen({ letztesBackup: ms });
}
