// Fachliche Typen der Einsatzdokumentation.
// Alle Zeitstempel sind Unix-Millisekunden (absolut), Anzeige und Eingabe erfolgen in lokaler Zeit.

/** Alarmstichwort-Typ: R/N = Rettungsdienst, F/H/ABC = Feuerwehr. */
export type Typ = 'R' | 'N' | 'F' | 'H' | 'ABC';
export const TYPEN: readonly Typ[] = ['R', 'N', 'F', 'H', 'ABC'];

export type Bereich = 'RD' | 'FW';

export function bereichVon(typ: Typ): Bereich {
  return typ === 'R' || typ === 'N' ? 'RD' : 'FW';
}

export type KatalogTyp =
  | 'kategorie'
  | 'rolle'
  | 'fahrzeug'
  | 'wache'
  | 'standort'
  /** Maßnahmen und Medikamente im Rettungsdienst. */
  | 'massnahme'
  /** Maßnahmen im Feuerwehreinsatz, ausgeführt auf Befehl. */
  | 'fwmassnahme'
  | 'diagnose'
  | 'ressource'
  | 'tag'
  /** Stichwort einer sonstigen Hilfeleistung im Rettungsdienst, z. B. Tragehilfe. */
  | 'hilfeleistung'
  /** Art einer Übung, z. B. Atemschutz oder Reanimation. */
  | 'uebungsart';

export type MassnahmeArt = 'medikament' | 'invasiv' | 'sonstige';

/** Gruppen der Feuerwehr-Maßnahmen; sie gliedern die Auswahl und die Auswertung. */
export type FwGruppe = 'rettung' | 'brand' | 'technik' | 'gefahrstoff' | 'sonstige';
export const FW_GRUPPEN: readonly FwGruppe[] = ['rettung', 'brand', 'technik', 'gefahrstoff', 'sonstige'];
export const FW_GRUPPE_NAME: Record<FwGruppe, string> = {
  rettung: 'Menschenrettung',
  brand: 'Brandbekämpfung',
  technik: 'Technische Hilfeleistung',
  gefahrstoff: 'Gefahrstoffe',
  sonstige: 'Absicherung und Sonstiges',
};
/** Kurzform für schmale Auswahlfelder. */
export const FW_GRUPPE_KURZ: Record<FwGruppe, string> = {
  rettung: 'Rettung',
  brand: 'Brand',
  technik: 'Technik',
  gefahrstoff: 'Gefahrstoffe',
  sonstige: 'Sonstiges',
};
export type Altersgruppe = 'saeugling' | 'kind' | 'erwachsener' | 'senior';

export interface KatalogEintrag {
  id?: number;
  typ: KatalogTyp;
  name: string;
  aktiv: boolean;
  /** Nur Kategorien: bei welchen Stichwort-Typen die Kategorie genutzt wird. */
  typen?: Typ[];
  /** Nur Rollen, Fahrzeuge und Übungsarten: für welchen Bereich sie vorgeschlagen werden. */
  bereich?: Bereich;
  /** Nur Maßnahmen im Rettungsdienst. */
  art?: MassnahmeArt;
  /** Nur Feuerwehr-Maßnahmen. */
  gruppe?: FwGruppe;
  /** Nur Maßnahmen aus dem Kompendium: Schlüssel für die Einordnung (z. B. „med:epinephrin“). */
  kompendiumKey?: string;
}

/**
 * Grundlage, auf der eine Maßnahme durchgeführt wurde.
 * Rettungsdienst:
 *  vorab: vorabdelegiert nach § 4 Abs. 2 Nr. 2c NotSanG (★ im Kompendium)
 *  eigen: eigenverantwortlich nach § 2a NotSanG
 *  arzt: auf Anordnung von Notarzt oder Telenotarzt (§ 4 Abs. 2 Nr. 2b NotSanG)
 * Feuerwehr:
 *  befehl: auf Befehl des Einsatzleiters oder Gruppenführers
 */
