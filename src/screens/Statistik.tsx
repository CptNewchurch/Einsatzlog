import { useMemo, useState } from 'react';
import {
  berechneMassnahmen,
  berechneStatistik,
  verfuegbareJahre,
  waehleEinsaetze,
  type MassnahmenZeile,
  type StatFilter,
} from '../domain/stats';
import { berechneTriage } from '../domain/triageStats';
import { stichwortText, TYP_INFO } from '../domain/stichwort';
import { fmtDauer, fmtSaldo, fmtStunden, fmtZahl } from '../domain/time';
import { bereichVon, DURCHFUEHRUNG_INFO, type MassnahmeArt } from '../domain/types';
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

export function Statistik() {
  const daten = useDaten();
  const { dienste, einsaetze, einst, katalogMap } = daten;

  const jahre = useMemo(() => verfuegbareJahre(dienste, einsaetze), [dienste, einsaetze]);
  const hatZusatz = useMemo(() => dienste.some((d) => d.zusatzdienst), [dienste]);

  const [jahrRoh, setJahrRoh] = useState<number | null | undefined>(gemerkt.jahr);
  const [bereich, setBereichRoh] = useState<StatFilter['bereich']>(gemerkt.bereich);
  const [dienstartRoh, setDienstartRoh] = useState<StatFilter['dienstart']>(gemerkt.dienstart);

  const aktuell = new Date().getFullYear();
  const standardJahr = jahre.includes(aktuell) ? aktuell : (jahre[0] ?? null);
  const jahr = jahrRoh === undefined ? standardJahr : jahrRoh === null || jahre.includes(jahrRoh) ? jahrRoh : null;
  const dienstart = hatZusatz ? dienstartRoh : 'alle';

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
    () => berechneStatistik(dienste, einsaetze, filter, einst.wachzeitMitDienstRand),
    [dienste, einsaetze, filter, einst.wachzeitMitDienstRand],
  );
  const gewaehlt = useMemo(() => waehleEinsaetze(dienste, einsaetze, filter), [dienste, einsaetze, filter]);
  const massn = useMemo(() => berechneMassnahmen(gewaehlt, katalogMap), [gewaehlt, katalogMap]);
  const triage = useMemo(() => berechneTriage(gewaehlt, katalogMap), [gewaehlt, katalogMap]);

  if (dienste.length === 0 && einsaetze.length === 0) {
    return (
      <Seite titel="Statistik">
        <Leer
          titel="Noch nichts auszuwerten"
          text="Sobald du Dienste und Einsätze erfasst hast, siehst du hier Zahlen, Zeiten, Maßnahmen und Überstunden."
          aktion={<Knopf variante="primaer" onClick={() => navigate('/dienst/neu')}>Dienst anlegen</Knopf>}
        />
      </Seite>
    );
  }

  const zeitraum = jahr == null ? 'Gesamt' : String(jahr);
  const leer = s.anzahl === 0 && s.dienste === 0;
  const z = s.zeiten;
  const zugeordnetMin = z.einsatzMin + z.rueckfahrtMin + z.wacheMin;
  const offenMin = Math.max(0, z.dienstMin - zugeordnetMin);
  const zeitSumme = Math.max(z.dienstMin, zugeordnetMin);
  const stichwortName = (typ: Parameters<typeof stichwortText>[0], kategorieId: number) =>
    stichwortText(typ, katalogName(daten, kategorieId));
  const regelDienste = dienstart !== 'zusatz';
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
        {hatZusatz && (
          <Segment<StatFilter['dienstart']>
            label="Dienstart"
            klein
            wert={dienstart}
            onChange={setDienstart}
            optionen={[
              { wert: 'alle', label: 'Alle Dienste' },
              { wert: 'regel', label: 'Regeldienst' },
              { wert: 'zusatz', label: 'Zusatzdienste' },
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
                tabelle={{ kopf: ['Typ', 'Anzahl'], zeilen: s.typ.map((t) => [`${t.typ} ${TYP_INFO[t.typ].kurz}`, t.n]) }}
              >
                <Balken
                  zeilen={s.typ
                    .filter((t) => t.n > 0)
                    .map((t) => ({ label: `${t.typ} ${TYP_INFO[t.typ].kurz}`, wert: t.n, ton: bereichVon(t.typ) === 'RD' ? 'rd' : 'fw' }))}
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
                ...(offenMin > 0 ? [['Nicht zugeordnet', fmtDauer(offenMin), prozent(offenMin, zeitSumme)]] : []),
              ],
            }}
          >
            <ZeitBalken einsatzMin={z.einsatzMin} rueckfahrtMin={z.rueckfahrtMin} wacheMin={z.wacheMin} offenMin={offenMin} />
          </ChartKarte>
          {z.ohneStatus2 > 0 && (
            <Meldung art="warnung">
              Bei {z.ohneStatus2} {z.ohneStatus2 === 1 ? 'Einsatz fehlt' : 'Einsätzen fehlt'} Status 2. Dort fehlen Rückfahrt und die Wachzeit danach.
              In der Einsatzliste findest du sie mit dem Filter „Status 2 fehlt“.
            </Meldung>
          )}
          {z.ueberlappungen > 0 && (
            <Meldung art="info">
              {z.ueberlappungen} {z.ueberlappungen === 1 ? 'Einsatz überschneidet' : 'Einsätze überschneiden'} sich mit dem nächsten. Die Einsatzzeit wird dann doppelt gezählt.
            </Meldung>
          )}

          <Abschnitt titel="Über- und Minusstunden">
            {!regelDienste ? (
              <Meldung art="info">Zusatzdienste haben keinen Plan und zählen deshalb nicht zu den Über- und Minusstunden.</Meldung>
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

          {bereich !== 'RD' && s.feuerwehr.einsaetze > 0 && (
            <Abschnitt titel="Feuerwehr">
              <KpiRaster>
                <Kpi wert={fmtZahl(s.feuerwehr.einsaetze)} label="Feuerwehr-Einsätze" ton="fw" zusatz={`Median ${minText(s.medianFwMin)}`} />
                <Kpi wert={fmtZahl(s.feuerwehr.mig)} label="Menschenleben in Gefahr" ton="fw" zusatz={`${prozent(s.feuerwehr.mig, s.feuerwehr.einsaetze)} der Einsätze`} />
                <Kpi wert={fmtZahl(s.feuerwehr.atemschutz)} label="Atemschutzeinsätze" ton="fw" />
                <Kpi wert={fmtDauer(s.feuerwehr.atemschutzMin)} label="Unter Atemschutz" ton="fw" zusatz={s.feuerwehr.atemschutz > 0 ? `Ø ${fmtDauer(s.feuerwehr.atemschutzMin / s.feuerwehr.atemschutz)} je Einsatz` : undefined} />
              </KpiRaster>
            </Abschnitt>
          )}

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
