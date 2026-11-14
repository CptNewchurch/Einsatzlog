import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { sorgeFuerStartlisten, seedEintraege, DIAGNOSEN, MASSNAHMEN, MEDIKAMENTE, SEED_VERSION } from '../src/db/seed';
import { aendereKatalogEintrag, legeKatalogEintragAn } from '../src/db/katalog';
import { ladeEinstellungen, speichereEinstellungen } from '../src/db/einstellungen';
import { loescheAlleDaten, loescheDienst, speichereDienst, speichereEinsatz } from '../src/db/speichern';
import { erzeugeBackup, leseBackupText, pruefeBackup, stelleWiederHer, BackupFehler } from '../src/db/backup';
import { zeitpunkt } from '../src/domain/time';
import type { Einsatz } from '../src/domain/types';

const T = (datum: string, h: number, m = 0) => zeitpunkt(datum, h, m);

async function leeren() {
  await Promise.all([db.dienste.clear(), db.einsaetze.clear(), db.katalog.clear(), db.meta.clear()]);
}

async function beispielDaten() {
  await sorgeFuerStartlisten();
  const chir = (await db.katalog.where('typ').equals('kategorie').toArray()).find((k) => k.name === 'Chirurgisch')!;
  const iv = (await db.katalog.where('typ').equals('massnahme').toArray()).find((k) => k.name === 'i.v.-Zugang')!;
  const dienstId = await speichereDienst({
    sollBeginn: T('2026-11-14', 7, 30),
    sollEnde: T('2026-11-15', 7, 30),
    beginn: T('2026-11-14', 7, 30),
    ende: T('2026-11-15', 7, 30),
  });
  const einsatz: Einsatz = {
    dienstId,
    typ: 'R',
    kategorieId: chir.id!,
    kraefteRtw: 1,
    kraefteNef: 0,
    alarm: T('2026-11-14', 9),
    status1: T('2026-11-14', 9, 40),
    status2: T('2026-11-14', 9, 55),
    massnahmen: [{ massnahmeId: iv.id!, anzahl: 1, durchfuehrung: 'vorab' }],
  };
  const einsatzId = await speichereEinsatz(einsatz);
  return { dienstId, einsatzId, chir, iv };
}

beforeEach(leeren);

describe('Startlisten', () => {
  it('werden genau einmal angelegt', async () => {
    await sorgeFuerStartlisten();
    await sorgeFuerStartlisten();
    const m = await db.katalog.where('typ').equals('massnahme').toArray();
    expect(m).toHaveLength(MASSNAHMEN.length + MEDIKAMENTE.length);
    expect(m.filter((x) => x.art === 'medikament')).toHaveLength(MEDIKAMENTE.length);
    expect(new Set(m.map((x) => x.kompendiumKey)).size).toBe(m.length);
  });

  it('enthält Verdachtsdiagnosen in der Reihenfolge ihrer Häufigkeit', async () => {
    await sorgeFuerStartlisten();
    const diagnosen = await db.katalog.where('typ').equals('diagnose').sortBy('id');
    expect(diagnosen.map((d) => d.name)).toEqual(DIAGNOSEN);
    expect(diagnosen.map((d) => d.name)).toContain('Akutes Koronarsyndrom (AKS)');
    expect((await db.meta.get('seedVersion'))?.value).toBe(SEED_VERSION);
  });

  it('ergänzt bei einer älteren Version nur die neuen Listen und lässt Eigenes unangetastet', async () => {
    // Stand der ersten Version: alles außer den Diagnosen, dazu ein selbst angelegter Eintrag.
    await db.katalog.bulkAdd(seedEintraege(0).filter((k) => k.typ !== 'diagnose'));
    await db.katalog.add({ typ: 'diagnose', name: 'sturz', aktiv: true });
    await db.meta.put({ key: 'seedVersion', value: 1 });
    const vorher = await db.katalog.where('typ').notEqual('diagnose').count();

    await sorgeFuerStartlisten();
    await sorgeFuerStartlisten();

    expect(await db.katalog.where('typ').notEqual('diagnose').count()).toBe(vorher);
    const diagnosen = await db.katalog.where('typ').equals('diagnose').toArray();
    expect(diagnosen).toHaveLength(DIAGNOSEN.length);
    expect(diagnosen.filter((d) => d.name.toLowerCase() === 'sturz')).toHaveLength(1);
    expect((await db.meta.get('seedVersion'))?.value).toBe(SEED_VERSION);
  });

  it('enthält die Wachen', async () => {
    await sorgeFuerStartlisten();
    const wachen = await db.katalog.where('typ').equals('wache').toArray();
    expect(wachen.map((w) => w.name)).toEqual(['FRW 1 (Paffrather Straße)', 'FRW 2 (Bensberg)', 'RW 4 (Refrath)']);
    expect(await db.katalog.where('typ').equals('standort').count()).toBe(0);
  });
});

