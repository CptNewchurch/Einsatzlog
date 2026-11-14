import { fmtZeit } from '../domain/time';
import { bereichVon } from '../domain/types';
import type { Dienst, Einsatz } from '../domain/types';

interface Props {
  dienst: Pick<Dienst, 'beginn' | 'ende'>;
  einsaetze: readonly Einsatz[];
  gross?: boolean;
  /** Einsatzsegmente führen zum Einsatz. */
  verlinkt?: boolean;
  beschriftung?: string;
  /** Aktuelle Zeit; wird als Strich gezeigt, solange der Dienst läuft. */
  jetzt?: number;
}

const STUNDE = 3_600_000;

/** Uhrzeiten, an denen die Skala beschriftet wird (an runden Stunden, nicht zu nah am Rand). */
function skalenMarken(beginn: number, ende: number): { ms: number; label: string }[] {
  const dauerH = (ende - beginn) / STUNDE;
  const schritt = dauerH <= 5 ? 1 : dauerH <= 12 ? 2 : dauerH <= 30 ? 4 : 6;
  const marken: { ms: number; label: string }[] = [];
  const start = new Date(beginn);
  const t = new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours() + 1, 0, 0, 0);
  for (let d = t; d.getTime() < ende; d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1, 0, 0, 0)) {
    if (d.getHours() % schritt !== 0) continue;
    const p = (d.getTime() - beginn) / (ende - beginn);
    if (p < 0.08 || p > 0.92) continue;
    marken.push({ ms: d.getTime(), label: String(d.getHours()).padStart(2, '0') });
  }
  return marken;
}

const prozent = (v: number) => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(3)}%`;

/**
 * Der Dienst als Zeitband: Einsatz (voll), Rückfahrt (schraffiert, dünner) und Wache (leere Spur).
 */
export function DienstBand({ dienst, einsaetze, gross, verlinkt, beschriftung, jetzt }: Props) {
  const { beginn, ende } = dienst;
  const dauer = ende - beginn;
  const lage = (von: number, bis: number) => {
    const l = Math.max(0, (von - beginn) / dauer);
    const r = Math.min(1, (bis - beginn) / dauer);
    return { left: prozent(l), width: prozent(Math.max(0, r - l)) };
  };

  return (
    <div className={`band${gross ? ' band--gross' : ''}`} role="group" aria-label={beschriftung ?? 'Dienstverlauf'}>
      <div className="band__spur">
        {einsaetze.map((e) => {
          const bereich = bereichVon(e.typ).toLowerCase();
          const einsatzLage = lage(e.alarm, e.status1);
          const rueck = e.status2 != null ? lage(e.status1, e.status2) : null;
          const label = `Einsatz ${fmtZeit(e.alarm)} bis ${fmtZeit(e.status1)}`;
          return (
            <span key={e.id}>
              {rueck && <span className={`band__rueck band__rueck--${bereich}`} style={rueck} aria-hidden="true" />}
              {verlinkt ? (
                <a href={`#/einsatz/${e.id}`} className={`band__seg band__seg--${bereich}`} style={einsatzLage} aria-label={label} />
              ) : (
                <span className={`band__seg band__seg--${bereich}`} style={einsatzLage} aria-hidden="true" />
              )}
            </span>
          );
        })}
        {jetzt != null && jetzt > beginn && jetzt < ende && (
          <span className="band__jetzt" style={{ left: prozent((jetzt - beginn) / dauer) }} aria-hidden="true" />
        )}
      </div>
      {gross && (
        <div className="band__skala" aria-hidden="true">
          <span className="band__marke band__marke--links">{fmtZeit(beginn)}</span>
          {skalenMarken(beginn, ende).map((m) => (
            <span key={m.ms} className="band__marke" style={{ left: prozent((m.ms - beginn) / dauer) }}>
              {m.label}
            </span>
          ))}
          <span className="band__marke band__marke--rechts">{fmtZeit(ende)}</span>
        </div>
      )}
    </div>
  );
}

export function BandLegende({ jetzt }: { jetzt?: boolean }) {
  return (
    <ul className="legende" aria-label="Legende des Dienstverlaufs">
      <li>
        <span className="legende__farbe legende__farbe--rd" /> Rettungsdienst
      </li>
      <li>
        <span className="legende__farbe legende__farbe--fw" /> Feuerwehr
      </li>
      <li>
        <span className="legende__farbe legende__farbe--rueck" /> Rückfahrt
      </li>
      <li>
        <span className="legende__farbe legende__farbe--wache" /> Wache
      </li>
      {jetzt && (
        <li>
          <span className="legende__farbe legende__farbe--jetzt" /> Jetzt
        </li>
      )}
    </ul>
  );
}
