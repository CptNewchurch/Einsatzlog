import { useMemo, useState } from 'react';
import { legeKatalogEintragAn } from '../db/katalog';
import { empfehlung, LEVEL_NAME } from '../domain/kompendium';
import { nameKey, normName, nutzung, sortiereNachNutzung } from '../domain/katalogLogik';
import {
  DURCHFUEHRUNG_INFO,
  type Durchfuehrung,
  type KatalogEintrag,
  type MassnahmeArt,
  type MassnahmeEintrag,
} from '../domain/types';
import { useDaten } from '../state/daten';
import { Chip, ChipReihe, Knopf, Segment, Stepper } from './controls';
import { Icon } from './icons';
import { Sheet, useToast } from './overlays';

export const ART_NAME: Record<MassnahmeArt, string> = {
  medikament: 'Medikament',
  invasiv: 'Invasive Maßnahme',
  sonstige: 'Sonstige',
};

/** Weiche Trennstellen, damit lange Wörter in schmalen Schaltflächen sauber umbrechen. */
const DURCHFUEHRUNG_OPTIONEN: { wert: Durchfuehrung; label: string }[] = [
  { wert: 'vorab', label: 'Vorab­delegation' },
  { wert: 'eigen', label: 'Eigen­verant­wortlich' },
  { wert: 'arzt', label: 'Auf Anord­nung' },
];

export const brauchtDurchfuehrung = (art: MassnahmeArt | undefined): boolean => art !== 'sonstige';

interface BlockProps {
  werte: MassnahmeEintrag[];
  onChange: (w: MassnahmeEintrag[]) => void;
  fehlende?: Set<number>;
  /** Kompendium-Region für die Vorschläge; ohne Angabe gibt es keine (z. B. im Zusatzdienst). */
  region?: string;
}