describe('Katalog', () => {
  it('legt Einträge ohne Dubletten an (Groß-/Kleinschreibung egal)', async () => {
    const a = await legeKatalogEintragAn('kategorie', '  Urologisch ', { typen: ['R'] });
    const b = await legeKatalogEintragAn('kategorie', 'urologisch', { typen: ['N'] });
    expect(b.id).toBe(a.id);
    expect((await db.katalog.get(a.id!))!.typen).toEqual(['R', 'N']);
    expect(await db.katalog.where('typ').equals('kategorie').count()).toBe(1);
  });

  it('aktiviert archivierte Einträge wieder', async () => {
    const a = await legeKatalogEintragAn('tag', 'Reanimation');
    await aendereKatalogEintrag(a.id!, { aktiv: false });
    const b = await legeKatalogEintragAn('tag', 'Reanimation');
    expect(b.id).toBe(a.id);
    expect((await db.katalog.get(a.id!))!.aktiv).toBe(true);
  });

  it('lehnt doppelte Umbenennung ab', async () => {
    await legeKatalogEintragAn('tag', 'Nacht');
    const b = await legeKatalogEintragAn('tag', 'Wochenende');
    await expect(aendereKatalogEintrag(b.id!, { name: 'nacht' })).rejects.toThrow(/gibt es in dieser Liste schon/);
  });

  it('gleiche Namen in verschiedenen Listen sind erlaubt', async () => {
    const a = await legeKatalogEintragAn('fahrzeug', 'RTW');
    const b = await legeKatalogEintragAn('ressource', 'RTW');
    expect(a.id).not.toBe(b.id);
  });
});

describe('Einsätze speichern', () => {
  it('merkt sich den Typ der Kategorie und den letzten Dienst', async () => {
    const { chir, dienstId } = await beispielDaten();
    const nachher = await db.katalog.get(chir.id!);
    expect(nachher!.typen).toEqual(expect.arrayContaining(['R', 'N']));
    const alt = nachher!.typen!.length;
    const e: Einsatz = {
      dienstId,
      typ: 'F',
      kategorieId: chir.id!,
      alarm: T('2026-11-14', 12),
      status1: T('2026-11-14', 12, 30),
    };
    await speichereEinsatz(e);
    expect((await db.katalog.get(chir.id!))!.typen).toHaveLength(alt + 1);
    expect((await ladeEinstellungen()).letzterDienstId).toBe(dienstId);
  });

  it('löscht einen Dienst samt Einsätzen', async () => {
    const { dienstId } = await beispielDaten();
    expect(await loescheDienst(dienstId)).toBe(1);
    expect(await db.einsaetze.count()).toBe(0);
    expect(await db.dienste.count()).toBe(0);
  });
});

describe('Dienste speichern', () => {
  const basis = {
    sollBeginn: T('2026-11-14', 7, 30),
    sollEnde: T('2026-11-15', 7, 30),
    beginn: T('2026-11-14', 7, 30),
    ende: T('2026-11-15', 7, 30),
  };

  it('merkt sich Wache, Fahrzeug und Rolle des Regeldienstes als Vorbelegung', async () => {
    await speichereDienst({ ...basis, wacheId: 1, fahrzeugId: 2, rolleId: 3 });
    const e = await ladeEinstellungen();
    expect([e.standardWacheId, e.standardFahrzeugId, e.standardRolleId]).toEqual([1, 2, 3]);
  });

  it('ein Zusatzdienst verändert die Vorbelegung nicht und hat Soll = Ist', async () => {
    await speichereDienst({ ...basis, wacheId: 1, fahrzeugId: 2, rolleId: 3 });
    const id = await speichereDienst({
      zusatzdienst: true,
      wacheId: 40,
      fahrzeugId: 41,
      rolleId: 42,
      sollBeginn: T('2026-11-20', 8),
      sollEnde: T('2026-11-20', 9),
      beginn: T('2026-11-20', 18),
      ende: T('2026-11-21', 2),
    });
    const d = (await db.dienste.get(id))!;
    expect(d.sollBeginn).toBe(d.beginn);
    expect(d.sollEnde).toBe(d.ende);
    const e = await ladeEinstellungen();
    expect([e.standardWacheId, e.standardFahrzeugId, e.standardRolleId]).toEqual([1, 2, 3]);
  });
});

