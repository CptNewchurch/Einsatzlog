import { useEffect, useState } from 'react';
import { TYPEN, type KatalogTyp, type Typ } from './domain/types';

export type Route =
  | { name: 'start' }
  | { name: 'dienstNeu'; zusatz?: boolean; uebung?: boolean }
  | { name: 'dienstBearbeiten'; id: number; zeiten?: boolean }
  | { name: 'dienst'; id: number }
  | { name: 'einsatzNeu'; dienstId?: number; typ?: Typ }
  | { name: 'einsatz'; id: number }
  | { name: 'uebungNeu'; dienstId?: number }
  | { name: 'uebung'; id: number }
  | { name: 'einsaetze' }
  | { name: 'statistik' }
  | { name: 'mehr' }
  | { name: 'einstellungen' }
  | { name: 'kataloge' }
  | { name: 'katalog'; typ: KatalogTyp }
  | { name: 'backup' }
  | { name: 'ueber' }
  | { name: 'unbekannt' };

export const KATALOG_SLUGS: Record<string, KatalogTyp> = {
  stichworte: 'kategorie',
  diagnosen: 'diagnose',
  massnahmen: 'massnahme',
  'fw-massnahmen': 'fwmassnahme',
  ressourcen: 'ressource',
  fahrzeuge: 'fahrzeug',
  rollen: 'rolle',
  wachen: 'wache',
  standorte: 'standort',
  uebungsarten: 'uebungsart',
  tags: 'tag',
};

export const katalogPfad = (typ: KatalogTyp): string =>
  `/mehr/kataloge/${Object.entries(KATALOG_SLUGS).find(([, t]) => t === typ)![0]}`;

const zahl = (s: string | undefined): number | null => {
  if (!s || !/^\d+$/.test(s)) return null;
  return Number(s);
};

export function parseRoute(hash: string): Route {
  const roh = hash.replace(/^#/, '') || '/';
  const [pfad, query = ''] = roh.split('?');
  const teile = pfad.split('/').filter(Boolean);
  const params = new URLSearchParams(query);

  if (teile.length === 0) return { name: 'start' };
  const [a, b, c] = teile;
  switch (a) {
    case 'dienst': {
      if (b === 'neu' && teile.length === 2) return { name: 'dienstNeu' };
      if (b === 'neu' && c === 'zusatz' && teile.length === 3) return { name: 'dienstNeu', zusatz: true };
      if (b === 'neu' && c === 'uebung' && teile.length === 3) return { name: 'dienstNeu', uebung: true };
      const id = zahl(b);
      if (id == null) break;
      if (teile.length === 2) return { name: 'dienst', id };
      if (teile.length === 3 && c === 'bearbeiten') {
        return params.get('zeiten') === '1' ? { name: 'dienstBearbeiten', id, zeiten: true } : { name: 'dienstBearbeiten', id };
      }
      break;
    }
    case 'einsatz': {
      if (b === 'neu' && teile.length === 2) {
        const d = zahl(params.get('dienst') ?? undefined);
        const t = params.get('typ');
        const typ = TYPEN.find((x) => x === t);
        return { name: 'einsatzNeu', ...(d != null ? { dienstId: d } : {}), ...(typ ? { typ } : {}) };
      }
      const id = zahl(b);
      if (id != null && teile.length === 2) return { name: 'einsatz', id };
      break;
    }
    case 'uebung': {
      if (b === 'neu' && teile.length === 2) {
        const d = zahl(params.get('dienst') ?? undefined);
        return d == null ? { name: 'uebungNeu' } : { name: 'uebungNeu', dienstId: d };
      }
      const id = zahl(b);
      if (id != null && teile.length === 2) return { name: 'uebung', id };
      break;
    }
    case 'einsaetze':
      if (teile.length === 1) return { name: 'einsaetze' };
      break;
    case 'statistik':
      if (teile.length === 1) return { name: 'statistik' };
      break;
    case 'mehr': {
      if (teile.length === 1) return { name: 'mehr' };
      if (b === 'einstellungen' && teile.length === 2) return { name: 'einstellungen' };
      if (b === 'backup' && teile.length === 2) return { name: 'backup' };
      if (b === 'ueber' && teile.length === 2) return { name: 'ueber' };
      if (b === 'kataloge') {
        if (teile.length === 2) return { name: 'kataloge' };
        const typ = c ? KATALOG_SLUGS[c] : undefined;
        if (typ && teile.length === 3) return { name: 'katalog', typ };
      }
      break;
    }
  }
  return { name: 'unbekannt' };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const f = () => setHash(window.location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return parseRoute(hash);
}

export function navigate(pfad: string, ersetzen = false): void {
  const ziel = `#${pfad}`;
  if (ersetzen) window.location.replace(ziel);
  else window.location.hash = ziel;
}

/** Geht einen Schritt zurück; ohne Verlauf (z. B. direkter Start) zum Ersatzziel. */
export function zurueck(fallback: string): void {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback, true);
}

/** Welcher Tab gehört zur Route? */
export function tabVon(r: Route): 'dienste' | 'einsaetze' | 'statistik' | 'mehr' {
  switch (r.name) {
    case 'einsaetze':
    case 'einsatz':
    case 'einsatzNeu':
    case 'uebung':
    case 'uebungNeu':
      return 'einsaetze';
    case 'statistik':
      return 'statistik';
    case 'mehr':
    case 'einstellungen':
    case 'kataloge':
    case 'katalog':
    case 'backup':
    case 'ueber':
      return 'mehr';
    default:
      return 'dienste';
  }
}
