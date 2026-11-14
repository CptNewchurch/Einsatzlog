import { useMemo, useState } from 'react';
import { berechneStatistik } from '../domain/stats';
import { fmtSaldo } from '../domain/time';
import type { Dienst } from '../domain/types';
import { navigate } from '../router';
import { laufenderDienst, useDaten } from '../state/daten';
import { Abschnitt, Knopf, Leer, Meldung } from '../ui/controls';
import { DienstZeile } from '../ui/dienstzeile';
import { Icon } from '../ui/icons';
import { Kpi, KpiRaster } from '../ui/kpi';
import { Seite } from '../ui/seite';

const MONATE_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const SEITE = 30;

function backupHinweis(letztes: number | undefined, tage: number, hatDaten: boolean, jetzt: number): string | null {
  if (!hatDaten || tage <= 0) return null;
  if (letztes == null) return 'Du hast noch keine Sicherung gemacht. Sichere deine Daten auf dem Gerät oder in deiner Cloud.';
  const alt = Math.floor((jetzt - letztes) / 86_400_000);
  return alt >= tage ? `Die letzte Sicherung ist ${alt} Tage her.` : null;
}

export function Start() {
  const daten = useDaten();
  const { dienste, einsaetze, einst } = daten;
  const [anzahl, setAnzahl] = useState(SEITE);
  const jetzt = Date.now();
  const jahr = new Date(jetzt).getFullYear();

  const stat = useMemo(
    () => berechneStatistik(dienste, einsaetze, { jahr, bereich: 'alle', dienstart: 'alle' }, einst.wachzeitMitDienstRand),
    [dienste, einsaetze, jahr, einst.wachzeitMitDienstRand],
  );
  const laufend = laufenderDienst(daten, jetzt);
  const laufendId = laufend?.id;
  const hinweis = backupHinweis(einst.letztesBackup, einst.backupErinnerungTage, einsaetze.length > 0, jetzt);

  const gruppen = useMemo(() => {
    const liste: { schluessel: string; titel: string; dienste: Dienst[] }[] = [];
    dienste.slice(0, anzahl).forEach((d) => {
      if (d.id === laufendId) return; // läuft schon oben als eigene Karte
      const x = new Date(d.beginn);
      const schluessel = `${x.getFullYear()}-${x.getMonth()}`;
      const letzte = liste[liste.length - 1];
      if (letzte?.schluessel === schluessel) letzte.dienste.push(d);
      else liste.push({ schluessel, titel: `${MONATE_LANG[x.getMonth()]} ${x.getFullYear()}`, dienste: [d] });
    });
    return liste;
  }, [dienste, anzahl, laufendId]);

  if (dienste.length === 0) {
    return (
      <Seite titel="Einsatzlog">
        <Leer
          titel="Noch kein Dienst"
          text="Lege deinen ersten Dienst an, danach erfasst du die Einsätze darin. Alle Daten bleiben auf diesem Gerät."
          aktion={
            <div className="knopfstapel">
              <Knopf variante="primaer" voll onClick={() => navigate('/dienst/neu')}>
                <Icon name="plus" groesse={20} /> Dienst anlegen
              </Knopf>
              <Knopf voll onClick={() => navigate('/dienst/neu/zusatz')}>
                Zusatzdienst anlegen
              </Knopf>
            </div>
          }
        />
      </Seite>
    );
  }

  const saldo = stat.ueberstunden.saldoMin;

  return (
    <Seite titel="Einsatzlog">
      {hinweis && (
        <Meldung
          art="warnung"
          aktion={
            <Knopf variante="text" onClick={() => navigate('/mehr/backup')}>
              Sichern
            </Knopf>
          }
        >
          {hinweis}
        </Meldung>
      )}

      {laufend && (
        <Abschnitt titel="Läuft gerade">
          <DienstZeile dienst={laufend} />
        </Abschnitt>
      )}

      <div className="knopfstapel">
        <Knopf variante="primaer" voll onClick={() => navigate(laufend ? `/einsatz/neu?dienst=${laufend.id}` : '/einsatz/neu')}>
          <Icon name="plus" groesse={20} /> Einsatz erfassen
        </Knopf>
        <div className="knopfreihe">
          <Knopf onClick={() => navigate('/dienst/neu')}>Dienst anlegen</Knopf>
          <Knopf onClick={() => navigate('/dienst/neu/zusatz')}>Zusatzdienst</Knopf>
        </div>
      </div>

      <Abschnitt titel={`${jahr} bisher`}>
        <KpiRaster>
          <Kpi wert={stat.anzahl} label={stat.anzahl === 1 ? 'Einsatz' : 'Einsätze'} zusatz={stat.anzahl > 0 ? `RD ${stat.rd} · FW ${stat.fw}` : undefined} />
          <Kpi wert={stat.dienste} label={stat.dienste === 1 ? 'Dienst' : 'Dienste'} zusatz={stat.einsaetzeProDienst != null ? `Ø ${stat.einsaetzeProDienst.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Einsätze` : undefined} />
          <Kpi wert={<span className={saldo > 0 ? 'text-plus' : saldo < 0 ? 'text-minus' : undefined}>{fmtSaldo(saldo)}</span>} label="Über-/Minusstunden" zusatz={stat.ueberstunden.diensteMitPlus + stat.ueberstunden.diensteMitMinus > 0 ? 'Saldo' : undefined} />
        </KpiRaster>
      </Abschnitt>

      {gruppen.map((g) => (
        <section key={g.schluessel} className="monat">
          <h2 className="monat__titel">{g.titel}</h2>
          <div className="liste">
            {g.dienste.map((d) => (
              <DienstZeile key={d.id} dienst={d} />
            ))}
          </div>
        </section>
      ))}

      {dienste.length > anzahl && (
        <Knopf voll onClick={() => setAnzahl((a) => a + SEITE)}>
          Ältere Dienste anzeigen
        </Knopf>
      )}
      <p className="hinweis hinweis--mitte">Alle Daten liegen nur auf diesem Gerät.</p>
    </Seite>
  );
}
