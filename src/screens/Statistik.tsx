import { useMemo, useState } from 'react';
import {
  berechneAlarmstufen,
  berechneFwMassnahmen,
  berechneMassnahmen,
  berechneStatistik,
  verfuegbareJahre,
  waehleEinsaetze,
  type FwMassnahmenGruppe,
  type MassnahmenZeile,
  type StatFilter,
} from '../domain/stats';
import { stufeKraefte, stufeText } from '../domain/alarmstufe';
import { berechneUebungen, berechneUebungsMassnahmen, waehleUebungen, type UebungsMassnahmeZeile } from '../domain/uebungen';
import { berechneTriage } from '../domain/triageStats';
import { stichwortText, TYP_INFO } from '../domain/stichwort';
import { fmtDauer, fmtSaldo, fmtStunden, fmtZahl } from '../domain/time';
import { bereichVon, DURCHFUEHRUNG_INFO, FW_GRUPPE_NAME, type MassnahmeArt } from '../domain/types';
import { navigate } from '../router';
import { katalogName, useDaten } from '../state/daten';
import { Balken, ChartKarte, FarbLegende, Saeulen, SaldoSaeulen, ZeitBalken } from '../ui/charts';
import { Abschnitt, Chip, ChipReihe, Knopf, Leer, Meldung, Segment } from '../ui/controls';
import { Kpi, KpiRaster } from '../ui/kpi';
import { Seite } from '../ui/seite';
import { TriageAbschnitte } from './StatistikTriage';
import { prozent } from '../ui/zahlen';

// Die Auswahl bleibt beim Wechsel zwischen den Reitern erhalten.
const gemerkt: { jahr: number | null | undefined; bereich: StatFilter['bereich']; dienstart: StatFilter['dienstart'] } = {
  jahr: undefined,
  bereich: 'alle',
  dienstart: 'alle',
};

const ART_TITEL: Record<MassnahmeArt, string> = {
  medikament: 'Medikamente',
  invasiv: 'Invasive Maßnahmen',
  sonstige: 'Sonstige Maßnahmen',
};

const minText = (min: number | null) => (min == null ? '–' : fmtDauer(Math.round(min)));

