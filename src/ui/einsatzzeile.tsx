import { kraefteText } from '../domain/stichwort';
import { fmtDatumKurz, fmtDauer, fmtZeit, minutenZwischen } from '../domain/time';
import { bewertungVon, NACA_INFO } from '../domain/triage';
import { AUSGANG_INFO, bereichVon, type Einsatz } from '../domain/types';
import { einsatzTitel, katalogName, useDaten } from '../state/daten';

interface Props {
  einsatz: Einsatz;
  mitDatum?: boolean;
}

/** Eine Zeile in Einsatzlisten; der farbige Rand zeigt den Bereich. */
export function EinsatzZeile({ einsatz: e, mitDatum }: Props) {
  const d = useDaten();
  const bereich = bereichVon(e.typ).toLowerCase();
  const dauer = minutenZwischen(e.alarm, e.status1);
  const marken: string[] = [];
  if (e.ausgang) marken.push(AUSGANG_INFO[e.ausgang].kurz);
  if (e.naca != null) marken.push(`NACA ${NACA_INFO[e.naca - 1]?.roemisch ?? e.naca}`);
  if (e.diagnoseId != null) marken.push(katalogName(d, e.diagnoseId));
  if (e.leitstelleDiagnoseId != null && e.leitstelleDiagnoseId !== e.diagnoseId) marken.push(`Leitstelle: ${katalogName(d, e.leitstelleDiagnoseId)}`);
  const bewertung = bewertungVon(e);
  if (bewertung === 'hoch') marken.push('Alarm zu hoch');
  else if (bewertung === 'niedrig') marken.push('Alarm zu niedrig');
  if (e.mig) marken.push('MIG');
  if (e.nachalarmiert) marken.push('nachalarmiert');
  (e.nachforderungen ?? []).forEach((n) => marken.push(`Nachf. ${katalogName(d, n.ressourceId)}`));
  if ((e.massnahmen ?? []).length > 0) marken.push(`${e.massnahmen!.length} Maßn.`);
  if (e.status2 == null) marken.push('Status 2 fehlt');

  return (
    <a className={`einsatzzeile einsatzzeile--${bereich}`} href={`#/einsatz/${e.id}`}>
      <div className="einsatzzeile__kopf">
        <span className="einsatzzeile__titel">{einsatzTitel(d, e)}</span>
        {e.kraefteRtw != null && e.kraefteNef != null && (
          <span className="einsatzzeile__kraefte zahl">{kraefteText(e.kraefteRtw, e.kraefteNef)}</span>
        )}
      </div>
      <div className="einsatzzeile__meta zahl">
        {mitDatum && `${fmtDatumKurz(e.alarm)} · `}
        {fmtZeit(e.alarm)}–{fmtZeit(e.status1)} · {fmtDauer(dauer)}
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
