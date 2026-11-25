import { db } from './db';
import { mergeEinstellungen, speichereEinstellungen, spiegleTheme } from './einstellungen';
import { sorgeFuerStartlisten } from './seed';
import { istAlarmstufe } from '../domain/alarmstufe';
import { TYPEN, type Dienst, type Einsatz, type Einstellungen, type KatalogEintrag, type Uebung } from '../domain/types';

export const BACKUP_APP = 'einsatzlog';
/** 2 = mit Übungen und Feuerwehr-Maßnahmen. Sicherungen der Version 1 lassen sich weiterhin einspielen. */
export const BACKUP_VERSION = 2;

/** Stand der Startlisten in Sicherungen der Version 1 (App 1.0.0). */
const SEED_STAND_VERSION_1 = 2;

export interface BackupDatei {
  app: typeof BACKUP_APP;
  version: number;
  exportiertAm: number;
  /** Stand der Startlisten beim Sichern; fehlende Listen werden nach dem Einspielen ergänzt. */
  seedVersion?: number;
  daten: {
    dienste: Dienst[];
    einsaetze: Einsatz[];
    katalog: KatalogEintrag[];
    uebungen: Uebung[];
    einstellungen: Einstellungen;
  };
}

export class BackupFehler extends Error {}

const KATALOG_TYPEN = [
  'kategorie',
  'rolle',
  'fahrzeug',
  'wache',
  'standort',
  'massnahme',
  'fwmassnahme',
  'diagnose',
  'ressource',
  'tag',
  'uebungsart',
];

export async function erzeugeBackup(jetzt = Date.now()): Promise<BackupDatei> {
  const [dienste, einsaetze, katalog, uebungen, einst, seed] = await Promise.all([
    db.dienste.orderBy('beginn').toArray(),
    db.einsaetze.orderBy('alarm').toArray(),
    db.katalog.toArray(),
    db.uebungen.orderBy('beginn').toArray(),
    db.meta.get('einstellungen'),
    db.meta.get('seedVersion'),
  ]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportiertAm: jetzt,
    seedVersion: Number(seed?.value ?? 0),
    daten: { dienste, einsaetze, katalog, uebungen, einstellungen: mergeEinstellungen(einst?.value) },
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
      (e.status2 != null && (!istZahl(e.status2) || e.status2 < e.status1)) ||
      // Neu in 1.5.0; ältere Sicherungen haben das Feld nicht.
      (e.folgeAusStatus1 != null && typeof e.folgeAusStatus1 !== 'boolean') ||
      // Die Alarmstufe kam später dazu; ältere Sicherungen haben sie nicht.
      (e.alarmstufe != null && !istAlarmstufe(e.alarmstufe))
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

  // Sicherungen der Version 1 kennen keine Übungen.
  const rohUebungen = daten.uebungen ?? [];
  if (!Array.isArray(rohUebungen)) throw new BackupFehler('Die Sicherung ist unvollständig.');
  rohUebungen.forEach((u, i) => {
    if (
      !istObjekt(u) ||
      !istZahl(u.id) ||
      !istZahl(u.artId) ||
      !istZahl(u.dienstId) ||
      !istZahl(u.beginn) ||
      !istZahl(u.ende) ||
      u.ende <= u.beginn ||
      // Ort, Atemschutz und Maßnahmen kamen später dazu; ältere Sicherungen haben sie nicht.
      (u.ortId != null && !istZahl(u.ortId)) ||
      (u.atemschutzMin != null && !istZahl(u.atemschutzMin)) ||
      (u.massnahmen != null &&
        (!Array.isArray(u.massnahmen) || u.massnahmen.some((m) => !istObjekt(m) || !istZahl(m.massnahmeId) || !istZahl(m.anzahl))))
    ) {
      throw new BackupFehler(`Übung Nr. ${i + 1} in der Sicherung ist ungültig.`);
    }
    if (!dienstIds.has(u.dienstId)) {
      throw new BackupFehler(`Übung Nr. ${i + 1} gehört zu einem Dienst, der in der Sicherung fehlt.`);
    }
    if (!katalogIds.has(u.artId)) {
      throw new BackupFehler(`Übung Nr. ${i + 1} verweist auf eine Übungsart, die in der Sicherung fehlt.`);
    }
  });

  return {
    app: BACKUP_APP,
    version: roh.version,
    exportiertAm: istZahl(roh.exportiertAm) ? roh.exportiertAm : Date.now(),
    seedVersion: istZahl(roh.seedVersion) ? roh.seedVersion : SEED_STAND_VERSION_1,
    daten: {
      dienste,
      einsaetze: daten.einsaetze as unknown as Einsatz[],
      katalog: daten.katalog as unknown as KatalogEintrag[],
      uebungen: rohUebungen as unknown as Uebung[],
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
export async function stelleWiederHer(
  datei: BackupDatei,
): Promise<{ dienste: number; einsaetze: number; uebungen: number; katalog: number }> {
  const { dienste, einsaetze, katalog, uebungen, einstellungen } = datei.daten;
  await db.transaction('rw', db.dienste, db.einsaetze, db.uebungen, db.katalog, db.meta, async () => {
    await Promise.all([db.dienste.clear(), db.einsaetze.clear(), db.uebungen.clear(), db.katalog.clear(), db.meta.clear()]);
    await db.dienste.bulkAdd(dienste);
    await db.einsaetze.bulkAdd(einsaetze);
    await db.uebungen.bulkAdd(uebungen);
    await db.katalog.bulkAdd(katalog);
    await db.meta.bulkPut([
      { key: 'einstellungen', value: einstellungen },
      { key: 'seedVersion', value: datei.seedVersion ?? SEED_STAND_VERSION_1 },
    ]);
  });
  // Eine ältere Sicherung kennt neuere Startlisten noch nicht; sie werden jetzt ergänzt.
  await sorgeFuerStartlisten();
  spiegleTheme(einstellungen.theme);
  return { dienste: dienste.length, einsaetze: einsaetze.length, uebungen: uebungen.length, katalog: katalog.length };
}

/** Merkt sich, wann zuletzt gesichert wurde (für die Erinnerung). */
export async function merkeBackupZeitpunkt(ms = Date.now()): Promise<void> {
  await speichereEinstellungen({ letztesBackup: ms });
}
