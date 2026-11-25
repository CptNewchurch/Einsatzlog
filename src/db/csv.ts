import { ausgangName, ergebnisHinweis } from '../domain/ausgangMigration';
import { stufeVon } from '../domain/alarmstufe';
import { berechneDienstZeiten, dienstSaldo } from '../domain/zeiten';
import { BEREICH_NAME, stichwortText } from '../domain/stichwort';
import { fmtDatum, fmtZeit, MIN } from '../domain/time';
import { NACA_GRUPPE_INFO, NACA_INFO, bewertungVon, nacaGruppe } from '../domain/triage';
import {
  BEWERTUNG_INFO,
  DIENSTART_NAME,
  DURCHFUEHRUNG_INFO,
  dienstartVon,
  hatPlan,
  type Dienst,
  type Einsatz,
  type KatalogEintrag,
  type Uebung,
} from '../domain/types';

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
    'Typ', 'Stichwort', 'MIG', 'Kräfteansatz', 'Alarmstufe', 'Dienst', 'Dienstart', 'Wache / Standort', 'Fahrzeug', 'Rolle',
    'Nachalarmiert', 'Nachforderungen', 'Ergebnis', 'NACA', 'NACA-Gruppe', 'Verdachtsdiagnose', 'Laut Leitstelle',
    'Bewertung Alarmierung', 'Altersgruppe', 'Notarzt vor Ort',
    'Maßnahmen', 'Atemschutz', 'Atemschutz (min)', 'Ort', 'Tags', 'Notiz', 'Danach aus Status 1 alarmiert', 'Hilfeleistung (Stichwort)', 'Ergebnis prüfen',
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
        // Wie in der Statistik: die eingetragene Stufe, sonst die der AAO für das Stichwort.
        stufeVon(e, katalog.get(e.kategorieId)?.name).stufe ?? '',
        d ? fmtDatum(d.beginn) : '',
        d ? DIENSTART_NAME[dienstartVon(d)] : '',
        d ? name(d.wacheId) : '',
        name(e.fahrzeugId),
        name(e.rolleId),
        e.nachalarmiert ? true : '',
        (e.nachforderungen ?? []).map((n) => `${name(n.ressourceId)}${n.vonMir ? ' (von mir)' : ''}`).join(', '),
        e.ausgang ? ausgangName(e.ausgang) : '',
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
        e.status2 == null && e.folgeAusStatus1 ? true : '',
        e.ausgang === 'hilfeleistung' ? name(e.hilfeleistungId) : '',
        ergebnisHinweis(e) ? true : '',
      ];
    });
  return csvText(kopf, zeilen);
}

export function erzeugeDiensteCsv(
  dienste: readonly Dienst[],
  einsaetze: readonly Einsatz[],
  katalog: ReadonlyMap<number, KatalogEintrag>,
  randZaehltAlsWache: boolean,
  uebungen: readonly Uebung[] = [],
): string {
  const name = (id: number | undefined) => (id == null ? '' : (katalog.get(id)?.name ?? ''));
  const proDienst = new Map<number, Einsatz[]>();
  einsaetze.forEach((e) => proDienst.set(e.dienstId, [...(proDienst.get(e.dienstId) ?? []), e]));
  const uebungenProDienst = new Map<number, Uebung[]>();
  uebungen.forEach((u) => uebungenProDienst.set(u.dienstId, [...(uebungenProDienst.get(u.dienstId) ?? []), u]));
  const kopf = [
    'Datum', 'Dienstart', 'Wache / Standort', 'Fahrzeug', 'Rolle',
    'Geplanter Beginn', 'Geplantes Ende', 'Dienstantritt', 'Dienstende',
    'Über-/Minusstunden (min)', 'Einsätze', 'Im Einsatz (min)', 'Rückfahrt (min)', 'Auf Wache (min)',
    'Übungen', 'Übung (min)', 'Notiz',
  ];
  const zeilen = [...dienste]
    .sort((a, b) => a.beginn - b.beginn)
    .map((d): Zelle[] => {
      const uebungenDesDienstes = uebungenProDienst.get(d.id!) ?? [];
      const z = berechneDienstZeiten(d, proDienst.get(d.id!) ?? [], randZaehltAlsWache, uebungenDesDienstes);
      const hm = (ms: number) => `${fmtDatum(ms)} ${fmtZeit(ms)}`;
      return [
        fmtDatum(d.beginn),
        DIENSTART_NAME[dienstartVon(d)],
        name(d.wacheId),
        name(d.fahrzeugId),
        name(d.rolleId),
        hatPlan(d) ? hm(d.sollBeginn) : '',
        hatPlan(d) ? hm(d.sollEnde) : '',
        hm(d.beginn),
        hm(d.ende),
        hatPlan(d) ? dienstSaldo(d).saldoMin : '',
        z.einsaetze,
        z.einsatzMin,
        z.rueckfahrtMin,
        z.wacheMin,
        uebungenDesDienstes.length || '',
        z.uebungMin > 0 ? z.uebungMin : '',
        d.notiz ?? '',
      ];
    });
  return csvText(kopf, zeilen);
}

export function erzeugeUebungenCsv(
  dienste: readonly Dienst[],
  uebungen: readonly Uebung[],
  katalog: ReadonlyMap<number, KatalogEintrag>,
): string {
  const name = (id: number | undefined) => (id == null ? '' : (katalog.get(id)?.name ?? ''));
  const dienstMap = new Map(dienste.map((d) => [d.id!, d]));
  const kopf = [
    'Datum', 'Beginn', 'Ende', 'Dauer (min)', 'Art', 'Bereich', 'Thema', 'Ort', 'Dienst', 'Dienstart', 'Wache / Standort',
    'Atemschutz', 'Atemschutz (min)', 'Maßnahmen', 'Notiz',
  ];
  const zeilen = [...uebungen]
    .sort((a, b) => a.beginn - b.beginn)
    .map((u): Zelle[] => {
      const d = dienstMap.get(u.dienstId);
      const bereich = katalog.get(u.artId)?.bereich;
      return [
        fmtDatum(u.beginn),
        fmtZeit(u.beginn),
        fmtZeit(u.ende),
        minuten(u.beginn, u.ende),
        name(u.artId),
        bereich ? BEREICH_NAME[bereich] : '',
        u.thema ?? '',
        name(u.ortId),
        d ? fmtDatum(d.beginn) : '',
        d ? DIENSTART_NAME[dienstartVon(d)] : '',
        d ? name(d.wacheId) : '',
        u.atemschutz ? true : '',
        u.atemschutz ? (u.atemschutzMin ?? '') : '',
        (u.massnahmen ?? []).map((m) => `${name(m.massnahmeId)} ${m.anzahl}×`).join(', '),
        u.notiz ?? '',
      ];
    });
  return csvText(kopf, zeilen);
}

export function csvDateiname(art: 'einsaetze' | 'dienste' | 'uebungen', ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `einsatzlog-${art}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.csv`;
}