export type Durchfuehrung = 'vorab' | 'eigen' | 'arzt' | 'befehl';
/** Die Auswahl im Rettungsdienst; im Feuerwehreinsatz gilt immer „Auf Befehl“. */
export const DURCHFUEHRUNGEN: readonly Durchfuehrung[] = ['vorab', 'eigen', 'arzt'];

export const DURCHFUEHRUNG_INFO: Record<Durchfuehrung, { kurz: string; lang: string }> = {
  vorab: { kurz: 'Vorabdelegation', lang: 'Vorabdelegiert nach § 4 Abs. 2 Nr. 2c NotSanG (★ im Kompendium)' },
  eigen: { kurz: 'Eigenverantwortlich', lang: 'Eigenverantwortlich nach § 2a NotSanG' },
  arzt: { kurz: 'Auf Anordnung', lang: 'Auf Anordnung von Notarzt oder Telenotarzt (§ 4 Abs. 2 Nr. 2b NotSanG)' },
  befehl: { kurz: 'Auf Befehl', lang: 'Auf Befehl des Einsatzleiters oder Gruppenführers ausgeführt' },
};

/**
 * Wie ein Einsatz ausging: was tatsächlich geschah, nicht was alarmiert wurde.
 * Transporte: mit oder ohne Notarzt (NA). Ambulante Versorgung heißt Transportverzicht: Der Patient wird
 * vor Ort versorgt und nicht transportiert, entweder mit NA oder allein durch den RTW. „Verweigerung“ ist
 * die abgelehnte Behandlung oder der abgelehnte Transport. Beim Tod unterscheidet die App, ob er an der
 * Einsatzstelle eintrat oder der Patient schon tot aufgefunden wurde. „Hilfeleistung“ ist die sonstige
 * Hilfeleistung ohne medizinische Notlage und zählt als zu hohe Alarmierung (Übertriage), weil dafür kein
 * Rettungsmittel nötig gewesen wäre. Sie bekommt ein Stichwort aus eigener Liste (`hilfeleistungId`).
 */
export type Ausgang =
  | 'transportMitNotarzt'
  | 'transportOhneNotarzt'
  | 'ambulantNotarzt'
  | 'ambulantRtw'
  | 'verweigerung'
  | 'fehleinsatz'
  | 'todEinsatzstelle'
  | 'todAufgefunden'
  | 'hilfeleistung';

/** Ergebnisse bis Version 1.6.0, die es nicht mehr zur Auswahl gibt; sie bleiben gespeichert und werden zur Prüfung markiert. */
export type AusgangAlt = 'transport' | 'ambulant' | 'verstorben' | 'transportdienst';

/** Auswahl im Rettungsdienst, in dieser Reihenfolge. */
export const AUSGAENGE_RD: readonly Ausgang[] = [
  'transportMitNotarzt',
  'transportOhneNotarzt',
  'ambulantNotarzt',
  'ambulantRtw',
  'verweigerung',
  'fehleinsatz',
  'todEinsatzstelle',
  'todAufgefunden',
  'hilfeleistung',
];

export interface AusgangInfo {
  kurz: string;
  lang: string;
  /** Zählt als zu hohe Alarmierung. */
  uebertriage: boolean;
  /** Setzt voraus, dass ein Notarzt vor Ort war („Notarzt vor Ort“ = Ja). */
  notarztVorOrt?: boolean;
}

