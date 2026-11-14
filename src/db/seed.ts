import { db } from './db';
import { nameKey } from '../domain/katalogLogik';
import type { Bereich, FwGruppe, KatalogEintrag, MassnahmeArt, Typ } from '../domain/types';

// Startwerte. Alles Weitere legst du beim Erfassen selbst an; die Listen wachsen mit.
// Die Maßnahmen und Medikamente entsprechen den SAA im Gemeinsamen Kompendium Rettungsdienst 2026.

/** Fachrichtungen im Rettungsdienst (Stichworte R und N). */
const KATEGORIEN_RD = ['Chirurgisch', 'Internistisch', 'Neurologisch'];

/**
 * Einsatzstichworte der Feuerwehr nach der AAO der Berufsfeuerwehr Bergisch Gladbach (V 5.2), je Typ in der Reihenfolge der
 * Alarmstufen. Die drei „MiG“-Zeilen (Dachstuhl, Keller, Gebäude) stehen nicht einzeln da: dafür gibt es den Schalter „MIG“.
 * „F-LKW (ABC)“ führt die AAO bei den Gefahrgut-Stichworten auf, es bleibt aber ein Feuer-Stichwort.
 */
export const AAO_STICHWORTE: Record<'F' | 'H' | 'ABC', string[]> = {
  F: [
    'Abfalltonne', 'Container', 'Kontrolle/Nachschau', 'Kleinbrand',
    'PKW', 'Gartenhaus', 'Unklare Brandmeldung im Freien', 'Wohnwagen', 'Heimrauchmelder', 'Kamin',
    'Alarmauslösung', 'Garage/Carport', 'LKW', 'Vegetationsbrand',
    'Gebäude', 'Keller',
    'Landwirt. Gebäude', 'Dachstuhl', 'Verkaufsstätte', 'Tiefgarage', 'Parkhaus', 'Geschäftshaus',
    'Wald', 'Hochhaus', 'Kindergarten', 'Schule', 'Beherbergungsstätte', 'Versammlungsstätte',
    'Bahn', 'Gewerbebetrieb', 'Explosion',
    'Krankenhaus', 'Bahn (Tunnel)', 'Tunnel', 'Altenheim', 'Einrichtung für Behinderte',
    'LKW (ABC)',
  ],
  H: [
    'First Responder', 'Unterstützung RettD', 'Ausleuchten', 'TH klein', 'VU', 'Wasserschaden', 'Tier in Notlage', 'Baum', 'K/R/N-Tragehilfe',
    'P Tür', 'Unterst. DLK RettD', 'Mensch in Notlage', 'P Aufzug',
    'P springt', 'P klemmt (1)', 'Bahn',
    'P Zug', 'P klemmt (> 1)', 'P Wasser', 'P Eis', 'VU LKW',
    'VU Bus', 'Einsturz', 'P verschüttet',
    'Bahnunfall', 'Absturz Flugobjekt',
  ],
  ABC: [
    'Ölspur Feuerwehr',
    'Gewässerverunreinigung', 'Ölunfall', 'Erkundung', 'Auslaufende Flüssigkeit',
    'CO', 'Gas',
    'Stoffaustritt im Gebäude',
    'VU', 'Stoffaustritt im Freien',
  ],
};

/** Die Stichwort-Kategorien der AAO. Ein Name, der in mehreren Typen vorkommt (Bahn, VU), ist ein Eintrag mit mehreren Typen. */
export const KATEGORIEN_FW: { name: string; typen: Typ[] }[] = (() => {
  const nachName = new Map<string, { name: string; typen: Typ[] }>();
  for (const typ of ['F', 'H', 'ABC'] as const) {
    for (const name of AAO_STICHWORTE[typ]) {
      const k = nachName.get(nameKey(name));
      if (k) k.typen.push(typ);
      else nachName.set(nameKey(name), { name, typen: [typ] });
    }
  }
  return [...nachName.values()];
})();

/** Schreibweise der AAO für Vorschläge, die es schon vor der AAO gab (gilt nur, solange der alte Name noch so dasteht). */
const UMBENENNUNGEN = [
  { alt: 'P-Tür', neu: 'P Tür' },
  { alt: 'P-Aufzug', neu: 'P Aufzug' },
  { alt: 'P-Klemmt', neu: 'P klemmt (1)' },
];

