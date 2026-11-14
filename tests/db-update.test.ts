import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { erzeugeBackup, pruefeBackup } from '../src/db/backup';
import { FW_MASSNAHMEN, SEED_VERSION, UEBUNGSARTEN, sorgeFuerStartlisten } from '../src/db/seed';
import { speichereUebung } from '../src/db/speichern';
import { zeitpunkt } from '../src/domain/time';

/**
 * Die Datenbank der Version 1.0.0 (Schema 1) wird von der aktuellen App geöffnet. Bestehende Dienste, Einsätze,
 * Listen und Einstellungen müssen unverändert bleiben; neu kommen die Übungen und die Startlisten der Version 3.
 */
class AlteDb extends Dexie {
  constructor() {
    super('einsatzlog');
    this.version(1).stores({
      dienste: '++id, beginn',
      einsaetze: '++id, dienstId, alarm, typ',
      katalog: '++id, typ, name',
      meta: 'key',
    });
  }
}

const T = (h: number, m = 0) => zeitpunkt('2026-11-02', h, m);

const ids = {
  dienst: 0,
  einsatz: 0,
  chirurgisch: 0,
  eigene: 0,
};

describe('Update einer bestehenden Datenbank (Schema 1 → 2)', () => {
  beforeAll(async () => {
    const alt = new AlteDb();
    ids.chirurgisch = (await alt.table('katalog').add({ typ: 'kategorie', name: 'Chirurgisch', aktiv: true, typen: ['R'] })) as number;
    ids.eigene = (await alt.table('katalog').add({ typ: 'kategorie', name: 'Eigene Kategorie', aktiv: true, typen: ['N'] })) as number;
    await alt.table('katalog').add({ typ: 'diagnose', name: 'Sturz', aktiv: true });
    ids.dienst = (await alt.table('dienste').add({ sollBeginn: T(7, 30), sollEnde: T(7, 30) + 24 * 3_600_000, beginn: T(7, 30), ende: T(7, 30) + 24 * 3_600_000 })) as number;
    ids.einsatz = (await alt.table('einsaetze').add({
      dienstId: ids.dienst,
      typ: 'R',
      kategorieId: ids.chirurgisch,
      kraefteRtw: 1,
      kraefteNef: 0,
      alarm: T(9),
      status1: T(9, 40),
      status2: T(9, 55),
    })) as number;
    await alt.table('meta').bulkAdd([
      { key: 'seedVersion', value: 2 },
      { key: 'einstellungen', value: { theme: 'dark', backupErinnerungTage: 14, wachzeitMitDienstRand: false, regelBeginn: '07:30', region: 'GL' } },
    ]);
    alt.close();
  });

  it('übernimmt Dienste, Einsätze, Listen und Einstellungen unverändert', async () => {
    const dienste = await db.dienste.toArray();
    expect(dienste).toHaveLength(1);
    expect(dienste[0]).toMatchObject({ id: ids.dienst, beginn: T(7, 30) });

    const einsaetze = await db.einsaetze.toArray();
    expect(einsaetze).toHaveLength(1);
    expect(einsaetze[0]).toMatchObject({ id: ids.einsatz, dienstId: ids.dienst, kategorieId: ids.chirurgisch, alarm: T(9), status1: T(9, 40), status2: T(9, 55) });

    const einst = (await db.meta.get('einstellungen'))?.value as { theme: string; backupErinnerungTage: number; wachzeitMitDienstRand: boolean };
    expect(einst).toMatchObject({ theme: 'dark', backupErinnerungTage: 14, wachzeitMitDienstRand: false });
    expect((await db.meta.get('seedVersion'))?.value).toBe(2);
    expect(await db.uebungen.count()).toBe(0);
  });

  it('ergänzt die neuen Startlisten, ohne vorhandene Einträge anzufassen', async () => {
    await sorgeFuerStartlisten();

    const katalog = await db.katalog.toArray();
    const fw = katalog.filter((k) => k.typ === 'fwmassnahme');
    const arten = katalog.filter((k) => k.typ === 'uebungsart');
    expect(fw).toHaveLength(FW_MASSNAHMEN.reduce((n, g) => n + g.namen.length, 0));
    expect(arten).toHaveLength(UEBUNGSARTEN.length);
    expect(fw.every((k) => k.aktiv && k.gruppe != null)).toBe(true);

    // Eigene und frühere Einträge behalten ihre Nummer und ihre Eigenschaften.
    expect(katalog.find((k) => k.id === ids.chirurgisch)).toMatchObject({ name: 'Chirurgisch', typen: ['R'] });
    expect(katalog.find((k) => k.id === ids.eigene)).toMatchObject({ name: 'Eigene Kategorie', typen: ['N'] });
    expect(katalog.filter((k) => k.typ === 'kategorie' && k.name === 'Chirurgisch')).toHaveLength(1);
    // Die Listen der Version 1 und 2 werden nicht noch einmal angelegt.
    expect(katalog.filter((k) => k.typ === 'diagnose' && k.name === 'Sturz')).toHaveLength(1);
    expect(katalog.filter((k) => k.typ === 'wache')).toHaveLength(0);
    expect((await db.meta.get('seedVersion'))?.value).toBe(SEED_VERSION);

    // Ein zweiter Aufruf ändert nichts.
    const vorher = await db.katalog.count();
    await sorgeFuerStartlisten();
    expect(await db.katalog.count()).toBe(vorher);
  });

  it('nimmt Übungen im alten Dienst auf und sichert beides zusammen', async () => {
    const art = (await db.katalog.where('typ').equals('uebungsart').toArray())[0];
    const id = await speichereUebung({ dienstId: ids.dienst, beginn: T(14), ende: T(15, 30), artId: art.id! });
    expect(await db.uebungen.get(id)).toMatchObject({ dienstId: ids.dienst, artId: art.id });

    const datei = await erzeugeBackup();
    expect(datei.daten.dienste).toHaveLength(1);
    expect(datei.daten.einsaetze).toHaveLength(1);
    expect(datei.daten.uebungen).toHaveLength(1);
    expect(() => pruefeBackup(JSON.parse(JSON.stringify(datei)))).not.toThrow();
  });
});
