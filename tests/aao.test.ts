import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { AAO_STICHWORTE, KATEGORIEN_FW, SEED_VERSION, seedEintraege, sorgeFuerStartlisten } from '../src/db/seed';
import { stichwortText } from '../src/domain/stichwort';
import { zeitpunkt } from '../src/domain/time';
import type { Dienst, Einsatz, KatalogEintrag, Typ } from '../src/domain/types';

const T = (h: number, m = 0) => zeitpunkt('2026-11-14', h, m);

async function leeren() {
  await Promise.all([db.dienste.clear(), db.einsaetze.clear(), db.uebungen.clear(), db.katalog.clear(), db.meta.clear()]);
}

const kategorien = () => db.katalog.where('typ').equals('kategorie').toArray();
const nachName = async (name: string) => (await kategorien()).find((k) => k.name === name);

beforeEach(leeren);

describe('Stichworte der AAO', () => {
  it('legt die Feuerwehr-Stichworte nach der AAO an', async () => {
    await sorgeFuerStartlisten();
    const alle = await kategorien();
    const fuer = (typ: Typ) => alle.filter((k) => (k.typen ?? []).includes(typ));

    expect(fuer('F')).toHaveLength(37); // 36 Stichworte plus „LKW (ABC)“
    expect(fuer('H')).toHaveLength(26);
    expect(fuer('ABC')).toHaveLength(10);
    expect(fuer('R')).toHaveLength(3);
    expect(alle).toHaveLength(3 + 37 + 26 + 10 - 2); // „Bahn“ und „VU“ gelten für zwei Typen
    expect(alle.every((k) => k.aktiv)).toBe(true);
    expect((await db.meta.get('seedVersion'))?.value).toBe(SEED_VERSION);
  });

  it('führt gleiche Namen in mehreren Typen als einen Eintrag', async () => {
    await sorgeFuerStartlisten();
    expect((await nachName('Bahn'))!.typen).toEqual(['F', 'H']);
    expect((await nachName('VU'))!.typen).toEqual(['H', 'ABC']);
    expect((await nachName('LKW (ABC)'))!.typen).toEqual(['F']);
    expect((await nachName('Gas'))!.typen).toEqual(['ABC']);
    expect((await nachName('K/R/N-Tragehilfe'))!.typen).toEqual(['H']);
  });

  it('hat eindeutige Namen, keine MiG-Zeilen und nicht mehr die vorläufigen Vorschläge', async () => {
    await sorgeFuerStartlisten();
    const namen = (await kategorien()).map((k) => k.name.toLowerCase());
    expect(new Set(namen).size).toBe(namen.length);
    expect(namen.filter((n) => /\bmig\b/.test(n))).toEqual([]);
    for (const alt of ['p-tür', 'p-aufzug', 'p-klemmt', 'ölspur']) expect(namen).not.toContain(alt);
  });

  it('ordnet jedem Typ die Stichworte in der Reihenfolge der AAO zu', async () => {
    await sorgeFuerStartlisten();
    const alle = (await kategorien()).sort((a, b) => a.id! - b.id!);
    const aufTyp = (typ: Typ) => alle.filter((k) => (k.typen ?? []).includes(typ)).map((k) => k.name);
    // Innerhalb eines Typs bleibt die Reihenfolge der AAO, nur gemeinsame Namen (Bahn, VU) rücken an ihre erste Stelle.
    const ohneGemeinsame = (liste: string[]) => liste.filter((n) => n !== 'Bahn' && n !== 'VU');
    expect(ohneGemeinsame(aufTyp('F'))).toEqual(ohneGemeinsame(AAO_STICHWORTE.F));
    expect(ohneGemeinsame(aufTyp('H'))).toEqual(ohneGemeinsame(AAO_STICHWORTE.H));
    expect(ohneGemeinsame(aufTyp('ABC'))).toEqual(ohneGemeinsame(AAO_STICHWORTE.ABC));
    expect(stichwortText('H', 'P klemmt (> 1)')).toBe('H-P klemmt (> 1)');
    expect(stichwortText('F', 'Dachstuhl', true)).toBe('F-Dachstuhl MIG');
  });

  it('bringt ab Stand 3 nur die neuen Stichworte mit', () => {
    const neu = seedEintraege(3);
    expect(neu.every((k) => k.typ === 'kategorie')).toBe(true);
    expect(neu.map((k) => k.name)).toEqual(KATEGORIEN_FW.map((k) => k.name));
    expect(seedEintraege(4)).toEqual([]);
  });
});

