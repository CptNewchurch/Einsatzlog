import { useMemo, useState } from 'react';
import { legeKatalogEintragAn } from '../db/katalog';
import { nameKey, normName } from '../domain/katalogLogik';
import type { KatalogEintrag, KatalogTyp } from '../domain/types';
import { Chip, ChipReihe, Feld, type Ton } from './controls';
import { Icon } from './icons';
import { Knopf } from './controls';
import { Sheet, useToast } from './overlays';

interface Props {
  label: string;
  katalogTyp: KatalogTyp;
  /** Vorschläge als Chips (aktiv, nach Nutzung sortiert). */
  vorschlaege: KatalogEintrag[];
  /** Alles Auswählbare für die Suche. */
  alle: KatalogEintrag[];
  ausgewaehlt: number[];
  mehrfach?: boolean;
  onChange: (ids: number[]) => void;
  /** Zusatzfelder für neu angelegte Einträge, z. B. { typen: ['R'] }. */
  neuExtra?: Partial<KatalogEintrag>;
  maxChips?: number;
  /** Kleinere Chips für lange Listen. */
  klein?: boolean;
  hinweis?: string;
  fehler?: string;
  ton?: Ton;
  nutzung?: ReadonlyMap<number, number>;
  /** Namen ausgewählter Einträge, die nicht mehr in `alle` stehen (archiviert). */
  namenAusgewaehlt?: ReadonlyMap<number, string>;
}

export function KatalogAuswahl({
  label,
  katalogTyp,
  vorschlaege,
  alle,
  ausgewaehlt,
  mehrfach,
  onChange,
  neuExtra,
  maxChips = 8,
  klein,
  hinweis,
  fehler,
  ton = 'neutral',
  nutzung,
  namenAusgewaehlt,
}: Props) {
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState('');
  const toast = useToast();

  const chips = useMemo(() => {
    const sichtbar = vorschlaege.slice(0, maxChips);
    const ids = new Set(sichtbar.map((k) => k.id!));
    const zusatz = ausgewaehlt.filter((id) => !ids.has(id));
    return { sichtbar, zusatz, mehr: alle.length > sichtbar.length };
  }, [vorschlaege, alle.length, ausgewaehlt, maxChips]);

  const nameVon = (id: number) =>
    alle.find((k) => k.id === id)?.name ?? vorschlaege.find((k) => k.id === id)?.name ?? namenAusgewaehlt?.get(id) ?? '?';

  const waehle = (id: number) => {
    if (mehrfach) {
      onChange(ausgewaehlt.includes(id) ? ausgewaehlt.filter((x) => x !== id) : [...ausgewaehlt, id]);
    } else {
      onChange(ausgewaehlt.includes(id) ? [] : [id]);
    }
  };

  const schliesse = () => {
    setOffen(false);
    setSuche('');
  };

  const gefiltert = useMemo(() => {
    const k = nameKey(suche);
    const liste = k ? alle.filter((e) => nameKey(e.name).includes(k)) : alle;
    return liste;
  }, [alle, suche]);

  const neuName = normName(suche);
  const exakt = alle.some((e) => nameKey(e.name) === nameKey(neuName));

  const legeAn = async () => {
    try {
      const e = await legeKatalogEintragAn(katalogTyp, neuName, neuExtra);
      if (mehrfach) {
        if (!ausgewaehlt.includes(e.id!)) onChange([...ausgewaehlt, e.id!]);
        setSuche('');
      } else {
        onChange([e.id!]);
        schliesse();
      }
    } catch (err) {
      toast.zeige(err instanceof Error ? err.message : 'Das hat nicht geklappt.');
    }
  };

  return (
    <Feld label={label} hinweis={hinweis} fehler={fehler}>
      <ChipReihe label={label}>
        {chips.sichtbar.map((k) => (
          <Chip key={k.id} ton={ton} klein={klein} aktiv={ausgewaehlt.includes(k.id!)} onClick={() => waehle(k.id!)}>
            {k.name}
          </Chip>
        ))}
        {chips.zusatz.map((id) => (
          <Chip key={id} ton={ton} klein={klein} aktiv onClick={() => waehle(id)}>
            {nameVon(id)}
          </Chip>
        ))}
        {chips.mehr && (
          <Chip klein={klein} gestrichelt onClick={() => setOffen(true)}>
            Mehr …
          </Chip>
        )}
        <Chip klein={klein} gestrichelt onClick={() => setOffen(true)}>
          + Neu
        </Chip>
      </ChipReihe>

      <Sheet
        offen={offen}
        titel={label}
        onClose={schliesse}
        fuss={
          mehrfach ? (
            <Knopf variante="primaer" voll onClick={schliesse}>
              Fertig{ausgewaehlt.length > 0 ? ` (${ausgewaehlt.length})` : ''}
            </Knopf>
          ) : undefined
        }
      >
        <div className="suchfeld">
          <Icon name="suche" groesse={20} />
          <input
            className="eingabe"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Suchen oder neu anlegen"
            aria-label={`${label} suchen oder neu anlegen`}
            autoFocus
            maxLength={60}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && neuName && !exakt) void legeAn();
            }}
          />
        </div>
        <ul className="auswahl">
          {neuName && !exakt && (
            <li>
              <button type="button" className="auswahl__zeile auswahl__zeile--neu" onClick={() => void legeAn()}>
                <Icon name="plus" groesse={20} />
                <span>„{neuName}“ neu anlegen</span>
              </button>
            </li>
          )}
          {gefiltert.map((k) => {
            const sel = ausgewaehlt.includes(k.id!);
            const n = nutzung?.get(k.id!) ?? 0;
            return (
              <li key={k.id}>
                <button
                  type="button"
                  className="auswahl__zeile"
                  aria-pressed={sel}
                  onClick={() => {
                    waehle(k.id!);
                    if (!mehrfach) schliesse();
                  }}
                >
                  <span className="auswahl__haken">{sel && <Icon name="check" groesse={20} />}</span>
                  <span className="auswahl__name">{k.name}</span>
                  {n > 0 && <span className="auswahl__zahl zahl">{n}×</span>}
                </button>
              </li>
            );
          })}
          {gefiltert.length === 0 && !neuName && <li className="auswahl__leer">Noch keine Einträge.</li>}
        </ul>
      </Sheet>
    </Feld>
  );
}
