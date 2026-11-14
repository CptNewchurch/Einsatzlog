import { useMemo, useState } from 'react';
import { aendereKatalogEintrag, legeKatalogEintragAn, loescheKatalogEintrag } from '../db/katalog';
import { KATALOG_INFO, KATALOG_REIHENFOLGE } from '../domain/katalogInfo';
import { nameKey, normName, nutzung } from '../domain/katalogLogik';
import { BEREICH_NAME } from '../domain/stichwort';
import { TYPEN, type Bereich, type KatalogEintrag, type KatalogTyp, type MassnahmeArt, type Typ } from '../domain/types';
import { katalogPfad, navigate } from '../router';
import { useDaten } from '../state/daten';
import { Chip, ChipReihe, Feld, Knopf, Leer, Meldung, Segment, TextFeld, Toggle } from '../ui/controls';
import { Icon } from '../ui/icons';
import { ART_NAME } from '../ui/massnahmen';
import { Bestaetigung, Sheet, useToast } from '../ui/overlays';
import { Seite } from '../ui/seite';

/* ---------- Übersicht ---------- */

export function KatalogUebersicht() {
  const { katalog } = useDaten();
  const zahlen = useMemo(() => {
    const m = new Map<KatalogTyp, number>();
    katalog.forEach((k) => k.aktiv && m.set(k.typ, (m.get(k.typ) ?? 0) + 1));
    return m;
  }, [katalog]);

  return (
    <Seite titel="Listen pflegen" zurueckZu="/mehr">
      <p className="hinweis">
        Neue Einträge legst du am schnellsten direkt beim Erfassen mit „+ Neu“ an. Hier benennst du sie um, blendest sie aus oder löschst, was du nie benutzt hast.
      </p>
      <ul className="menue">
        {KATALOG_REIHENFOLGE.map((typ) => (
          <li key={typ}>
            <button type="button" className="menuezeile" onClick={() => navigate(katalogPfad(typ))}>
              <span className="menuezeile__text">
                <span className="menuezeile__titel">{KATALOG_INFO[typ].titel}</span>
                <span className="menuezeile__info">{KATALOG_INFO[typ].hinweis}</span>
              </span>
              <span className="menuezeile__zahl zahl">{zahlen.get(typ) ?? 0}</span>
              <Icon name="weiter" groesse={20} />
            </button>
          </li>
        ))}
      </ul>
    </Seite>
  );
}

/* ---------- Eine Liste ---------- */

const BEREICH_OPTIONEN: { wert: Bereich | 'beide'; label: string }[] = [
  { wert: 'beide', label: 'Beide' },
  { wert: 'RD', label: 'Rettungsdienst' },
  { wert: 'FW', label: 'Feuerwehr' },
];

function meta(k: KatalogEintrag): string {
  switch (k.typ) {
    case 'kategorie':
      return (k.typen ?? []).length > 0 ? [...(k.typen ?? [])].sort((a, b) => TYPEN.indexOf(a) - TYPEN.indexOf(b)).join(' · ') : 'ohne Typ';
    case 'fahrzeug':
    case 'rolle':
      return k.bereich ? BEREICH_NAME[k.bereich] : 'RD und FW';
    case 'massnahme':
      return `${ART_NAME[k.art ?? 'sonstige']}${k.kompendiumKey ? ' · Kompendium' : ''}`;
    default:
      return '';
  }
}

interface Entwurf {
  name: string;
  typen: Typ[];
  bereich: Bereich | 'beide';
  art: MassnahmeArt;
  aktiv: boolean;
}

function entwurfVon(k?: KatalogEintrag): Entwurf {
  return {
    name: k?.name ?? '',
    typen: k?.typen ?? [],
    bereich: k?.bereich ?? 'beide',
    art: k?.art ?? 'sonstige',
    aktiv: k?.aktiv ?? true,
  };
}

interface BearbeitenProps {
  typ: KatalogTyp;
  /** Bestehender Eintrag; ohne = neu anlegen. */
  eintrag?: KatalogEintrag;
  verwendet: number;
  onClose: () => void;
}

