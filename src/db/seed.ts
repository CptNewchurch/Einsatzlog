import { db } from './db';
import type { Bereich, FwGruppe, KatalogEintrag, MassnahmeArt, Typ } from '../domain/types';

// Startwerte. Alles Weitere legst du beim Erfassen selbst an; die Listen wachsen mit.
// Die Maßnahmen und Medikamente entsprechen den SAA im Gemeinsamen Kompendium Rettungsdienst 2026.

const KATEGORIEN: { name: string; typen: Typ[] }[] = [
  { name: 'Chirurgisch', typen: ['R', 'N'] },
  { name: 'Internistisch', typen: ['R', 'N'] },
  { name: 'Neurologisch', typen: ['R', 'N'] },
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
 */
export const SEED_VERSION = 3;

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
    ...KATEGORIEN.map((k): Neu => ({ typ: 'kategorie', name: k.name, aktiv: true, typen: k.typen })),
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
  return [...(ab < 1 ? v1 : []), ...(ab < 2 ? v2 : []), ...(ab < 3 ? v3 : [])];
}

/** Legt fehlende Startlisten an – höchstens einmal je Version, auch bei doppeltem Aufruf. */
export async function sorgeFuerStartlisten(): Promise<void> {
  await db.transaction('rw', db.katalog, db.meta, async () => {
    const stand = Number((await db.meta.get('seedVersion'))?.value ?? 0);
    if (stand >= SEED_VERSION) return;
    const vorhanden = new Set((await db.katalog.toArray()).map((k) => `${k.typ}|${k.name.trim().toLowerCase()}`));
    const neu = seedEintraege(stand).filter((k) => !vorhanden.has(`${k.typ}|${k.name.trim().toLowerCase()}`));
    if (neu.length > 0) await db.katalog.bulkAdd(neu);
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION });
  });
}
