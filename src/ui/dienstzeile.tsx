import { dienstSaldo } from '../domain/zeiten';
import { fmtDauer, fmtSaldo, fmtZeit, minutenZwischen } from '../domain/time';
import { bereichVon, hatPlan, type Dienst } from '../domain/types';
import { katalogName, useDaten } from '../state/daten';
import { DienstBand } from './band';

/** Eine Zeile in der Dienstliste mit kleinem Zeitband und Einsatzzahlen. */
export function DienstZeile({ dienst }: { dienst: Dienst }) {
  const d = useDaten();
  const einsaetze = d.einsaetzeNachDienst.get(dienst.id!) ?? [];
  const rd = einsaetze.filter((e) => bereichVon(e.typ) === 'RD').length;
  const fw = einsaetze.length - rd;
  const uebungen = d.uebungenNachDienst.get(dienst.id!) ?? [];
  const saldo = hatPlan(dienst) ? dienstSaldo(dienst).saldoMin : 0;
  const ort = katalogName(d, dienst.wacheId);
  const jetzt = Date.now();

  return (
    <a className="dienstzeile" href={`#/dienst/${dienst.id}`}>
      <div className="dienstzeile__kopf">
        <span className="dienstzeile__datum">{datumLang(dienst.beginn)}</span>
        {dienst.zusatzdienst && <span className="marke">Zusatzdienst</span>}
        {dienst.uebungsdienst && <span className="marke marke--ue">Übungsdienst</span>}
        {saldo !== 0 && (
          <span className={`marke marke--saldo zahl${saldo < 0 ? ' marke--minus' : ''}`}>{fmtSaldo(saldo)}</span>
        )}
      </div>
      <div className="dienstzeile__meta zahl">
        {fmtZeit(dienst.beginn)}–{fmtZeit(dienst.ende)} · {fmtDauer(minutenZwischen(dienst.beginn, dienst.ende))}
        {ort && <span className="dienstzeile__ort"> · {ort}</span>}
      </div>
      <DienstBand dienst={dienst} einsaetze={einsaetze} uebungen={uebungen} jetzt={jetzt} />
      <div className="dienstzeile__zahlen zahl">
        {einsaetze.length === 0 && uebungen.length === 0 ? (
          dienst.uebungsdienst ? (
            'Noch keine Übung erfasst'
          ) : (
            'Keine Einsätze'
          )
        ) : (
          <>
            {einsaetze.length > 0 && (
              <>
                {einsaetze.length} {einsaetze.length === 1 ? 'Einsatz' : 'Einsätze'}
                {rd > 0 && <span className="zahlpunkt zahlpunkt--rd">RD {rd}</span>}
                {fw > 0 && <span className="zahlpunkt zahlpunkt--fw">FW {fw}</span>}
              </>
            )}
            {uebungen.length > 0 &&
              (einsaetze.length > 0 ? (
                <span className="zahlpunkt zahlpunkt--ue">Ü {uebungen.length}</span>
              ) : (
                <>
                  {uebungen.length} {uebungen.length === 1 ? 'Übung' : 'Übungen'}
                </>
              ))}
          </>
        )}
      </div>
    </a>
  );
}

const WOCHENTAG_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** „Samstag, 14.11.“ */
export function datumLang(ms: number): string {
  const x = new Date(ms);
  return `${WOCHENTAG_LANG[x.getDay()]}, ${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.`;
}
