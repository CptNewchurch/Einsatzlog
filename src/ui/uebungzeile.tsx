import { fmtDatumKurz, fmtDauer, fmtZeit, minutenZwischen } from '../domain/time';
import type { Uebung } from '../domain/types';
import { katalogName, useDaten } from '../state/daten';

interface Props {
  uebung: Uebung;
  mitDatum?: boolean;
}

/** Eine Übung in Listen, im gleichen Stil wie ein Einsatz, mit violettem Rand. */
export function UebungZeile({ uebung: u, mitDatum }: Props) {
  const d = useDaten();
  const marken: string[] = [];
  if (u.thema) marken.push(u.thema);
  if (u.atemschutz) marken.push(u.atemschutzMin ? `Atemschutz ${u.atemschutzMin} min` : 'Atemschutz');
  const anzahl = (u.massnahmen ?? []).length;
  if (anzahl > 0) marken.push(`${anzahl} Maßn.`);
  if (u.notiz) marken.push('mit Notiz');
  return (
    <a className="einsatzzeile einsatzzeile--ue" href={`#/uebung/${u.id}`}>
      <div className="einsatzzeile__kopf">
        <span className="einsatzzeile__titel">
          <span className="einsatzzeile__art" aria-hidden="true">Ü</span>
          {katalogName(d, u.artId)}
          <span className="sr-only"> (Übung)</span>
        </span>
      </div>
      <div className="einsatzzeile__meta zahl">
        {mitDatum && `${fmtDatumKurz(u.beginn)} · `}
        {fmtZeit(u.beginn)}–{fmtZeit(u.ende)} · {fmtDauer(minutenZwischen(u.beginn, u.ende))}
        {u.ortId != null && ` · ${katalogName(d, u.ortId)}`}
      </div>
      {marken.length > 0 && (
        <ul className="einsatzzeile__marken">
          {marken.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </a>
  );
}
