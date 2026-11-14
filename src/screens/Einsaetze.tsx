import { useMemo, useState } from 'react';
import { bewertungVon } from '../domain/triage';
import { AUSGANG_INFO, bereichVon, type Einsatz } from '../domain/types';
import { einsatzTitel, katalogName, useDaten } from '../state/daten';
import { Chip, ChipReihe, Leer } from '../ui/controls';
import { datumLang } from '../ui/dienstzeile';
import { EinsatzZeile } from '../ui/einsatzzeile';
import { Icon } from '../ui/icons';
import { Knopf } from '../ui/controls';
import { Seite } from '../ui/seite';
import { navigate } from '../router';

const SEITE = 40;

export function Einsaetze() {
  const daten = useDaten();
  const { einsaetze } = daten;
  const [suche, setSuche] = useState('');
  const [bereich, setBereich] = useState<'alle' | 'RD' | 'FW'>('alle');
  const [jahr, setJahr] = useState<number | null>(null);
  const [offen, setOffen] = useState(false);
  const [anzahl, setAnzahl] = useState(SEITE);

  const jahre = useMemo(() => [...new Set(einsaetze.map((e) => new Date(e.alarm).getFullYear()))].sort((a, b) => b - a), [einsaetze]);

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

  const treffer = useMemo(() => {
    const q = suche.trim().toLocaleLowerCase('de-DE');
    return einsaetze.filter(
      (e) =>
        (bereich === 'alle' || bereichVon(e.typ) === bereich) &&
        (jahr == null || new Date(e.alarm).getFullYear() === jahr) &&
        (!offen || e.status2 == null) &&
        (!q || (heuhaufen.get(e.id!) ?? '').includes(q)),
    );
  }, [einsaetze, suche, bereich, jahr, offen, heuhaufen]);

  const gruppen = useMemo(() => {
    const liste: { tag: string; titel: string; einsaetze: Einsatz[] }[] = [];
    treffer.slice(0, anzahl).forEach((e) => {
      const x = new Date(e.alarm);
      const tag = `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
      const letzte = liste[liste.length - 1];
      if (letzte?.tag === tag) letzte.einsaetze.push(e);
      else liste.push({ tag, titel: `${datumLang(e.alarm)}${x.getFullYear()}`, einsaetze: [e] });
    });
    return liste;
  }, [treffer, anzahl]);

  const zuruecksetzen = () => {
    setSuche('');
    setBereich('alle');
    setJahr(null);
    setOffen(false);
  };

  if (einsaetze.length === 0) {
    return (
      <Seite titel="Einsätze">
        <Leer
          titel="Noch keine Einsätze"
          text="Sobald du Einsätze erfasst hast, findest du sie hier und kannst sie durchsuchen."
          aktion={
            <Knopf variante="primaer" onClick={() => navigate('/einsatz/neu')}>
              Einsatz erfassen
            </Knopf>
          }
        />
      </Seite>
    );
  }

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
          placeholder="Stichwort, Diagnose, Maßnahme …"
          aria-label="Einsätze durchsuchen"
          type="search"
        />
      </div>
      <ChipReihe label="Filter">
        <Chip klein aktiv={bereich === 'alle'} onClick={() => setBereich('alle')}>Alle</Chip>
        <Chip klein ton="rd" aktiv={bereich === 'RD'} onClick={() => setBereich(bereich === 'RD' ? 'alle' : 'RD')}>Rettungsdienst</Chip>
        <Chip klein ton="fw" aktiv={bereich === 'FW'} onClick={() => setBereich(bereich === 'FW' ? 'alle' : 'FW')}>Feuerwehr</Chip>
        <Chip klein aktiv={offen} onClick={() => setOffen((o) => !o)}>Status 2 fehlt</Chip>
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
        {treffer.length} {treffer.length === 1 ? 'Einsatz' : 'Einsätze'}
      </p>

      {treffer.length === 0 ? (
        <Leer
          titel="Nichts gefunden"
          text="Zu dieser Suche gibt es keine Einsätze."
          aktion={<Knopf onClick={zuruecksetzen}>Filter zurücksetzen</Knopf>}
        />
      ) : (
        gruppen.map((g) => (
          <section key={g.tag} className="monat">
            <h2 className="monat__titel">{g.titel}</h2>
            <div className="liste">
              {g.einsaetze.map((e) => (
                <EinsatzZeile key={e.id} einsatz={e} />
              ))}
            </div>
          </section>
        ))
      )}
      {treffer.length > anzahl && (
        <Knopf voll onClick={() => setAnzahl((a) => a + SEITE)}>
          Mehr anzeigen
        </Knopf>
      )}
    </Seite>
  );
}
