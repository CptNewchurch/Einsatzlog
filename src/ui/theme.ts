import { useEffect } from 'react';
import type { ThemeWahl } from '../domain/types';

export const KOPF_HELL = '#0e1a2e';
export const KOPF_DUNKEL = '#0f1b30';

/** Setzt das Farbschema auf der Seite; „system“ folgt dem Handy, auch wenn es sich während der Nutzung ändert. */
export function useTheme(wahl: ThemeWahl): void {
  useEffect(() => {
    const abfrage = window.matchMedia('(prefers-color-scheme: dark)');
    const wende = () => {
      const dunkel = wahl === 'dark' || (wahl === 'system' && abfrage.matches);
      document.documentElement.dataset.theme = dunkel ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dunkel ? KOPF_DUNKEL : KOPF_HELL);
    };
    wende();
    abfrage.addEventListener('change', wende);
    return () => abfrage.removeEventListener('change', wende);
  }, [wahl]);
}
