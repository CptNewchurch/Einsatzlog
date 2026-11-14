import { dienstSaldo, berechneDienstZeiten } from '../domain/zeiten';
import { sollText, weichtAb } from '../domain/dienst';
import { fmtDauer, fmtSaldo, fmtZeit, minutenZwischen } from '../domain/time';
import { bereichVon } from '../domain/types';
import { navigate } from '../router';
import { katalogName, useDaten } from '../state/daten';
import { Abschnitt, Knopf, Leer, Meldung } from '../ui/controls';
import { DienstBand, BandLegende } from '../ui/band';
import { datumLang } from '../ui/dienstzeile';
import { EinsatzZeile } from '../ui/einsatzzeile';
import { Icon } from '../ui/icons';
import { Kpi, KpiRaster } from '../ui/kpi';
import { Seite } from '../ui/seite';

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
  const z = berechneDienstZeiten(dienst, einsaetze, daten.einst.wachzeitMitDienstRand);
  const rd = einsaetze.filter((e) => bereichVon(e.typ) === 'RD').length;
  const fw = einsaetze.length - rd;
  const saldo = dienst.zusatzdienst ? null : dienstSaldo(dienst);
  const anteil = z.dienstMin > 0 ? Math.round((z.einsatzMin / z.dienstMin) * 100) : 0;
  const jetzt = Date.now();
  const laeuft = dienst.beginn <= jetzt && jetzt < dienst.ende;
  const nachEnde = einsaetze.filter((e) => Math.max(e.status1, e.status2 ?? 0) > dienst.ende).length;

  const angaben: [string, string][] = [
    [dienst.zusatzdienst ? 'Stadt / Organisation' : 'Wache', katalogName(daten, dienst.wacheId)],
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
        <Knopf variante="primaer" voll onClick={() => navigate(`/einsatz/neu?dienst=${id}`)}>
          <Icon name="plus" groesse={20} /> Einsatz erfassen
        </Knopf>
      }
    >
      <section className="karte">
        <div className="karte__zeile">
          {dienst.zusatzdienst && <span className="marke">Zusatzdienst</span>}
          <span className="zahl karte__gross">
            {fmtZeit(dienst.beginn)}–{fmtZeit(dienst.ende)}
          </span>
          <span className="zahl karte__nebenher">{fmtDauer(minutenZwischen(dienst.beginn, dienst.ende))}</span>
        </div>
        {!dienst.zusatzdienst && weichtAb(dienst) && (
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
        {!dienst.zusatzdienst && (
          <Knopf variante="text" onClick={() => navigate(`/dienst/${id}/bearbeiten?zeiten=1`)}>
            {weichtAb(dienst) ? 'Zeiten ändern' : 'Früher abgelöst oder länger geblieben?'}
          </Knopf>
        )}
      </section>

      <Abschnitt titel="Verlauf">
        <DienstBand dienst={dienst} einsaetze={einsaetze} gross verlinkt beschriftung="Verlauf des Dienstes" jetzt={laeuft ? jetzt : undefined} />
        <BandLegende jetzt={laeuft} />
      </Abschnitt>

      <KpiRaster>
        <Kpi wert={einsaetze.length} label={einsaetze.length === 1 ? 'Einsatz' : 'Einsätze'} zusatz={einsaetze.length > 0 ? `RD ${rd} · FW ${fw}` : undefined} />
        <Kpi wert={fmtDauer(z.einsatzMin)} label="Im Einsatz" zusatz={`${anteil} % des Dienstes`} />
        <Kpi wert={fmtDauer(z.wacheMin)} label="Auf Wache" zusatz={z.mitStatus2 < einsaetze.length ? 'unvollständig' : undefined} />
      </KpiRaster>

      {z.ohneStatus2 > 0 && (
        <Meldung art="info">
          {z.ohneStatus2 === 1 ? 'Bei einem Einsatz fehlt' : `Bei ${z.ohneStatus2} Einsätzen fehlt`} Status 2. Die Wachzeit danach ist daher nicht enthalten.
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
            !dienst.zusatzdienst ? (
              <Knopf variante="text" onClick={() => navigate(`/dienst/${id}/bearbeiten?zeiten=1`)}>
                Ende anpassen
              </Knopf>
            ) : undefined
          }
        >
          {nachEnde === 1 ? 'Ein Einsatz endet' : `${nachEnde} Einsätze enden`} nach dem Dienstende.
        </Meldung>
      )}

      <Abschnitt titel={einsaetze.length > 0 ? `Einsätze (${einsaetze.length})` : 'Einsätze'}>
        {einsaetze.length === 0 ? (
          <Leer titel="Noch keine Einsätze" text="Erfasse die Einsätze dieses Dienstes gleich oder später gesammelt." />
        ) : (
          <div className="liste">
            {einsaetze.map((e) => (
              <EinsatzZeile key={e.id} einsatz={e} />
            ))}
          </div>
        )}
      </Abschnitt>
    </Seite>
  );
}
