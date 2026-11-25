import { dienstSaldo, berechneDienstZeiten } from '../domain/zeiten';
import { sollText, weichtAb } from '../domain/dienst';
import { fmtDauer, fmtSaldo, fmtZeit, minutenZwischen } from '../domain/time';
import { bereichVon, hatPlan, type Einsatz, type Uebung } from '../domain/types';
import { navigate } from '../router';
import { katalogName, useDaten } from '../state/daten';
import { Abschnitt, Knopf, Leer, Meldung } from '../ui/controls';
import { DienstBand, BandLegende } from '../ui/band';
import { datumLang } from '../ui/dienstzeile';
import { EinsatzZeile } from '../ui/einsatzzeile';
import { Icon } from '../ui/icons';
import { Kpi, KpiRaster } from '../ui/kpi';
import { Seite } from '../ui/seite';
import { UebungZeile } from '../ui/uebungzeile';

type Eintrag = { art: 'einsatz'; zeit: number; einsatz: Einsatz } | { art: 'uebung'; zeit: number; uebung: Uebung };

export function DienstDetail({ id }: { id: number }) {
  const daten = useDaten();
  const dienst = daten.dienstMap.get(id);
  if (!dienst) {
    return (
      <Seite titel="Dienst" zurueckZu="/">
        <Leer titel="Dienst nicht gefunden" text="Dieser Dienst existiert nicht mehr." aktion={<Knopf onClick={() => navigate('/')}>Zur Dienstliste</Knopf>} />
      </Seite>
    );
  }

  const einsaetze = daten.einsaetzeNachDienst.get(id) ?? [];
  const uebungen = daten.uebungenNachDienst.get(id) ?? [];
  const z = berechneDienstZeiten(dienst, einsaetze, daten.einst.wachzeitMitDienstRand, uebungen);
  const rd = einsaetze.filter((e) => bereichVon(e.typ) === 'RD').length;
  const fw = einsaetze.length - rd;
  const plan = hatPlan(dienst);
  const uebungsdienst = !!dienst.uebungsdienst;
  const saldo = plan ? dienstSaldo(dienst) : null;
  const erfasstMin = uebungen.reduce((s, u) => s + minutenZwischen(u.beginn, u.ende), 0);
  const eintraege: Eintrag[] = [
    ...einsaetze.map((e): Eintrag => ({ art: 'einsatz', zeit: e.alarm, einsatz: e })),
    ...uebungen.map((u): Eintrag => ({ art: 'uebung', zeit: u.beginn, uebung: u })),
  ].sort((a, b) => a.zeit - b.zeit);
  const anteil = z.dienstMin > 0 ? Math.round((z.einsatzMin / z.dienstMin) * 100) : 0;
  const uebungAnteil = z.dienstMin > 0 ? Math.round((z.uebungMin / z.dienstMin) * 100) : 0;
  const jetzt = Date.now();
  const laeuft = dienst.beginn <= jetzt && jetzt < dienst.ende;
  const nachEnde =
    einsaetze.filter((e) => Math.max(e.status1, e.status2 ?? 0) > dienst.ende).length +
    uebungen.filter((u) => u.ende > dienst.ende).length;

  const angaben: [string, string][] = [
    [uebungsdienst ? 'Ort / Organisation' : dienst.zusatzdienst ? 'Stadt / Organisation' : 'Wache', katalogName(daten, dienst.wacheId)],
    ['Fahrzeug', katalogName(daten, dienst.fahrzeugId)],
    [dienst.zusatzdienst ? 'Funktion' : 'Rolle', katalogName(daten, dienst.rolleId)],
  ];
  const sichtbar = angaben.filter(([, w]) => w);

  return (
    <Seite
      titel={datumLang(dienst.beginn)}
      zurueckZu="/"
      aktionen={
        <button type="button" className="icon-knopf" aria-label="Dienst bearbeiten" onClick={() => navigate(`/dienst/${id}/bearbeiten`)}>
          <Icon name="stift" />
        </button>
      }
      fuss={
        <div className="knopfreihe knopfreihe--fuss">
          {uebungsdienst ? (
            <>
              <Knopf onClick={() => navigate(`/einsatz/neu?dienst=${id}`)}>Einsatz</Knopf>
              <Knopf variante="primaer" onClick={() => navigate(`/uebung/neu?dienst=${id}`)}>
                <Icon name="plus" groesse={20} /> Übung erfassen
              </Knopf>
            </>
          ) : (
            <>
              <Knopf onClick={() => navigate(`/uebung/neu?dienst=${id}`)}>Übung</Knopf>
              <Knopf variante="primaer" onClick={() => navigate(`/einsatz/neu?dienst=${id}`)}>
                <Icon name="plus" groesse={20} /> Einsatz erfassen
              </Knopf>
            </>
          )}
        </div>
      }
    >
      <section className="karte">
        <div className="karte__zeile">
          {dienst.zusatzdienst && <span className="marke">Zusatzdienst</span>}
          {uebungsdienst && <span className="marke marke--ue">Übungsdienst</span>}
          <span className="zahl karte__gross">
            {fmtZeit(dienst.beginn)}–{fmtZeit(dienst.ende)}
          </span>
          <span className="zahl karte__nebenher">{fmtDauer(minutenZwischen(dienst.beginn, dienst.ende))}</span>
        </div>
        {plan && weichtAb(dienst) && (
          <p className="hinweis zahl">
            Plan {sollText(dienst)}
            {saldo && saldo.saldoMin !== 0 && (
              <>
                {' · '}
                <strong className={saldo.saldoMin < 0 ? 'text-minus' : 'text-plus'}>
                  {saldo.saldoMin > 0 ? 'Überstunden' : 'Minusstunden'} {fmtSaldo(saldo.saldoMin)}
                </strong>
              </>
            )}
          </p>
        )}
        {sichtbar.length > 0 && (
          <dl className="angaben">
            {sichtbar.map(([k, w]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{w}</dd>
              </div>
            ))}
          </dl>
        )}
        {dienst.notiz && <p className="karte__notiz">{dienst.notiz}</p>}
        {plan && (
          <Knopf variante="text" onClick={() => navigate(`/dienst/${id}/bearbeiten?zeiten=1`)}>
            {weichtAb(dienst) ? 'Zeiten ändern' : 'Früher abgelöst oder länger geblieben?'}
          </Knopf>
        )}
      </section>

      <Abschnitt titel="Verlauf">
        <DienstBand dienst={dienst} einsaetze={einsaetze} uebungen={uebungen} gross verlinkt beschriftung="Verlauf des Dienstes" jetzt={laeuft ? jetzt : undefined} />
        <BandLegende jetzt={laeuft} uebung={uebungen.length > 0} uebungsdienst={uebungsdienst} />
      </Abschnitt>

      <KpiRaster>
        {uebungsdienst && (
          <>
            <Kpi ton="ue" wert={fmtDauer(z.uebungMin)} label="Übungszeit" zusatz={`${uebungAnteil} % des Dienstes`} />
            <Kpi
              ton="ue"
              wert={uebungen.length}
              label={uebungen.length === 1 ? 'Übung' : 'Übungen'}
              zusatz={uebungen.length > 0 ? `davon ${fmtDauer(erfasstMin)} erfasst` : 'noch keine erfasst'}
            />
          </>
        )}
        {(!uebungsdienst || einsaetze.length > 0) && (
          <>
            <Kpi wert={einsaetze.length} label={einsaetze.length === 1 ? 'Einsatz' : 'Einsätze'} zusatz={einsaetze.length > 0 ? `RD ${rd} · FW ${fw}` : undefined} />
            <Kpi wert={fmtDauer(z.einsatzMin)} label="Im Einsatz" zusatz={`${anteil} % des Dienstes`} />
          </>
        )}
        {!uebungsdienst && <Kpi wert={fmtDauer(z.wacheMin)} label="Auf Wache" zusatz={z.mitStatus2 + z.ausStatus1 < einsaetze.length ? 'unvollständig' : undefined} />}
        {!uebungsdienst && uebungen.length > 0 && (
          <Kpi ton="ue" wert={fmtDauer(z.uebungMin)} label="Übung" zusatz={`${uebungen.length} ${uebungen.length === 1 ? 'Übung' : 'Übungen'}, nicht auf Wache`} />
        )}
      </KpiRaster>

      {z.ohneStatus2 > 0 && (
        <Meldung art="info">
          {z.ohneStatus2 === 1 ? 'Bei einem Einsatz fehlt' : `Bei ${z.ohneStatus2} Einsätzen fehlt`} Status 2. Die Wachzeit danach ist daher nicht enthalten.
        </Meldung>
      )}
      {z.ausStatus1 > 0 && (
        <Meldung art="info">
          {z.ausStatus1 === 1 ? 'Nach einem Einsatz' : `Nach ${z.ausStatus1} Einsätzen`} wurdest du aus Status 1 heraus neu alarmiert. Die Zeit bis dahin zählt als Rückfahrt, Wachzeit gibt es dort nicht.
        </Meldung>
      )}
      {z.ueberlappungen > 0 && (
        <Meldung art="warnung">
          {z.ueberlappungen === 1 ? 'Ein Einsatz beginnt' : `${z.ueberlappungen} Einsätze beginnen`} vor dem Ende des vorherigen. Prüfe die Zeiten.
        </Meldung>
      )}
      {nachEnde > 0 && (
        <Meldung
          art="warnung"
          aktion={
            plan ? (
              <Knopf variante="text" onClick={() => navigate(`/dienst/${id}/bearbeiten?zeiten=1`)}>
                Ende anpassen
              </Knopf>
            ) : undefined
          }
        >
          {nachEnde === 1 ? 'Ein Eintrag endet' : `${nachEnde} Einträge enden`} nach dem Dienstende.
        </Meldung>
      )}

      {uebungsdienst && uebungen.length === 0 && (
        <Meldung
          art="info"
          aktion={
            <Knopf variante="text" onClick={() => navigate(`/uebung/neu?dienst=${id}`)}>
              Übung erfassen
            </Knopf>
          }
        >
          Noch keine Übung erfasst. Die ganze Dienstzeit zählt als Übung, in der Auswertung aber ohne Art.
        </Meldung>
      )}

      <Abschnitt
        titel={
          eintraege.length > 0
            ? `${uebungen.length > 0 ? 'Einsätze und Übungen' : 'Einsätze'} (${eintraege.length})`
            : uebungsdienst
              ? 'Übungen'
              : 'Einsätze und Übungen'
        }
      >
        {eintraege.length === 0 ? (
          <Leer
            titel={uebungsdienst ? 'Noch keine Übungen' : 'Noch keine Einsätze'}
            text={
              uebungsdienst
                ? 'Erfasse, was ihr in diesem Dienst geübt habt, zum Beispiel Atemschutz oder Reanimation.'
                : 'Erfasse die Einsätze und Übungen dieses Dienstes gleich oder später gesammelt.'
            }
          />
        ) : (
          <div className="liste">
            {eintraege.map((x) =>
              x.art === 'einsatz' ? <EinsatzZeile key={`e${x.einsatz.id}`} einsatz={x.einsatz} /> : <UebungZeile key={`u${x.uebung.id}`} uebung={x.uebung} />,
            )}
          </div>
        )}
      </Abschnitt>
    </Seite>
  );
}
