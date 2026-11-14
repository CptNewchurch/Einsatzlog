import type { EinordnungEintrag, Mindestlevel } from './kompendium';

// Einordnung für den Rheinisch-Bergischen Kreis (Kürzel „GL“) aus dem Gemeinsamen Kompendium
// Rettungsdienst 2026. Gelesen aus den SAA „Invasive Maßnahmen“ und den Medikamenten-SAA/BPR.
//
//   level  Mindestqualifikation laut Kompendium
//   stern  ★ = für Notfallsanitäter vorabdelegiert (§ 4 Abs. 2 Nr. 2c NotSanG)
//
// Ein leeres Feld bedeutet: Das Kompendium führt die Maßnahme für diese Region nicht.
// Mehrere Einträge entstehen, wenn die Einordnung je nach Behandlungspfad oder Altersgruppe wechselt.

const k = (level: Mindestlevel, stern = false, kontext?: string): EinordnungEintrag => ({
  level,
  stern,
  ...(kontext ? { kontext } : {}),
});

export const KOMPENDIUM_GL: Record<string, EinordnungEintrag[]> = {
  // Invasive Maßnahmen
  'inv:iv': [k('RS')],
  'inv:io': [k('NotSan')],
  'inv:ega-lts': [],
  'inv:ega-lma': [k('RS')],
  'inv:ega-igel': [k('RS')],
  'inv:laryngoskopie': [k('RettAss')],
  'inv:cpap': [k('NotSan', true)],
  'inv:tourniquet': [k('RS')],
  'inv:beckenschlinge': [k('RettAss')],
  'inv:immobilisation': [k('RettAss')],
  'inv:thorax': [k('NotSan')],
  'inv:defi': [k('RS')],
  'inv:kardioversion': [k('NotSan')],
  'inv:schrittmacher': [k('NotSan')],
  'inv:absaugen': [k('RettAss')],
  'inv:im': [k('RettAss')],
  'inv:in': [k('RettAss')],

  // Medikamente
  'med:asa': [k('NotSan', true)],
  'med:amiodaron': [
    k('RettAss', true, 'Reanimation Erwachsene'),
    k('NotSan', true, 'Reanimation Kinder'),
    k('NotSan', false, 'Kammertachykardie (Kurzinfusion)'),
  ],
  'med:atropin': [k('NotSan')],
  'med:berodual': [],
  'med:butylscopolamin': [k('NotSan', true)],
  'med:diazepam': [k('RettAss', true)],
  'med:dimenhydrinat': [k('NotSan', true)],
  'med:dimetinden': [k('NotSan', true)],
  'med:epinephrin': [
    k('RettAss', true, 'Reanimation Erwachsene'),
    k('NotSan', true, 'Reanimation Kinder'),
    k('RettAss', true, 'Anaphylaxie i.m. ab 12 Jahren'),
    k('NotSan', false, 'Anaphylaxie i.m. 6 bis 12 Jahre'),
    k('NotSan', false, 'Anaphylaxie i.m. unter 6 Jahre'),
    k('RettAss', true, 'Anaphylaxie Verneblung'),
    k('RettAss', true, 'A-Problem Erwachsene: inhalativ'),
    k('RettAss', true, 'Bronchialobstruktion Kinder unter 4 Jahre: inhalativ'),
    k('RettAss', true, 'Obere Atemwege Kinder unter 12 Jahre: inhalativ'),
    k('NotSan', false, 'Instabile Bradykardie (5 µg i.v.)'),
  ],
  'med:esketamin': [k('NotSan', true)],
  'med:fentanyl': [],
  'med:furosemid': [k('NotSan', true)],
  'med:glucagon': [],
  'med:glucose': [k('RettAss', true)],
  'med:gtn': [k('NotSan', false, 'ACS (keine routinemäßige Gabe)'), k('NotSan', true, 'Lungenödem')],
  'med:heparin': [k('NotSan')],
  'med:ibuprofen': [],
  'med:ipratropium': [k('RettAss', true)],
  'med:ketamin': [],
  'med:lidocain': [k('Notarzt')],
  'med:metamizol': [k('Notarzt')],
  'med:metoprolol': [k('NotSan')],
  'med:midazolam': [
    k('NotSan', true, 'Analgosedierung i.v.'),
    k('NotSan', false, 'Krampfanfall i.v.'),
    k('NotSan', false, 'Krampfanfall i.m.'),
    k('RettAss', true, 'Krampfanfall intranasal'),
  ],
  'med:morphin': [k('NotSan', true, 'Erwachsene'), k('Notarzt', false, 'Kinder')],
  'med:nalbuphin': [],
  'med:naloxon': [k('NotSan', true)],
  'med:ondansetron': [k('NotSan')],
  'med:paracetamol': [k('NotSan', true, 'Analgesie i.v.'), k('RettAss', true, 'Fiebersenkung beim Kind')],
  'med:prednisolon': [k('NotSan', true)],
  'med:salbutamol': [k('RettAss', true)],
  'med:txa': [k('NotSan', true)],
  'med:urapidil': [k('NotSan', true)],
  'med:vel': [k('RettAss', true)],
  // Sauerstoff steht nicht als eigene SAA im Kompendium und bekommt deshalb keine Einordnung.
};