function KatalogBearbeiten({ typ, eintrag, verwendet, onClose }: BearbeitenProps) {
  const toast = useToast();
  const { katalog } = useDaten();
  const info = KATALOG_INFO[typ];
  const [e, setE] = useState<Entwurf>(() => entwurfVon(eintrag));
  const [loeschen, setLoeschen] = useState(false);
  const [fehler, setFehler] = useState<string | undefined>();
  const artFest = !!eintrag?.kompendiumKey;

  const sauber = normName(e.name);
  const doppelt = katalog.some((k) => k.typ === typ && k.id !== eintrag?.id && nameKey(k.name) === nameKey(sauber));
  const nameFehler = fehler ?? (sauber === '' ? 'Der Name darf nicht leer sein.' : doppelt ? `„${sauber}“ gibt es in dieser Liste schon.` : undefined);

  const felder = (): Partial<KatalogEintrag> => ({
    ...(typ === 'kategorie' ? { typen: e.typen } : {}),
    ...(typ === 'fahrzeug' || typ === 'rolle' ? { bereich: e.bereich === 'beide' ? undefined : e.bereich } : {}),
    ...(typ === 'massnahme' && !artFest ? { art: e.art } : {}),
  });

  const speichern = async () => {
    if (nameFehler) {
      setFehler(nameFehler);
      return;
    }
    try {
      if (eintrag) {
        await aendereKatalogEintrag(eintrag.id!, { name: sauber, aktiv: e.aktiv, ...felder() });
      } else {
        await legeKatalogEintragAn(typ, sauber, felder());
      }
      toast.zeige(eintrag ? 'Gespeichert' : `${info.neu.replace(/^Neu(e|er|es) /, '')} angelegt`);
      onClose();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Das hat nicht geklappt.');
    }
  };

  return (
    <>
      <Sheet
        offen
        titel={eintrag ? 'Eintrag bearbeiten' : info.neu}
        onClose={onClose}
        fuss={
          <div className="knopfreihe">
            {eintrag && verwendet === 0 && (
              <Knopf variante="gefahr" onClick={() => setLoeschen(true)}>
                Löschen
              </Knopf>
            )}
            <Knopf variante="primaer" onClick={() => void speichern()}>
              Speichern
            </Knopf>
          </div>
        }
      >
        <TextFeld
          label="Name"
          wert={e.name}
          onChange={(name) => {
            setFehler(undefined);
            setE({ ...e, name });
          }}
          maxLength={60}
          fehler={eintrag || e.name !== '' ? nameFehler : undefined}
        />
        {typ === 'kategorie' && (
          <Feld label="Gehört zu" hinweis="Bei diesen Typen wird das Stichwort zur Auswahl angeboten.">
            <ChipReihe label="Typen">
              {TYPEN.map((t) => (
                <Chip
                  key={t}
                  ton={t === 'R' || t === 'N' ? 'rd' : 'fw'}
                  aktiv={e.typen.includes(t)}
                  onClick={() => setE({ ...e, typen: e.typen.includes(t) ? e.typen.filter((x) => x !== t) : [...e.typen, t] })}
                >
                  {t}
                </Chip>
              ))}
            </ChipReihe>
          </Feld>
        )}
        {(typ === 'fahrzeug' || typ === 'rolle') && (
          <Feld label="Vorschlagen bei">
            <Segment<Bereich | 'beide'> label="Bereich" wert={e.bereich} onChange={(bereich) => setE({ ...e, bereich })} optionen={BEREICH_OPTIONEN} />
          </Feld>
        )}
        {typ === 'massnahme' && (
          <Feld
            label="Art"
            hinweis={artFest ? 'Vorgegeben durch das Kompendium.' : 'Medikamente und invasive Maßnahmen brauchen die Angabe der Durchführung.'}
          >
            {artFest ? (
              <p className="text">{ART_NAME[e.art]}</p>
            ) : (
              <Segment<MassnahmeArt>
                label="Art"
                wert={e.art}
                onChange={(art) => setE({ ...e, art })}
                optionen={[
                  { wert: 'medikament', label: 'Medikament' },
                  { wert: 'invasiv', label: 'Invasiv' },
                  { wert: 'sonstige', label: 'Sonstige' },
                ]}
              />
            )}
          </Feld>
        )}
        {eintrag && (
          <>
            <Toggle
              an={e.aktiv}
              onChange={(aktiv) => setE({ ...e, aktiv })}
              label="In der Auswahl anzeigen"
              hinweis="Ausgeblendete Einträge bleiben in bestehenden Einsätzen erhalten."
            />
            {verwendet > 0 && (
              <Meldung art="info">
                Wird {verwendet}× verwendet und lässt sich deshalb nicht löschen. Du kannst ihn ausblenden.
              </Meldung>
            )}
          </>
        )}
      </Sheet>
      <Bestaetigung
        offen={loeschen}
        titel="Eintrag löschen?"
        gefahr
        jaText="Löschen"
        text={`„${eintrag?.name ?? ''}“ wird aus der Liste entfernt.`}
        onNein={() => setLoeschen(false)}
        onJa={async () => {
          if (!eintrag) return;
          await loescheKatalogEintrag(eintrag.id!);
          setLoeschen(false);
          toast.zeige('Gelöscht');
          onClose();
        }}
      />
    </>
  );
}

