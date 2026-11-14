import { useState } from 'react';
import { loescheUebung, speichereUebung, verlaengereDienst } from '../db/speichern';
import {
  fmtDatumZeit,
  fmtDauer,
  fmtSaldo,
  fmtZeit,
  MIN,
  minutenZwischen,
  naechsteUhrzeit,
  parseUhrzeit,
  STUNDE,
  uhrzeitImFenster,
} from '../domain/time';
import { vorschlagAtemschutzMin } from '../domain/uebungen';
import { hatPlan, type Dienst, type MassnahmeEintrag, type Uebung } from '../domain/types';
import { dienstSaldo } from '../domain/zeiten';
import { navigate, zurueck } from '../router';
import { katalogName, laufenderDienst, useDaten } from '../state/daten';
import { Abschnitt, Aufklappen, Chip, ChipReihe, Feld, Knopf, Leer, Meldung, Stepper, TextFeld, Toggle, ZeitFeld } from '../ui/controls';
import { DienstWahl } from '../ui/dienstwahl';
import { EinsatzartReihe } from '../ui/einsatzart';
import { KatalogAuswahl } from '../ui/katalogwahl';
import { ohneLeere, useKatalogListe } from '../ui/katalogListen';
import { UebungMassnahmenBlock } from '../ui/massnahmen';
import { Bestaetigung, useToast } from '../ui/overlays';
import { Seite } from '../ui/seite';

interface Props {
  /** Bestehende Übung zum Bearbeiten. */
  id?: number;
  /** Vorgewählter Dienst für eine neue Übung. */
  dienstId?: number;
}

/** Eine Übung ist eine Einsatzart: Sie gehört zu einem Dienst, zählt aber nicht als Einsatz. */
export function UebungForm({ id, dienstId }: Props) {
  const daten = useDaten();
  const { dienste, dienstMap, einst, uebungen } = daten;
  const bestehend = id != null ? uebungen.find((u) => u.id === id) : undefined;

  if (id != null && !bestehend) {
    return (
      <Seite titel="Übung" zurueckZu="/">
        <Leer titel="Übung nicht gefunden" text="Diese Übung existiert nicht mehr." aktion={<Knopf onClick={() => navigate('/')}>Zur Dienstliste</Knopf>} />
      </Seite>
    );
  }

  const vorgabe =
    bestehend?.dienstId ??
    (dienstId != null && dienstMap.has(dienstId) ? dienstId : undefined) ??
    laufenderDienst(daten)?.id ??
    (einst.letzterDienstId != null && dienstMap.has(einst.letzterDienstId) ? einst.letzterDienstId : undefined) ??
    dienste[0]?.id;

  if (vorgabe == null || !dienstMap.has(vorgabe)) {
    return (
      <Seite titel="Übung erfassen" zurueckZu="/">
        <Leer
          titel="Zuerst ein Dienst"
          text="Jede Übung gehört zu einem Dienst, entweder zu deiner Schicht oder zu einem reinen Übungsdienst."
          aktion={
            <div className="knopfstapel">
              <Knopf variante="primaer" voll onClick={() => navigate('/dienst/neu/uebung')}>Übungsdienst anlegen</Knopf>
              <Knopf voll onClick={() => navigate('/dienst/neu')}>Dienst anlegen</Knopf>
            </div>
          }
        />
      </Seite>
    );
  }
  return <Formular key={`${id ?? 'neu'}-${dienstId ?? ''}`} bestehend={bestehend} dienstId={vorgabe} />;
}

/* ---------- Formular ---------- */

interface FormState {
  dienstId: number;
  art: number[];
  thema: string;
  /** Ort aus der Liste „standort“. */
  ort: number[];
  beginn: string;
  ende: string;
  atemschutz: boolean;
  atemschutzMin: number;
  massnahmen: MassnahmeEintrag[];
  notiz: string;
}

/** In einem Übungsdienst ist der Standort des Dienstes meist auch der Ort der Übung. */
const ortVorschlag = (dienst: Dienst): number[] => (dienst.uebungsdienst && dienst.wacheId != null ? [dienst.wacheId] : []);

/** Im Übungsdienst ist meist der Rest des Dienstes gemeint, ab der letzten Übung. */
function vorschlagZeiten(dienst: Dienst, vorhanden: readonly Uebung[]): { beginn: string; ende: string } {
  if (!dienst.uebungsdienst) return { beginn: '', ende: '' };
  const ab = vorhanden.reduce((m, u) => Math.max(m, u.ende), dienst.beginn);
  return ab >= dienst.ende ? { beginn: '', ende: '' } : { beginn: fmtZeit(ab), ende: fmtZeit(dienst.ende) };
}

const DAUER_CHIPS = [30, 60, 90, 120, 180, 240];