const WACHEN = ['FRW 1 (Paffrather Straße)', 'FRW 2 (Bensberg)', 'RW 4 (Refrath)'];

const RESSOURCEN = ['Notarzt (NEF)', 'RTW', 'Feuerwehr', 'Polizei', 'RTH'];

const FAHRZEUGE: { name: string; bereich: Bereich }[] = [
  { name: 'RTW', bereich: 'RD' },
  { name: 'NEF', bereich: 'RD' },
  { name: 'KTW', bereich: 'RD' },
  { name: 'LF', bereich: 'FW' },
  { name: 'HLF', bereich: 'FW' },
  { name: 'DLK', bereich: 'FW' },
  { name: 'RW', bereich: 'FW' },
  { name: 'ELW', bereich: 'FW' },
];

const ROLLEN: { name: string; bereich: Bereich }[] = [
  { name: 'Transportführer', bereich: 'RD' },
  { name: 'Fahrer', bereich: 'RD' },
  { name: 'NEF-Fahrer', bereich: 'RD' },
  { name: 'Gruppenführer', bereich: 'FW' },
  { name: 'Maschinist', bereich: 'FW' },
  { name: 'Angriffstrupp', bereich: 'FW' },
  { name: 'Wassertrupp', bereich: 'FW' },
  { name: 'Schlauchtrupp', bereich: 'FW' },
  { name: 'Melder', bereich: 'FW' },
];

/** SAA „Invasive Maßnahmen“ des Kompendiums. Der Schlüssel verknüpft die Einordnung je Region. */
export const MASSNAHMEN: { key: string; name: string }[] = [
  { key: 'inv:iv', name: 'i.v.-Zugang' },
  { key: 'inv:io', name: 'i.o.-Zugang' },
  { key: 'inv:ega-lts', name: 'EGA: Larynxtubus (LTS-D)' },
  { key: 'inv:ega-lma', name: 'EGA: Larynxmaske (LMA-D)' },
  { key: 'inv:ega-igel', name: 'EGA: i-gel' },
  { key: 'inv:laryngoskopie', name: 'Laryngoskopie' },
  { key: 'inv:cpap', name: 'CPAP / NIV' },
  { key: 'inv:tourniquet', name: 'Tourniquet / Blutsperre' },
  { key: 'inv:beckenschlinge', name: 'Beckenschlinge' },
  { key: 'inv:immobilisation', name: 'Achsengerechte Immobilisation' },
  { key: 'inv:thorax', name: 'Thoraxentlastungspunktion' },
  { key: 'inv:defi', name: 'Manuelle Defibrillation' },
  { key: 'inv:kardioversion', name: 'Kardioversion' },
  { key: 'inv:schrittmacher', name: 'Externe Schrittmacheranlage' },
  { key: 'inv:absaugen', name: 'Endobronchiales Absaugen' },
  { key: 'inv:im', name: 'i.m.-Injektion' },
  { key: 'inv:in', name: 'Intranasale Gabe' },
];

