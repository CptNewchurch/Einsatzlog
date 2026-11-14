import { useState } from 'react';
import { sollText } from '../domain/dienst';
import { fmtZeit } from '../domain/time';
import { DIENSTART_NAME, dienstartVon, hatPlan, type Dienst } from '../domain/types';
import { navigate } from '../router';
import { dienstTitel, katalogName, useDaten } from '../state/daten';
import { Knopf } from './controls';
import { datumLang } from './dienstzeile';
import { Icon } from './icons';
import { Sheet } from './overlays';

interface Props {
  dienst: Dienst;
  /** Wird mit dem neu gewählten Dienst aufgerufen; das Fenster schließt sich danach selbst. */
  onWahl: (d: Dienst) => void;
  /** Was neben jedem Dienst in der Liste gezählt wird. */
  zaehle: 'einsaetze' | 'uebungen';
}

/** Zeigt den Dienst, zu dem erfasst wird, und lässt ihn wechseln. */
export function DienstWahl({ dienst, onWahl, zaehle }: Props) {
  const daten = useDaten();
  const [offen, setOffen] = useState(false);
  const art = dienstartVon(dienst);

  return (
    <>
      <button type="button" className="dienstwahl" onClick={() => setOffen(true)} aria-label="Dienst ändern">
        <span className="dienstwahl__text">
          <span className="dienstwahl__label">Dienst{art !== 'regel' ? ` (${DIENSTART_NAME[art]})` : ''}</span>
          <span className="dienstwahl__wert">{dienstTitel(daten, dienst)}</span>
          <span className="dienstwahl__meta zahl">
            {hatPlan(dienst) ? sollText(dienst) : `${fmtZeit(dienst.beginn)}–${fmtZeit(dienst.ende)}`}
          </span>
        </span>
        <span className="dienstwahl__aktion">Ändern</span>
      </button>

      <Sheet
        offen={offen}
        titel="Dienst wählen"
        onClose={() => setOffen(false)}
        fuss={
          <div className="knopfstapel dienstwahl__neu">
            <p className="hinweis">Oder einen neuen Dienst anlegen:</p>
            <div className="knopfreihe knopfreihe--dienste">
              <Knopf onClick={() => navigate('/dienst/neu')}>Regeldienst</Knopf>
              <Knopf onClick={() => navigate('/dienst/neu/zusatz')}>Zusatzdienst</Knopf>
              <Knopf onClick={() => navigate('/dienst/neu/uebung')}>Übungsdienst</Knopf>
            </div>
          </div>
        }
      >
        <ul className="auswahl">
          {daten.dienste.slice(0, 20).map((d) => {
            const dienstArt = dienstartVon(d);
            const anzahl = (zaehle === 'einsaetze' ? daten.einsaetzeNachDienst : daten.uebungenNachDienst).get(d.id!)?.length ?? 0;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  className="auswahl__zeile auswahl__zeile--dienst"
                  aria-pressed={d.id === dienst.id}
                  onClick={() => {
                    onWahl(d);
                    setOffen(false);
                  }}
                >
                  <span className="auswahl__haken">{d.id === dienst.id && <Icon name="check" groesse={20} />}</span>
                  <span className="auswahl__name">
                    <span className="auswahl__haupt">
                      {datumLang(d.beginn)}
                      {dienstArt !== 'regel' ? ` · ${DIENSTART_NAME[dienstArt]}` : ''}
                    </span>
                    <span className="auswahl__neben zahl">
                      {fmtZeit(d.beginn)}–{fmtZeit(d.ende)}
                      {katalogName(daten, d.wacheId) ? ` · ${katalogName(daten, d.wacheId)}` : ''}
                    </span>
                  </span>
                  <span className="auswahl__zahl zahl">{anzahl}×</span>
                </button>
              </li>
            );
          })}
        </ul>
        {daten.dienste.length > 20 && <p className="hinweis">Es werden die 20 neuesten Dienste gezeigt. Ältere ändert man über den jeweiligen Dienst.</p>}
      </Sheet>
    </>
  );
}
