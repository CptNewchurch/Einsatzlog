import { KOMPENDIUM_GL } from './kompendiumGL';
import type { Durchfuehrung } from './types';

// Einordnung der Maßnahmen im Gemeinsamen Kompendium Rettungsdienst 2026.
// Das Kompendium nennt je Stadt/Kreis die erforderliche Mindestqualifikation und mit ★ die
// Vorabdelegation nach § 4 Abs. 2 Nr. 2c NotSanG. Ohne ★ darf ein Notfallsanitäter die Maßnahme
// nur eigenverantwortlich nach § 2a NotSanG durchführen (Lebensgefahr, bis zum Eintreffen des
// Notarztes) oder auf Anordnung eines Arztes (Notarzt oder Telenotarzt).

export type Mindestlevel = 'RS' | 'RettAss' | 'NotSan' | 'Notarzt';

export interface EinordnungEintrag {
  level: Mindestlevel;
  stern: boolean;
  /** Behandlungspfad oder Altersgruppe, wenn die Einordnung wechselt, z. B. „Reanimation Kinder“. */
  kontext?: string;
}

export const REGIONEN: { code: string; name: string }[] = [
  { code: 'AC', name: 'Aachen (Stadt)' },
  { code: 'SR AC', name: 'StädteRegion Aachen' },
  { code: 'BO', name: 'Bochum' },
  { code: 'BOT', name: 'Bottrop' },
  { code: 'D', name: 'Düsseldorf' },
  { code: 'DO', name: 'Dortmund' },
  { code: 'DU', name: 'Duisburg' },
  { code: 'DN', name: 'Kreis Düren' },
  { code: 'E', name: 'Essen' },
  { code: 'EU', name: 'Kreis Euskirchen' },
  { code: 'GE', name: 'Gelsenkirchen' },
  { code: 'GL', name: 'Rheinisch-Bergischer Kreis' },
  { code: 'HA', name: 'Hagen' },
  { code: 'HAM', name: 'Hamm' },
  { code: 'HS', name: 'Kreis Heinsberg' },
  { code: 'HER', name: 'Herne' },
  { code: 'HSK', name: 'Hochsauerlandkreis' },
  { code: 'KLE', name: 'Kreis Kleve' },
  { code: 'KR', name: 'Krefeld' },
  { code: 'MG', name: 'Mönchengladbach' },
  { code: 'MH', name: 'Mülheim an der Ruhr' },
  { code: 'OB', name: 'Oberhausen' },
  { code: 'REK', name: 'Rhein-Erft-Kreis' },
  { code: 'RKN', name: 'Rhein-Kreis Neuss' },
  { code: 'TNA-BL', name: 'TNA Bergisches Land (EN, LEV, ME, SG, RS, W)' },
  { code: 'UN', name: 'Kreis Unna' },
  { code: 'VIE', name: 'Kreis Viersen' },
];

export const regionName = (code: string | undefined): string =>
  REGIONEN.find((r) => r.code === code)?.name ?? '';

/**
 * Einordnung je Region und Maßnahme (Schlüssel wie im Katalog: „inv:iv“, „med:epinephrin“).
 * Fehlt der Schlüssel, gibt es keine Aussage; ein leeres Feld heißt „im Kompendium nicht geführt“.
 * Hinterlegt ist bisher nur der Rheinisch-Bergische Kreis.
 */
export const EINORDNUNG: Record<string, Record<string, EinordnungEintrag[]>> = {
  GL: KOMPENDIUM_GL,
};

/** Regionen mit hinterlegter Einordnung. */
export const REGIONEN_MIT_DATEN = REGIONEN.filter((r) => r.code in EINORDNUNG);

export interface Variante {
  kontext?: string;
  level: Mindestlevel;
  stern: boolean;
  /** Rechtsgrundlage, die sich daraus für einen Notfallsanitäter ergibt. */
  durchfuehrung: Durchfuehrung;
}

export interface Empfehlung {
  /** Eindeutige Vorgabe, sonst null (dann wählst du selbst). */
  vorgabe: Durchfuehrung | null;
  text: string;
  /** Die Einordnung je Anwendung, wenn sie wechselt (sonst leer). */
  varianten: Variante[];
}

export const LEVEL_NAME: Record<Mindestlevel, string> = {
  RS: 'Rettungssanitäter',
  RettAss: 'Rettungsassistent',
  NotSan: 'Notfallsanitäter',
  Notarzt: 'Notarzt',
};

/** Rechtsgrundlage für einen Notfallsanitäter: ★ vorab, Notarzt-Level nur auf Anordnung, sonst eigenverantwortlich. */
export function durchfuehrungVon(e: EinordnungEintrag): Durchfuehrung {
  return e.level === 'Notarzt' ? 'arzt' : e.stern ? 'vorab' : 'eigen';
}

export function empfehlung(region: string | undefined, key: string | undefined): Empfehlung | null {
  if (!region || !key) return null;
  const daten = EINORDNUNG[region];
  const eintraege = daten?.[key];
  if (!eintraege) return null;
  const name = regionName(region);
  if (eintraege.length === 0) {
    return { vorgabe: null, text: `Kompendium (${name}): für diese Region nicht geführt.`, varianten: [] };
  }

  const varianten: Variante[] = eintraege.map((e) => ({ ...e, durchfuehrung: durchfuehrungVon(e) }));
  const arten = new Set(varianten.map((v) => v.durchfuehrung));
  if (arten.size > 1) {
    return {
      vorgabe: null,
      text: `Kompendium (${name}): je nach Anwendung unterschiedlich. Tippe die passende Zeile an.`,
      varianten,
    };
  }
  const vorgabe = varianten[0].durchfuehrung;
  const text =
    vorgabe === 'vorab'
      ? `Kompendium (${name}): ★ – für Notfallsanitäter vorabdelegiert.`
      : vorgabe === 'arzt'
        ? `Kompendium (${name}): nur auf Anordnung von Notarzt oder Telenotarzt.`
        : `Kompendium (${name}): kein ★ – nicht vorabdelegiert, nur eigenverantwortlich nach § 2a (Lebensgefahr, bis zum Eintreffen des Notarztes) oder auf Anordnung.`;
  return { vorgabe, text, varianten: [] };
}
