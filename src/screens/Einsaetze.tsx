import { useMemo, useState } from 'react';
import { bewertungVon } from '../domain/triage';
import { AUSGANG_INFO, bereichVon } from '../domain/types';
import { einsatzTitel, katalogName, useDaten } from '../state/daten';
import { Chip, ChipReihe, Leer } from '../ui/controls';
import { datumLang } from '../ui/dienstzeile';
import { EinsatzZeile } from '../ui/einsatzzeile';
import { Icon } from '../ui/icons';
import { Knopf } from '../ui/controls';
import { Seite } from '../ui/seite';
import { UebungZeile } from '../ui/uebungzeile';
import { navigate } from '../router';

const SEITE = 40;

type Filter = 'alle' | 'RD' | 'FW' | 'UE';

/** Gruppiert eine nach Zeit sortierte Liste nach Kalendertag. */
function gruppiere<T>(liste: readonly T[], zeit: (x: T) => number): { tag: string; titel: string; eintraege: T[] }[] {
  const aus: { tag: string; titel: string; eintraege: T[] }[] = [];
  liste.forEach((x) => {
    const d = new Date(zeit(x));
    const tag = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const letzte = aus[aus.length - 1];
    if (letzte?.tag === tag) letzte.eintraege.push(x);
    else aus.push({ tag, titel: `${datumLang(zeit(x))}${d.getFullYear()}`, eintraege: [x] });
  });
  return aus;
}