export const AUSGANG_INFO: Record<Ausgang, AusgangInfo> = {
  transportMitNotarzt: {
    kurz: 'Transport mit NA',
    lang: 'Der Patient wurde in eine Klinik transportiert. Der Notarzt hat vor Ort behandelt und begleitet den Transport.',
    uebertriage: false,
    notarztVorOrt: true,
  },
  transportOhneNotarzt: {
    kurz: 'Transport ohne NA',
    lang: 'Der Patient wurde in eine Klinik transportiert, ohne dass ein Notarzt den Transport begleitet hat. Ein Notarzt kann vor Ort behandelt haben.',
    uebertriage: false,
  },
  ambulantNotarzt: {
    kurz: 'Ambulant NA',
    lang: 'Ambulante Versorgung durch den Notarzt vor Ort (Transportverzicht). Der Patient wurde nicht transportiert.',
    uebertriage: false,
    notarztVorOrt: true,
  },
  ambulantRtw: {
    kurz: 'Ambulant RTW',
    lang: 'Ambulante Versorgung durch den RTW (Transportverzicht). Der Patient wurde nicht transportiert.',
    uebertriage: false,
  },
  verweigerung: { kurz: 'Transportverweigerung', lang: 'Der Patient lehnt den Transport oder die Behandlung ab.', uebertriage: false },
  fehleinsatz: { kurz: 'Fehleinsatz', lang: 'Kein Patient oder keine Einsatzstelle angetroffen, Fehlalarm oder abgebrochen.', uebertriage: false },
  todEinsatzstelle: {
    kurz: 'Tod an Einsatzstelle',
    lang: 'Der Patient ist an der Einsatzstelle verstorben, auch bei erfolglos beendeter Reanimation.',
    uebertriage: false,
  },
  todAufgefunden: { kurz: 'Tod aufgefunden', lang: 'Der Patient wurde bereits tot aufgefunden.', uebertriage: false },
  hilfeleistung: {
    kurz: 'Sonstige Hilfeleistung',
    lang: 'Keine medizinische Notlage, z. B. Aufstehhilfe oder Tragehilfe. Das Stichwort wählst du aus einer eigenen Liste.',
    uebertriage: true,
  },
};

/** Setzt das Ergebnis einen Notarzt vor Ort voraus? Dann muss „Notarzt vor Ort“ auf Ja stehen. */
export const ausgangBrauchtNotarzt = (a: Ausgang | AusgangAlt | null | undefined): boolean =>
  a != null && a in AUSGANG_INFO && AUSGANG_INFO[a as Ausgang].notarztVorOrt === true;

/** Zählt als zu hohe Alarmierung. Das alte „Nur Transport“ galt ebenfalls so. */
export const ausgangUebertriage = (a: Ausgang | AusgangAlt | null | undefined): boolean =>
  a === 'transportdienst' || (a != null && a in AUSGANG_INFO && AUSGANG_INFO[a as Ausgang].uebertriage);

/** Eigene Einschätzung, ob das Stichwort zum Befund vor Ort passte. */
export type AlarmBewertung = 'passend' | 'hoch' | 'niedrig';
export const BEWERTUNGEN: readonly AlarmBewertung[] = ['passend', 'hoch', 'niedrig'];

export const BEWERTUNG_INFO: Record<AlarmBewertung, { kurz: string; lang: string }> = {
  passend: { kurz: 'Passend', lang: 'Stichwort und Befund passten zusammen.' },
  hoch: { kurz: 'Zu hoch', lang: 'Zu hoch alarmiert: Das Stichwort war dringlicher als der Befund.' },
  niedrig: { kurz: 'Zu niedrig', lang: 'Zu niedrig alarmiert: Der Befund war dringlicher als das Stichwort.' },
};

/**
 * Ein Dienst mit geplanter (Soll) und tatsächlicher (Ist) Zeit.
 * Der Unterschied ergibt die Überstunden (Antritt früher, Ende später als geplant)
 * oder Minusstunden (früher abgelöst, später angetreten). `beginn` und `ende` sind die
 * Ist-Zeiten und bilden das Fenster, in dem die Einsätze liegen.
 */