/** Liste der Maßnahmen und Medikamente eines Einsatzes, jeweils mit Rechtsgrundlage. */
export function MassnahmenBlock({ werte, onChange, fehlende, region }: BlockProps) {
  const { katalogMap } = useDaten();
  const [offen, setOffen] = useState(false);

  const setze = (i: number, patch: Partial<MassnahmeEintrag>) =>
    onChange(werte.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  return (
    <div className="massnahmen">
      {werte.length === 0 && (
        <p className="hinweis">Keine Maßnahmen erfasst. Nur Medikamente und Maßnahmen eintragen, die du selbst durchgeführt hast.</p>
      )}
      {werte.map((w, i) => {
        const k = katalogMap.get(w.massnahmeId);
        const art = k?.art ?? 'sonstige';
        const hilfe = brauchtDurchfuehrung(art) ? empfehlung(region, k?.kompendiumKey) : null;
        const fehlt = fehlende?.has(i);
        return (
          <div className={`massnahme${fehlt ? ' massnahme--fehler' : ''}`} key={i}>
            <div className="massnahme__kopf">
              <div>
                <div className="massnahme__name">{k?.name ?? '?'}</div>
                <div className="massnahme__art">{ART_NAME[art]}</div>
              </div>
              <button
                type="button"
                className="icon-knopf"
                aria-label={`${k?.name ?? 'Maßnahme'} entfernen`}
                onClick={() => onChange(werte.filter((_, j) => j !== i))}
              >
                <Icon name="papierkorb" />
              </button>
            </div>
            {brauchtDurchfuehrung(art) && (
              <>
                <Segment
                  label={`Rechtsgrundlage für ${k?.name ?? 'Maßnahme'}`}
                  wert={w.durchfuehrung}
                  optionen={DURCHFUEHRUNG_OPTIONEN}
                  onChange={(d) => setze(i, { durchfuehrung: d })}
                />
                {w.durchfuehrung && <div className="hinweis">{DURCHFUEHRUNG_INFO[w.durchfuehrung].lang}</div>}
                {fehlt && !w.durchfuehrung && (
                  <div className="feld__fehler" role="alert">
                    Bitte wählen: vorabdelegiert, eigenverantwortlich oder auf Anordnung.
                  </div>
                )}
                {hilfe && <div className="hinweis hinweis--kompendium">{hilfe.text}</div>}
                {hilfe && hilfe.varianten.length > 1 && (
                  <ul className="varianten" aria-label="Einordnung je Anwendung">
                    {hilfe.varianten.map((v, j) => (
                      <li key={j}>
                        <button
                          type="button"
                          className="variante"
                          onClick={() => setze(i, { durchfuehrung: v.durchfuehrung })}
                        >
                          <span className="variante__text">{v.kontext}</span>
                          <span className="variante__stufe">
                            {v.level === 'Notarzt' ? 'Notarzt' : `${LEVEL_NAME[v.level]}${v.stern ? ' ★' : ''}`}
                          </span>
                          <span className="variante__folge">→ {DURCHFUEHRUNG_INFO[v.durchfuehrung].kurz}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <div className="massnahme__zahl">
              <span className="feld__label">{art === 'medikament' ? 'Gaben' : 'Anzahl'}</span>
              <Stepper
                label={`Anzahl ${k?.name ?? ''}`}
                wert={w.anzahl}
                min={1}
                max={20}
                onChange={(n) => setze(i, { anzahl: n })}
              />
            </div>
          </div>
        );
      })}
      <Knopf variante="sekundaer" voll onClick={() => setOffen(true)}>
        <Icon name="plus" groesse={20} /> Maßnahme oder Medikament
      </Knopf>
      <MassnahmeSheet
        offen={offen}
        onClose={() => setOffen(false)}
        werte={werte}
        onHinzu={(k) => {
          const h = brauchtDurchfuehrung(k.art) ? empfehlung(region, k.kompendiumKey) : null;
          onChange([
            ...werte,
            { massnahmeId: k.id!, anzahl: 1, ...(h?.vorgabe ? { durchfuehrung: h.vorgabe } : {}) },
          ]);
        }}
      />
    </div>
  );
}

interface SheetProps {
  offen: boolean;
  onClose: () => void;
  werte: MassnahmeEintrag[];
  onHinzu: (k: KatalogEintrag) => void;
}

function MassnahmeSheet({ offen, onClose, werte, onHinzu }: SheetProps) {
  const { katalog, dienste, einsaetze } = useDaten();
  const toast = useToast();
  const [suche, setSuche] = useState('');
  const [neueArt, setNeueArt] = useState<MassnahmeArt>('medikament');

  const gezaehlt = useMemo(() => nutzung('massnahme', dienste, einsaetze), [dienste, einsaetze]);
  const aktive = useMemo(
    () => sortiereNachNutzung(katalog.filter((k) => k.typ === 'massnahme' && k.aktiv), gezaehlt),
    [katalog, gezaehlt],
  );

  const key = nameKey(suche);
  const treffer = key ? aktive.filter((k) => nameKey(k.name).includes(key)) : aktive;
  const neuName = normName(suche);
  const exakt = aktive.some((k) => nameKey(k.name) === nameKey(neuName));

  const gruppen: { titel: string; liste: KatalogEintrag[] }[] = key
    ? [{ titel: 'Treffer', liste: treffer }]
    : [
        { titel: 'Häufig verwendet', liste: treffer.filter((k) => (gezaehlt.get(k.id!) ?? 0) > 0).slice(0, 6) },
        { titel: 'Medikamente', liste: treffer.filter((k) => k.art === 'medikament') },
        { titel: 'Invasive Maßnahmen', liste: treffer.filter((k) => k.art === 'invasiv') },
        { titel: 'Sonstige', liste: treffer.filter((k) => k.art === 'sonstige' || !k.art) },
      ];

  const anzahlIn = (id: number) => werte.filter((w) => w.massnahmeId === id).length;

  const legeAn = async () => {
    try {
      const k = await legeKatalogEintragAn('massnahme', neuName, { art: neueArt });
      onHinzu(k);
      setSuche('');
    } catch (err) {
      toast.zeige(err instanceof Error ? err.message : 'Das hat nicht geklappt.');
    }
  };

  const schliesse = () => {
    setSuche('');
    onClose();
  };

  return (
    <Sheet
      offen={offen}
      titel="Maßnahme oder Medikament"
      onClose={schliesse}
      fuss={
        <Knopf variante="primaer" voll onClick={schliesse}>
          Fertig{werte.length > 0 ? ` (${werte.length})` : ''}
        </Knopf>
      }
    >
      <div className="suchfeld">
        <Icon name="suche" groesse={20} />
        <input
          className="eingabe"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Suchen oder neu anlegen"
          aria-label="Maßnahme oder Medikament suchen"
          maxLength={60}
        />
      </div>
      <p className="hinweis">Startliste nach dem Gemeinsamen Kompendium Rettungsdienst 2026. Tippe mehrfach, um dieselbe Gabe erneut hinzuzufügen.</p>

      {neuName && !exakt && (
        <div className="neu-massnahme">
          <ChipReihe label="Art der neuen Maßnahme">
            {(Object.keys(ART_NAME) as MassnahmeArt[]).map((a) => (
              <Chip key={a} klein aktiv={neueArt === a} onClick={() => setNeueArt(a)}>
                {ART_NAME[a]}
              </Chip>
            ))}
          </ChipReihe>
          <button type="button" className="auswahl__zeile auswahl__zeile--neu" onClick={() => void legeAn()}>
            <Icon name="plus" groesse={20} />
            <span>„{neuName}“ neu anlegen und hinzufügen</span>
          </button>
        </div>
      )}

      {gruppen
        .filter((g) => g.liste.length > 0)
        .map((g) => (
          <div key={g.titel}>
            <h3 className="auswahl__gruppe">{g.titel}</h3>
            <ul className="auswahl">
              {g.liste.map((k) => {
                const n = anzahlIn(k.id!);
                return (
                  <li key={k.id}>
                    <button type="button" className="auswahl__zeile" onClick={() => onHinzu(k)}>
                      <span className="auswahl__haken">
                        <Icon name="plus" groesse={18} />
                      </span>
                      <span className="auswahl__name">{k.name}</span>
                      {n > 0 && <span className="auswahl__badge zahl">{n}× im Einsatz</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </Sheet>
  );
}
