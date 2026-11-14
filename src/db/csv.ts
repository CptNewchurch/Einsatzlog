import { berechneDienstZeiten, dienstSaldo } from '../domain/zeiten';
import { stichwortText } from '../domain/stichwort';
import { fmtDatum, fmtZeit, MIN } from '../domain/time';
import { NACA_GRUPPE_INFO, NACA_INFO, bewertungVon, nacaGruppe } from '../domain/triage';
import { AUSGANG_INFO, BEWERTUNG_INFO, DURCHFUEHRUNG_INFO, type Dienst, type Einsatz, type KatalogEintrag } from '../domain/types';

// CSV für Excel und LibreOffice: Semikolon, UTF-8 mit Kennzeichen, deutsche Datumsangaben.

type Zelle = string | number | boolean | null | undefined;

const BOM = '﻿';

/** Ein Wert für die CSV-Datei; Text, der als Formel gelesen würde, bekommt ein Hochkomma davor. */
export function csvFeld(wert: Zelle): string {
  if (wert == null || wert === '') return '';
  if (typeof wert === 'boolean') return wert ? 'ja' : 'nein';
  let t = typeof wert === 'number' ? String(wert).replace('.', ',') : wert;
  if (typeof wert === 'string' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function csvText(kopf: string[], zeilen: Zelle[][]): string {
  return BOM + [kopf, ...zeilen].map((z) => z.map(csvFeld).join(';')).join('\r\n') + '\r\n';
}

const minuten = (von: number, bis: number) => Math.round((bis - von) / MIN);

export function erzeugeEinsaetzeCsv(
  dienste: readonly Dienst[],
  einsaetze: readonly Einsatz[],
  katalog: ReadonlyMap<number, KatalogEintrag>,
): string {
  const name = (id: number | undefined) => (id == null ? '' : (katalog.get(id)?.name ?? ''));
  const dienstMap = new Map(dienste.map((d) => [d.id!, d]));
  const kopf = [
    'Datum', 'Alarmierung', 'Status 1', 'Status 2', 'Einsatzdauer (min)', 'Rückfahrt (min)',
    'Typ', 'Stichwort', 'MIG', 'Kräfteansatz', 'Dienst', 'Dienstart', 'Wache / Standort', 'Fahrzeug', 'Rolle',
    'Nachalarmiert', 'Nachforderungen', 'Ergebnis', 'NACA', 'NACA-Gruppe', 'Verdachtsdiagnose', 'Laut Leitstelle',
    'Bewertung Alarmierung', 'Altersgruppe', 'Notarzt vor Ort',
    'Maßnahmen', 'Atemschutz', 'Atemschutz (min)', 'Ort', 'Tags', 'Notiz',
  ];
  const zeilen = [...einsaetze]
    .sort((a, b) => a.alarm - b.alarm)
    .map((e): Zelle[] => {
      const d = dienstMap.get(e.dienstId);
      return [
        fmtDatum(e.alarm),
        fmtZeit(e.alarm),
        fmtZeit(e.status1),
        e.status2 != null ? fmtZeit(e.status2) : '',
        minuten(e.alarm, e.status1),
        e.status2 != null ? minuten(e.status1, e.status2) : '',
        e.typ,
        stichwortText(e.typ, name(e.kategorieId), e.mig),
        e.mig ? true : '',
        e.kraefteRtw != null && e.kraefteNef != null ? `R${e.kraefteRtw}N${e.kraefteNef}` : '',
        d ? fmtDatum(d.beginn) : '',
        d ? (d.zusatzdienst ? 'Zusatzdienst' : 'Regeldienst') : '',
        d ? name(d.wacheId) : '',
        name(e.fahrzeugId),
        name(e.rolleId),
        e.nachalarmiert ? true : '',
        (e.nachforderungen ?? []).map((n) => `${name(n.ressourceId)}${n.vonMir ? ' (von mir)' : ''}`).join(', '),
        e.ausgang ? AUSGANG_INFO[e.ausgang].kurz : '',
        e.naca != null ? (NACA_INFO[e.naca - 1]?.roemisch ?? '') : '',
        e.naca != null ? NACA_GRUPPE_INFO[nacaGruppe(e.naca)].kurz : '',
        name(e.diagnoseId),
        name(e.leitstelleDiagnoseId),
        // Eigene Bewertung; sonst „zu hoch“ bei Nur Transport und Hilfeleistung, wie in der Statistik.
        bewertungVon(e) ? BEWERTUNG_INFO[bewertungVon(e)!].kurz : '',
        e.altersgruppe ?? '',
        e.notarztVorOrt == null ? '' : e.notarztVorOrt,
        (e.massnahmen ?? [])
          .map((m) => `${name(m.massnahmeId)} ${m.anzahl}×${m.durchfuehrung ? ` (${DURCHFUEHRUNG_INFO[m.durchfuehrung].kurz})` : ''}`)
          .join(', '),
        e.atemschutz ? true : '',
        e.atemschutz ? (e.atemschutzMin ?? '') : '',
        e.ortGrob ?? '',
        (e.tagIds ?? []).map(name).join(', '),
        e.notiz ?? '',
      ];
    });
  return csvText(kopf, zeilen);
}

export function erzeugeDiensteCsv(
  dienste: readonly Dienst[],
  einsaetze: readonly Einsatz[],
  katalog: ReadonlyMap<number, KatalogEintrag>,
  randZaehltAlsWache: boolean,
): string {
  const name = (id: number | undefined) => (id == null ? '' : (katalog.get(id)?.name ?? ''));
  const proDienst = new Map<number, Einsatz[]>();
  einsaetze.forEach((e) => proDienst.set(e.dienstId, [...(proDienst.get(e.dienstId) ?? []), e]));
  const kopf = [
    'Datum', 'Dienstart', 'Wache / Standort', 'Fahrzeug', 'Rolle',
    'Geplanter Beginn', 'Geplantes Ende', 'Dienstantritt', 'Dienstende',
    'Über-/Minusstunden (min)', 'Einsätze', 'Im Einsatz (min)', 'Rückfahrt (min)', 'Auf Wache (min)', 'Notiz',
  ];
  const zeilen = [...dienste]
    .sort((a, b) => a.beginn - b.beginn)
    .map((d): Zelle[] => {
      const z = berechneDienstZeiten(d, proDienst.get(d.id!) ?? [], randZaehltAlsWache);
      const hm = (ms: number) => `${fmtDatum(ms)} ${fmtZeit(ms)}`;
      return [
        fmtDatum(d.beginn),
        d.zusatzdienst ? 'Zusatzdienst' : 'Regeldienst',
        name(d.wacheId),
        name(d.fahrzeugId),
        name(d.rolleId),
        d.zusatzdienst ? '' : hm(d.sollBeginn),
        d.zusatzdienst ? '' : hm(d.sollEnde),
        hm(d.beginn),
        hm(d.ende),
        d.zusatzdienst ? '' : dienstSaldo(d).saldoMin,
        z.einsaetze,
        z.einsatzMin,
        z.rueckfahrtMin,
        z.wacheMin,
        d.notiz ?? '',
      ];
    });
  return csvText(kopf, zeilen);
}

export function csvDateiname(art: 'einsaetze' | 'dienste', ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `einsatzlog-${art}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.csv`;
}
