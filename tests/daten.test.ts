import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { sorgeFuerStartlisten, seedEintraege, DIAGNOSEN, FW_MASSNAHMEN, MASSNAHMEN, MEDIKAMENTE, SEED_VERSION, UEBUNGSARTEN } from '../src/db/seed';
import { aendereKatalogEintrag, legeKatalogEintragAn } from '../src/db/katalog';
import { ladeEinstellungen, speichereEinstellungen } from '../src/db/einstellungen';
import { loescheAlleDaten, loescheDienst, loescheUebung, speichereDienst, speichereEinsatz, speichereUebung, verlaengereDienst } from '../src/db/speichern';
import { erzeugeBackup, leseBackupText, pruefeBackup, stelleWiederHer, BackupFehler } from '../src/db/backup';
import { zeitpunkt } from '../src/domain/time';
import type { Einsatz, Uebung } from '../src/domain/types';

const T = (datum: string, h: number, m = 0) => zeitpunkt(datum, h, m);

async function leeren() {
  await Promise.all([db.dienste.clear(), db.einsaetze.clear(), db.uebungen.clear(), db.katalog.clear(), db.meta.clear()]);
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

  const NEU_SEIT_V1 = ['diagnose', 'fwmassnahme', 'uebungsart'];

  it('ergänzt bei einer älteren Version nur die neuen Listen und lässt Eigenes unangetastet', async () => {
    // Stand der ersten Version: alles außer Diagnosen, Feuerwehr-Maßnahmen und Übungsarten, dazu ein selbst angelegter Eintrag.
    await db.katalog.bulkAdd(seedEintraege(0).filter((k) => !NEU_SEIT_V1.includes(k.typ)));
    await db.katalog.add({ typ: 'diagnose', name: 'sturz', aktiv: true });
    await db.meta.put({ key: 'seedVersion', value: 1 });
    const vorher = await db.katalog.where('typ').noneOf(NEU_SEIT_V1).count();

    await sorgeFuerStartlisten();
    await sorgeFuerStartlisten();

    expect(await db.katalog.where('typ').noneOf(NEU_SEIT_V1).count()).toBe(vorher);
    const diagnosen = await db.katalog.where('typ').equals('diagnose').toArray();
    expect(diagnosen).toHaveLength(DIAGNOSEN.length);
    expect(diagnosen.filter((d) => d.name.toLowerCase() === 'sturz')).toHaveLength(1);
    expect(await db.katalog.where('typ').equals('fwmassnahme').count()).toBe(FW_MASSNAHMEN.flatMap((g) => g.namen).length);
    expect(await db.katalog.where('typ').equals('uebungsart').count()).toBe(UEBUNGSARTEN.length);
    expect((await db.meta.get('seedVersion'))?.value).toBe(SEED_VERSION);
  });

  it('ergänzt ab Version 2 nur Feuerwehr-Maßnahmen und Übungsarten und doppelt nichts', async () => {
    await db.katalog.bulkAdd(seedEintraege(0).filter((k) => k.typ !== 'fwmassnahme' && k.typ !== 'uebungsart'));
    // Selbst angelegt, bevor es die Startliste gab; trägt einen Namen aus der Startliste.
    await db.katalog.add({ typ: 'fwmassnahme', name: 'erkundung', aktiv: true, gruppe: 'brand' });
    await db.meta.put({ key: 'seedVersion', value: 2 });
    const diagnosen = await db.katalog.where('typ').equals('diagnose').count();

    await sorgeFuerStartlisten();

    expect(await db.katalog.where('typ').equals('diagnose').count()).toBe(diagnosen);
    const fw = await db.katalog.where('typ').equals('fwmassnahme').toArray();
    expect(fw).toHaveLength(FW_MASSNAHMEN.flatMap((g) => g.namen).length);
    expect(fw.filter((k) => k.name.toLowerCase() === 'erkundung')).toHaveLength(1);
    expect(fw.every((k) => k.gruppe)).toBe(true);
  });

  it('legt Feuerwehr-Maßnahmen in Gruppen und Übungsarten mit Bereich an', async () => {
    await sorgeFuerStartlisten();
    const fw = await db.katalog.where('typ').equals('fwmassnahme').toArray();
    expect(new Set(fw.map((k) => k.gruppe))).toEqual(new Set(['rettung', 'brand', 'technik', 'gefahrstoff', 'sonstige']));
    const arten = await db.katalog.where('typ').equals('uebungsart').toArray();
    expect(arten.find((a) => a.name === 'Atemschutzübung')!.bereich).toBe('FW');
    expect(arten.find((a) => a.name === 'Reanimation')!.bereich).toBe('RD');
    expect(arten.find((a) => a.name === 'Dienstsport')!.bereich).toBeUndefined();
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

describe('Übungsdienst und Übungen speichern', () => {
  const basis = {
    sollBeginn: T('2026-11-14', 7, 30),
    sollEnde: T('2026-11-15', 7, 30),
    beginn: T('2026-11-14', 7, 30),
    ende: T('2026-11-15', 7, 30),
  };
  const art = async () => (await db.katalog.where('typ').equals('uebungsart').first())!.id!;

  it('ein Übungsdienst hat Soll = Ist und verändert die Vorbelegung nicht', async () => {
    await speichereDienst({ ...basis, wacheId: 1, fahrzeugId: 2, rolleId: 3 });
    const id = await speichereDienst({
      uebungsdienst: true,
      wacheId: 40,
      fahrzeugId: 41,
      rolleId: 42,
      sollBeginn: T('2026-11-20', 8),
      sollEnde: T('2026-11-20', 9),
      beginn: T('2026-11-21', 8),
      ende: T('2026-11-21', 16),
    });
    const d = (await db.dienste.get(id))!;
    expect(d.sollBeginn).toBe(d.beginn);
    expect(d.sollEnde).toBe(d.ende);
    expect(d.uebungsdienst).toBe(true);
    const e = await ladeEinstellungen();
    expect([e.standardWacheId, e.standardFahrzeugId, e.standardRolleId]).toEqual([1, 2, 3]);
    expect(e.letzterDienstId).toBe(id);
  });

  it('verlängert einen Übungsdienst samt Soll-Ende, einen Regeldienst nur das Ist-Ende', async () => {
    const regel = await speichereDienst({ ...basis });
    const uebung = await speichereDienst({ ...basis, uebungsdienst: true });
    const spaeter = T('2026-11-15', 9);
    await verlaengereDienst(regel, spaeter);
    await verlaengereDienst(uebung, spaeter);
    expect(await db.dienste.get(regel)).toMatchObject({ ende: spaeter, sollEnde: basis.sollEnde });
    expect(await db.dienste.get(uebung)).toMatchObject({ ende: spaeter, sollEnde: spaeter });
  });

  it('speichert eine Übung, merkt sich den Dienst und löscht sie wieder', async () => {
    await sorgeFuerStartlisten();
    const dienstId = await speichereDienst({ ...basis });
    const u: Uebung = { dienstId, beginn: T('2026-11-14', 14), ende: T('2026-11-14', 15, 30), artId: await art(), thema: 'Übungsstrecke' };
    const id = await speichereUebung(u);
    expect(await db.uebungen.get(id)).toMatchObject({ dienstId, thema: 'Übungsstrecke' });
    expect((await ladeEinstellungen()).letzterDienstId).toBe(dienstId);
    await loescheUebung(id);
    expect(await db.uebungen.count()).toBe(0);
  });

  it('beim Löschen eines Dienstes verschwinden auch seine Übungen, die anderer Dienste bleiben', async () => {
    await sorgeFuerStartlisten();
    const a = await speichereDienst({ ...basis });
    const b = await speichereDienst({ ...basis, uebungsdienst: true });
    const artId = await art();
    await speichereUebung({ dienstId: a, beginn: T('2026-11-14', 14), ende: T('2026-11-14', 15), artId });
    await speichereUebung({ dienstId: b, beginn: T('2026-11-14', 8), ende: T('2026-11-14', 12), artId });
    await loescheDienst(a);
    expect((await db.uebungen.toArray()).map((u) => u.dienstId)).toEqual([b]);
  });

  it('„Alle Daten löschen“ entfernt auch die Übungen', async () => {
    await sorgeFuerStartlisten();
    const dienstId = await speichereDienst({ ...basis });
    await speichereUebung({ dienstId, beginn: T('2026-11-14', 14), ende: T('2026-11-14', 15), artId: await art() });
    await loescheAlleDaten();
    expect(await db.uebungen.count()).toBe(0);
    expect(await db.dienste.count()).toBe(0);
    expect(await db.katalog.where('typ').equals('uebungsart').count()).toBe(UEBUNGSARTEN.length);
  });
});

describe('Sicherung', () => {
  /** Ein Regeldienst mit Übung und ein Übungsdienst mit Übung. */
  async function mitUebungen() {
    const { dienstId } = await beispielDaten();
    const artId = (await db.katalog.where('typ').equals('uebungsart').first())!.id!;
    const uebungsdienstId = await speichereDienst({
      uebungsdienst: true,
      sollBeginn: T('2026-05-09', 8),
      sollEnde: T('2026-05-09', 16),
      beginn: T('2026-05-09', 8),
      ende: T('2026-05-09', 16),
    });
    await speichereUebung({ dienstId, beginn: T('2026-11-14', 14), ende: T('2026-11-14', 15, 30), artId, thema: 'Atemschutzstrecke' });
    await speichereUebung({ dienstId: uebungsdienstId, beginn: T('2026-05-09', 8), ende: T('2026-05-09', 12), artId });
    return { dienstId, uebungsdienstId, artId };
  }

  it('Hin- und Rückweg erhält Übungen und das Kennzeichen „Übungsdienst“', async () => {
    await mitUebungen();
    const vorher = await erzeugeBackup(1_700_000_000_000);
    expect(vorher.daten.uebungen).toHaveLength(2);
    expect(vorher.daten.dienste.filter((d) => d.uebungsdienst)).toHaveLength(1);

    const text = JSON.stringify(vorher);
    await loescheAlleDaten();
    const zaehler = await stelleWiederHer(leseBackupText(text));
    expect(zaehler).toMatchObject({ dienste: 2, einsaetze: 1, uebungen: 2 });
    expect(await erzeugeBackup(1_700_000_000_000)).toEqual(vorher);
  });

  it('Hin- und Rückweg erhält Ort, Atemschutz und Maßnahmen einer Übung', async () => {
    const { dienstId, artId } = await mitUebungen();
    const ortId = (await legeKatalogEintragAn('standort', 'Feuerwehrschule')).id!;
    const massnahmeId = (await legeKatalogEintragAn('fwmassnahme', 'Löschangriff', { gruppe: 'brand' })).id!;
    const id = await speichereUebung({
      dienstId,
      beginn: T('2026-11-14', 16),
      ende: T('2026-11-14', 18),
      artId,
      ortId,
      atemschutz: true,
      atemschutzMin: 30,
      massnahmen: [{ massnahmeId, anzahl: 2 }],
    });
    const vorher = await erzeugeBackup(1_700_000_000_000);
    await loescheAlleDaten();
    await stelleWiederHer(leseBackupText(JSON.stringify(vorher)));
    expect(await db.uebungen.get(id)).toMatchObject({ ortId, atemschutz: true, atemschutzMin: 30, massnahmen: [{ massnahmeId, anzahl: 2 }] });
    expect(await erzeugeBackup(1_700_000_000_000)).toEqual(vorher);
  });

  it('lehnt kaputte Maßnahmen, Orte und Atemschutzminuten in Übungen ab', async () => {
    await mitUebungen();
    const gut = JSON.parse(JSON.stringify(await erzeugeBackup()));
    const mit = (aenderung: Record<string, unknown>) => {
      const kopie = structuredClone(gut);
      Object.assign(kopie.daten.uebungen[0], aenderung);
      return kopie;
    };
    expect(() => pruefeBackup(mit({ massnahmen: 'kaputt' }))).toThrow(/Übung Nr\. 1 in der Sicherung ist ungültig/);
    expect(() => pruefeBackup(mit({ massnahmen: [{ massnahmeId: 'x', anzahl: 1 }] }))).toThrow(/Übung Nr\. 1 in der Sicherung ist ungültig/);
    expect(() => pruefeBackup(mit({ massnahmen: [{ massnahmeId: 3 }] }))).toThrow(/Übung Nr\. 1 in der Sicherung ist ungültig/);
    expect(() => pruefeBackup(mit({ ortId: 'Schule' }))).toThrow(/Übung Nr\. 1 in der Sicherung ist ungültig/);
    expect(() => pruefeBackup(mit({ atemschutzMin: '20' }))).toThrow(/Übung Nr\. 1 in der Sicherung ist ungültig/);
    // ältere Sicherungen ohne diese Felder bleiben gültig
    expect(() => pruefeBackup(gut)).not.toThrow();
  });

  it('liest Sicherungen der Version 1 ohne Übungen', async () => {
    await beispielDaten();
    const alt = JSON.parse(JSON.stringify(await erzeugeBackup()));
    alt.version = 1;
    delete alt.daten.uebungen;
    const geprueft = pruefeBackup(alt);
    expect(geprueft.daten.uebungen).toEqual([]);
    await stelleWiederHer(geprueft);
    expect(await db.uebungen.count()).toBe(0);
    expect(await db.einsaetze.count()).toBe(1);
  });

  it('lehnt kaputte Übungen ab, ohne Daten zu verändern', async () => {
    await mitUebungen();
    const gut = await erzeugeBackup();
    const vorher = await db.uebungen.count();

    const ohneDienst = structuredClone(gut);
    ohneDienst.daten.uebungen[0].dienstId = 4711;
    expect(() => pruefeBackup(ohneDienst)).toThrow(/Übung Nr\. 1 gehört zu einem Dienst, der in der Sicherung fehlt/);

    const ohneArt = structuredClone(gut);
    ohneArt.daten.uebungen[1].artId = 4711;
    expect(() => pruefeBackup(ohneArt)).toThrow(/Übung Nr\. 2 verweist auf eine Übungsart/);

    const zeit = structuredClone(gut);
    zeit.daten.uebungen[0].ende = zeit.daten.uebungen[0].beginn;
    expect(() => pruefeBackup(zeit)).toThrow(/Übung Nr\. 1 in der Sicherung ist ungültig/);

    const keinDienst = structuredClone(gut) as unknown as { daten: { uebungen: unknown } };
    keinDienst.daten.uebungen = 'kaputt';
    expect(() => pruefeBackup(keinDienst)).toThrow(BackupFehler);

    expect(await db.uebungen.count()).toBe(vorher);
  });

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
