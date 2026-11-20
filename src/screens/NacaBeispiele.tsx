import { useMemo, useState } from 'react';
import {
  filtereNacaBeispiele,
  gruppiereNacaBeispiele,
  NACA_FAECHER,
  type NacaFach,
} from '../domain/nacaBeispiele';
import { NACA_INFO } from '../domain/triage';
import { Chip, ChipReihe } from '../ui/controls';
import { Icon } from '../ui/icons';
import { Sheet } from '../ui/overlays';

interface Props {
  offen: boolean;
  onClose: () => void;
  /** Aktuell gewählter NACA-Wert (1–7). */
  wert: number | null;
  /** Ein Beispiel wurde angetippt: der zugehörige NACA-Wert wird übernommen. */
  onWaehle: (naca: number) => void;
}

/** Nachschlagetabelle: Krankheitsbild oder Verletzung suchen, den passenden NACA-Wert ablesen und übernehmen. */
export function NacaBeispiele({ offen, onClose, wert, onWaehle }: Props) {
  return (
    <Sheet offen={offen} titel="NACA-Beispiele" onClose={onClose}>
      {/* Der Inhalt entsteht nur bei geöffnetem Sheet, so beginnt jede Ansicht ohne alte Suche. */}
      <Inhalt wert={wert} onWaehle={onWaehle} />
    </Sheet>
  );
}

function Inhalt({ wert, onWaehle }: Pick<Props, 'wert' | 'onWaehle'>) {
  const [suche, setSuche] = useState('');
  const [fach, setFach] = useState<NacaFach | null>(null);

  const gruppen = useMemo(() => gruppiereNacaBeispiele(filtereNacaBeispiele(suche, fach)), [suche, fach]);
  const treffer = gruppen.reduce((n, g) => n + g.eintraege.length, 0);

  return (
    <div>
      <p className="naca-hinweis">
        Richtwerte, keine amtliche Liste: Es zählt der Zustand des Patienten, nicht die Diagnose allein.
        <span className="naca-hinweis__klein">
          „Lit.“ = als Beispiel in der Fachliteratur genannt, alles andere ist aus den Stufen abgeleitet. Kein Patient (NACA 0)? Dann beim Ergebnis
          „Fehleinsatz“ wählen.
        </span>
      </p>

      <div className="naca-kopf">
        <div className="suchfeld">
          <Icon name="suche" groesse={20} />
          <input
            className="eingabe"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Krankheitsbild oder Verletzung"
            aria-label="Beispiele suchen"
            maxLength={60}
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <div className="naca-faecher">
          <ChipReihe label="Fachgebiet">
            <Chip klein aktiv={fach == null} onClick={() => setFach(null)}>
              Alle
            </Chip>
            {NACA_FAECHER.map((f) => (
              <Chip key={f.fach} klein aktiv={fach === f.fach} onClick={() => setFach(fach === f.fach ? null : f.fach)}>
                {f.label}
              </Chip>
            ))}
          </ChipReihe>
        </div>
      </div>

      <p className="naca-treffer" aria-live="polite">
        {treffer} {treffer === 1 ? 'Beispiel' : 'Beispiele'}
      </p>

      {gruppen.map((g) => {
        const info = NACA_INFO[g.naca - 1];
        return (
          <section key={g.naca} className="naca-gruppe" aria-labelledby={`naca-gruppe-${g.naca}`}>
            <h3 id={`naca-gruppe-${g.naca}`} className="naca-gruppe__kopf">
              <span className="naca-gruppe__zahl zahl">{info.roemisch}</span>
              <span className="naca-gruppe__name">{info.kurz}</span>
              {wert === g.naca && <span className="naca-gruppe__gewaehlt">gewählt</span>}
            </h3>
            <p className="naca-gruppe__def">{info.lang}</p>
            <ul>
              {g.eintraege.map((b) => (
                <li key={`${b.text}|${b.bedingung ?? ''}`}>
                  <button type="button" className="auswahl__zeile" onClick={() => onWaehle(b.naca)}>
                    <span className="auswahl__name">
                      <span className="auswahl__haupt">
                        {b.text}
                        {b.lit && (
                          <abbr className="naca-lit" title="In der Fachliteratur als Beispiel genannt">
                            Lit.
                          </abbr>
                        )}
                      </span>
                      {b.bedingung && <span className="auswahl__neben">{b.bedingung}</span>}
                    </span>
                    <span className="sr-only">: NACA {info.roemisch} übernehmen</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {treffer === 0 && <p className="auswahl__leer">Nichts gefunden. Anderes Wort versuchen oder den Filter auf „Alle“ stellen.</p>}
    </div>
  );
}
