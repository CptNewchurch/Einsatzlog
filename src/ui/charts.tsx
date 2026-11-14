import { useState, type ReactNode } from 'react';
import { fmtDauer, fmtSaldo, fmtZahl } from '../domain/time';
import type { BereichsWert } from '../domain/stats';

/* ---------- Karte mit Diagramm und Tabellenansicht ---------- */

interface Tabelle {
  kopf: string[];
  zeilen: (string | number)[][];
}

export function ChartKarte({
  titel,
  untertitel,
  tabelle,
  children,
}: {
  titel: string;
  untertitel?: string;
  tabelle: Tabelle;
  children: ReactNode;
}) {
  const [alsTabelle, setAlsTabelle] = useState(false);
  return (
    <section className="chartkarte">
      <div className="chartkarte__kopf">
        <div>
          <h2 className="abschnitt__titel">{titel}</h2>
          {untertitel && <div className="hinweis">{untertitel}</div>}
        </div>
        <button
          type="button"
          className="textknopf"
          aria-pressed={alsTabelle}
          onClick={() => setAlsTabelle((a) => !a)}
        >
          {alsTabelle ? 'Diagramm' : 'Tabelle'}
        </button>
      </div>
      {alsTabelle ? (
        <div className="tabelle-huelle">
          <table className="tabelle">
            <caption className="sr-only">{titel}</caption>
            <thead>
              <tr>
                {tabelle.kopf.map((k, i) => (
                  <th key={k} scope="col" className={i > 0 ? 'zahl' : undefined}>
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabelle.zeilen.map((z, i) => (
                <tr key={i}>
                  {z.map((c, j) => (
                    <td key={j} className={j > 0 ? 'zahl' : undefined}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export function FarbLegende({ nur }: { nur?: 'rd' | 'fw' }) {
  return (
    <ul className="legende" aria-label="Legende">
      {nur !== 'fw' && (
        <li>
          <span className="legende__farbe legende__farbe--rd" /> Rettungsdienst
        </li>
      )}
      {nur !== 'rd' && (
        <li>
          <span className="legende__farbe legende__farbe--fw" /> Feuerwehr
        </li>
      )}
    </ul>
  );
}

/* ---------- Gestapelte Säulen (Rettungsdienst unten, Feuerwehr oben) ---------- */

const NETTE_MAXIMA = [4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100, 120, 160, 200, 250, 300, 400, 500, 600, 800, 1000];

export function niceMax(v: number): number {
  return NETTE_MAXIMA.find((m) => m >= v) ?? Math.ceil(v / 1000) * 1000;
}

interface SaeulenProps {
  daten: BereichsWert[];
  /** Kurzbeschriftung unter der Säule; leer = keine. */
  achse: (d: BereichsWert, i: number) => string;
  /** Ausführliche Beschriftung für die Anzeige beim Antippen. */
  lang?: (d: BereichsWert) => string;
}

export function Saeulen({ daten, achse, lang }: SaeulenProps) {
  const [aktiv, setAktiv] = useState<number | null>(null);
  const summen = daten.map((d) => d.rd + d.fw);
  const max = niceMax(Math.max(0, ...summen));
  const gewaehlt = aktiv != null ? daten[aktiv] : null;

  return (
    <div className="saeulen">
      <div className="saeulen__plot">
        <div className="saeulen__gitter" aria-hidden="true">
          <span style={{ bottom: '100%' }}>{max}</span>
          <span style={{ bottom: '50%' }}>{max / 2}</span>
          <span style={{ bottom: '0%' }}>0</span>
        </div>
        <div className="saeulen__spalten" style={{ gridTemplateColumns: `repeat(${daten.length}, minmax(0, 1fr))` }}>
          {daten.map((d, i) => {
            const summe = d.rd + d.fw;
            return (
              <button
                key={d.label}
                type="button"
                className="saeulen__spalte"
                aria-pressed={aktiv === i}
                aria-label={`${lang ? lang(d) : d.label}: ${summe} Einsätze, davon ${d.rd} Rettungsdienst und ${d.fw} Feuerwehr`}
                onClick={() => setAktiv(aktiv === i ? null : i)}
              >
                {summe > 0 && (
                  <span className="saeulen__stapel" style={{ height: `${(summe / max) * 100}%` }}>
                    {d.fw > 0 && <span className="saeulen__seg saeulen__seg--fw" style={{ flexGrow: d.fw }} />}
                    {d.rd > 0 && <span className="saeulen__seg saeulen__seg--rd" style={{ flexGrow: d.rd }} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="saeulen__achse" style={{ gridTemplateColumns: `repeat(${daten.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {daten.map((d, i) => (
          <span key={d.label}>{achse(d, i)}</span>
        ))}
      </div>
      <p className="saeulen__anzeige" aria-live="polite">
        {gewaehlt ? (
          <>
            <strong>{lang ? lang(gewaehlt) : gewaehlt.label}</strong>
            {': '}
            <span className="zahl">{gewaehlt.rd + gewaehlt.fw}</span> Einsätze · Rettungsdienst{' '}
            <span className="zahl">{gewaehlt.rd}</span> · Feuerwehr <span className="zahl">{gewaehlt.fw}</span>
          </>
        ) : (
          'Tippe auf eine Säule für die Zahlen.'
        )}
      </p>
    </div>
  );
}

/* ---------- Horizontale Balken ---------- */

export interface BalkenZeile {
  label: string;
  wert: number;
  ton: 'rd' | 'fw' | 'ue' | 'neutral';
  zusatz?: string;
  /** Anzeige statt der gerundeten Zahl, z. B. „4,5 h“. Die Länge des Balkens folgt weiter `wert`. */
  text?: string;
}

export function Balken({ zeilen }: { zeilen: BalkenZeile[] }) {
  const max = Math.max(1, ...zeilen.map((z) => z.wert));
  return (
    <ul className="balken">
      {zeilen.map((z) => (
        <li key={z.label} className="balken__zeile">
          <span className="balken__label">{z.label}</span>
          <span className="balken__spur" aria-hidden="true">
            <span
              className={`balken__fuell balken__fuell--${z.ton}`}
              style={{ width: `${(z.wert / max) * 100}%`, minWidth: z.wert === 0 ? 0 : undefined }}
            />
          </span>
          <span className="balken__wert zahl">
            {z.text ?? fmtZahl(z.wert)}
            {z.zusatz && <span className="balken__zusatz"> {z.zusatz}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Aufteilung der Dienstzeit ---------- */

export function ZeitBalken({
  einsatzMin,
  rueckfahrtMin,
  wacheMin,
  uebungMin = 0,
  offenMin = 0,
}: {
  einsatzMin: number;
  rueckfahrtMin: number;
  wacheMin: number;
  /** Zeit, in der auf Wache geübt wurde; sie gehört nicht zur Wachzeit. */
  uebungMin?: number;
  /** Dienstzeit, die keinem der Teile zugeordnet werden kann (z. B. Status 2 fehlt). */
  offenMin?: number;
}) {
  const summe = Math.max(1, einsatzMin + rueckfahrtMin + wacheMin + uebungMin + offenMin);
  const teile = [
    { key: 'einsatz', label: 'Im Einsatz', min: einsatzMin },
    { key: 'rueck', label: 'Rückfahrt', min: rueckfahrtMin },
    { key: 'wache', label: 'Auf Wache', min: wacheMin },
    ...(uebungMin > 0 ? [{ key: 'uebung', label: 'Übung', min: uebungMin }] : []),
    ...(offenMin > 0 ? [{ key: 'offen', label: 'Nicht zugeordnet', min: offenMin }] : []),
  ];
  return (
    <div>
      <div className="zeitbalken" role="img" aria-label={teile.map((t) => `${t.label} ${fmtDauer(t.min)}`).join(', ')}>
        {teile.map((t) => (
          <span key={t.key} className={`zeitbalken__teil zeitbalken__teil--${t.key}`} style={{ flexGrow: t.min }} />
        ))}
      </div>
      <ul className="zeitliste">
        {teile.map((t) => (
          <li key={t.key}>
            <span className={`legende__farbe zeitliste__farbe--${t.key}`} />
            <span className="zeitliste__label">{t.label}</span>
            <span className="zahl">{fmtDauer(t.min)}</span>
            <span className="zeitliste__anteil zahl">{Math.round((t.min / summe) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Über- und Minusstunden: Plus über, Minus unter der Nulllinie ---------- */

export interface SaldoWert {
  label: string;
  min: number;
}

export function SaldoSaeulen({ daten, achse }: { daten: SaldoWert[]; achse: (d: SaldoWert, i: number) => string }) {
  const [aktiv, setAktiv] = useState<number | null>(null);
  const hoechstPlus = Math.max(0, ...daten.map((d) => d.min)) / 60;
  const hoechstMinus = Math.max(0, ...daten.map((d) => -d.min)) / 60;
  const plus = hoechstPlus > 0 ? niceMax(Math.ceil(hoechstPlus)) : hoechstMinus > 0 ? 0 : 4;
  const minus = hoechstMinus > 0 ? niceMax(Math.ceil(hoechstMinus)) : 0;
  const gesamt = plus + minus;
  const nullLinie = (plus / gesamt) * 100;
  const gewaehlt = aktiv != null ? daten[aktiv] : null;

  return (
    <div className="saeulen saldo">
      <div className="saeulen__plot saldo__plot">
        <div className="saeulen__gitter" aria-hidden="true">
          {plus > 0 && <span style={{ top: '0%' }}>+{plus} h</span>}
          <span className="saldo__null" style={{ top: `${nullLinie}%` }}>0</span>
          {minus > 0 && <span style={{ top: '100%' }}>−{minus} h</span>}
        </div>
        <div className="saeulen__spalten" style={{ gridTemplateColumns: `repeat(${daten.length}, minmax(0, 1fr))` }}>
          {daten.map((d, i) => {
            const h = d.min / 60;
            return (
              <button
                key={d.label}
                type="button"
                className="saeulen__spalte saldo__spalte"
                aria-pressed={aktiv === i}
                aria-label={`${d.label}: ${fmtSaldo(d.min)}`}
                onClick={() => setAktiv(aktiv === i ? null : i)}
              >
                {h > 0 && (
                  <span
                    className="saldo__balken saldo__balken--plus"
                    style={{ top: `${((plus - h) / gesamt) * 100}%`, height: `${(h / gesamt) * 100}%` }}
                  />
                )}
                {h < 0 && (
                  <span
                    className="saldo__balken saldo__balken--minus"
                    style={{ top: `${nullLinie}%`, height: `${(-h / gesamt) * 100}%` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="saeulen__achse" style={{ gridTemplateColumns: `repeat(${daten.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {daten.map((d, i) => (
          <span key={d.label}>{achse(d, i)}</span>
        ))}
      </div>
      <p className="saeulen__anzeige" aria-live="polite">
        {gewaehlt ? (
          <>
            <strong>{gewaehlt.label}</strong>
            {': '}
            <span className="zahl">{fmtSaldo(gewaehlt.min)}</span>
          </>
        ) : (
          'Tippe auf eine Säule für die Zahl.'
        )}
      </p>
    </div>
  );
}
