import { NACA_GRUPPE_INFO, NACA_INFO, NACA_LEICHT_MAX, NACA_NOTARZT_AB } from '../domain/triage';
import { transportZahlen, type TriageStatistik } from '../domain/triageStats';
import { fmtZahl } from '../domain/time';
import { AUSGANG_INFO, BEWERTUNG_INFO, BEWERTUNGEN, type Ausgang } from '../domain/types';
import { Balken, ChartKarte } from '../ui/charts';
import { Abschnitt } from '../ui/controls';
import { Kpi, KpiRaster } from '../ui/kpi';
import { prozent } from '../ui/zahlen';

const MAX_DIAGNOSEN = 8;
const MAX_ABWEICHUNGEN = 10;
const roemisch = (wert: number) => NACA_INFO[wert - 1].roemisch;
const anteil = (n: number, gesamt: number) => `${prozent(n, gesamt)} (${fmtZahl(n)} von ${fmtZahl(gesamt)})`;

interface Props {
  t: TriageStatistik;
  zeitraum: string;
}

/** Ergebnis, Schweregrad, Alarmierung und Diagnosen – wie gut Stichwort und Befund zusammenpassten. */
export function TriageAbschnitte({ t, zeitraum }: Props) {
  if (t.rd + t.fw === 0) return null;
  return (
    <>
      <ErgebnisAbschnitt t={t} zeitraum={zeitraum} />
      {t.rd > 0 && (
        <>
          <NacaAbschnitt t={t} zeitraum={zeitraum} />
          <AlarmierungAbschnitt t={t} />
          <DiagnosenAbschnitt t={t} zeitraum={zeitraum} />
        </>
      )}
    </>
  );
}

function ErgebnisAbschnitt({ t, zeitraum }: Props) {
  const anzahl = (a: Ausgang) => t.ergebnis.find((e) => e.ausgang === a)?.n ?? 0;
  const fehleinsaetze = t.fehleinsaetzeRd + t.fehleinsaetzeFw;
  const ohneNotfall = anzahl('transportdienst') + anzahl('hilfeleistung');
  // Transporte insgesamt, auch die mit und ohne NA; „Ambulant versorgt“ bleibt davon getrennt.
  const { gesamt: transporte, mitNa, ohneNa } = transportZahlen(t.ergebnis);
  const alle = t.rd + t.fw;

  if (t.rd === 0) {
    return (
      <Abschnitt titel="Fehleinsätze">
        <KpiRaster>
          <Kpi wert={fmtZahl(fehleinsaetze)} label="Fehleinsätze" ton="fw" zusatz={`${prozent(fehleinsaetze, alle)} der Einsätze`} />
        </KpiRaster>
      </Abschnitt>
    );
  }

  const zeilen = t.ergebnis
    .filter((e) => e.n > 0)
    .map((e) => ({
      label: e.ausgang ? AUSGANG_INFO[e.ausgang].kurz : 'Nicht erfasst',
      wert: e.n,
      ton: e.ausgang ? ('rd' as const) : ('neutral' as const),
      zusatz: `(${prozent(e.n, t.rd)})`,
    }));
  // Die Reihenfolge der Auswahl im Formular beibehalten, „Nicht erfasst“ zuletzt.
  const reihenfolge = (l: string) => (l === 'Nicht erfasst' ? 99 : Object.values(AUSGANG_INFO).findIndex((i) => i.kurz === l));
  zeilen.sort((a, b) => reihenfolge(a.label) - reihenfolge(b.label));

  return (
    <Abschnitt titel="Ergebnis der Einsätze">
      {t.ergebnisErfasst === 0 ? (
        <p className="hinweis">
          In {zeitraum} ist noch bei keinem Rettungsdiensteinsatz ein Ergebnis erfasst. Du trägst es im Einsatz unter „Ergebnis und Befund“ ein: Transport, ambulant versorgt, Fehleinsatz und mehr.
        </p>
      ) : (
        <>
          <KpiRaster>
            <Kpi
              wert={fmtZahl(transporte)}
              label="Transport"
              ton="rd"
              zusatz={
                <>
                  {prozent(transporte, t.ergebnisErfasst)} der erfassten
                  {mitNa + ohneNa > 0 && (
                    <>
                      <br />
                      davon {fmtZahl(mitNa)}&nbsp;mit&nbsp;NA, {fmtZahl(ohneNa)}&nbsp;ohne&nbsp;NA
                    </>
                  )}
                </>
              }
            />
            <Kpi wert={fmtZahl(anzahl('ambulant'))} label="Ambulant versorgt" ton="rd" zusatz={`${prozent(anzahl('ambulant'), t.ergebnisErfasst)} der erfassten`} />
            <Kpi wert={fmtZahl(ohneNotfall)} label="Ohne Notfall" ton="rd" zusatz="Nur Transport oder Hilfeleistung" />
            <Kpi wert={fmtZahl(fehleinsaetze)} label="Fehleinsätze" zusatz={`${prozent(fehleinsaetze, alle)} der Einsätze`} />
          </KpiRaster>
          <ChartKarte
            titel="Ergebnis im Rettungsdienst"
            untertitel={`${fmtZahl(t.ergebnisErfasst)} von ${fmtZahl(t.rd)} Einsätzen mit Ergebnis`}
            tabelle={{
              kopf: ['Ergebnis', 'Anzahl', 'Anteil'],
              zeilen: zeilen.map((z) => [z.label, z.wert, prozent(z.wert, t.rd)]),
            }}
          >
            <Balken zeilen={zeilen} />
          </ChartKarte>
        </>
      )}
    </Abschnitt>
  );
}

