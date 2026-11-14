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
  | 'massnahme'
  | 'diagnose'
  | 'ressource'
  | 'tag';

export type MassnahmeArt = 'medikament' | 'invasiv' | 'sonstige';
export type Altersgruppe = 'saeugling' | 'kind' | 'erwachsener' | 'senior';

export interface KatalogEintrag {
  id?: number;
  typ: KatalogTyp;
  name: string;
  aktiv: boolean;
  /** Nur Kategorien: bei welchen Stichwort-Typen die Kategorie genutzt wird. */
  typen?: Typ[];
  /** Nur Rollen und Fahrzeuge: für welchen Bereich sie vorgeschlagen werden. */
  bereich?: Bereich;
  /** Nur Maßnahmen. */
  art?: MassnahmeArt;
  /** Nur Maßnahmen aus dem Kompendium: Schlüssel für die Einordnung (z. B. „med:epinephrin“). */
  kompendiumKey?: string;
}

/**
 * Rechtsgrundlage, auf der eine Maßnahme durchgeführt wurde.
 * vorab: vorabdelegiert nach § 4 Abs. 2 Nr. 2c NotSanG (★ im Kompendium)
 * eigen: eigenverantwortlich nach § 2a NotSanG
 * arzt: auf Anordnung von Notarzt oder Telenotarzt (§ 4 Abs. 2 Nr. 2b NotSanG)
 */
export type Durchfuehrung = 'vorab' | 'eigen' | 'arzt';
export const DURCHFUEHRUNGEN: readonly Durchfuehrung[] = ['vorab', 'eigen', 'arzt'];

export const DURCHFUEHRUNG_INFO: Record<Durchfuehrung, { kurz: string; lang: string }> = {
  vorab: { kurz: 'Vorabdelegation', lang: 'Vorabdelegiert nach § 4 Abs. 2 Nr. 2c NotSanG (★ im Kompendium)' },
  eigen: { kurz: 'Eigenverantwortlich', lang: 'Eigenverantwortlich nach § 2a NotSanG' },
  arzt: { kurz: 'Auf Anordnung', lang: 'Auf Anordnung von Notarzt oder Telenotarzt (§ 4 Abs. 2 Nr. 2b NotSanG)' },
};

/**
 * Wie ein Einsatz ausging: was tatsächlich geschah, nicht was alarmiert wurde.
 * „transportdienst“ und „hilfeleistung“ zählen als zu hohe Alarmierung (Übertriage),
 * weil dafür kein Rettungsmittel nötig gewesen wäre.
 */
export type Ausgang = 'transport' | 'ambulant' | 'abgelehnt' | 'verstorben' | 'transportdienst' | 'hilfeleistung' | 'fehleinsatz';

/** Auswahl im Rettungsdienst, in dieser Reihenfolge. */
export const AUSGAENGE_RD: readonly Ausgang[] = ['transport', 'ambulant', 'abgelehnt', 'verstorben', 'transportdienst', 'hilfeleistung', 'fehleinsatz'];

export interface AusgangInfo {
  kurz: string;
  lang: string;
  /** Zählt als zu hohe Alarmierung. */
  uebertriage: boolean;
}

export const AUSGANG_INFO: Record<Ausgang, AusgangInfo> = {
  transport: { kurz: 'Transport', lang: 'Der Patient wurde in eine Klinik transportiert.', uebertriage: false },
  ambulant: { kurz: 'Ambulant versorgt', lang: 'Vor Ort versorgt, ein Transport war nicht nötig.', uebertriage: false },
  abgelehnt: { kurz: 'Lehnt ab', lang: 'Der Patient lehnt Transport oder Behandlung ab.', uebertriage: false },
  verstorben: { kurz: 'Verstorben', lang: 'Tod festgestellt oder Reanimation erfolglos beendet.', uebertriage: false },
  transportdienst: { kurz: 'Nur Transport', lang: 'Reine Transportleistung ohne Notfall. Das hätte ein Krankentransport sein können.', uebertriage: true },
  hilfeleistung: { kurz: 'Hilfeleistung', lang: 'Keine medizinische Notlage, z. B. Aufstehhilfe oder Tragehilfe.', uebertriage: true },
  fehleinsatz: { kurz: 'Fehleinsatz', lang: 'Kein Patient oder keine Einsatzstelle angetroffen, Fehlalarm oder abgebrochen.', uebertriage: false },
};

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
  notiz?: string;
}

export interface MassnahmeEintrag {
  massnahmeId: number;
  anzahl: number;
  /** Fehlt bei sonstigen Maßnahmen, die keine Heilkunde-Einordnung brauchen. */
  durchfuehrung?: Durchfuehrung;
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
  ausgang?: Ausgang;
  /** Verdachtsdiagnose vor Ort (Liste „diagnose“). */
  diagnoseId?: number;
  /** Verdacht laut Leitstelle bei der Alarmierung, z. B. „AKS“ (Liste „diagnose“). */
  leitstelleDiagnoseId?: number;
  alarmBewertung?: AlarmBewertung;
  massnahmen?: MassnahmeEintrag[];
  atemschutz?: boolean;
  atemschutzMin?: number;
}

export type ThemeWahl = 'system' | 'light' | 'dark';

export interface Einstellungen {
  theme: ThemeWahl;
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
  backupErinnerungTage: 30,
  wachzeitMitDienstRand: true,
  region: 'GL',
  regelBeginn: '07:30',
};
