import {
  AUSGAENGE_RD,
  AUSGANG_INFO,
  BEWERTUNG_INFO,
  BEWERTUNGEN,
  type AlarmBewertung,
  type Altersgruppe,
  type Ausgang,
} from '../domain/types';
import { NACA_INFO, type BewertungsVorschlag } from '../domain/triage';
import { Chip, ChipReihe, Feld, Knopf, Meldung } from '../ui/controls';
import { KatalogAuswahl } from '../ui/katalogwahl';
import type { KatalogListe } from '../ui/katalogListen';

/* Bausteine für „Ergebnis und Befund“ und „Alarmierung bewerten“ im Einsatzformular. */

const ALTER: { wert: Altersgruppe; label: string }[] = [
  { wert: 'saeugling', label: 'Säugling' },
  { wert: 'kind', label: 'Kind' },
  { wert: 'erwachsener', label: 'Erwachsene' },
  { wert: 'senior', label: 'Senior' },
];

export function JaNein({ label, wert, onChange }: { label: string; wert: boolean | null; onChange: (w: boolean | null) => void }) {
  return (
    <Feld label={label}>
      <ChipReihe label={label}>
        <Chip aktiv={wert === true} onClick={() => onChange(wert === true ? null : true)}>
          Ja
        </Chip>
        <Chip aktiv={wert === false} onClick={() => onChange(wert === false ? null : false)}>
          Nein
        </Chip>
      </ChipReihe>
    </Feld>
  );
}

export function AusgangWahl({ wert, onChange }: { wert: Ausgang | null; onChange: (a: Ausgang | null) => void }) {
  return (
    <Feld label="Ergebnis" hinweis={wert ? AUSGANG_INFO[wert].lang : 'Was am Ende tatsächlich geschah.'}>
      <ChipReihe label="Ergebnis des Einsatzes">
        {AUSGAENGE_RD.map((a) => (
          <Chip key={a} klein aktiv={wert === a} onClick={() => onChange(wert === a ? null : a)} titel={AUSGANG_INFO[a].lang}>
            {AUSGANG_INFO[a].kurz}
          </Chip>
        ))}
      </ChipReihe>
    </Feld>
  );
}

export function NacaWahl({ wert, onChange }: { wert: number | null; onChange: (n: number | null) => void }) {
  const info = wert != null ? NACA_INFO[wert - 1] : undefined;
  return (
    <Feld label="NACA" hinweis={info ? `${info.roemisch}: ${info.kurz}` : 'Von I (geringfügig) bis VII (Tod).'}>
      <ChipReihe label="NACA-Score">
        {NACA_INFO.map((n) => (
          <Chip key={n.wert} klein aktiv={wert === n.wert} onClick={() => onChange(wert === n.wert ? null : n.wert)} titel={`${n.roemisch}: ${n.kurz}`}>
            {n.roemisch}
          </Chip>
        ))}
      </ChipReihe>
    </Feld>
  );
}

export function AlterWahl({ wert, onChange }: { wert: Altersgruppe | null; onChange: (a: Altersgruppe | null) => void }) {
  return (
    <Feld label="Altersgruppe">
      <ChipReihe label="Altersgruppe">
        {ALTER.map((a) => (
          <Chip key={a.wert} klein aktiv={wert === a.wert} onClick={() => onChange(wert === a.wert ? null : a.wert)}>
            {a.label}
          </Chip>
        ))}
      </ChipReihe>
    </Feld>
  );
}

interface AlarmierungProps {
  bewertung: AlarmBewertung | null;
  onBewertung: (b: AlarmBewertung | null) => void;
  vorschlag: BewertungsVorschlag | null;
  leitstelle: number[];
  onLeitstelle: (ids: number[]) => void;
  diagnosen: KatalogListe;
  /** Verdachtsdiagnose vor Ort, für den Vergleich. */
  diagnoseVorOrt: number | undefined;
}

/** Eigene Einschätzung der Alarmierung plus der Verdacht, den die Leitstelle genannt hat. */
export function AlarmierungBewerten({ bewertung, onBewertung, vorschlag, leitstelle, onLeitstelle, diagnosen, diagnoseVorOrt }: AlarmierungProps) {
  const leitstelleId = leitstelle[0];
  const abweichend = leitstelleId != null && diagnoseVorOrt != null && leitstelleId !== diagnoseVorOrt;
  const name = (id: number) => diagnosen.namen.get(id) ?? '?';
  return (
    <>
      <Feld label="Passte die Alarmierung zum Befund?">
        <ChipReihe label="Bewertung der Alarmierung">
          {BEWERTUNGEN.map((b) => (
            <Chip key={b} klein aktiv={bewertung === b} onClick={() => onBewertung(bewertung === b ? null : b)} titel={BEWERTUNG_INFO[b].lang}>
              {BEWERTUNG_INFO[b].kurz}
            </Chip>
          ))}
        </ChipReihe>
      </Feld>
      {vorschlag && vorschlag.bewertung !== bewertung && (
        <Meldung
          art="info"
          aktion={
            <Knopf variante="text" onClick={() => onBewertung(vorschlag.bewertung)}>
              Übernehmen
            </Knopf>
          }
        >
          Vorschlag: <strong>{BEWERTUNG_INFO[vorschlag.bewertung].kurz}</strong>. {vorschlag.grund}
        </Meldung>
      )}
      <KatalogAuswahl
        label="Laut Leitstelle"
        katalogTyp="diagnose"
        vorschlaege={diagnosen.vorschlaege}
        alle={diagnosen.alle}
        ausgewaehlt={leitstelle}
        onChange={onLeitstelle}
        klein
        maxChips={6}
        nutzung={diagnosen.zaehler}
        namenAusgewaehlt={diagnosen.namen}
        hinweis="Der Verdacht bei der Alarmierung, z. B. „V. a. AKS“."
      />
      {abweichend && (
        <Meldung art="info">
          Abweichung: Die Leitstelle vermutete <strong>{name(leitstelleId)}</strong>, vor Ort fand sich <strong>{name(diagnoseVorOrt)}</strong>.
        </Meldung>
      )}
    </>
  );
}
