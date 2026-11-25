import type { KatalogTyp } from './types';

export interface KatalogInfo {
  titel: string;
  /** „Neues Stichwort“, „Neue Wache“ … */
  neu: string;
  hinweis: string;
}

/** Reihenfolge wie in der Übersicht. */
export const KATALOG_REIHENFOLGE: KatalogTyp[] = [
  'kategorie',
  'diagnose',
  'hilfeleistung',
  'massnahme',
  'fwmassnahme',
  'ressource',
  'fahrzeug',
  'rolle',
  'wache',
  'standort',
  'uebungsart',
  'tag',
];

export const KATALOG_INFO: Record<KatalogTyp, KatalogInfo> = {
  kategorie: {
    titel: 'Stichworte',
    neu: 'Neues Stichwort',
    hinweis: 'Die Kategorie hinter R, N, F, H und ABC, z. B. „Chirurgisch“ oder „Gebäude“. Für die Feuerwehr nach der AAO Bergisch Gladbach vorbelegt.',
  },
  diagnose: {
    titel: 'Verdachtsdiagnosen',
    neu: 'Neue Diagnose',
    hinweis: 'Für „Verdachtsdiagnose“ und „Laut Leitstelle“ im Einsatz. Die Liste wächst beim Erfassen mit.',
  },
  hilfeleistung: {
    titel: 'Hilfeleistungen',
    neu: 'Neue Hilfeleistung',
    hinweis: 'Stichwörter für das Ergebnis „Sonstige Hilfeleistung“, z. B. Tragehilfe oder Türöffnung. Die Liste wächst beim Erfassen mit.',
  },
  massnahme: {
    titel: 'Maßnahmen Rettungsdienst',
    neu: 'Neue Maßnahme',
    hinweis: 'Maßnahmen und Medikamente im Rettungsdienst, vorbelegt nach dem Kompendium. Eigene Einträge kannst du ergänzen.',
  },
  fwmassnahme: {
    titel: 'Maßnahmen Feuerwehr',
    neu: 'Neue Maßnahme',
    hinweis: 'Was du im Feuerwehreinsatz auf Befehl ausführst, z. B. Löschangriff oder Türöffnung. Die Liste wächst beim Erfassen mit.',
  },
  ressource: {
    titel: 'Nachforderungen',
    neu: 'Neue Ressource',
    hinweis: 'Was nachgefordert werden kann, z. B. Notarzt oder Drehleiter.',
  },
  fahrzeug: {
    titel: 'Fahrzeuge',
    neu: 'Neues Fahrzeug',
    hinweis: 'Fahrzeuge, auf denen du eingesetzt bist.',
  },
  rolle: {
    titel: 'Rollen',
    neu: 'Neue Rolle',
    hinweis: 'Deine Funktion im Einsatz, z. B. Transportführer oder Angriffstrupp.',
  },
  wache: {
    titel: 'Wachen',
    neu: 'Neue Wache',
    hinweis: 'Die Wachen für deine Regeldienste.',
  },
  standort: {
    titel: 'Standorte und Übungsorte',
    neu: 'Neuer Standort',
    hinweis:
      'Stadt, Organisation oder Ausbildungsstätte, in der du einen Zusatz- oder Übungsdienst leistest. Auch der Ort einer einzelnen Übung kommt aus dieser Liste, z. B. Feuerwehrschule oder Übungsgelände.',
  },
  uebungsart: {
    titel: 'Übungsarten',
    neu: 'Neue Übungsart',
    hinweis: 'Für die Erfassung von Übungen, z. B. Atemschutz oder Reanimation. Die Liste wächst beim Erfassen mit.',
  },
  tag: {
    titel: 'Tags',
    neu: 'Neuer Tag',
    hinweis: 'Eigene Stichwörter zum Wiederfinden, z. B. „Reanimation“.',
  },
};