function NacaAbschnitt({ t, zeitraum }: Props) {
  const zeilen = t.naca.map((n) => ({
    label: `NACA ${n.roemisch}`,
    wert: n.n,
    ton: 'rd' as const,
    zusatz: `(${prozent(n.n, t.nacaErfasst)})`,
  }));
  return (
    <Abschnitt titel="Schweregrad (NACA)">
      {t.nacaErfasst === 0 ? (
        <p className="hinweis">
          In {zeitraum} ist noch kein NACA-Wert erfasst. Du wählst ihn im Einsatz unter „Ergebnis und Befund“. Die App ordnet ihn automatisch in leicht, mäßig, schwer oder kritisch ein.
        </p>
      ) : (
        <>
          <ChartKarte
            titel="NACA-Verteilung"
            untertitel={`${fmtZahl(t.nacaErfasst)} von ${fmtZahl(t.rd)} Einsätzen mit NACA`}
            tabelle={{
              kopf: ['NACA', 'Anzahl', 'Anteil'],
              zeilen: t.naca.map((n) => [n.roemisch, n.n, prozent(n.n, t.nacaErfasst)]),
            }}
          >
            <Balken zeilen={zeilen} />
          </ChartKarte>

          <div className="tabelle-huelle">
            <table className="tabelle tabelle--triage">
              <caption className="tabelle__titel">Schweregrad nach Alarmtyp</caption>
              <thead>
                <tr>
                  <th scope="col">Schweregrad</th>
                  <th scope="col" className="zahl" title="Stichwort R: primär für den RTW">RTW</th>
                  <th scope="col" className="zahl" title="Stichwort N: primär für oder mit dem Notarzt">Notarzt</th>
                  <th scope="col" className="zahl">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {t.nacaGruppen.map((g) => (
                  <tr key={g.gruppe}>
                    <th scope="row">
                      {NACA_GRUPPE_INFO[g.gruppe].kurz} <span className="tabelle__neben">{NACA_GRUPPE_INFO[g.gruppe].bereich}</span>
                    </th>
                    <td className="zahl">{g.r || '–'}</td>
                    <td className="zahl">{g.n || '–'}</td>
                    <td className="zahl">{g.r + g.n || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hinweis">RTW = Stichwort R, Notarzt = Stichwort N. Gruppen nach NACA: leicht I–II, mäßig III, schwer IV–V, kritisch VI–VII.</p>
        </>
      )}
    </Abschnitt>
  );
}

function AlarmierungAbschnitt({ t }: { t: TriageStatistik }) {
  const { notarztBeiLeicht: nl, rtwBeiSchwer: rs } = t;
  const bereichLeicht = `NACA I–${roemisch(NACA_LEICHT_MAX)}`;
  const bereichSchwer = `NACA ${roemisch(NACA_NOTARZT_AB)}–VII`;
  const abw = t.abweichungen.slice(0, MAX_ABWEICHUNGEN);
  const hatAngaben = t.bewertet > 0 || nl.von > 0 || rs.von > 0 || t.vergleichbar > 0;

  return (
    <Abschnitt titel="Alarmierung und Befund">
      {!hatAngaben ? (
        <p className="hinweis">
          Hier erscheint, wie oft das Stichwort der Leitstelle zum Befund passte. Du bewertest die Alarmierung im Einsatz unter „Alarmierung bewerten“, dort hältst du auch den Verdacht der Leitstelle fest. „Nur Transport“ und „Hilfeleistung“ zählen von selbst als zu hoch.
        </p>
      ) : (
        <>
          {t.bewertet > 0 && (
            <>
              <KpiRaster>
                <Kpi wert={fmtZahl(t.bewertung.hoch)} label="Zu hoch alarmiert" ton="rd" zusatz={`${prozent(t.bewertung.hoch, t.bewertet)} der bewerteten`} />
                <Kpi wert={fmtZahl(t.bewertung.passend)} label="Passend" ton="rd" zusatz={`${prozent(t.bewertung.passend, t.bewertet)} der bewerteten`} />
                <Kpi wert={fmtZahl(t.bewertung.niedrig)} label="Zu niedrig alarmiert" ton="rd" zusatz={`${prozent(t.bewertung.niedrig, t.bewertet)} der bewerteten`} />
                <Kpi wert={fmtZahl(t.bewertet)} label="Bewertet" zusatz={`von ${fmtZahl(t.rd)} Einsätzen`} />
              </KpiRaster>
              <ChartKarte
                titel="Bewertung der Alarmierung"
                untertitel={`${fmtZahl(t.bewertet)} bewertete Einsätze`}
                tabelle={{
                  kopf: ['Bewertung', 'Anzahl', 'Anteil'],
                  zeilen: BEWERTUNGEN.map((b) => [BEWERTUNG_INFO[b].kurz, t.bewertung[b], prozent(t.bewertung[b], t.bewertet)]),
                }}
              >
                <Balken
                  zeilen={BEWERTUNGEN.map((b) => ({
                    label: BEWERTUNG_INFO[b].kurz,
                    wert: t.bewertung[b],
                    ton: 'rd' as const,
                    zusatz: `(${prozent(t.bewertung[b], t.bewertet)})`,
                  }))}
                />
              </ChartKarte>
            </>
          )}

          {(nl.von > 0 || rs.von > 0) && (
            <>
              <KpiRaster>
                {nl.von > 0 && <Kpi wert={fmtZahl(nl.n)} label="Notarztalarm, leicht erkrankt" ton="rd" zusatz={`${bereichLeicht}: ${anteil(nl.n, nl.von)}`} />}
                {rs.von > 0 && <Kpi wert={fmtZahl(rs.n)} label="RTW-Alarm, schwer erkrankt" ton="rd" zusatz={`${bereichSchwer}: ${anteil(rs.n, rs.von)}`} />}
              </KpiRaster>
              <p className="hinweis">Gerechnet wird aus dem NACA-Wert, ohne dass du etwas bewerten musst. Anteil an allen Notarzt- bzw. RTW-Stichworten mit NACA.</p>
            </>
          )}

          {t.vergleichbar > 0 ? (
            <div>
              <h3 className="tabelle__titel">Leitstelle und Befund</h3>
              {abw.length === 0 ? (
                <p className="hinweis">Keine Abweichung: Verdacht der Leitstelle und Befund stimmten überein.</p>
              ) : (
                <ul className="abweichungen">
                  {abw.map((a) => (
                    <li key={`${a.leitstelleId}-${a.diagnoseId}`} className="abweichung">
                      <dl className="abweichung__paar">
                        <div>
                          <dt>Leitstelle</dt>
                          <dd>{a.leitstelle}</dd>
                        </div>
                        <div>
                          <dt>Vor Ort</dt>
                          <dd>{a.diagnose}</dd>
                        </div>
                      </dl>
                      <span className="abweichung__n zahl" aria-label={`${a.n} mal`}>
                        {a.n}×
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="hinweis">
                Bei {fmtZahl(t.vergleichbar)} {t.vergleichbar === 1 ? 'Einsatz' : 'Einsätzen'} sind Verdacht der Leitstelle und Diagnose vor Ort erfasst. {fmtZahl(t.abweichend)} davon weichen voneinander ab
                {t.abweichungen.length > abw.length ? `, die ${abw.length} häufigsten Paare siehst du hier` : ''}.
              </p>
            </div>
          ) : (
            <p className="hinweis">Halte im Einsatz unter „Alarmierung bewerten“ fest, was die Leitstelle vermutet hat. Dann siehst du hier, wo Verdacht und Befund auseinanderlagen.</p>
          )}
        </>
      )}
    </Abschnitt>
  );
}

function DiagnosenAbschnitt({ t, zeitraum }: Props) {
  return (
    <Abschnitt titel="Verdachtsdiagnosen">
      {t.diagnosenErfasst === 0 ? (
        <p className="hinweis">In {zeitraum} ist noch keine Verdachtsdiagnose erfasst. Du wählst sie im Einsatz unter „Ergebnis und Befund“, die Liste wächst mit.</p>
      ) : (
        <ChartKarte
          titel="Häufigste Verdachtsdiagnosen"
          untertitel={
            t.diagnosen.length > MAX_DIAGNOSEN
              ? `Die ${MAX_DIAGNOSEN} häufigsten von ${t.diagnosen.length} · ${fmtZahl(t.diagnosenErfasst)} von ${fmtZahl(t.rd)} Einsätzen`
              : `${fmtZahl(t.diagnosenErfasst)} von ${fmtZahl(t.rd)} Einsätzen mit Diagnose`
          }
          tabelle={{
            kopf: ['Diagnose', 'Anzahl', 'Anteil'],
            zeilen: t.diagnosen.slice(0, 60).map((d) => [d.name, d.n, prozent(d.n, t.diagnosenErfasst)]),
          }}
        >
          <Balken
            zeilen={t.diagnosen.slice(0, MAX_DIAGNOSEN).map((d) => ({
              label: d.name,
              wert: d.n,
              ton: 'rd' as const,
            }))}
          />
        </ChartKarte>
      )}
    </Abschnitt>
  );
}