/** Stand der Version 1.1.0: Startlisten bis Version 3, mit den vorläufigen Feuerwehr-Vorschlägen vor der AAO. */
const VOR_AAO: { name: string; typen: Typ[] }[] = [
  { name: 'Gebäude', typen: ['F'] },
  { name: 'Krankenhaus', typen: ['F'] },
  { name: 'LKW', typen: ['F'] },
  { name: 'Gewerbebetrieb', typen: ['F'] },
  { name: 'P-Tür', typen: ['H'] },
  { name: 'P-Aufzug', typen: ['H'] },
  { name: 'P-Klemmt', typen: ['H'] },
  { name: 'Ölspur', typen: ['H'] },
  { name: 'Gas', typen: ['H', 'ABC'] },
];

describe('Update von Version 1.1.0 auf die AAO', () => {
  const ids: Record<string, number> = {};
  let dienstId = 0;

  const eintrag = async (name: string, typen: Typ[], aktiv = true) =>
    (await db.katalog.add({ typ: 'kategorie', name, aktiv, typen } as KatalogEintrag)) as number;
  const einsatz = async (typ: Typ, kategorieId: number) =>
    (await db.einsaetze.add({ dienstId, typ, kategorieId, alarm: T(9), status1: T(9, 30) } as Einsatz)) as number;

  beforeEach(async () => {
    ids.chirurgisch = await eintrag('Chirurgisch', ['R', 'N']);
    for (const k of VOR_AAO) ids[k.name] = await eintrag(k.name, k.typen);
    await db.meta.put({ key: 'seedVersion', value: 3 });
    dienstId = (await db.dienste.add({ sollBeginn: T(7, 30), sollEnde: T(7, 30) + 24 * 3_600_000, beginn: T(7, 30), ende: T(7, 30) + 24 * 3_600_000 } as Dienst)) as number;
  });

  it('stellt nie benutzte Vorschläge auf die AAO um, ohne Nummern zu ändern', async () => {
    await sorgeFuerStartlisten();

    // Neue Schreibweise, gleiche Einträge.
    expect(await db.katalog.get(ids['P-Tür'])).toMatchObject({ name: 'P Tür', typen: ['H'], aktiv: true });
    expect(await db.katalog.get(ids['P-Aufzug'])).toMatchObject({ name: 'P Aufzug', typen: ['H'], aktiv: true });
    expect(await db.katalog.get(ids['P-Klemmt'])).toMatchObject({ name: 'P klemmt (1)', typen: ['H'], aktiv: true });
    // Gibt es in der AAO nicht als Hilfeleistung: ausgeblendet bzw. nur noch ABC.
    expect(await db.katalog.get(ids['Ölspur'])).toMatchObject({ name: 'Ölspur', aktiv: false });
    expect(await db.katalog.get(ids['Gas'])).toMatchObject({ name: 'Gas', typen: ['ABC'], aktiv: true });
    // Diese Stichworte stehen so in der AAO.
    for (const name of ['Gebäude', 'Krankenhaus', 'LKW', 'Gewerbebetrieb']) {
      expect(await db.katalog.get(ids[name])).toMatchObject({ name, typen: ['F'], aktiv: true });
    }
    expect(await db.katalog.get(ids.chirurgisch)).toMatchObject({ name: 'Chirurgisch', typen: ['R', 'N'] });
    expect((await db.meta.get('seedVersion'))?.value).toBe(SEED_VERSION);
  });

  it('enthält danach genau die Stichworte der AAO, ohne Dubletten', async () => {
    await sorgeFuerStartlisten();
    const alle = await kategorien();
    const namen = alle.map((k) => k.name.toLowerCase());
    expect(new Set(namen).size).toBe(namen.length);

    for (const soll of KATEGORIEN_FW) {
      const k = alle.find((x) => x.name.toLowerCase() === soll.name.toLowerCase());
      expect(k, soll.name).toBeDefined();
      expect(k!.typen, soll.name).toEqual(expect.arrayContaining(soll.typen));
      expect(k!.aktiv, soll.name).toBe(true);
    }
    // „Chirurgisch“, die AAO und als einziger Rest der ausgeblendete Vorschlag „Ölspur“.
    expect(alle).toHaveLength(1 + KATEGORIEN_FW.length + 1);
  });

  it('lässt benutzte Vorschläge unverändert und Einsätze bei ihrem Stichwort', async () => {
    const mitOelspur = await einsatz('H', ids['Ölspur']);
    const gasAlsH = await einsatz('H', ids['Gas']);
    const tuer = await einsatz('H', ids['P-Tür']);
    await sorgeFuerStartlisten();

    expect(await db.katalog.get(ids['Ölspur'])).toMatchObject({ aktiv: true, typen: ['H'] });
    expect((await db.katalog.get(ids['Gas']))!.typen).toEqual(['H', 'ABC']);
    // Der Einsatz zeigt weiter auf denselben Eintrag, der jetzt die Schreibweise der AAO trägt.
    const e = (await db.einsaetze.get(tuer))!;
    expect(e.kategorieId).toBe(ids['P-Tür']);
    expect(stichwortText(e.typ, (await db.katalog.get(e.kategorieId))!.name)).toBe('H-P Tür');
    expect((await db.einsaetze.get(mitOelspur))!.kategorieId).toBe(ids['Ölspur']);
    expect((await db.einsaetze.get(gasAlsH))!.kategorieId).toBe(ids['Gas']);
    expect(await db.einsaetze.count()).toBe(3);
  });

  it('nimmt „Gas“ nur dann aus H heraus, wenn es dort nie benutzt wurde', async () => {
    await einsatz('ABC', ids['Gas']);
    await sorgeFuerStartlisten();
    expect((await db.katalog.get(ids['Gas']))!.typen).toEqual(['ABC']);
  });

  it('fasst Eigenes nicht an', async () => {
    await db.katalog.update(ids['P-Tür'], { name: 'Tür zu' }); // selbst umbenannt
    const eigenesAufzug = await eintrag('P Aufzug', ['H']); // Name der AAO schon selbst angelegt
    const eigenesVu = await eintrag('VU', ['H']); // Stichwort der AAO, aber nur für H
    const eigene = await eintrag('Eigene Kategorie', ['F']);
    await db.katalog.update(ids['Krankenhaus'], { aktiv: false }); // bewusst ausgeblendet
    await sorgeFuerStartlisten();

    expect(await db.katalog.get(ids['P-Tür'])).toMatchObject({ name: 'Tür zu', typen: ['H'], aktiv: true });
    expect((await kategorien()).filter((k) => k.name === 'P Tür')).toHaveLength(1); // kommt neu aus der AAO dazu
    expect((await nachName('P Tür'))!.id).not.toBe(ids['P-Tür']);
    // Der Name ist schon vergeben, also bleibt der alte Vorschlag, wie er ist.
    expect(await db.katalog.get(ids['P-Aufzug'])).toMatchObject({ name: 'P-Aufzug' });
    expect((await kategorien()).filter((k) => k.name === 'P Aufzug').map((k) => k.id)).toEqual([eigenesAufzug]);
    // Ein eigener Eintrag mit dem Namen eines AAO-Stichworts gilt danach auch für dessen Typen.
    expect((await db.katalog.get(eigenesVu))!.typen).toEqual(['H', 'ABC']);
    expect((await kategorien()).filter((k) => k.name === 'VU')).toHaveLength(1);
    expect(await db.katalog.get(eigene)).toMatchObject({ name: 'Eigene Kategorie', typen: ['F'], aktiv: true });
    expect((await db.katalog.get(ids['Krankenhaus']))!.aktiv).toBe(false);
  });

  it('ändert beim zweiten Aufruf nichts mehr', async () => {
    await sorgeFuerStartlisten();
    const vorher = JSON.stringify((await kategorien()).sort((a, b) => a.id! - b.id!));
    await sorgeFuerStartlisten();
    expect(JSON.stringify((await kategorien()).sort((a, b) => a.id! - b.id!))).toBe(vorher);
  });
});
