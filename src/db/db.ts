import Dexie, { type Table } from 'dexie';
import type { Dienst, Einsatz, KatalogEintrag } from '../domain/types';

export interface MetaEintrag {
  key: string;
  value: unknown;
}

export class EinsatzDB extends Dexie {
  dienste!: Table<Dienst, number>;
  einsaetze!: Table<Einsatz, number>;
  katalog!: Table<KatalogEintrag, number>;
  meta!: Table<MetaEintrag, string>;

  constructor(name = 'einsatzlog') {
    super(name);
    this.version(1).stores({
      dienste: '++id, beginn',
      einsaetze: '++id, dienstId, alarm, typ',
      katalog: '++id, typ, name',
      meta: 'key',
    });
  }
}

/** Die einzige Datenbank der App. Alle Daten bleiben lokal auf dem Gerät. */
export const db = new EinsatzDB();