/** SAA „Medikamente“ des Kompendiums. */
export const MEDIKAMENTE: { key: string; name: string }[] = [
  { key: 'med:asa', name: 'Acetylsalicylsäure (ASS)' },
  { key: 'med:amiodaron', name: 'Amiodaron' },
  { key: 'med:atropin', name: 'Atropin' },
  { key: 'med:berodual', name: 'Fenoterol/Ipratropiumbromid (Berodual® LS)' },
  { key: 'med:butylscopolamin', name: 'Butylscopolamin' },
  { key: 'med:diazepam', name: 'Diazepam rektal' },
  { key: 'med:dimenhydrinat', name: 'Dimenhydrinat' },
  { key: 'med:dimetinden', name: 'Dimetinden' },
  { key: 'med:epinephrin', name: 'Epinephrin' },
  { key: 'med:esketamin', name: 'Esketamin' },
  { key: 'med:fentanyl', name: 'Fentanyl' },
  { key: 'med:furosemid', name: 'Furosemid' },
  { key: 'med:glucagon', name: 'Glucagon' },
  { key: 'med:glucose', name: 'Glucose' },
  { key: 'med:gtn', name: 'Glyceroltrinitrat (GTN)' },
  { key: 'med:heparin', name: 'Heparin' },
  { key: 'med:ibuprofen', name: 'Ibuprofen' },
  { key: 'med:ipratropium', name: 'Ipratropiumbromid' },
  { key: 'med:ketamin', name: 'Ketamin' },
  { key: 'med:lidocain', name: 'Lidocain' },
  { key: 'med:metamizol', name: 'Metamizol' },
  { key: 'med:metoprolol', name: 'Metoprolol' },
  { key: 'med:midazolam', name: 'Midazolam' },
  { key: 'med:morphin', name: 'Morphin' },
  { key: 'med:nalbuphin', name: 'Nalbuphin' },
  { key: 'med:naloxon', name: 'Naloxon' },
  { key: 'med:ondansetron', name: 'Ondansetron' },
  { key: 'med:paracetamol', name: 'Paracetamol' },
  { key: 'med:prednisolon', name: 'Prednisolon' },
  { key: 'med:salbutamol', name: 'Salbutamol' },
  { key: 'med:sauerstoff', name: 'Sauerstoff' },
  { key: 'med:txa', name: 'Tranexamsäure' },
  { key: 'med:urapidil', name: 'Urapidil' },
  { key: 'med:vel', name: 'Vollelektrolytlösung' },
];

/**
 * Häufige Verdachtsdiagnosen im Rettungsdienst, grob nach Häufigkeit geordnet.
 * Solange noch nichts erfasst wurde, bleibt diese Reihenfolge in den Vorschlägen erhalten;
 * danach rücken die tatsächlich genutzten nach vorn.
 */
export const DIAGNOSEN: string[] = [
  'Sturz',
  'Synkope / Kollaps',
  'Dyspnoe / Atemnot',
  'Akutes Koronarsyndrom (AKS)',
  'Schlaganfall / TIA',
  'Bauchschmerzen',
  'AZ-Verschlechterung',
  'Hypoglykämie',
  'Krampfanfall',
  'Rückenschmerzen',
  'Herzrhythmusstörung',
  'Hypertensive Entgleisung',
  'Infekt / Fieber',
  'Asthma / COPD',
  'Herzinsuffizienz / Lungenödem',
  'Alkoholintoxikation',
  'Intoxikation (Medikamente / Drogen)',
  'Psychiatrischer Notfall',
  'Extremitätenverletzung',
  'Schädel-Hirn-Trauma',
  'Wunde / Blutung',
  'Anaphylaxie',
  'Sepsis',
  'Lungenembolie',
  'Schwindel',
  'Kopfschmerzen',
  'Übelkeit / Erbrechen',
  'Reanimation',
  'Geburtshilflicher Notfall',
  'Verbrennung / Verbrühung',
  'Hilflose Lage / Soziale Indikation',
  'Kein pathologischer Befund',
];

/**
 * Typische Maßnahmen im Feuerwehreinsatz. Sie werden auf Befehl ausgeführt und deshalb ohne
 * Rechtsgrundlage erfasst. Die Liste ist ein Anfang: eigene Maßnahmen legst du beim Erfassen an.
 */
export const FW_MASSNAHMEN: { gruppe: FwGruppe; namen: string[] }[] = [
  {
    gruppe: 'rettung',
    namen: [
      'Personensuche',
      'Menschenrettung aus Gefahrenbereich',
      'Rettung über Drehleiter',
      'Technische Rettung (Verkehrsunfall)',
      'Rettung aus Höhen und Tiefen',
      'Tragehilfe für den Rettungsdienst',
      'Erste Hilfe und Betreuung',
    ],
  },
  {
    gruppe: 'brand',
    namen: [
      'Erkundung',
      'Löschangriff im Innenangriff',
      'Löschangriff im Außenangriff',
      'Riegelstellung',
      'Wasserversorgung herstellen',
      'Belüftung und Entrauchung',
      'Schaumeinsatz',
      'Nachlöscharbeiten und Brandnachschau',
    ],
  },
  {
    gruppe: 'technik',
    namen: [
      'Hydraulisches Rettungsgerät',
      'Fahrzeug sichern und stabilisieren',
      'Türöffnung (Notöffnung)',
      'Aufzugbefreiung',
      'Motorsäge (Baum, Sturmschaden)',
      'Wasser abpumpen',
      'Ölspur abstreuen',
      'Heben und Abstützen',
    ],
  },
  {
    gruppe: 'gefahrstoff',
    namen: ['Messen (Gas, CO, Ex)', 'Dekontamination', 'Stoff abdichten und auffangen', 'Einsatz im Chemikalienschutzanzug'],
  },
  {
    gruppe: 'sonstige',
    namen: [
      'Absperrung und Gefahrenbereich',
      'Verkehrsabsicherung',
      'Einsatzstelle ausleuchten',
      'Führungsaufgabe (Einsatzleitung)',
      'Brandwache',
    ],
  },
];

