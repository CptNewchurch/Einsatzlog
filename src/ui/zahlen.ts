/** „62 %“ oder ein Strich, wenn es nichts zu teilen gibt. */
export const prozent = (teil: number, ganz: number): string => (ganz > 0 ? `${Math.round((teil / ganz) * 100)} %` : '–');