export interface Dienst {
  id?: number;
  /** Geplanter Dienstbeginn, z. B. 07:30. */
  sollBeginn: number;
  /** Geplantes Dienstende, z. B. 07:30 am Folgetag. */
  sollEnde: number;
  /** Tatsächlicher Dienstantritt. */
  beginn: number;
  /** Tatsächliches Dienstende. */
  ende: number;
  /** Regeldienst: Wache (Liste „wache“). Zusatzdienst: Stadt/Organisation (Liste „standort“). */
  wacheId?: number;
  fahrzeugId?: number;
  rolleId?: number;
  /**
   * Zusatzdienst, z. B. in einer anderen Stadt: eigene Maske ohne Vorbelegung, Soll = Ist.
   * Zusatzdienste zählen nicht zu den Über- und Minusstunden und lassen sich getrennt auswerten.
   */
  zusatzdienst?: boolean;
  /**
   * Reiner Übungsdienst, z. B. ein Übungsabend oder Lehrgangstag: Die ganze Dienstzeit zählt als Übung.
   * Wie ein Zusatzdienst hat er keinen Plan (Soll = Ist) und zählt nicht zu den Über- und Minusstunden.
   * Der Ort steht in `wacheId` (Liste „standort“).
   */
  uebungsdienst?: boolean;
  notiz?: string;
}

/** Wie ein Dienst geführt wird: nach Plan, als Zusatzdienst oder als reiner Übungsdienst. */
export type Dienstart = 'regel' | 'zusatz' | 'uebung';

export const dienstartVon = (d: Pick<Dienst, 'zusatzdienst' | 'uebungsdienst'>): Dienstart =>
  d.uebungsdienst ? 'uebung' : d.zusatzdienst ? 'zusatz' : 'regel';

export const DIENSTART_NAME: Record<Dienstart, string> = { regel: 'Regeldienst', zusatz: 'Zusatzdienst', uebung: 'Übungsdienst' };

/** Nur Regeldienste haben einen Plan und damit Über- und Minusstunden. */
export const hatPlan = (d: Pick<Dienst, 'zusatzdienst' | 'uebungsdienst'>): boolean => !d.zusatzdienst && !d.uebungsdienst;

export interface MassnahmeEintrag {
  /** Eintrag der Liste „massnahme“ (Rettungsdienst) oder „fwmassnahme“ (Feuerwehr). */
  massnahmeId: number;
  anzahl: number;
  /** Fehlt bei sonstigen Maßnahmen im Rettungsdienst, die keine Heilkunde-Einordnung brauchen. */
  durchfuehrung?: Durchfuehrung;
}

/**
 * Eine Übung als Einsatzart neben Rettungsdienst und Feuerwehr. Sie gehört zu einem Dienst, entweder zu
 * einer normalen Schicht oder zu einem reinen Übungsdienst, zählt aber nicht als Einsatz.
 */
export interface Uebung {
  id?: number;
  dienstId: number;
  beginn: number;
  ende: number;
  /** Art der Übung (Liste „uebungsart“). */
  artId: number;
  /** Frei gewähltes Thema, z. B. „Atemschutzstrecke“. */
  thema?: string;
  /** Ort der Übung aus der Liste „standort“, z. B. Feuerwehrschule. */
  ortId?: number;
  /** Die Übung wird als Atemschutzeinsatz gewertet, z. B. Atemschutzstrecke oder Brandcontainer. */
  atemschutz?: boolean;
  /** Minuten unter Atemschutz, höchstens so lang wie die Übung. */
  atemschutzMin?: number;
  /**
   * In der Übung durchgeführte Maßnahmen, aus der Liste für Rettungsdienst oder Feuerwehr.
   * Sie gelten als geübt und haben keine Rechtsgrundlage; im Maßnahmen-Nachweis der Einsätze zählen sie nicht mit.
   */
  massnahmen?: MassnahmeEintrag[];
  notiz?: string;
}

export interface Nachforderung {
  ressourceId: number;
  vonMir: boolean;
}