/** Übungsarten. Ohne Bereich passen sie zu Feuerwehr und Rettungsdienst. */
export const UEBUNGSARTEN: { name: string; bereich?: Bereich }[] = [
  { name: 'Atemschutzübung', bereich: 'FW' },
  { name: 'Löschübung', bereich: 'FW' },
  { name: 'Technische Hilfeleistung', bereich: 'FW' },
  { name: 'Absturzsicherung und Höhenrettung', bereich: 'FW' },
  { name: 'Gefahrgut und ABC', bereich: 'FW' },
  { name: 'Fahrzeug- und Gerätekunde', bereich: 'FW' },
  { name: 'Funk und Kommunikation', bereich: 'FW' },
  { name: 'Reanimation', bereich: 'RD' },
  { name: 'Traumaversorgung', bereich: 'RD' },
  { name: 'Algorithmen und Medikamente', bereich: 'RD' },
  { name: 'Medizingeräte-Einweisung', bereich: 'RD' },
  { name: 'Einsatzübung' },
  { name: 'Unterricht und Fortbildung' },
  { name: 'Lehrgang' },
  { name: 'Dienstsport' },
];

/**
 * Stand der Startlisten. Jede Version ergänzt nur, was neu ist; bereits vorhandene Einträge
 * (auch selbst angelegte) bleiben unangetastet.
 *  1 = Stichwort-Kategorien, Wachen, Fahrzeuge, Rollen, Maßnahmen und Medikamente
 *  2 = Verdachtsdiagnosen
 *  3 = Feuerwehr-Maßnahmen und Übungsarten
 *  4 = Feuerwehr-Stichworte nach der AAO; sie lösen die vorläufigen Vorschläge ab
 */
export const SEED_VERSION = 4;

type Neu = Omit<KatalogEintrag, 'id'>;

/** Die Einträge, die zwischen Stand `ab` und der aktuellen Version dazugekommen sind. */
export function seedEintraege(ab = 0): Neu[] {
  const massnahme = (m: { key: string; name: string }, art: MassnahmeArt): Neu => ({
    typ: 'massnahme',
    name: m.name,
    aktiv: true,
    art,
    kompendiumKey: m.key,
  });
  const v1: Neu[] = [
    ...KATEGORIEN_RD.map((name): Neu => ({ typ: 'kategorie', name, aktiv: true, typen: ['R', 'N'] })),
    ...WACHEN.map((name): Neu => ({ typ: 'wache', name, aktiv: true })),
    ...RESSOURCEN.map((name): Neu => ({ typ: 'ressource', name, aktiv: true })),
    ...FAHRZEUGE.map((f): Neu => ({ typ: 'fahrzeug', name: f.name, aktiv: true, bereich: f.bereich })),
    ...ROLLEN.map((r): Neu => ({ typ: 'rolle', name: r.name, aktiv: true, bereich: r.bereich })),
    ...MASSNAHMEN.map((m) => massnahme(m, 'invasiv')),
    ...MEDIKAMENTE.map((m) => massnahme(m, 'medikament')),
  ];
  const v2: Neu[] = DIAGNOSEN.map((name): Neu => ({ typ: 'diagnose', name, aktiv: true }));
  const v3: Neu[] = [
    ...FW_MASSNAHMEN.flatMap((g) => g.namen.map((name): Neu => ({ typ: 'fwmassnahme', name, aktiv: true, gruppe: g.gruppe }))),
    ...UEBUNGSARTEN.map((u): Neu => ({ typ: 'uebungsart', name: u.name, aktiv: true, ...(u.bereich ? { bereich: u.bereich } : {}) })),
  ];
  const v4: Neu[] = KATEGORIEN_FW.map((k): Neu => ({ typ: 'kategorie', name: k.name, aktiv: true, typen: [...k.typen] }));
  return [...(ab < 1 ? v1 : []), ...(ab < 2 ? v2 : []), ...(ab < 3 ? v3 : []), ...(ab < 4 ? v4 : [])];
}