export function Einsaetze() {
  const daten = useDaten();
  const { einsaetze, uebungen } = daten;
  const [suche, setSuche] = useState('');
  const [bereich, setBereich] = useState<Filter>('alle');
  const [jahr, setJahr] = useState<number | null>(null);
  const [offen, setOffen] = useState(false);
  const [anzahl, setAnzahl] = useState(SEITE);
  const nurUebungen = bereich === 'UE';

  const jahre = useMemo(
    () => [...new Set([...einsaetze.map((e) => new Date(e.alarm).getFullYear()), ...uebungen.map((u) => new Date(u.beginn).getFullYear())])].sort((a, b) => b - a),
    [einsaetze, uebungen],
  );

  const heuhaufen = useMemo(() => {
    const m = new Map<number, string>();
    einsaetze.forEach((e) => {
      const teile = [
        einsatzTitel(daten, e),
        e.notiz,
        e.ortGrob,
        katalogName(daten, e.fahrzeugId),
        katalogName(daten, e.rolleId),
        ...(e.tagIds ?? []).map((t) => katalogName(daten, t)),
        ...(e.massnahmen ?? []).map((x) => katalogName(daten, x.massnahmeId)),
        e.ausgang ? AUSGANG_INFO[e.ausgang].kurz : undefined,
        katalogName(daten, e.diagnoseId),
        katalogName(daten, e.leitstelleDiagnoseId),
        // „zu hoch“ und „zu niedrig“ finden die Einsätze mit abweichender Alarmierung.
        { hoch: 'alarm zu hoch', niedrig: 'alarm zu niedrig', passend: undefined }[bewertungVon(e) ?? 'passend'],
      ];
      m.set(e.id!, teile.filter(Boolean).join(' ').toLocaleLowerCase('de-DE'));
    });
    return m;
  }, [einsaetze, daten]);

  const heuhaufenUebungen = useMemo(() => {
    const m = new Map<number, string>();
    uebungen.forEach((u) => {
      m.set(u.id!, [katalogName(daten, u.artId), u.thema, u.notiz, 'übung'].filter(Boolean).join(' ').toLocaleLowerCase('de-DE'));
    });
    return m;
  }, [uebungen, daten]);

  const treffer = useMemo(() => {
    const q = suche.trim().toLocaleLowerCase('de-DE');
    return einsaetze.filter(
      (e) =>
        (bereich === 'alle' || bereichVon(e.typ) === bereich) &&
        (jahr == null || new Date(e.alarm).getFullYear() === jahr) &&
        (!offen || (e.status2 == null && !e.folgeAusStatus1)) &&
        (!q || (heuhaufen.get(e.id!) ?? '').includes(q)),
    );
  }, [einsaetze, suche, bereich, jahr, offen, heuhaufen]);

  const trefferUebungen = useMemo(() => {
    const q = suche.trim().toLocaleLowerCase('de-DE');
    return uebungen.filter(
      (u) => (jahr == null || new Date(u.beginn).getFullYear() === jahr) && (!q || (heuhaufenUebungen.get(u.id!) ?? '').includes(q)),
    );
  }, [uebungen, suche, jahr, heuhaufenUebungen]);

  const gruppen = useMemo(() => gruppiere(treffer.slice(0, anzahl), (e) => e.alarm), [treffer, anzahl]);
  const gruppenUebungen = useMemo(() => gruppiere(trefferUebungen.slice(0, anzahl), (u) => u.beginn), [trefferUebungen, anzahl]);

  const zuruecksetzen = () => {
    setSuche('');
    setBereich('alle');
    setJahr(null);
    setOffen(false);
  };

  if (einsaetze.length === 0 && uebungen.length === 0) {
    return (
      <Seite titel="Einsätze">
        <Leer
          titel="Noch keine Einsätze"
          text="Sobald du Einsätze oder Übungen erfasst hast, findest du sie hier und kannst sie durchsuchen."
          aktion={
            <Knopf variante="primaer" onClick={() => navigate('/einsatz/neu')}>
              Einsatz erfassen
            </Knopf>
          }
        />
      </Seite>
    );
  }

  const anzahlTreffer = nurUebungen ? trefferUebungen.length : treffer.length;

  return (
    <Seite titel="Einsätze">
      <div className="suchfeld">
        <Icon name="suche" groesse={20} />
        <input
          className="eingabe"
          value={suche}
          onChange={(e) => {
            setSuche(e.target.value);
            setAnzahl(SEITE);
          }}
          placeholder={nurUebungen ? 'Art, Thema, Notiz …' : 'Stichwort, Diagnose, Maßnahme …'}
          aria-label={nurUebungen ? 'Übungen durchsuchen' : 'Einsätze durchsuchen'}
          type="search"
        />
      </div>
      <ChipReihe label="Einsatzart">
        <Chip klein aktiv={bereich === 'alle'} onClick={() => setBereich('alle')}>Alle</Chip>
        <Chip klein ton="rd" aktiv={bereich === 'RD'} onClick={() => setBereich(bereich === 'RD' ? 'alle' : 'RD')}>Rettungsdienst</Chip>
        <Chip klein ton="fw" aktiv={bereich === 'FW'} onClick={() => setBereich(bereich === 'FW' ? 'alle' : 'FW')}>Feuerwehr</Chip>
        <Chip klein ton="ue" aktiv={nurUebungen} onClick={() => setBereich(nurUebungen ? 'alle' : 'UE')}>Übung</Chip>
        {!nurUebungen && <Chip klein aktiv={offen} onClick={() => setOffen((o) => !o)}>Status 2 fehlt</Chip>}
      </ChipReihe>
      {jahre.length > 1 && (
        <ChipReihe label="Jahr">
          <Chip klein aktiv={jahr == null} onClick={() => setJahr(null)}>Alle Jahre</Chip>
          {jahre.slice(0, 5).map((j) => (
            <Chip key={j} klein aktiv={jahr === j} onClick={() => setJahr(jahr === j ? null : j)}>
              {j}
            </Chip>
          ))}
        </ChipReihe>
      )}

      <p className="hinweis zahl" aria-live="polite">
        {nurUebungen
          ? `${anzahlTreffer} ${anzahlTreffer === 1 ? 'Übung' : 'Übungen'}`
          : `${anzahlTreffer} ${anzahlTreffer === 1 ? 'Einsatz' : 'Einsätze'}`}
      </p>

      {anzahlTreffer === 0 ? (
        <Leer
          titel="Nichts gefunden"
          text={nurUebungen ? 'Zu dieser Suche gibt es keine Übungen.' : 'Zu dieser Suche gibt es keine Einsätze.'}
          aktion={<Knopf onClick={zuruecksetzen}>Filter zurücksetzen</Knopf>}
        />
      ) : nurUebungen ? (
        gruppenUebungen.map((g) => (
          <section key={g.tag} className="monat">
            <h2 className="monat__titel">{g.titel}</h2>
            <div className="liste">
              {g.eintraege.map((u) => (
                <UebungZeile key={u.id} uebung={u} />
              ))}
            </div>
          </section>
        ))
      ) : (
        gruppen.map((g) => (
          <section key={g.tag} className="monat">
            <h2 className="monat__titel">{g.titel}</h2>
            <div className="liste">
              {g.eintraege.map((e) => (
                <EinsatzZeile key={e.id} einsatz={e} />
              ))}
            </div>
          </section>
        ))
      )}
      {anzahlTreffer > anzahl && (
        <Knopf voll onClick={() => setAnzahl((a) => a + SEITE)}>
          Mehr anzeigen
        </Knopf>
      )}
    </Seite>
  );
}
