import { nameKey } from './katalogLogik';
import { bereichVon, type Einsatz, type Typ } from './types';

// Alarmstufen nach der Alarm- und Ausrückeordnung (AAO) der Berufsfeuerwehr Bergisch Gladbach,
// Version 5.2 (Druckfassung vom 30.06.2026). Die Stufe gibt an, mit wie vielen Staffeln die
// Feuerwehr bei der Alarmierung ausrückt: Stufe 0 ist ein HLF, Stufe 6 sind sechs Staffeln.
// Beim Rettungsdienst gibt es keine Stufen, dort zählt der Kräfteansatz (R1N0, R1N1).

export const MAX_ALARMSTUFE = 6;
export const ALARMSTUFEN: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

export function istAlarmstufe(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_ALARMSTUFE;
}

/** „Stufe 3“ */
export const stufeText = (stufe: number) => `Stufe ${stufe}`;

/** Spalte „Kräfte“ der AAO: „HLF“, „1 Staffel“, „2 Staffeln“ … */
export function stufeKraefte(stufe: number): string {
  if (stufe <= 0) return 'HLF';
  return stufe === 1 ? '1 Staffel' : `${stufe} Staffeln`;
}

type FwTyp = 'F' | 'H' | 'ABC';

/**
 * Die Stichworte je Stufe, wie die AAO sie auf den Seiten „Feuer“, „Hilfeleistungseinsätze“ und
 * „ABC Gefahrgut“ aufführt. Der Index ist die Stufe. Die Namen entsprechen den Startlisten in
 * `AAO_STICHWORTE`; „LKW (ABC)“ steht in der AAO auf der ABC-Seite, ist aber ein F-Stichwort.
 */
export const AAO_STUFEN: Record<FwTyp, readonly (readonly string[])[]> = {
  F: [
    ['Abfalltonne', 'Container', 'Kontrolle/Nachschau', 'Kleinbrand'],
    ['PKW', 'Gartenhaus', 'Unklare Brandmeldung im Freien', 'Wohnwagen', 'Heimrauchmelder', 'Kamin'],
    ['Alarmauslösung', 'Garage/Carport', 'LKW', 'Vegetationsbrand'],
    ['Gebäude', 'Keller'],
    [
      'Landwirt. Gebäude',
      'Dachstuhl',
      'Verkaufsstätte',
      'Tiefgarage',
      'Parkhaus',
      'Geschäftshaus',
      'Wald',
      'Hochhaus',
      'Kindergarten',
      'Schule',
      'Beherbergungsstätte',
      'Versammlungsstätte',
    ],
    ['Bahn', 'Gewerbebetrieb', 'Explosion', 'LKW (ABC)'],
    ['Krankenhaus', 'Bahn (Tunnel)', 'Tunnel', 'Altenheim', 'Einrichtung für Behinderte'],
  ],
  H: [
    ['First Responder', 'Unterstützung RettD', 'Ausleuchten', 'TH klein', 'VU', 'Wasserschaden', 'Tier in Notlage', 'Baum', 'K/R/N-Tragehilfe'],
    ['P Tür', 'Unterst. DLK RettD', 'Mensch in Notlage', 'P Aufzug'],
    ['P springt', 'P klemmt (1)', 'Bahn'],
    ['P Zug', 'P klemmt (> 1)', 'P Wasser', 'P Eis', 'VU LKW'],
    ['VU Bus', 'Einsturz', 'P verschüttet'],
    ['Bahnunfall', 'Absturz Flugobjekt'],
    [],
  ],
  ABC: [
    ['Ölspur Feuerwehr'],
    ['Gewässerverunreinigung', 'Ölunfall', 'Erkundung', 'Auslaufende Flüssigkeit'],
    [],
    ['CO', 'Gas'],
    ['Stoffaustritt im Gebäude'],
    ['VU', 'Stoffaustritt im Freien'],
    [],
  ],
};

/** Die drei „MiG“-Zeilen der AAO: bei Menschenleben in Gefahr rücken vier Staffeln aus. */
const AAO_STUFE_MIG = new Map<string, number>(
  ['Gebäude', 'Keller', 'Dachstuhl'].map((name): [string, number] => [nameKey(name), 4]),
);

const schluessel = (typ: Typ, name: string) => `${typ}|${nameKey(name)}`;

const STUFE_NACH_STICHWORT = new Map<string, number>();
(Object.keys(AAO_STUFEN) as FwTyp[]).forEach((typ) =>
  AAO_STUFEN[typ].forEach((namen, stufe) => namen.forEach((name) => STUFE_NACH_STICHWORT.set(schluessel(typ, name), stufe))),
);

/**
 * Die Alarmstufe, die die AAO für das Stichwort vorsieht. Ohne Ergebnis bleibt es bei Stichworten,
 * die die AAO nicht kennt (z. B. selbst angelegte) und im Rettungsdienst. Der Name zählt ohne
 * Rücksicht auf Groß- und Kleinschreibung; „Bahn“ und „VU“ haben je nach Typ eine andere Stufe.
 */
export function aaoStufe(typ: Typ, kategorie: string, mig?: boolean): number | undefined {
  if (typ === 'F' && mig) {
    const m = AAO_STUFE_MIG.get(nameKey(kategorie));
    if (m != null) return m;
  }
  return STUFE_NACH_STICHWORT.get(schluessel(typ, kategorie));
}

export interface StufeVon {
  /** Die Stufe des Einsatzes: die eingetragene, sonst die der AAO. */
  stufe?: number;
  /** Was die AAO für das Stichwort vorsieht. */
  aao?: number;
}

/** Alarmstufe eines Feuerwehr-Einsatzes. Frühere Einsätze ohne Eintrag zählen mit der Stufe der AAO. */
export function stufeVon(e: Pick<Einsatz, 'typ' | 'mig' | 'alarmstufe'>, kategorieName: string | undefined): StufeVon {
  if (bereichVon(e.typ) !== 'FW') return {};
  const aao = kategorieName == null ? undefined : aaoStufe(e.typ, kategorieName, e.mig);
  return { stufe: istAlarmstufe(e.alarmstufe) ? e.alarmstufe : aao, aao };
}