export interface Einsatz {
  id?: number;
  dienstId: number;
  typ: Typ;
  kategorieId: number;
  /** Menschenleben in Gefahr, nur bei Typ F. */
  mig?: boolean;
  /** Initial alarmierter Kräfteansatz, nur bei R und N. */
  kraefteRtw?: number;
  kraefteNef?: number;
  alarm: number;
  /** Status 1: einsatzbereit über Funk (Einsatzende). */
  status1: number;
  /** Status 2: einsatzbereit auf Wache. */
  status2?: number;
  /**
   * Das Fahrzeug wurde nach diesem Einsatz aus Status 1 heraus zum nächsten Einsatz alarmiert und war
   * deshalb nicht auf Wache. Es gibt dann keinen Status 2, und das ist kein Fehler. Nur ohne Status 2.
   */
  folgeAusStatus1?: boolean;
  fahrzeugId?: number;
  rolleId?: number;
  /** Das eigene Fahrzeug wurde zu einem laufenden Einsatz nachgefordert. */
  nachalarmiert?: boolean;
  nachforderungen?: Nachforderung[];
  ortGrob?: string;
  notiz?: string;
  tagIds?: number[];
  /** NACA-Score I–VII als 1–7. */
  naca?: number;
  altersgruppe?: Altersgruppe;
  notarztVorOrt?: boolean;
  ausgang?: Ausgang | AusgangAlt;
  /** Nur bei „Sonstige Hilfeleistung“: das Stichwort aus der Liste der Hilfeleistungen. */
  hilfeleistungId?: number;
  /** Verdachtsdiagnose vor Ort (Liste „diagnose“). */
  diagnoseId?: number;
  /** Verdacht laut Leitstelle bei der Alarmierung, z. B. „AKS“ (Liste „diagnose“). */
  leitstelleDiagnoseId?: number;
  alarmBewertung?: AlarmBewertung;
  massnahmen?: MassnahmeEintrag[];
  atemschutz?: boolean;
  atemschutzMin?: number;
  /**
   * Alarmstufe der AAO (0–6), nur bei Feuerwehr-Einsätzen. Das Formular belegt sie nach dem Stichwort vor;
   * wurde sie erhöht, steht hier die höchste Stufe. Ohne Eintrag gilt die Stufe, die die AAO für das Stichwort vorsieht.
   */
  alarmstufe?: number;
}

export type ThemeWahl = 'system' | 'light' | 'dark';

/**
 * Für welche Bereiche die App genutzt wird. Der nicht genutzte Bereich wird in Auswahl, Listen und
 * Statistik ausgeblendet. Die Daten bleiben erhalten. Wer nur den Rettungsdienst nutzt, kann Feuerwehr-Einsätze
 * trotzdem erfassen (z. B. RTW bei einem Brand), sie zählen dann aber nicht in der Statistik.
 */
export type Bereiche = 'beide' | 'rd' | 'fw';
export const BEREICHE_NAME: Record<Bereiche, string> = { beide: 'Rettungsdienst und Feuerwehr', rd: 'Nur Rettungsdienst', fw: 'Nur Feuerwehr' };

/** Der Bereich, auf den sich Statistik und Kennzahlen beschränken; bei „beide“ gibt es keine Einschränkung. */
export const statistikBereich = (b: Bereiche | undefined): Bereich | 'alle' => (b === 'rd' ? 'RD' : b === 'fw' ? 'FW' : 'alle');

export interface Einstellungen {
  theme: ThemeWahl;
  /** Genutzte Bereiche; ohne Angabe beide. */
  bereiche: Bereiche;
  backupErinnerungTage: number;
  letztesBackup?: number;
  /** Dienstbeginn bis erste Alarmierung und letzter Status 2 bis Dienstende zählen als Wachzeit. */
  wachzeitMitDienstRand: boolean;
  /** Gebietskörperschaft im Kompendium (z. B. „GL“ für den Rheinisch-Bergischen Kreis); bestimmt die Einordnung der Maßnahmen. */
  region?: string;
  /** Üblicher Dienstbeginn als „HH:MM“; ein 24-h-Dienst beginnt und endet dann zu dieser Uhrzeit. */
  regelBeginn: string;
  standardWacheId?: number;
  standardFahrzeugId?: number;
  standardRolleId?: number;
  letzterDienstId?: number;
  jahresziele?: Record<number, number>;
}

export const STANDARD_EINSTELLUNGEN: Einstellungen = {
  theme: 'system',
  bereiche: 'beide',
  backupErinnerungTage: 30,
  wachzeitMitDienstRand: true,
  region: 'GL',
  regelBeginn: '07:30',
};