describe('Sicherung', () => {
  it('Hin- und Rückweg liefert identische Daten', async () => {
    await beispielDaten();
    await speichereEinstellungen({ theme: 'dark', region: 'D' });
    const vorher = await erzeugeBackup(1_700_000_000_000);
    const text = JSON.stringify(vorher);

    await loescheAlleDaten();
    expect(await db.einsaetze.count()).toBe(0);

    const zaehler = await stelleWiederHer(leseBackupText(text));
    expect(zaehler.einsaetze).toBe(1);
    const nachher = await erzeugeBackup(1_700_000_000_000);
    expect(nachher).toEqual(vorher);
    expect((await ladeEinstellungen()).region).toBe('D');
  });

  it('ältere Sicherungen ohne Soll-Zeiten bekommen Soll = Ist', async () => {
    await beispielDaten();
    const alt = JSON.parse(JSON.stringify(await erzeugeBackup()));
    delete alt.daten.dienste[0].sollBeginn;
    delete alt.daten.dienste[0].sollEnde;
    const geprueft = pruefeBackup(alt);
    expect(geprueft.daten.dienste[0].sollBeginn).toBe(geprueft.daten.dienste[0].beginn);
    expect(geprueft.daten.dienste[0].sollEnde).toBe(geprueft.daten.dienste[0].ende);
  });

  it('nach der Wiederherstellung werden Startlisten nicht doppelt angelegt', async () => {
    await beispielDaten();
    const katalogVorher = await db.katalog.count();
    const roh = JSON.stringify(await erzeugeBackup());
    await stelleWiederHer(leseBackupText(roh));
    await sorgeFuerStartlisten();
    expect(await db.katalog.count()).toBe(katalogVorher);
  });

  it('neue Datensätze bekommen nach der Wiederherstellung neue IDs', async () => {
    const { einsatzId } = await beispielDaten();
    const roh = JSON.stringify(await erzeugeBackup());
    await stelleWiederHer(leseBackupText(roh));
    const neu = await speichereEinsatz({
      dienstId: (await db.dienste.toArray())[0].id!,
      typ: 'R',
      kategorieId: (await db.katalog.where('typ').equals('kategorie').first())!.id!,
      alarm: T('2026-11-14', 15),
      status1: T('2026-11-14', 15, 20),
    });
    expect(neu).toBeGreaterThan(einsatzId);
  });

  it('lehnt fremde und kaputte Dateien ab, ohne Daten zu verändern', async () => {
    await beispielDaten();
    const vorher = await db.einsaetze.count();
    expect(() => leseBackupText('{kein json')).toThrow(BackupFehler);
    expect(() => pruefeBackup({ app: 'etwas-anderes' })).toThrow(/keine Einsatzlog-Sicherung/);
    expect(() => pruefeBackup({ app: 'einsatzlog', version: 99, daten: {} })).toThrow(/neueren App-Version/);
    const gut = await erzeugeBackup();
    const waise = structuredClone(gut);
    waise.daten.einsaetze[0].dienstId = 4711;
    expect(() => pruefeBackup(waise)).toThrow(/Dienst, der in der Sicherung fehlt/);
    const zeit = structuredClone(gut);
    zeit.daten.einsaetze[0].status1 = zeit.daten.einsaetze[0].alarm;
    expect(() => pruefeBackup(zeit)).toThrow(/ungültig/);
    expect(await db.einsaetze.count()).toBe(vorher);
  });
});