function Formular({ bestehend, dienstId }: { bestehend?: Uebung; dienstId: number }) {
  const daten = useDaten();
  const toast = useToast();
  const neu = !bestehend;

  const [f, setF] = useState<FormState>(() =>
    bestehend
      ? {
          dienstId: bestehend.dienstId,
          art: [bestehend.artId],
          thema: bestehend.thema ?? '',
          ort: bestehend.ortId != null ? [bestehend.ortId] : [],
          beginn: fmtZeit(bestehend.beginn),
          ende: fmtZeit(bestehend.ende),
          atemschutz: !!bestehend.atemschutz,
          atemschutzMin: bestehend.atemschutzMin ?? 20,
          massnahmen: bestehend.massnahmen ?? [],
          notiz: bestehend.notiz ?? '',
        }
      : {
          dienstId,
          art: [],
          thema: '',
          ort: ortVorschlag(daten.dienstMap.get(dienstId)!),
          ...vorschlagZeiten(daten.dienstMap.get(dienstId)!, daten.uebungenNachDienst.get(dienstId) ?? []),
          atemschutz: false,
          atemschutzMin: 20,
          massnahmen: [],
          notiz: '',
        },
  );
  const set = (patch: Partial<FormState>) => setF((alt) => ({ ...alt, ...patch }));
  const [versucht, setVersucht] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [massnahmenOffen, setMassnahmenOffen] = useState(f.massnahmen.length > 0);

  const dienst = daten.dienstMap.get(f.dienstId)!;
  const arten = useKatalogListe('uebungsart');
  const orte = useKatalogListe('standort');
  /** Die Art der Übung bestimmt, aus welcher Maßnahmenliste zuerst gewählt wird. */
  const artBereich = daten.katalogMap.get(f.art[0])?.bereich;

  /* ---- Zeiten: Uhrzeiten werden im Fenster des Dienstes aufgelöst, wie beim Einsatz ---- */
  const bP = parseUhrzeit(f.beginn);
  const beginnMs = bP
    ? (uhrzeitImFenster(bP.h, bP.m, dienst.beginn, dienst.ende) ?? uhrzeitImFenster(bP.h, bP.m, dienst.ende, dienst.ende + 6 * STUNDE))
    : null;
  const eP = parseUhrzeit(f.ende);
  const endeMs = beginnMs != null && eP ? naechsteUhrzeit(eP.h, eP.m, beginnMs, false) : null;
  const dauerMin = beginnMs != null && endeMs != null ? minutenZwischen(beginnMs, endeMs) : null;

  const fehler = {
    art: f.art.length === 0 ? 'Wähle die Art der Übung oder lege sie neu an.' : undefined,
    beginn: !f.beginn
      ? 'Beginn der Übung angeben.'
      : !bP
        ? 'Uhrzeit wie 08:00 eingeben.'
        : beginnMs == null
          ? `Liegt nicht im Dienst (${fmtZeit(dienst.beginn)}–${fmtZeit(dienst.ende)}). Dienst ändern oder die Zeit prüfen.`
          : undefined,
    ende: !f.ende
      ? 'Ende der Übung angeben.'
      : !eP
        ? 'Uhrzeit wie 12:00 eingeben.'
        : beginnMs != null && endeMs != null && endeMs <= beginnMs
          ? 'Das Ende muss nach dem Beginn liegen.'
          : undefined,
    atemschutz:
      f.atemschutz && dauerMin != null && f.atemschutzMin > dauerMin
        ? `Die Zeit unter Atemschutz kann nicht länger sein als die Übung (${fmtDauer(dauerMin)}).`
        : undefined,
  };
  const hatFehler = Object.values(fehler).some(Boolean);
  const zeigeZeit = (feld: 'beginn' | 'ende') => (versucht || f[feld] !== '' ? fehler[feld] : undefined);

  const ueberschneidung =
    beginnMs != null && endeMs != null
      ? (daten.uebungenNachDienst.get(f.dienstId) ?? []).find((u) => u.id !== bestehend?.id && u.beginn < endeMs && beginnMs < u.ende)
      : undefined;
  const neuesDienstende = endeMs != null && endeMs > dienst.ende ? endeMs : null;

  /* ---- Aktionen ---- */
  const wechsleDienst = (d: Dienst) => {
    const keineZeiten = f.beginn === '' && f.ende === '';
    // Der vorgeschlagene Ort wechselt mit, solange du keinen anderen gewählt hast.
    const alterVorschlag = ortVorschlag(dienst);
    const ortUnveraendert = f.ort.length === 0 || (alterVorschlag.length > 0 && f.ort[0] === alterVorschlag[0]);
    set({
      dienstId: d.id!,
      ...(neu && keineZeiten ? vorschlagZeiten(d, daten.uebungenNachDienst.get(d.id!) ?? []) : {}),
      ...(neu && ortUnveraendert ? { ort: ortVorschlag(d) } : {}),
    });
  };

  const schalteAtemschutz = (an: boolean) =>
    set({ atemschutz: an, ...(an ? { atemschutzMin: vorschlagAtemschutzMin(dauerMin) } : {}) });

  const speichern = async () => {
    setVersucht(true);
    if (hatFehler || beginnMs == null || endeMs == null) {
      window.setTimeout(() => document.querySelector('.feld--fehler')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      return;
    }
    setSpeichert(true);
    const uebung: Uebung = ohneLeere({
      ...(bestehend ?? {}),
      dienstId: f.dienstId,
      beginn: beginnMs,
      ende: endeMs,
      artId: f.art[0],
      thema: f.thema.trim() || undefined,
      ortId: f.ort[0],
      atemschutz: f.atemschutz ? true : undefined,
      atemschutzMin: f.atemschutz ? f.atemschutzMin : undefined,
      massnahmen: f.massnahmen.length > 0 ? f.massnahmen : undefined,
      notiz: f.notiz.trim() || undefined,
    });
    try {
      await speichereUebung(uebung);
      if (neuesDienstende != null) await verlaengereDienst(f.dienstId, neuesDienstende);
      if (neu) {
        toast.zeige('Übung gespeichert', {
          aktion: { label: 'Weitere Übung', onClick: () => navigate(`/uebung/neu?dienst=${f.dienstId}`) },
        });
        navigate(`/dienst/${f.dienstId}`, true);
      } else {
        toast.zeige('Übung gespeichert');
        zurueck(`/dienst/${f.dienstId}`);
      }
    } catch {
      toast.zeige('Das Speichern hat nicht geklappt. Bitte noch einmal versuchen.');
      setSpeichert(false);
    }
  };

  const fuss = (
    <div className="knopfreihe knopfreihe--fuss">
      {bestehend && (
        <Knopf variante="gefahr" onClick={() => setLoeschen(true)}>
          Löschen
        </Knopf>
      )}
      <Knopf variante="primaer" onClick={() => void speichern()} disabled={speichert}>
        {bestehend ? 'Speichern' : 'Übung speichern'}
      </Knopf>
    </div>
  );

  return (
    <Seite titel={neu ? 'Übung erfassen' : 'Übung bearbeiten'} zurueckZu={`/dienst/${f.dienstId}`} fuss={fuss}>
      <DienstWahl dienst={dienst} onWahl={wechsleDienst} zaehle="uebungen" />

      <Abschnitt titel="Übung">
        {neu && (
          <Feld label="Einsatzart">
            <EinsatzartReihe aktiv="uebung" onTyp={(t) => navigate(`/einsatz/neu?dienst=${f.dienstId}&typ=${t}`, true)} onUebung={() => undefined} />
          </Feld>
        )}
        <KatalogAuswahl
          label="Art der Übung"
          katalogTyp="uebungsart"
          vorschlaege={arten.vorschlaege}
          alle={arten.alle}
          ausgewaehlt={f.art}
          onChange={(ids) => set({ art: ids })}
          ton="ue"
          fehler={versucht ? fehler.art : undefined}
          nutzung={arten.zaehler}
          namenAusgewaehlt={arten.namen}
          hinweis="Zum Beispiel Atemschutzübung oder Reanimation. Die Liste wächst mit."
        />
        <TextFeld label="Thema" wert={f.thema} onChange={(thema) => set({ thema })} maxLength={80} placeholder="z. B. Übungsstrecke" hinweis="Optional. Keine Namen." />
        <KatalogAuswahl
          label="Ort"
          katalogTyp="standort"
          vorschlaege={orte.vorschlaege}
          alle={orte.alle}
          ausgewaehlt={f.ort}
          onChange={(ids) => set({ ort: ids })}
          ton="ue"
          nutzung={orte.zaehler}
          namenAusgewaehlt={orte.namen}
          hinweis="Optional. Zum Beispiel Feuerwehrschule oder Übungsgelände. Die Liste wächst mit."
        />
      </Abschnitt>

      <Abschnitt titel="Zeiten">
        <ZeitFeld
          label="Beginn"
          wert={f.beginn}
          onChange={(beginn) => set({ beginn })}
          fehler={zeigeZeit('beginn')}
          hinweis={beginnMs != null ? fmtDatumZeit(beginnMs) : undefined}
          rechts={
            <ChipReihe label="Beginn wählen">
              <Chip klein gestrichelt onClick={() => set({ beginn: fmtZeit(Date.now()) })}>Jetzt</Chip>
            </ChipReihe>
          }
        />
        <ZeitFeld
          label="Ende"
          wert={f.ende}
          onChange={(ende) => set({ ende })}
          fehler={zeigeZeit('ende')}
          hinweis={dauerMin != null && dauerMin > 0 ? `Dauer ${fmtDauer(dauerMin)}` : undefined}
          rechts={
            <ChipReihe label="Ende jetzt">
              <Chip klein gestrichelt onClick={() => set({ ende: fmtZeit(Date.now()) })}>Jetzt</Chip>
            </ChipReihe>
          }
        />
        {beginnMs != null && (
          <ChipReihe label="Dauer wählen">
            {DAUER_CHIPS.map((m) => (
              <Chip key={m} klein aktiv={endeMs === beginnMs + m * MIN} onClick={() => set({ ende: fmtZeit(beginnMs + m * MIN) })}>
                {fmtDauer(m)}
              </Chip>
            ))}
          </ChipReihe>
        )}
        {dienst.uebungsdienst && (
          <ChipReihe label="Ganzer Dienst">
            <Chip gestrichelt onClick={() => set({ beginn: fmtZeit(dienst.beginn), ende: fmtZeit(dienst.ende) })}>
              Ganzer Dienst {fmtZeit(dienst.beginn)}–{fmtZeit(dienst.ende)}
            </Chip>
          </ChipReihe>
        )}

        {dauerMin != null && dauerMin > 12 * 60 && <Meldung art="warnung">Die Übung dauert über 12 Stunden. Stimmen Beginn und Ende?</Meldung>}
        {ueberschneidung && (
          <Meldung art="warnung">
            Überschneidet sich mit der Übung {katalogName(daten, ueberschneidung.artId)} ({fmtZeit(ueberschneidung.beginn)}–{fmtZeit(ueberschneidung.ende)}).
          </Meldung>
        )}
        {neuesDienstende != null && (
          <Meldung art="info">
            Die Übung reicht über das Dienstende ({fmtZeit(dienst.ende)}) hinaus. Beim Speichern wird das Dienstende auf{' '}
            <strong className="zahl">{fmtZeit(neuesDienstende)}</strong> gesetzt
            {hatPlan(dienst) && (
              <>
                {' '}
                – <span className="zahl">{fmtSaldo(dienstSaldo({ ...dienst, ende: neuesDienstende }).saldoMin)}</span> gegenüber dem Plan
              </>
            )}
            .
          </Meldung>
        )}
      </Abschnitt>

      <Abschnitt titel="Atemschutz">
        <Toggle
          an={f.atemschutz}
          onChange={schalteAtemschutz}
          label="Als Atemschutzeinsatz werten"
          hinweis="Die Übung zählt dann in der Statistik zu deinen Atemschutzeinsätzen."
        />
        {f.atemschutz && (
          <Feld label="Dauer unter Atemschutz" fehler={fehler.atemschutz}>
            <Stepper
              label="Minuten unter Atemschutz"
              wert={f.atemschutzMin}
              min={5}
              max={240}
              schritt={5}
              onChange={(atemschutzMin) => set({ atemschutzMin })}
              einheit="min"
            />
          </Feld>
        )}
      </Abschnitt>

      <Aufklappen
        titel="Maßnahmen in der Übung"
        zusatz={f.massnahmen.length > 0 ? `${f.massnahmen.length} Maßnahme${f.massnahmen.length === 1 ? '' : 'n'}` : undefined}
        offen={massnahmenOffen}
        onToggle={() => setMassnahmenOffen((o) => !o)}
      >
        <p className="hinweis">Nur, was du selbst durchgeführt hast. Diese Maßnahmen zählen nicht im Maßnahmen-Nachweis der Einsätze, sondern getrennt bei den Übungen.</p>
        <UebungMassnahmenBlock werte={f.massnahmen} onChange={(massnahmen) => set({ massnahmen })} bereich={artBereich} />
      </Aufklappen>

      <TextFeld label="Notiz" wert={f.notiz} onChange={(notiz) => set({ notiz })} mehrzeilig maxLength={500} hinweis="Keine Namen." />

      {versucht && hatFehler && <Meldung art="fehler">Bitte prüfe die markierten Felder.</Meldung>}

      <Bestaetigung
        offen={loeschen}
        titel="Übung löschen?"
        gefahr
        jaText="Endgültig löschen"
        text={`Die Übung ${katalogName(daten, f.art[0])} wird gelöscht. Das lässt sich nicht rückgängig machen.`}
        onNein={() => setLoeschen(false)}
        onJa={async () => {
          if (!bestehend) return;
          await loescheUebung(bestehend.id!);
          setLoeschen(false);
          toast.zeige('Übung gelöscht');
          navigate(`/dienst/${f.dienstId}`, true);
        }}
      />
    </Seite>
  );
}