/**
 * Stellt die vorläufigen Feuerwehr-Vorschläge der Versionen 1.0.0 bis 1.1.0 auf die AAO um. Nummern und Einsätze bleiben
 * erhalten; selbst angelegte oder umbenannte Einträge werden nicht angefasst.
 */
async function stelleVorlaeufigeStichworteUm(): Promise<void> {
  const kategorien = await db.katalog.where('typ').equals('kategorie').toArray();
  const finde = (name: string) => kategorien.find((k) => nameKey(k.name) === nameKey(name));
  const benutzt = async (id: number, typ?: Typ) =>
    (await db.einsaetze.filter((e) => e.kategorieId === id && (!typ || e.typ === typ)).count()) > 0;

  // Schreibweise der AAO („P Tür“ statt „P-Tür“), solange der neue Name nicht schon vergeben ist.
  for (const u of UMBENENNUNGEN) {
    const alt = finde(u.alt);
    if (alt && !finde(u.neu)) {
      await db.katalog.update(alt.id!, { name: u.neu });
      alt.name = u.neu;
    }
  }
  // „Ölspur“ kennt die AAO nur als ABC-Stichwort („Ölspur Feuerwehr“); ein nie benutzter Vorschlag wird ausgeblendet.
  const oelspur = finde('Ölspur');
  if (oelspur?.aktiv && (oelspur.typen ?? []).every((t) => t === 'H') && !(await benutzt(oelspur.id!))) {
    await db.katalog.update(oelspur.id!, { aktiv: false });
  }
  // „Gas“ gibt es in der AAO nur als ABC-Stichwort; für H fällt es weg, wenn es dort nie benutzt wurde.
  const gas = finde('Gas');
  if (gas && (gas.typen ?? []).includes('H') && !(await benutzt(gas.id!, 'H'))) {
    await db.katalog.update(gas.id!, { typen: (gas.typen ?? []).filter((t) => t !== 'H') });
  }
}

/** Gab es ein Stichwort der AAO schon als eigenen Eintrag, gilt es danach auch für die Typen der AAO. */
async function ergaenzeTypenDerAao(): Promise<void> {
  const nachName = new Map((await db.katalog.where('typ').equals('kategorie').toArray()).map((k) => [nameKey(k.name), k]));
  for (const soll of KATEGORIEN_FW) {
    const k = nachName.get(nameKey(soll.name));
    const fehlt = k ? soll.typen.filter((t) => !(k.typen ?? []).includes(t)) : [];
    if (k && fehlt.length > 0) await db.katalog.update(k.id!, { typen: [...(k.typen ?? []), ...fehlt] });
  }
}

/** Legt fehlende Startlisten an – höchstens einmal je Version, auch bei doppeltem Aufruf. */
export async function sorgeFuerStartlisten(): Promise<void> {
  await db.transaction('rw', db.katalog, db.einsaetze, db.meta, async () => {
    const stand = Number((await db.meta.get('seedVersion'))?.value ?? 0);
    if (stand >= SEED_VERSION) return;
    if (stand < 4) await stelleVorlaeufigeStichworteUm();
    const schluessel = (typ: string, name: string) => `${typ}|${nameKey(name)}`;
    const vorhanden = new Set((await db.katalog.toArray()).map((k) => schluessel(k.typ, k.name)));
    const neu = seedEintraege(stand).filter((k) => !vorhanden.has(schluessel(k.typ, k.name)));
    if (neu.length > 0) await db.katalog.bulkAdd(neu);
    if (stand < 4) await ergaenzeTypenDerAao();
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION });
  });
}
