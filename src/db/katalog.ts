import { db } from './db';
import { nameKey, normName } from '../domain/katalogLogik';
import type { KatalogEintrag, KatalogTyp, Typ } from '../domain/types';

/**
 * Legt einen Eintrag an oder liefert den vorhandenen mit gleichem Namen (ohne Groß-/Kleinschreibung).
 * Ein archivierter Eintrag wird wieder aktiviert, bei Kategorien werden neue Typen ergänzt.
 */
export async function legeKatalogEintragAn(
  typ: KatalogTyp,
  name: string,
  extra: Partial<KatalogEintrag> = {},
): Promise<KatalogEintrag> {
  const sauber = normName(name);
  if (!sauber) throw new Error('Der Name darf nicht leer sein.');
  return db.transaction('rw', db.katalog, async () => {
    const key = nameKey(sauber);
    const vorhanden = (await db.katalog.where('typ').equals(typ).toArray()).find((k) => nameKey(k.name) === key);
    if (vorhanden) {
      const patch: Partial<KatalogEintrag> = {};
      if (!vorhanden.aktiv) patch.aktiv = true;
      if (typ === 'kategorie' && extra.typen) {
        const alle = new Set<Typ>([...(vorhanden.typen ?? []), ...extra.typen]);
        if (alle.size !== (vorhanden.typen ?? []).length) patch.typen = [...alle];
      }
      if (Object.keys(patch).length > 0) await db.katalog.update(vorhanden.id!, patch);
      return { ...vorhanden, ...patch };
    }
    const neu: Omit<KatalogEintrag, 'id'> = { typ, name: sauber, aktiv: true, ...extra };
    const id = await db.katalog.add(neu as KatalogEintrag);
    return { ...neu, id };
  });
}

/** Ändert einen Eintrag; ein Name, der schon vergeben ist, wird abgelehnt. */
export async function aendereKatalogEintrag(id: number, patch: Partial<KatalogEintrag>): Promise<void> {
  await db.transaction('rw', db.katalog, async () => {
    const alt = await db.katalog.get(id);
    if (!alt) return;
    const p = { ...patch };
    delete p.id;
    delete p.typ;
    if (p.name != null) {
      p.name = normName(p.name);
      if (!p.name) throw new Error('Der Name darf nicht leer sein.');
      const key = nameKey(p.name);
      const doppelt = (await db.katalog.where('typ').equals(alt.typ).toArray()).some(
        (k) => k.id !== id && nameKey(k.name) === key,
      );
      if (doppelt) throw new Error(`„${p.name}“ gibt es in dieser Liste schon.`);
    }
    await db.katalog.update(id, p);
  });
}

export async function loescheKatalogEintrag(id: number): Promise<void> {
  await db.katalog.delete(id);
}

/** Merkt sich, dass eine Kategorie zu einem Stichwort-Typ gehört. */
export async function lerneKategorieTyp(kategorieId: number, typ: Typ): Promise<void> {
  await db.transaction('rw', db.katalog, async () => {
    const k = await db.katalog.get(kategorieId);
    if (!k || (k.typen ?? []).includes(typ)) return;
    await db.katalog.update(kategorieId, { typen: [...(k.typen ?? []), typ] });
  });
}
