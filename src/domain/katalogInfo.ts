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
  'massnahme',
  'ressource',
  'fahrzeug',
  'rolle',
  'wache',
  'standort',
  'tag',
];

export const KATALOG_INFO: Record<KatalogTyp, KatalogInfo> = {
  kategorie: {
    titel: 'Stichworte',
    neu: 'Neues Stichwort',
    hinweis: 'Die Kategorie hinter R, N, F, H und ABC, z. B. „Chirurgisch“ oder „Gebäude“.',
  },
  diagnose: {
    titel: 'Verdachtsdiagnosen',
    neu: 'Neue Diagnose',
    hinweis: 'Für „Verdachtsdiagnose“ und „Laut Leitstelle“ im Einsatz. Die Liste wächst beim Erfassen mit.',
  },
  massnahme: {
    titel: 'Maßnahmen und Medikamente',
    neu: 'Neue Maßnahme',
    hinweis: 'Vorbelegt nach dem Kompendium. Eigene Einträge kannst du ergänzen.',
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
    titel: 'Standorte für Zusatzdienste',
    neu: 'Neuer Standort',
    hinweis: 'Stadt oder Organisation, in der du einen Zusatzdienst leistest.',
  },
  tag: {
    titel: 'Tags',
    neu: 'Neuer Tag',
    hinweis: 'Eigene Stichwörter zum Wiederfinden, z. B. „Reanimation“.',
  },
};
