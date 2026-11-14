import { useMemo, useState } from 'react';
import { loescheDienst, speichereDienst } from '../db/speichern';
import { berechneDienstEingabe, dienstArt, sollDauerStunden, sollText, type DienstArt } from '../domain/dienst';
import {
  datumInput,
  endeNachDauer,
  fmtDatumKurz,
  fmtDatumZeit,
  fmtSaldo,
  fmtZeit,
  naechsteUhrzeit,
  parseUhrzeit,
  regelUhrzeit,
  zeitpunkt,
  datumVorTagen,
} from '../domain/time';
import type { Dienst } from '../domain/types';
import { dienstSaldo } from '../domain/zeiten';
import { navigate, zurueck } from '../router';
import { dienstTitel, useDaten } from '../state/daten';
import { Abschnitt, Aufklappen, Chip, ChipReihe, Feld, Knopf, Leer, Meldung, Segment, Stepper, TextFeld, ZeitFeld } from '../ui/controls';
import { KatalogAuswahl } from '../ui/katalogwahl';
import { ohneLeere, useKatalogListe } from '../ui/katalogListen';
import { Bestaetigung, useToast } from '../ui/overlays';
import { Seite } from '../ui/seite';

interface Props {
  /** Ohne Angabe wird ein neuer Dienst angelegt. */
  id?: number;
  /** Klappt die Über- und Minusstunden direkt auf. */
  zeitenOffen?: boolean;
  /** Neuer Zusatzdienst (bei bestehendem Dienst gilt dessen Art). */
  zusatz?: boolean;
}

/** Vor 12 Uhr ist meist der Dienst von gestern gemeint, der gerade zu Ende ging. */
function vorschlagDatum(jetzt: Date): string {
  return datumVorTagen(jetzt.getTime(), jetzt.getHours() < 12 ? 1 : 0);
}

export function DienstForm({ id, zusatz: zusatzNeu, zeitenOffen }: Props) {
  const daten = useDaten();
  const { dienstMap, einst } = daten;
  const bestehend = id != null ? dienstMap.get(id) : undefined;
  if (id != null && !bestehend) {
    return (
      <Seite titel="Dienst" zurueckZu="/">
        <Leer titel="Dienst nicht gefunden" text="Dieser Dienst existiert nicht mehr." aktion={<Knopf onClick={() => navigate('/')}>Zur Dienstliste</Knopf>} />
      </Seite>
    );
  }
  return (
    <Formular
      key={id ?? (zusatzNeu ? 'zusatz' : 'neu')}
      bestehend={bestehend}
      zusatz={bestehend ? !!bestehend.zusatzdienst : !!zusatzNeu}
      regelBeginn={einst.regelBeginn}
      zeitenOffen={!!zeitenOffen}
    />
  );
}

interface FormProps {
  bestehend?: Dienst;
  zusatz: boolean;
  regelBeginn: string;
  zeitenOffen: boolean;
}

