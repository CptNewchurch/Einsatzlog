import Dexie, { type Table } from 'dexie';
import type { Dienst, Einsatz, KatalogEintrag, Uebung } from '../domain/types';

export interface MetaEintrag {
  key: string;
  value: unknown;
}

export class EinsatzDB extends Dexie {
  dienste!: Table<Dienst, number>;
  einsaetze!: Table<Einsatz, number>;
  katalog!: Table<KatalogEintrag, number>;
  uebungen!: Table<Uebung, number>;
  meta!: Table<MetaEintrag, string>;

  constructor(name = 'einsatzlog') {
    super(name);
    this.version(1).stores({
      dienste: '++id, beginn',
      einsaetze: '++id, dienstId, alarm, typ',
      katalog: '++id, typ, name',
      meta: 'key',
    });
    // Version 2: Übungen (in der Schicht oder als eigener Übungsdienst). Bestehende Daten bleiben unverändert.
    this.version(2).stores({
      dienste: '++id, beginn',
      einsaetze: '++id, dienstId, alarm, typ',
      katalog: '++id, typ, name',
      uebungen: '++id, beginn, dienstId, artId',
      meta: 'key',
    });
  }
}

/** Die einzige Datenbank der App. Alle Daten bleiben lokal auf dem Gerät. */
export const db = new EinsatzDB();