export function KatalogListeScreen({ typ }: { typ: KatalogTyp }) {
  const { katalog, dienste, einsaetze } = useDaten();
  const info = KATALOG_INFO[typ];
  const [suche, setSuche] = useState('');
  const [bearbeite, setBearbeite] = useState<KatalogEintrag | 'neu' | null>(null);

  const zaehler = useMemo(() => nutzung(typ, dienste, einsaetze), [typ, dienste, einsaetze]);
  const alle = useMemo(
    () => katalog.filter((k) => k.typ === typ).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [katalog, typ],
  );
  const gefiltert = useMemo(() => {
    const k = nameKey(suche);
    return k ? alle.filter((e) => nameKey(e.name).includes(k)) : alle;
  }, [alle, suche]);
  const aktive = gefiltert.filter((k) => k.aktiv);
  const ausgeblendet = gefiltert.filter((k) => !k.aktiv);

  const gruppen: { titel?: string; liste: KatalogEintrag[] }[] =
    typ === 'massnahme'
      ? (['medikament', 'invasiv', 'sonstige'] as const)
          .map((art) => ({ titel: gruppenTitel(art), liste: aktive.filter((k) => (k.art ?? 'sonstige') === art) }))
          .filter((g) => g.liste.length > 0)
      : [{ liste: aktive }];

  const zeile = (k: KatalogEintrag) => {
    const n = zaehler.get(k.id!) ?? 0;
    const m = meta(k);
    return (
      <li key={k.id}>
        <button type="button" className={`menuezeile${k.aktiv ? '' : ' menuezeile--aus'}`} onClick={() => setBearbeite(k)}>
          <span className="menuezeile__text">
            <span className="menuezeile__titel">{k.name}</span>
            {m && <span className="menuezeile__info">{m}</span>}
          </span>
          {n > 0 && <span className="menuezeile__zahl zahl">{n}×</span>}
          <Icon name="stift" groesse={18} />
        </button>
      </li>
    );
  };

  return (
    <Seite
      titel={info.titel}
      zurueckZu="/mehr/kataloge"
      aktionen={
        <button type="button" className="icon-knopf icon-knopf--hell" onClick={() => setBearbeite('neu')} aria-label={info.neu}>
          <Icon name="plus" />
        </button>
      }
    >
      <p className="hinweis">{info.hinweis}</p>
      {alle.length > 10 && (
        <div className="suchfeld">
          <Icon name="suche" groesse={20} />
          <input className="eingabe" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder={`${info.titel} suchen`} aria-label={`${info.titel} suchen`} />
        </div>
      )}
      {alle.length === 0 ? (
        <Leer titel="Noch keine Einträge" text="Lege den ersten Eintrag an." aktion={<Knopf variante="primaer" onClick={() => setBearbeite('neu')}>{info.neu}</Knopf>} />
      ) : (
        <>
          {gruppen.map((g, i) => (
            <section key={g.titel ?? i} className="gruppe">
              {g.titel && <h2 className="gruppe__titel">{g.titel}</h2>}
              <ul className="menue">{g.liste.map(zeile)}</ul>
            </section>
          ))}
          {gefiltert.length === 0 && <p className="hinweis hinweis--mitte">Nichts gefunden.</p>}
          {ausgeblendet.length > 0 && (
            <section className="gruppe">
              <h2 className="gruppe__titel">Ausgeblendet</h2>
              <ul className="menue">{ausgeblendet.map(zeile)}</ul>
            </section>
          )}
        </>
      )}
      {bearbeite && (
        <KatalogBearbeiten
          key={bearbeite === 'neu' ? 'neu' : bearbeite.id}
          typ={typ}
          eintrag={bearbeite === 'neu' ? undefined : bearbeite}
          verwendet={bearbeite === 'neu' ? 0 : (zaehler.get(bearbeite.id!) ?? 0)}
          onClose={() => setBearbeite(null)}
        />
      )}
    </Seite>
  );
}

function gruppenTitel(art: MassnahmeArt): string {
  return art === 'medikament' ? 'Medikamente' : art === 'invasiv' ? 'Invasive Maßnahmen' : 'Sonstige Maßnahmen';
}
