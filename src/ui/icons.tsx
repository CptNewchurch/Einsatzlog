const PFADE = {
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  zurueck: 'M15 5l-7 7 7 7',
  weiter: 'M9 5l7 7-7 7',
  unten: 'M5 9l7 7 7-7',
  oben: 'M5 15l7-7 7 7',
  papierkorb: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3',
  dienste: 'M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1zM4 10h16M8 3v4M16 3v4',
  einsaetze: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  statistik: 'M5 20V11M12 20V4M19 20v-6',
  mehr: 'M4 7h16M4 12h16M4 17h16',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  stift: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  suche: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8h.01M11 12h1v5h1',
  warnung: 'M12 4l9 16H3L12 4zM12 10v4M12 17h.01',
  teilen: 'M8 12l8-5M8 12l8 5M6 9a3 3 0 100 6 3 3 0 000-6zM18 4a3 3 0 100 6 3 3 0 000-6zM18 14a3 3 0 100 6 3 3 0 000-6z',
  schild: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z',
  liste: 'M5 6h14M5 12h14M5 18h14',
} as const;

export type IconName = keyof typeof PFADE;

export function Icon({ name, groesse = 24 }: { name: IconName; groesse?: number }) {
  return (
    <svg
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PFADE[name]} />
    </svg>
  );
}