function Formular({ bestehend, zusatz, regelBeginn, zeitenOffen }: FormProps) {
  const daten = useDaten();
  const toast = useToast();
  const { einst } = daten;
  const neu = !bestehend;

  const wachen = useKatalogListe(zusatz ? 'standort' : 'wache');
  const fahrzeuge = useKatalogListe('fahrzeug');
  const rollen = useKatalogListe('rolle');

  /* ---- Anfangswerte ---- */
  const start = useMemo(() => {
    const jetzt = new Date();
    if (bestehend) {
      const art: DienstArt = zusatz ? 'andere' : dienstArt(bestehend, regelBeginn);
      return {
        datum: datumInput(zusatz ? bestehend.beginn : bestehend.sollBeginn),
        art,
        beginnUhr: fmtZeit(zusatz ? bestehend.beginn : bestehend.sollBeginn),
        dauer: sollDauerStunden(bestehend) ?? 12,
        endeUhr: zusatz ? fmtZeit(bestehend.ende) : '',
        istBeginn: !zusatz && bestehend.beginn !== bestehend.sollBeginn ? fmtZeit(bestehend.beginn) : '',
        istEnde: !zusatz && bestehend.ende !== bestehend.sollEnde ? fmtZeit(bestehend.ende) : '',
        wache: bestehend.wacheId != null ? [bestehend.wacheId] : [],
        fahrzeug: bestehend.fahrzeugId != null ? [bestehend.fahrzeugId] : [],
        rolle: bestehend.rolleId != null ? [bestehend.rolleId] : [],
        notiz: bestehend.notiz ?? '',
      };
    }
    // Neuer Regeldienst: üblicher Dienst, Wache/Fahrzeug/Rolle vom letzten Mal.
    // Neuer Zusatzdienst: bewusst nichts vorbelegt.
    return {
      datum: zusatz ? datumInput(jetzt.getTime()) : vorschlagDatum(jetzt),
      art: (zusatz ? 'andere' : '24') as DienstArt,
      beginnUhr: zusatz ? '' : regelBeginn,
      dauer: 24,
      endeUhr: '',
      istBeginn: '',
      istEnde: '',
      wache: zusatz || einst.standardWacheId == null ? [] : [einst.standardWacheId],
      fahrzeug: zusatz || einst.standardFahrzeugId == null ? [] : [einst.standardFahrzeugId],
      rolle: zusatz || einst.standardRolleId == null ? [] : [einst.standardRolleId],
      notiz: '',
    };
    // Nur beim Öffnen auswerten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [datum, setDatum] = useState(start.datum);
  const [art, setArt] = useState<DienstArt>(start.art);
  const [beginnUhr, setBeginnUhr] = useState(start.beginnUhr);
  const [dauer, setDauer] = useState(start.dauer);
  const [endeUhr, setEndeUhr] = useState(start.endeUhr);
  const [dauerChip, setDauerChip] = useState<number | null>(null);
  const [istBeginn, setIstBeginn] = useState(start.istBeginn);
  const [istEnde, setIstEnde] = useState(start.istEnde);
  const [abweichungOffen, setAbweichungOffen] = useState(zeitenOffen || start.istBeginn !== '' || start.istEnde !== '');
  const [wache, setWache] = useState<number[]>(start.wache);
  const [fahrzeug, setFahrzeug] = useState<number[]>(start.fahrzeug);
  const [rolle, setRolle] = useState<number[]>(start.rolle);
  const [notiz, setNotiz] = useState(start.notiz);
  const [versucht, setVersucht] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const [speichert, setSpeichert] = useState(false);

  /* ---- Zeiten berechnen ---- */
  const regel = regelUhrzeit(regelBeginn);
  const regelText = `${String(regel.h).padStart(2, '0')}:${String(regel.m).padStart(2, '0')}`;

  const regelErgebnis = useMemo(
    () =>
      berechneDienstEingabe({
        datum,
        beginnUhr: art === 'andere' ? beginnUhr : regelText,
        dauerStunden: art === '24' ? 24 : art === '12' ? 12 : dauer,
        istBeginn,
        istEnde,
      }),
    [datum, art, beginnUhr, dauer, istBeginn, istEnde, regelText],
  );

  const zusatzZeiten = useMemo(() => {
    const s = parseUhrzeit(beginnUhr);
    const e = parseUhrzeit(endeUhr);
    const datumOk = /^\d{4}-\d{2}-\d{2}$/.test(datum);
    const beginn = s && datumOk ? zeitpunkt(datum, s.h, s.m) : null;
    const ende = beginn != null && e ? naechsteUhrzeit(e.h, e.m, beginn, true) : null;
    return { beginn, ende, beginnFehler: !s, endeFehler: !e };
  }, [datum, beginnUhr, endeUhr]);

  const zeiten = zusatz
    ? zusatzZeiten.beginn != null && zusatzZeiten.ende != null
      ? { sollBeginn: zusatzZeiten.beginn, sollEnde: zusatzZeiten.ende, beginn: zusatzZeiten.beginn, ende: zusatzZeiten.ende }
      : null
    : regelErgebnis.zeiten;

  const saldo = zeiten && !zusatz ? dienstSaldo(zeiten) : null;

  /* ---- Prüfungen ---- */
  const einsaetze = bestehend ? (daten.einsaetzeNachDienst.get(bestehend.id!) ?? []) : [];
  const ausserhalb = zeiten ? einsaetze.filter((e) => e.alarm < zeiten.beginn || e.alarm >= zeiten.ende) : [];
  const zuSpaet = zeiten
    ? einsaetze.filter((e) => Math.max(e.status1, e.status2 ?? 0) > zeiten.ende && !ausserhalb.includes(e))
    : [];
  const ueberschneidung = zeiten
    ? daten.dienste.find((d) => d.id !== bestehend?.id && d.beginn < zeiten.ende && zeiten.beginn < d.ende)
    : undefined;

  const fehler: Partial<Record<'datum' | 'beginnUhr' | 'endeUhr' | 'dauer' | 'istBeginn' | 'istEnde', string>> = {};
  if (zusatz) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) fehler.datum = 'Datum angeben.';
    if (zusatzZeiten.beginnFehler) fehler.beginnUhr = beginnUhr ? 'Uhrzeit wie 18:00 eingeben.' : 'Beginn angeben.';
    if (zusatzZeiten.endeFehler) fehler.endeUhr = endeUhr ? 'Uhrzeit wie 02:00 eingeben.' : 'Ende angeben.';
  } else {
    Object.assign(fehler, regelErgebnis.fehler);
  }
  const zeigeFehler = (f: keyof typeof fehler) => (versucht || (f !== 'datum' && !!{ beginnUhr, endeUhr, dauer: '', istBeginn, istEnde }[f as 'beginnUhr']) ? fehler[f] : undefined);

  /* ---- Aktionen ---- */
  const jetzt = () => {
    setDatum(datumVorTagen(Date.now(), 0));
    setBeginnUhr(fmtZeit(Date.now()));
    setDauerChip(null);
  };

  const waehleDauer = (stunden: number) => {
    const s = parseUhrzeit(beginnUhr);
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      setVersucht(true);
      return;
    }
    setDauerChip(stunden);
    setEndeUhr(fmtZeit(endeNachDauer(zeitpunkt(datum, s.h, s.m), stunden)));
  };

  const aendereBeginn = (text: string) => {
    setBeginnUhr(text);
    const s = parseUhrzeit(text);
    if (dauerChip != null && s && /^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      setEndeUhr(fmtZeit(endeNachDauer(zeitpunkt(datum, s.h, s.m), dauerChip)));
    }
  };

  const speichern = async () => {
    setVersucht(true);
    if (!zeiten || Object.keys(fehler).length > 0) return;
    if (ausserhalb.length > 0) return;
    setSpeichert(true);
    try {
      const dienst: Dienst = ohneLeere({
        ...(bestehend ?? {}),
        sollBeginn: zeiten.sollBeginn,
        sollEnde: zeiten.sollEnde,
        beginn: zeiten.beginn,
        ende: zeiten.ende,
        wacheId: wache[0],
        fahrzeugId: fahrzeug[0],
        rolleId: rolle[0],
        zusatzdienst: zusatz ? true : undefined,
        notiz: notiz.trim() || undefined,
      });
      const neueId = await speichereDienst(dienst);
      toast.zeige(neu ? (zusatz ? 'Zusatzdienst angelegt' : 'Dienst angelegt') : 'Dienst gespeichert');
      if (neu) navigate(`/dienst/${neueId}`, true);
      else zurueck(`/dienst/${neueId}`);
    } catch {
      toast.zeige('Das Speichern hat nicht geklappt. Bitte noch einmal versuchen.');
      setSpeichert(false);
    }
  };

  const titel = `${zusatz ? 'Zusatzdienst' : 'Dienst'} ${neu ? 'anlegen' : 'bearbeiten'}`;
  const fuss = (
    <div className="knopfreihe knopfreihe--fuss">
      {!neu && (
        <Knopf variante="gefahr" onClick={() => setLoeschen(true)} aria-label="Dienst löschen">
          Löschen
        </Knopf>
      )}
      <Knopf variante="primaer" onClick={() => void speichern()} disabled={speichert}>
        {neu ? (zusatz ? 'Zusatzdienst speichern' : 'Dienst speichern') : 'Speichern'}
      </Knopf>
    </div>
  );

  const heute = datumVorTagen(Date.now(), 0);
  const gestern = datumVorTagen(Date.now(), 1);

  return (
    <Seite titel={titel} zurueckZu={bestehend ? `/dienst/${bestehend.id}` : '/'} fuss={fuss}>
      {zusatz && neu && (
        <Meldung art="info">
          Zusatzdienst ohne Vorbelegung. Beginn und Ende bilden den Rahmen für die Einsätze darin. Er zählt nicht zu deinen Über- und Minusstunden.
        </Meldung>
      )}

      <Abschnitt titel={zusatz ? 'Zeitraum' : 'Dienst'}>
        <Feld label={zusatz ? 'Beginn am' : 'Datum des Dienstbeginns'} fehler={zeigeFehler('datum')} htmlFor="dienst-datum">
          <ChipReihe label="Datum wählen">
            <Chip aktiv={datum === heute} onClick={() => setDatum(heute)}>Heute</Chip>
            <Chip aktiv={datum === gestern} onClick={() => setDatum(gestern)}>Gestern</Chip>
          </ChipReihe>
          <input
            id="dienst-datum"
            type="date"
            className="eingabe eingabe--datum zahl"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
          />
        </Feld>

        {zusatz ? (
          <>
            <ZeitFeld
              label="Beginn"
              wert={beginnUhr}
              onChange={aendereBeginn}
              fehler={zeigeFehler('beginnUhr')}
              hinweis={zusatzZeiten.beginn != null ? fmtDatumZeit(zusatzZeiten.beginn) : undefined}
            />
            <ChipReihe label="Beginn jetzt">
              <Chip gestrichelt onClick={jetzt}>Jetzt</Chip>
            </ChipReihe>
            <ZeitFeld
              label="Ende"
              wert={endeUhr}
              onChange={(t) => {
                setEndeUhr(t);
                setDauerChip(null);
              }}
              fehler={zeigeFehler('endeUhr')}
              hinweis={zusatzZeiten.ende != null ? fmtDatumZeit(zusatzZeiten.ende) : 'Die Uhrzeit nach dem Beginn zählt, höchstens 24 Stunden danach.'}
            />
            <ChipReihe label="Dauer wählen">
              {[4, 6, 8, 12, 24].map((h) => (
                <Chip key={h} klein aktiv={dauerChip === h} onClick={() => waehleDauer(h)}>
                  {h} h
                </Chip>
              ))}
            </ChipReihe>
          </>
        ) : (
          <>
            <Feld label="Art des Dienstes">
              <Segment<DienstArt>
                label="Art des Dienstes"
                wert={art}
                onChange={setArt}
                optionen={[
                  { wert: '24', label: '24 h' },
                  { wert: '12', label: '12 h' },
                  { wert: 'andere', label: 'Andere' },
                ]}
              />
            </Feld>
            {art === 'andere' && (
              <>
                <ZeitFeld label="Geplanter Beginn" wert={beginnUhr} onChange={setBeginnUhr} fehler={zeigeFehler('beginnUhr')} />
                <Feld label="Geplante Dauer" fehler={zeigeFehler('dauer')}>
                  <Stepper label="Dauer in Stunden" wert={dauer} min={1} max={48} onChange={setDauer} einheit="h" />
                </Feld>
              </>
            )}
            {regelErgebnis.zeiten && (
              <p className="hinweis zahl">
                Plan: {sollText(regelErgebnis.zeiten)} · {fmtDatumKurz(regelErgebnis.zeiten.sollBeginn)} bis {fmtDatumKurz(regelErgebnis.zeiten.sollEnde)}
              </p>
            )}
          </>
        )}
      </Abschnitt>

      {!zusatz && (
        <Aufklappen
          titel="Über- oder Minusstunden"
          zusatz={saldo ? fmtSaldo(saldo.saldoMin) : undefined}
          offen={abweichungOffen}
          onToggle={() => setAbweichungOffen((o) => !o)}
        >
          <p className="hinweis">
            Nur ausfüllen, wenn du von der Planung abweichst: früher da (Übergabe), länger geblieben oder früher abgelöst. Leer bedeutet: wie geplant.
          </p>
          <ZeitFeld
            label="Dienstantritt"
            wert={istBeginn}
            onChange={setIstBeginn}
            optional
            fehler={zeigeFehler('istBeginn')}
            hinweis={regelErgebnis.zeiten ? `Geplant ${fmtZeit(regelErgebnis.zeiten.sollBeginn)}${istBeginn && regelErgebnis.zeiten.beginn !== regelErgebnis.zeiten.sollBeginn ? ` · ${fmtDatumZeit(regelErgebnis.zeiten.beginn)}` : ''}` : undefined}
          />
          <ZeitFeld
            label="Dienstende"
            wert={istEnde}
            onChange={setIstEnde}
            optional
            fehler={zeigeFehler('istEnde')}
            hinweis={regelErgebnis.zeiten ? `Geplant ${fmtZeit(regelErgebnis.zeiten.sollEnde)}${istEnde && regelErgebnis.zeiten.ende !== regelErgebnis.zeiten.sollEnde ? ` · ${fmtDatumZeit(regelErgebnis.zeiten.ende)}` : ''}` : undefined}
          />
          {saldo && saldo.saldoMin !== 0 && (
            <Meldung art="info">
              {saldo.saldoMin > 0 ? 'Überstunden' : 'Minusstunden'}: <strong className="zahl">{fmtSaldo(saldo.saldoMin)}</strong>
              {saldo.vorMin !== 0 && saldo.nachMin !== 0 && (
                <span className="zahl"> ({fmtSaldo(saldo.vorMin)} beim Antritt, {fmtSaldo(saldo.nachMin)} am Ende)</span>
              )}
            </Meldung>
          )}
          {(istBeginn || istEnde) && (
            <Knopf
              variante="text"
              onClick={() => {
                setIstBeginn('');
                setIstEnde('');
              }}
            >
              Auf Plan zurücksetzen
            </Knopf>
          )}
        </Aufklappen>
      )}

      <Abschnitt titel={zusatz ? 'Rahmen' : 'Einsatzort und Besetzung'}>
        <KatalogAuswahl
          label={zusatz ? 'Stadt / Organisation' : 'Wache'}
          katalogTyp={zusatz ? 'standort' : 'wache'}
          vorschlaege={wachen.vorschlaege}
          alle={wachen.alle}
          ausgewaehlt={wache}
          onChange={setWache}
          nutzung={wachen.zaehler}
          namenAusgewaehlt={wachen.namen}
          hinweis={zusatz ? 'Zum Beispiel „Leverkusen Rettungsdienst“. Die Liste wächst mit.' : undefined}
        />
        <KatalogAuswahl
          label="Fahrzeug"
          katalogTyp="fahrzeug"
          vorschlaege={fahrzeuge.vorschlaege}
          alle={fahrzeuge.alle}
          ausgewaehlt={fahrzeug}
          onChange={setFahrzeug}
          nutzung={fahrzeuge.zaehler}
          namenAusgewaehlt={fahrzeuge.namen}
        />
        <KatalogAuswahl
          label={zusatz ? 'Funktion' : 'Rolle'}
          katalogTyp="rolle"
          vorschlaege={rollen.vorschlaege}
          alle={rollen.alle}
          ausgewaehlt={rolle}
          onChange={setRolle}
          nutzung={rollen.zaehler}
          namenAusgewaehlt={rollen.namen}
        />
        <TextFeld
          label="Notiz"
          wert={notiz}
          onChange={setNotiz}
          mehrzeilig
          maxLength={500}
          hinweis="Keine Patientendaten und keine Namen."
        />
      </Abschnitt>

      {ueberschneidung && (
        <Meldung art="warnung">
          Überschneidet sich mit dem Dienst {dienstTitel(daten, ueberschneidung)} ({fmtZeit(ueberschneidung.beginn)}–{fmtZeit(ueberschneidung.ende)}).
        </Meldung>
      )}
      {ausserhalb.length > 0 && (
        <Meldung art="fehler">
          {ausserhalb.length === 1 ? 'Ein Einsatz liegt' : `${ausserhalb.length} Einsätze liegen`} außerhalb des neuen Zeitraums. Passe Beginn oder Ende an oder ändere zuerst den Einsatz.
        </Meldung>
      )}
      {zuSpaet.length > 0 && (
        <Meldung art="warnung">
          {zuSpaet.length === 1 ? 'Ein Einsatz endet' : `${zuSpaet.length} Einsätze enden`} nach dem Dienstende. Stimmt das Ende?
        </Meldung>
      )}

      <Bestaetigung
        offen={loeschen}
        titel="Dienst löschen?"
        gefahr
        jaText="Endgültig löschen"
        text={
          einsaetze.length > 0
            ? `Der Dienst und seine ${einsaetze.length} ${einsaetze.length === 1 ? 'Einsatz' : 'Einsätze'} werden gelöscht. Das lässt sich nicht rückgängig machen.`
            : 'Der Dienst wird gelöscht. Das lässt sich nicht rückgängig machen.'
        }
        onNein={() => setLoeschen(false)}
        onJa={async () => {
          if (!bestehend) return;
          await loescheDienst(bestehend.id!);
          setLoeschen(false);
          toast.zeige('Dienst gelöscht');
          navigate('/', true);
        }}
      />
    </Seite>
  );
}