function MassnahmenTabelle({ art, zeilen }: { art: MassnahmeArt; zeilen: MassnahmenZeile[] }) {
  const mitDurchfuehrung = art !== 'sonstige';
  return (
    <div className="tabelle-huelle">
      <table className={`tabelle tabelle--massnahmen${mitDurchfuehrung ? '' : ' tabelle--einsaetze'}`}>
        <caption className="tabelle__titel">{ART_TITEL[art]}</caption>
        <thead>
          <tr>
            <th scope="col">Maßnahme</th>
            <th scope="col" className="zahl">Anzahl</th>
            {mitDurchfuehrung ? (
              <>
                <th scope="col" className="zahl" aria-label={DURCHFUEHRUNG_INFO.vorab.kurz}>V</th>
                <th scope="col" className="zahl" aria-label={DURCHFUEHRUNG_INFO.eigen.kurz}>E</th>
                <th scope="col" className="zahl" aria-label={DURCHFUEHRUNG_INFO.arzt.kurz}>A</th>
              </>
            ) : (
              <th scope="col" className="zahl">Einsätze</th>
            )}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.massnahmeId}>
              <th scope="row">{z.name}</th>
              <td className="zahl">{fmtZahl(z.anzahl)}</td>
              {mitDurchfuehrung ? (
                <>
                  <td className="zahl">{z.vorab || '–'}</td>
                  <td className="zahl">{z.eigen || '–'}</td>
                  <td className="zahl">{z.arzt || '–'}</td>
                </>
              ) : (
                <td className="zahl">{z.einsaetze}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FwMassnahmenTabelle({ gruppe }: { gruppe: FwMassnahmenGruppe }) {
  return (
    <div className="tabelle-huelle">
      <table className="tabelle tabelle--massnahmen tabelle--einsaetze">
        <caption className="tabelle__titel">{FW_GRUPPE_NAME[gruppe.gruppe]}</caption>
        <thead>
          <tr>
            <th scope="col">Maßnahme</th>
            <th scope="col" className="zahl">Anzahl</th>
            <th scope="col" className="zahl">Einsätze</th>
          </tr>
        </thead>
        <tbody>
          {gruppe.zeilen.map((z) => (
            <tr key={z.massnahmeId}>
              <th scope="row">{z.name}</th>
              <td className="zahl">{fmtZahl(z.anzahl)}</td>
              <td className="zahl">{z.einsaetze}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UebungsMassnahmenTabelle({ titel, zeilen }: { titel: string; zeilen: UebungsMassnahmeZeile[] }) {
  return (
    <div className="tabelle-huelle">
      <table className="tabelle tabelle--massnahmen tabelle--einsaetze">
        <caption className="tabelle__titel">{titel}</caption>
        <thead>
          <tr>
            <th scope="col">Maßnahme</th>
            <th scope="col" className="zahl">Anzahl</th>
            <th scope="col" className="zahl">Übungen</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.massnahmeId}>
              <th scope="row">{z.name}</th>
              <td className="zahl">{fmtZahl(z.anzahl)}</td>
              <td className="zahl">{z.uebungen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Statistik() {
  const daten = useDaten();
  const { dienste, einsaetze, uebungen, einst, katalogMap } = daten;

  const jahre = useMemo(() => verfuegbareJahre(dienste, einsaetze, uebungen), [dienste, einsaetze, uebungen]);
  const hatZusatz = useMemo(() => dienste.some((d) => d.zusatzdienst), [dienste]);
  const hatUebungsdienst = useMemo(() => dienste.some((d) => d.uebungsdienst), [dienste]);

  const [jahrRoh, setJahrRoh] = useState<number | null | undefined>(gemerkt.jahr);
  const [bereich, setBereichRoh] = useState<StatFilter['bereich']>(gemerkt.bereich);
  const [dienstartRoh, setDienstartRoh] = useState<StatFilter['dienstart']>(gemerkt.dienstart);

  const aktuell = new Date().getFullYear();
  const standardJahr = jahre.includes(aktuell) ? aktuell : (jahre[0] ?? null);
  const jahr = jahrRoh === undefined ? standardJahr : jahrRoh === null || jahre.includes(jahrRoh) ? jahrRoh : null;
  // Eine gemerkte Dienstart, die es (nach Löschen) nicht mehr gibt, fällt auf „Alle“ zurück.
  const dienstart = (dienstartRoh === 'zusatz' && hatZusatz) || (dienstartRoh === 'uebung' && hatUebungsdienst) || dienstartRoh === 'regel' ? dienstartRoh : 'alle';

  const setJahr = (j: number | null) => {
    gemerkt.jahr = j;
    setJahrRoh(j);
  };
  const setBereich = (b: StatFilter['bereich']) => {
    gemerkt.bereich = b;
    setBereichRoh(b);
  };
  const setDienstart = (a: StatFilter['dienstart']) => {
    gemerkt.dienstart = a;
    setDienstartRoh(a);
  };

  const filter = useMemo<StatFilter>(() => ({ jahr, bereich, dienstart }), [jahr, bereich, dienstart]);
  const s = useMemo(
    () => berechneStatistik(dienste, einsaetze, filter, einst.wachzeitMitDienstRand, uebungen),
    [dienste, einsaetze, uebungen, filter, einst.wachzeitMitDienstRand],
  );
  const ueb = useMemo(() => berechneUebungen(dienste, uebungen, filter, katalogMap, einsaetze), [dienste, uebungen, filter, katalogMap, einsaetze]);
  const uebMassn = useMemo(
    () => berechneUebungsMassnahmen(waehleUebungen(dienste, uebungen, filter, katalogMap), katalogMap, filter.bereich),
    [dienste, uebungen, filter, katalogMap],
  );
  const gewaehlt = useMemo(() => waehleEinsaetze(dienste, einsaetze, filter), [dienste, einsaetze, filter]);
  const massn = useMemo(() => berechneMassnahmen(gewaehlt, katalogMap), [gewaehlt, katalogMap]);
  const fwMassn = useMemo(() => berechneFwMassnahmen(gewaehlt, katalogMap), [gewaehlt, katalogMap]);
  const triage = useMemo(() => berechneTriage(gewaehlt, katalogMap), [gewaehlt, katalogMap]);
  const stufen = useMemo(() => berechneAlarmstufen(gewaehlt, katalogMap), [gewaehlt, katalogMap]);

  if (dienste.length === 0 && einsaetze.length === 0 && uebungen.length === 0) {
    return (
      <Seite titel="Statistik">
        <Leer
          titel="Noch nichts auszuwerten"
          text="Sobald du Dienste, Einsätze und Übungen erfasst hast, siehst du hier Zahlen, Zeiten, Maßnahmen und Überstunden."
          aktion={<Knopf variante="primaer" onClick={() => navigate('/dienst/neu')}>Dienst anlegen</Knopf>}
        />
      </Seite>
    );
  }

  const zeitraum = jahr == null ? 'Gesamt' : String(jahr);
  const leer = s.anzahl === 0 && s.dienste === 0 && ueb.anzahl === 0;
  const z = s.zeiten;
  const zugeordnetMin = z.einsatzMin + z.rueckfahrtMin + z.wacheMin + z.uebungMin;
  const offenMin = Math.max(0, z.dienstMin - zugeordnetMin);
  const zeitSumme = Math.max(z.dienstMin, zugeordnetMin);
  const stichwortName = (typ: Parameters<typeof stichwortText>[0], kategorieId: number) =>
    stichwortText(typ, katalogName(daten, kategorieId));
  const regelDienste = dienstart === 'alle' || dienstart === 'regel';
  // Die Stufen bis zur höchsten vorkommenden, auch mit Lücken dazwischen; höhere ohne Einsatz bleiben weg.
  const stufenZeilen = stufen.zeilen.filter((st) => st.stufe <= (stufen.hoechste?.stufe ?? 0));
  // Atemschutz zählt aus Feuerwehr-Einsätzen und aus Übungen, die als Atemschutzeinsatz gewertet werden.
  const asEinsatz = { anzahl: s.feuerwehr.atemschutz, minuten: s.feuerwehr.atemschutzMin };
  const asUebung = ueb.atemschutz;
  const asGesamt = { anzahl: asEinsatz.anzahl + asUebung.anzahl, minuten: asEinsatz.minuten + asUebung.minuten };
  const ue = s.ueberstunden;
  const hatUeberstunden = ue.diensteMitPlus + ue.diensteMitMinus > 0;
  const massnNachArt = (['medikament', 'invasiv', 'sonstige'] as const)
    .map((art) => ({ art, zeilen: massn.zeilen.filter((m) => m.art === art) }))
    .filter((g) => g.zeilen.length > 0);
  const gesamtAchse = (d: { label: string }) => (jahr == null && s.verlauf.length > 6 ? `’${d.label.slice(2)}` : d.label);
  const saldoWert = (min: number) => (
    <span className={min > 0 ? 'text-plus' : min < 0 ? 'text-minus' : undefined}>{fmtSaldo(min)}</span>
  );

  return (
    <Seite titel="Statistik">
      <div className="filter">
        <ChipReihe label="Zeitraum">
          <Chip aktiv={jahr == null} onClick={() => setJahr(null)}>Gesamt</Chip>
          {jahre.map((j) => (
            <Chip key={j} aktiv={jahr === j} onClick={() => setJahr(j)}>{j}</Chip>
          ))}
        </ChipReihe>
        <Segment<StatFilter['bereich']>
          label="Bereich"
          wert={bereich}
          onChange={setBereich}
          optionen={[
            { wert: 'alle', label: 'Alle' },
            { wert: 'RD', label: 'Rettungsdienst', ton: 'rd' },
            { wert: 'FW', label: 'Feuerwehr', ton: 'fw' },
          ]}
        />
        {(hatZusatz || hatUebungsdienst) && (
          <Segment<StatFilter['dienstart']>
            label="Dienstart"
            klein
            wert={dienstart}
            onChange={setDienstart}
            optionen={[
              { wert: 'alle', label: 'Alle Dienste' },
              { wert: 'regel', label: 'Regeldienste' },
              ...(hatZusatz ? [{ wert: 'zusatz' as const, label: 'Zusatzdienste' }] : []),
              ...(hatUebungsdienst ? [{ wert: 'uebung' as const, label: 'Übungsdienste' }] : []),
            ]}
          />
        )}
      </div>

      {leer ? (
        <Leer titel={`Keine Daten für ${zeitraum}`} text="In diesem Zeitraum gibt es weder Dienste noch Einsätze. Wähle einen anderen Zeitraum." />
      ) : (
        <>
          <KpiRaster>
            <Kpi wert={fmtZahl(s.anzahl)} label="Einsätze" zusatz={`RD ${fmtZahl(s.rd)} · FW ${fmtZahl(s.fw)}`} />
            <Kpi wert={fmtZahl(s.dienste)} label="Dienste" zusatz={s.einsaetzeProDienst != null ? `${s.einsaetzeProDienst.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Einsätze je Dienst` : undefined} />
            <Kpi
              wert={minText(s.medianEinsatzMin)}
              label="Mittlere Einsatzdauer"
              zusatz={bereich === 'alle' && s.rd > 0 && s.fw > 0 ? `RD ${minText(s.medianRdMin)} · FW ${minText(s.medianFwMin)}` : 'Median, Alarm bis Status 1'}
            />
            <Kpi wert={fmtStunden(z.einsatzMin)} label="Im Einsatz" zusatz={bereich === 'alle' ? `${prozent(z.einsatzMin, z.dienstMin)} der Dienstzeit` : 'Rettungsdienst und Feuerwehr'} />
          </KpiRaster>

          {s.anzahl > 0 && (
            <>
              <ChartKarte
                titel={jahr == null ? 'Einsätze je Jahr' : 'Einsätze je Monat'}
                untertitel={zeitraum}
                tabelle={{
                  kopf: [jahr == null ? 'Jahr' : 'Monat', 'Gesamt', 'RD', 'FW'],
                  zeilen: s.verlauf.map((v) => [v.label, v.rd + v.fw, v.rd, v.fw]),
                }}
              >
                <FarbLegende />
                <Saeulen daten={s.verlauf} achse={gesamtAchse} lang={(d) => (jahr == null ? d.label : `${d.label} ${jahr}`)} />
              </ChartKarte>

              <ChartKarte
                titel="Wochentag"
                tabelle={{ kopf: ['Tag', 'Gesamt', 'RD', 'FW'], zeilen: s.wochentag.map((v) => [v.label, v.rd + v.fw, v.rd, v.fw]) }}
              >
                <FarbLegende />
                <Saeulen daten={s.wochentag} achse={(d) => d.label} />
              </ChartKarte>

              <ChartKarte
                titel="Tageszeit"
                untertitel="Nach Alarmierung, in Zwei-Stunden-Blöcken"
                tabelle={{ kopf: ['Uhrzeit', 'Gesamt', 'RD', 'FW'], zeilen: s.tageszeit.map((v) => [`${v.label} Uhr`, v.rd + v.fw, v.rd, v.fw]) }}
              >
                <FarbLegende />
                <Saeulen daten={s.tageszeit} achse={(_, i) => (i % 2 === 0 ? String(i * 2) : '')} lang={(d) => `${d.label} Uhr`} />
              </ChartKarte>

              <ChartKarte
                titel="Häufigste Stichworte"
                untertitel={s.stichworte.length > 8 ? `Die 8 häufigsten von ${s.stichworte.length}` : undefined}
                tabelle={{
                  kopf: ['Stichwort', 'Anzahl', 'Median'],
                  zeilen: s.stichworte.slice(0, 60).map((w) => [stichwortName(w.typ, w.kategorieId), w.n, minText(w.medianMin)]),
                }}
              >
                <Balken
                  zeilen={s.stichworte.slice(0, 8).map((w) => ({
                    label: stichwortName(w.typ, w.kategorieId),
                    wert: w.n,
                    ton: bereichVon(w.typ) === 'RD' ? 'rd' : 'fw',
                  }))}
                />
              </ChartKarte>

              <ChartKarte
                titel="Einsatzart"
                untertitel={ueb.anzahl > 0 ? 'Übungen zählen nicht zu den Einsätzen' : undefined}
                tabelle={{
                  kopf: ['Art', 'Anzahl'],
                  zeilen: [...s.typ.map((t) => [`${t.typ} ${TYP_INFO[t.typ].kurz}`, t.n]), ...(ueb.anzahl > 0 ? [['Ü Übung', ueb.anzahl]] : [])],
                }}
              >
                <Balken
                  zeilen={[
                    ...s.typ
                      .filter((t) => t.n > 0)
                      .map((t) => ({ label: `${t.typ} ${TYP_INFO[t.typ].kurz}`, wert: t.n, ton: bereichVon(t.typ) === 'RD' ? ('rd' as const) : ('fw' as const) })),
                    ...(ueb.anzahl > 0 ? [{ label: 'Ü Übung', wert: ueb.anzahl, ton: 'ue' as const }] : []),
                  ]}
                />
              </ChartKarte>

              {s.kraefte.length > 0 && (
                <ChartKarte
                  titel="Kräfteansatz im Rettungsdienst"
                  untertitel="Initial alarmiert"
                  tabelle={{ kopf: ['Ansatz', 'Anzahl'], zeilen: s.kraefte.map((k) => [k.text, k.n]) }}
                >
                  <Balken zeilen={s.kraefte.map((k) => ({ label: k.text, wert: k.n, ton: 'rd' as const }))} />
                </ChartKarte>
              )}

              <TriageAbschnitte t={triage} zeitraum={zeitraum} />
            </>
          )}

          <ChartKarte
            titel="Wohin die Dienstzeit geht"
            untertitel={`${fmtStunden(z.dienstMin)} Dienstzeit in ${s.dienste} ${s.dienste === 1 ? 'Dienst' : 'Diensten'}`}
            tabelle={{
              kopf: ['Zeit', 'Dauer', 'Anteil'],
              zeilen: [
                ['Im Einsatz', fmtDauer(z.einsatzMin), prozent(z.einsatzMin, zeitSumme)],
                ['Rückfahrt', fmtDauer(z.rueckfahrtMin), prozent(z.rueckfahrtMin, zeitSumme)],
                ['Auf Wache', fmtDauer(z.wacheMin), prozent(z.wacheMin, zeitSumme)],
                ...(z.uebungMin > 0 ? [['Übung', fmtDauer(z.uebungMin), prozent(z.uebungMin, zeitSumme)]] : []),
                ...(offenMin > 0 ? [['Nicht zugeordnet', fmtDauer(offenMin), prozent(offenMin, zeitSumme)]] : []),
              ],
            }}
          >
            <ZeitBalken einsatzMin={z.einsatzMin} rueckfahrtMin={z.rueckfahrtMin} wacheMin={z.wacheMin} uebungMin={z.uebungMin} offenMin={offenMin} />
            {z.uebungMin > 0 && <p className="hinweis">Übung: Zeit, in der du auf Wache oder im Übungsdienst geübt hast. Sie zählt nicht zur Wachzeit.</p>}
          </ChartKarte>
          {z.ohneStatus2 > 0 && (
            <Meldung art="warnung">
              Bei {z.ohneStatus2} {z.ohneStatus2 === 1 ? 'Einsatz fehlt' : 'Einsätzen fehlt'} Status 2. Dort fehlen Rückfahrt und die Wachzeit danach.
              In der Einsatzliste findest du sie mit dem Filter „Status 2 fehlt“.
            </Meldung>
          )}
          {z.ausStatus1 > 0 && (
            <Meldung art="info">
              Nach {z.ausStatus1} {z.ausStatus1 === 1 ? 'Einsatz' : 'Einsätzen'} wurdest du aus Status 1 heraus neu alarmiert. Die Zeit bis dahin zählt als Rückfahrt, Wachzeit gibt es dort nicht.
            </Meldung>
          )}
          {z.ueberlappungen > 0 && (
            <Meldung art="info">
              {z.ueberlappungen} {z.ueberlappungen === 1 ? 'Einsatz überschneidet' : 'Einsätze überschneiden'} sich mit dem nächsten. Die Einsatzzeit wird dann doppelt gezählt.
            </Meldung>
          )}

          <Abschnitt titel="Über- und Minusstunden">
            {!regelDienste ? (
              <Meldung art="info">
                {dienstart === 'uebung' ? 'Übungsdienste haben' : 'Zusatzdienste haben'} keinen Plan und zählen deshalb nicht zu den Über- und Minusstunden.
              </Meldung>
            ) : !hatUeberstunden ? (
              <p className="hinweis">
                In {zeitraum} gibt es keine Abweichung vom Plan. Zeiten vor dem Dienstbeginn, nach dem Dienstende oder eine frühere Ablösung trägst du im Dienst unter „Zeiten ändern“ ein.
              </p>
            ) : (
              <>
                <KpiRaster>
                  <Kpi wert={saldoWert(ue.saldoMin)} label="Saldo" zusatz={`${ue.diensteMitPlus + ue.diensteMitMinus} Dienste mit Abweichung`} />
                  <Kpi wert={<span className="text-plus">{fmtDauer(ue.plusMin)}</span>} label="Überstunden" zusatz={`${ue.diensteMitPlus} ${ue.diensteMitPlus === 1 ? 'Dienst' : 'Dienste'}`} />
                  <Kpi wert={<span className="text-minus">{fmtDauer(ue.minusMin)}</span>} label="Minusstunden" zusatz={`${ue.diensteMitMinus} ${ue.diensteMitMinus === 1 ? 'Dienst' : 'Dienste'}`} />
                </KpiRaster>
                <ChartKarte
                  titel={jahr == null ? 'Saldo je Jahr' : 'Saldo je Monat'}
                  untertitel="Über dem Strich Überstunden, darunter Minusstunden"
                  tabelle={{ kopf: [jahr == null ? 'Jahr' : 'Monat', 'Saldo'], zeilen: ue.verlauf.map((v) => [v.label, fmtSaldo(v.min)]) }}
                >
                  <SaldoSaeulen daten={ue.verlauf} achse={(d) => (jahr == null && ue.verlauf.length > 6 ? `’${d.label.slice(2)}` : d.label)} />
                </ChartKarte>
              </>
            )}
          </Abschnitt>

          {bereich !== 'FW' && (
          <Abschnitt titel="Maßnahmen-Nachweis">
            {massn.zeilen.length === 0 ? (
              <p className="hinweis">In {zeitraum} sind keine Maßnahmen oder Medikamente erfasst.</p>
            ) : (
              <>
                <KpiRaster>
                  <Kpi wert={fmtZahl(massn.summe.anzahl)} label="Maßnahmen gesamt" zusatz={`in ${massn.summe.einsaetze} ${massn.summe.einsaetze === 1 ? 'Einsatz' : 'Einsätzen'}`} />
                  <Kpi wert={fmtZahl(massn.summe.vorab)} label={DURCHFUEHRUNG_INFO.vorab.kurz} zusatz="§ 4 Abs. 2 Nr. 2c" />
                  <Kpi wert={fmtZahl(massn.summe.eigen)} label={DURCHFUEHRUNG_INFO.eigen.kurz} zusatz="§ 2a NotSanG" />
                  <Kpi wert={fmtZahl(massn.summe.arzt)} label={DURCHFUEHRUNG_INFO.arzt.kurz} zusatz="§ 4 Abs. 2 Nr. 2b" />
                </KpiRaster>
                {massnNachArt.map((g) => (
                  <MassnahmenTabelle key={g.art} art={g.art} zeilen={g.zeilen} />
                ))}
                <p className="hinweis">
                  V Vorabdelegation · E eigenverantwortlich · A auf Anordnung von Notarzt oder Telenotarzt. Gezählt wird, wie oft du die Maßnahme selbst durchgeführt hast.
                </p>
              </>
            )}
          </Abschnitt>
          )}

          {bereich !== 'RD' && s.feuerwehr.einsaetze > 0 && (
            <Abschnitt titel="Feuerwehr">
              <KpiRaster>
                <Kpi wert={fmtZahl(s.feuerwehr.einsaetze)} label="Feuerwehr-Einsätze" ton="fw" zusatz={`Median ${minText(s.medianFwMin)}`} />
                <Kpi wert={fmtZahl(s.feuerwehr.mig)} label="Menschenleben in Gefahr" ton="fw" zusatz={`${prozent(s.feuerwehr.mig, s.feuerwehr.einsaetze)} der Einsätze`} />
              </KpiRaster>
              {fwMassn.summe.anzahl > 0 ? (
                <>
                  <KpiRaster>
                    <Kpi
                      wert={fmtZahl(fwMassn.summe.anzahl)}
                      label="Maßnahmen auf Befehl"
                      ton="fw"
                      zusatz={`in ${fwMassn.summe.einsaetze} ${fwMassn.summe.einsaetze === 1 ? 'Einsatz' : 'Einsätzen'}`}
                    />
                    <Kpi wert={fmtZahl(fwMassn.summe.verschiedene)} label="Verschiedene Maßnahmen" ton="fw" />
                  </KpiRaster>
                  {fwMassn.gruppen.map((g) => (
                    <FwMassnahmenTabelle key={g.gruppe} gruppe={g} />
                  ))}
                  <p className="hinweis">Gezählt wird, wie oft du die Maßnahme auf Befehl selbst ausgeführt hast.</p>
                </>
              ) : (
                <p className="hinweis">In {zeitraum} sind keine Maßnahmen auf Befehl erfasst.</p>
              )}
            </Abschnitt>
          )}

          {bereich !== 'RD' && stufen.hoechste != null && (
            <Abschnitt titel="Alarmstufen">
              <KpiRaster>
                <Kpi
                  wert={String(stufen.hoechste.stufe)}
                  label="Höchste Alarmstufe"
                  ton="fw"
                  zusatz={`${stufeKraefte(stufen.hoechste.stufe)} · ${stufen.hoechste.n}× in ${zeitraum}`}
                />
                <Kpi
                  wert={fmtZahl(stufen.hoeher)}
                  label="Höher als in der AAO"
                  ton="fw"
                  zusatz={`${prozent(stufen.hoeher, stufen.mitStufe)} der Einsätze`}
                />
              </KpiRaster>
              <ChartKarte
                titel="Einsätze nach Alarmstufe"
                untertitel={`${stufen.mitStufe} Feuerwehr-${stufen.mitStufe === 1 ? 'Einsatz' : 'Einsätze'}`}
                tabelle={{
                  kopf: ['Stufe', 'Kräfte', 'Einsätze', 'Zeit', 'Median'],
                  zeilen: stufenZeilen.map((st) => [stufeText(st.stufe), stufeKraefte(st.stufe), st.n, fmtDauer(st.minuten), minText(st.medianMin)]),
                }}
              >
                <Balken zeilen={stufenZeilen.map((st) => ({ label: stufeText(st.stufe), wert: st.n, ton: 'fw' as const }))} />
                <p className="hinweis">
                  Stufe 0 ist ein HLF, ab Stufe 1 zählt die Zahl der Staffeln. Einsätze ohne eingetragene Stufe zählen mit der Stufe, die die AAO für das Stichwort vorsieht.
                </p>
              </ChartKarte>
              {stufen.niedriger > 0 && (
                <p className="hinweis">
                  Niedriger als in der AAO: {stufen.niedriger} {stufen.niedriger === 1 ? 'Einsatz' : 'Einsätze'}.
                </p>
              )}
              {stufen.ohneStufe > 0 && (
                <p className="hinweis">
                  Nicht enthalten: {stufen.ohneStufe} {stufen.ohneStufe === 1 ? 'Einsatz' : 'Einsätze'} mit einem Stichwort, das die AAO nicht kennt, und ohne eingetragene Stufe.
                </p>
              )}
            </Abschnitt>
          )}

          {bereich !== 'RD' && asGesamt.anzahl > 0 && (
            <Abschnitt titel="Atemschutz">
              <KpiRaster>
                <Kpi
                  wert={fmtZahl(asGesamt.anzahl)}
                  label="Atemschutzeinsätze"
                  ton="fw"
                  zusatz={`${asEinsatz.anzahl} im Einsatz · ${asUebung.anzahl} in Übungen`}
                />
                <Kpi
                  wert={fmtDauer(asGesamt.minuten)}
                  label="Unter Atemschutz"
                  ton="fw"
                  zusatz={`Ø ${fmtDauer(asGesamt.minuten / asGesamt.anzahl)} je Einsatz`}
                />
              </KpiRaster>
              <div className="tabelle-huelle">
                <table className="tabelle tabelle--massnahmen tabelle--einsaetze">
                  <caption className="tabelle__titel">Atemschutz im Nachweis</caption>
                  <thead>
                    <tr>
                      <th scope="col">Wo</th>
                      <th scope="col" className="zahl">Anzahl</th>
                      <th scope="col" className="zahl">Zeit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Einsätze</th>
                      <td className="zahl">{fmtZahl(asEinsatz.anzahl)}</td>
                      <td className="zahl">{fmtDauer(asEinsatz.minuten)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Übungen</th>
                      <td className="zahl">{fmtZahl(asUebung.anzahl)}</td>
                      <td className="zahl">{fmtDauer(asUebung.minuten)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Gesamt</th>
                      <td className="zahl">{fmtZahl(asGesamt.anzahl)}</td>
                      <td className="zahl">{fmtDauer(asGesamt.minuten)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="hinweis">Eine Übung zählt, wenn du sie im Übungsformular als Atemschutzeinsatz wertest. Die Zeit ist die Zeit unter Atemschutz, nicht die Dauer der Übung.</p>
            </Abschnitt>
          )}

          <Abschnitt titel="Übungen">
            {ueb.minuten === 0 ? (
              <p className="hinweis">
                In {zeitraum} sind keine Übungen erfasst. Du erfasst sie im Einsatzformular als Einsatzart „Ü Übung“ oder legst einen Übungsdienst an.
              </p>
            ) : (
              <>
                <KpiRaster>
                  <Kpi ton="ue" wert={fmtStunden(ueb.minuten)} label="Übungszeit" zusatz={`${ueb.anzahl} ${ueb.anzahl === 1 ? 'Übung' : 'Übungen'} erfasst`} />
                  {ueb.anzahl > 0 && (
                    <Kpi ton="ue" wert={fmtDauer((ueb.minuten - ueb.restMin) / ueb.anzahl)} label="Ø je Übung" zusatz="erfasste Übungen" />
                  )}
                  <Kpi
                    ton="ue"
                    wert={fmtStunden(ueb.inSchicht.minuten)}
                    label="In der Schicht"
                    zusatz={`${ueb.inSchicht.anzahl} ${ueb.inSchicht.anzahl === 1 ? 'Übung' : 'Übungen'}`}
                  />
                  <Kpi
                    ton="ue"
                    wert={fmtStunden(ueb.imUebungsdienst.minuten)}
                    label="Im Übungsdienst"
                    zusatz={`${ueb.imUebungsdienst.dienste} ${ueb.imUebungsdienst.dienste === 1 ? 'Dienst' : 'Dienste'}`}
                  />
                </KpiRaster>
                <ChartKarte
                  titel="Übungszeit nach Art"
                  untertitel={zeitraum}
                  tabelle={{
                    kopf: ['Art', 'Übungen', 'Dauer'],
                    zeilen: [
                      ...ueb.nachArt.map((a) => [a.name, a.anzahl, fmtDauer(a.minuten)]),
                      ...(ueb.restMin > 0 ? [['Nicht aufgeschlüsselt', '–', fmtDauer(ueb.restMin)]] : []),
                    ],
                  }}
                >
                  <Balken
                    zeilen={[
                      ...ueb.nachArt.map((a) => ({ label: a.name, wert: a.minuten, text: fmtStunden(a.minuten), zusatz: `${a.anzahl}×`, ton: 'ue' as const })),
                      ...(ueb.restMin > 0 ? [{ label: 'Nicht aufgeschlüsselt', wert: ueb.restMin, text: fmtStunden(ueb.restMin), ton: 'neutral' as const }] : []),
                    ]}
                  />
                </ChartKarte>
                {ueb.restMin > 0 && (
                  <p className="hinweis">
                    Nicht aufgeschlüsselt ist Zeit in Übungsdiensten, für die keine Übung erfasst ist, zum Beispiel Pausen. Die ganze Zeit des Dienstes zählt als Übung.
                  </p>
                )}
                {uebMassn.summe.anzahl > 0 && (
                  <>
                    <KpiRaster>
                      <Kpi
                        ton="ue"
                        wert={fmtZahl(uebMassn.summe.anzahl)}
                        label="Maßnahmen in Übungen"
                        zusatz={`in ${uebMassn.summe.uebungen} ${uebMassn.summe.uebungen === 1 ? 'Übung' : 'Übungen'}`}
                      />
                      <Kpi ton="ue" wert={fmtZahl(uebMassn.summe.verschiedene)} label="Verschiedene Maßnahmen" />
                    </KpiRaster>
                    {uebMassn.fw.length > 0 && <UebungsMassnahmenTabelle titel="Feuerwehr" zeilen={uebMassn.fw} />}
                    {uebMassn.rd.length > 0 && <UebungsMassnahmenTabelle titel="Rettungsdienst" zeilen={uebMassn.rd} />}
                    <p className="hinweis">Maßnahmen aus Übungen zählen nicht im Maßnahmen-Nachweis der Einsätze.</p>
                  </>
                )}
              </>
            )}
          </Abschnitt>

          <Abschnitt titel="Nachforderungen">
            {s.nachalarmiert + s.mitNachforderung === 0 ? (
              <p className="hinweis">In {zeitraum} sind keine Nachforderungen oder Nachalarmierungen erfasst.</p>
            ) : (
              <KpiRaster>
                <Kpi wert={fmtZahl(s.nachalarmiert)} label="Nachalarmiert" zusatz="zu einem laufenden Einsatz" />
                <Kpi wert={fmtZahl(s.mitNachforderung)} label="Einsätze mit Nachforderung" zusatz={`${s.vonMirNachgefordert} davon von dir`} />
              </KpiRaster>
            )}
          </Abschnitt>
        </>
      )}
    </Seite>
  );
}
