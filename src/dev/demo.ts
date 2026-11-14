// Nur für die Entwicklung: füllt die Datenbank mit Beispieldaten für Bildschirmfotos.
// Aufruf: http://localhost:5173/?demo=1#/ – in der fertigen App ist dieser Code nicht enthalten.
import { db } from '../db/db';
import { speichereEinstellungen } from '../db/einstellungen';
import { sorgeFuerStartlisten } from '../db/seed';
import { MIN, STUNDE, zeitpunkt } from '../domain/time';
import { bewertungVorschlag } from '../domain/triage';
import type { Ausgang, Dienst, Durchfuehrung, Einsatz, KatalogEintrag, MassnahmeEintrag, Typ, Uebung } from '../domain/types';

function zufall(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Befunde je Fachrichtung, und was die Leitstelle dort typischerweise vermutet. */
const BEFUNDE: Record<string, { befunde: string[]; verdacht: string[] }> = {
  Internistisch: {
    befunde: ['Akutes Koronarsyndrom (AKS)', 'Dyspnoe / Atemnot', 'Synkope / Kollaps', 'Bauchschmerzen', 'Hypertensive Entgleisung', 'Infekt / Fieber', 'AZ-Verschlechterung', 'Hypoglykämie', 'Herzrhythmusstörung'],
    verdacht: ['Akutes Koronarsyndrom (AKS)', 'Akutes Koronarsyndrom (AKS)', 'Dyspnoe / Atemnot', 'Synkope / Kollaps'],
  },
  Chirurgisch: {
    befunde: ['Sturz', 'Sturz', 'Extremitätenverletzung', 'Wunde / Blutung', 'Rückenschmerzen', 'Schädel-Hirn-Trauma'],
    verdacht: ['Sturz', 'Extremitätenverletzung', 'Wunde / Blutung'],
  },
  Neurologisch: {
    befunde: ['Schlaganfall / TIA', 'Krampfanfall', 'Schwindel', 'Kopfschmerzen'],
    verdacht: ['Schlaganfall / TIA', 'Krampfanfall'],
  },
};

const tag = (ms: number, offset: number): string => {
  const d = new Date(ms);
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, 12);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export async function ladeDemodaten(): Promise<void> {
  await db.transaction('rw', db.dienste, db.einsaetze, db.uebungen, db.katalog, db.meta, async () => {
    await Promise.all([db.dienste.clear(), db.einsaetze.clear(), db.uebungen.clear(), db.katalog.clear(), db.meta.clear()]);
  });
  await sorgeFuerStartlisten();

  const standortId = await db.katalog.add({ typ: 'standort', name: 'Leverkusen (Sanitätsdienst)', aktiv: true } as KatalogEintrag);
  const schuleId = await db.katalog.add({ typ: 'standort', name: 'Feuerwehrschule', aktiv: true } as KatalogEintrag);
  const uebungswacheId = await db.katalog.add({ typ: 'standort', name: 'Wache 1 (Übungsabend)', aktiv: true } as KatalogEintrag);
  const katalog = await db.katalog.toArray();
  const id = (typ: string, name: string) => katalog.find((k) => k.typ === typ && k.name === name)?.id;
  const kat = (name: string) => id('kategorie', name)!;
  const massn = (name: string) => id('massnahme', name)!;
  const fwMassn = (name: string) => id('fwmassnahme', name)!;
  const art = (name: string) => id('uebungsart', name)!;
  const diag = (name: string) => id('diagnose', name)!;
  const r = zufall(7);
  const wahl = <T,>(liste: readonly T[]): T => liste[Math.floor(r() * liste.length)];

  const jetzt = Date.now();
  const heute = tag(jetzt, 0);
  const wache1 = id('wache', 'FRW 1 (Paffrather Straße)')!;
  const wache2 = id('wache', 'FRW 2 (Bensberg)')!;
  const wache4 = id('wache', 'RW 4 (Refrath)')!;
  const rtw = id('fahrzeug', 'RTW')!;
  const nef = id('fahrzeug', 'NEF')!;
  const lf = id('fahrzeug', 'LF')!;
  const hlf = id('fahrzeug', 'HLF')!;
  const tf = id('rolle', 'Transportführer')!;
  const fahrer = id('rolle', 'Fahrer')!;
  const at = id('rolle', 'Angriffstrupp')!;
  const gf = id('rolle', 'Gruppenführer')!;

  // Dienste: jeder dritte bis vierte Tag, der aktuelle läuft gerade (Beginn heute 07:30).
  const abstaende = [0, 3, 6, 9, 12, 15, 19, 22, 26, 30, 35, 39, 44, 49, 54, 60, 66, 71, 77, 84];
  const dienste: Dienst[] = [];
  const einsaetze: Einsatz[] = [];
  const wachen = [wache1, wache1, wache2, wache1, wache4, wache1, wache2];

  const dienstIds: number[] = [];
  for (let i = 0; i < abstaende.length; i++) {
    const beginnTag = tag(jetzt, -abstaende[i]);
    const folgeTag = tag(jetzt, -abstaende[i] + 1);
    const sollBeginn = zeitpunkt(beginnTag, 7, 30);
    const sollEnde = zeitpunkt(folgeTag, 7, 30);
    let beginn = sollBeginn;
    let ende = sollEnde;
    if (i === 2) beginn = zeitpunkt(beginnTag, 7, 10);
    if (i === 3) ende = zeitpunkt(folgeTag, 8, 5);
    if (i === 5) ende = zeitpunkt(folgeTag, 5, 40);
    if (i === 8) {
      beginn = zeitpunkt(beginnTag, 7, 0);
      ende = zeitpunkt(folgeTag, 7, 45);
    }
    if (i === 0) {
      beginn = sollBeginn;
      ende = sollEnde;
    }
    const rettung = i % 3 !== 1;
    dienste.push({
      sollBeginn,
      sollEnde,
      beginn,
      ende,
      wacheId: wachen[i % wachen.length],
      fahrzeugId: rettung ? rtw : i % 2 ? lf : hlf,
      rolleId: rettung ? (i % 2 ? tf : fahrer) : i % 2 ? at : gf,
    });
  }
  // Zwei Zusatzdienste in Leverkusen
  for (const versatz of [18, 46]) {
    const t = tag(jetzt, -versatz);
    const b = zeitpunkt(t, 18, 0);
    const e = zeitpunkt(tag(jetzt, -versatz + 1), 2, 0);
    dienste.push({ sollBeginn: b, sollEnde: e, beginn: b, ende: e, wacheId: standortId, fahrzeugId: rtw, rolleId: tf, zusatzdienst: true });
  }
  // Zwei reine Übungsdienste: ein Samstag in der Feuerwehrschule und ein Übungsabend an der Wache.
  const schulTag = tag(jetzt, -13);
  dienste.push({
    sollBeginn: zeitpunkt(schulTag, 8, 0),
    sollEnde: zeitpunkt(schulTag, 16, 0),
    beginn: zeitpunkt(schulTag, 8, 0),
    ende: zeitpunkt(schulTag, 16, 0),
    wacheId: schuleId,
    uebungsdienst: true,
  });
  const abendTag = tag(jetzt, -41);
  dienste.push({
    sollBeginn: zeitpunkt(abendTag, 19, 30),
    sollEnde: zeitpunkt(abendTag, 22, 0),
    beginn: zeitpunkt(abendTag, 19, 30),
    ende: zeitpunkt(abendTag, 22, 0),
    wacheId: uebungswacheId,
    uebungsdienst: true,
  });
  for (const d of dienste) dienstIds.push(await db.dienste.add(d));

  const medDurchfuehrung = (m: string): Durchfuehrung => (['Epinephrin', 'Midazolam', 'Morphin', 'Esketamin', 'Fentanyl'].includes(m) ? 'vorab' : 'eigen');

  dienste.forEach((d, i) => {
    if (d.uebungsdienst) return;
    const dienstId = dienstIds[i];
    const laufend = i === 0;
    const anzahl = d.zusatzdienst ? 2 : laufend ? 3 : 3 + Math.floor(r() * 5);
    let t = d.beginn + (20 + Math.floor(r() * 90)) * MIN;
    for (let k = 0; k < anzahl; k++) {
      const typ: Typ = d.zusatzdienst ? 'R' : wahl(['R', 'R', 'R', 'R', 'N', 'N', 'F', 'H', 'H', 'H', 'ABC'] as const);
      const rdTyp = typ === 'R' || typ === 'N';
      const dauer = (rdTyp ? 25 + Math.floor(r() * 50) : 20 + Math.floor(r() * 70)) * MIN;
      if (t + dauer > d.ende - 10 * MIN || (laufend && t + dauer > jetzt - 20 * MIN)) break;
      const alarm = t;
      const status1 = alarm + dauer;
      const mitStatus2 = !(laufend && k === anzahl - 1) && r() > 0.08;
      const status2 = mitStatus2 ? status1 + (5 + Math.floor(r() * 20)) * MIN : undefined;
      const fach = wahl(['Chirurgisch', 'Internistisch', 'Internistisch', 'Neurologisch'] as const);
      const e: Einsatz = {
        dienstId,
        typ,
        kategorieId: rdTyp ? kat(fach) : typ === 'F' ? kat(wahl(['Gebäude', 'Gebäude', 'LKW', 'Gewerbebetrieb', 'Krankenhaus'])) : typ === 'ABC' ? kat('Gas') : kat(wahl(['P-Tür', 'P-Tür', 'P-Aufzug', 'Ölspur', 'P-Klemmt', 'Gas'])),
        alarm,
        status1,
        ...(status2 ? { status2 } : {}),
        fahrzeugId: rdTyp ? (typ === 'N' && r() > 0.5 ? nef : rtw) : r() > 0.5 ? lf : hlf,
        rolleId: rdTyp ? tf : r() > 0.5 ? at : gf,
      };
      if (rdTyp) {
        e.kraefteRtw = 1;
        e.kraefteNef = typ === 'N' ? 1 : 0;
        e.altersgruppe = wahl(['erwachsener', 'erwachsener', 'senior', 'senior', 'kind'] as const);
        e.notarztVorOrt = typ === 'N' || r() > 0.8;

        // Ergebnis und Befund: meist Transport, dazwischen ambulante Fälle, Ablehnungen und Fehlalarme.
        const ausgang: Ausgang = wahl(['transport', 'transport', 'transport', 'transport', 'transport', 'ambulant', 'ambulant', 'abgelehnt', 'verstorben', 'transportdienst', 'hilfeleistung', 'fehleinsatz'] as const);
        e.ausgang = ausgang;
        const { befunde, verdacht } = BEFUNDE[fach];
        let befund = wahl(befunde);
        let leitstelle: string | undefined = r() < (typ === 'N' ? 0.75 : 0.3) ? wahl(verdacht) : undefined;
        if (ausgang !== 'fehleinsatz') {
          e.naca = ausgang === 'verstorben' ? 7 : ausgang === 'hilfeleistung' ? 1 : ausgang === 'transportdienst' ? wahl([1, 2]) : ausgang === 'ambulant' ? wahl([1, 2, 2]) : wahl([2, 3, 3, 3, 4, 4, 5]);
          // Der klassische Fall: „N-Internistisch, V. a. AKS“ – vor Ort Rückenschmerzen seit drei Wochen.
          if (typ === 'N' && fach === 'Internistisch' && ausgang === 'ambulant' && r() > 0.3) {
            befund = 'Rückenschmerzen';
            leitstelle = 'Akutes Koronarsyndrom (AKS)';
            e.naca = 1;
          }
          if (ausgang === 'hilfeleistung') befund = 'Hilflose Lage / Soziale Indikation';
          if (ausgang === 'verstorben') befund = 'Reanimation';
          e.diagnoseId = diag(befund);
        }
        if (leitstelle) e.leitstelleDiagnoseId = diag(leitstelle);
        // Die Alarmierung bewertet er nicht immer; wenn, dann meist so, wie es der Vorschlag nahelegt.
        const vorschlag = bewertungVorschlag(e);
        if (ausgang !== 'fehleinsatz' && r() > 0.5) e.alarmBewertung = vorschlag && r() > 0.2 ? vorschlag.bewertung : 'passend';
        const m: MassnahmeEintrag[] = [];
        if (r() > 0.45) m.push({ massnahmeId: massn('i.v.-Zugang'), anzahl: 1, durchfuehrung: 'eigen' });
        if (r() > 0.6) m.push({ massnahmeId: massn('Sauerstoff'), anzahl: 1, durchfuehrung: 'eigen' });
        if (r() > 0.75) {
          const med = wahl(['Epinephrin', 'Midazolam', 'Morphin', 'Salbutamol', 'Glucose'] as const);
          m.push({ massnahmeId: massn(med), anzahl: 1 + Math.floor(r() * 2), durchfuehrung: medDurchfuehrung(med) });
        }
        if (typ === 'N' && r() > 0.5) m.push({ massnahmeId: massn('Manuelle Defibrillation'), anzahl: 1, durchfuehrung: 'eigen' });
        if (m.length > 0) e.massnahmen = m;
        if (typ === 'N' && r() > 0.7) e.nachforderungen = [{ ressourceId: id('ressource', 'Notarzt (NEF)')!, vonMir: true }];
      } else {
        if (typ === 'F') {
          e.mig = r() > 0.6;
          if (r() > 0.5) {
            e.atemschutz = true;
            e.atemschutzMin = 15 + Math.floor(r() * 20);
          }
        }
        if (r() > 0.85) e.nachalarmiert = true;
        if (typ === 'F' && !e.mig && r() > 0.7) e.ausgang = 'fehleinsatz';
        // Maßnahmen auf Befehl: nach Art des Einsatzes.
        const namen: string[] =
          typ === 'F'
            ? ['Erkundung', wahl(['Löschangriff im Innenangriff', 'Löschangriff im Außenangriff']), 'Wasserversorgung herstellen', ...(r() > 0.5 ? ['Belüftung und Entrauchung'] : []), ...(r() > 0.6 ? ['Nachlöscharbeiten und Brandnachschau'] : [])]
            : typ === 'ABC'
              ? ['Messen (Gas, CO, Ex)', 'Absperrung und Gefahrenbereich']
              : [wahl(['Türöffnung (Notöffnung)', 'Aufzugbefreiung', 'Ölspur abstreuen', 'Tragehilfe für den Rettungsdienst', 'Absperrung und Gefahrenbereich'])];
        e.massnahmen = namen.map((n) => ({ massnahmeId: fwMassn(n), anzahl: 1, durchfuehrung: 'befehl' as const }));
      }
      if (k === 0 && i === 1) e.notiz = 'Anfahrt über Umleitung, Zugang schwierig.';
      einsaetze.push(e);
      t = (status2 ?? status1) + (35 + Math.floor(r() * 150)) * MIN;
    }
  });
  await db.einsaetze.bulkAdd(einsaetze);

  // Übungen in der Schicht: nachmittags auf Wache, bei einigen Regeldiensten.
  const uebungen: Uebung[] = [];
  const inSchicht: [number, string, string][] = [
    [1, 'Atemschutzübung', 'Übungsstrecke'],
    [4, 'Reanimation', 'Teamtraining'],
    [7, 'Fahrzeug- und Gerätekunde', 'HLF Beladung'],
    [10, 'Dienstsport', ''],
    [13, 'Technische Hilfeleistung', 'Hydraulisches Rettungsgerät'],
    [16, 'Atemschutzübung', ''],
  ];
  for (const [i, artName, thema] of inSchicht) {
    const d = dienste[i];
    if (!d || d.zusatzdienst || d.uebungsdienst) continue;
    const beginn = d.beginn + 390 * MIN;
    uebungen.push({ dienstId: dienstIds[i], beginn, ende: beginn + 90 * MIN, artId: art(artName), ...(thema ? { thema } : {}) });
  }
  // Der Übungstag in der Feuerwehrschule mit zwei Übungen und einer Mittagspause dazwischen.
  const schulIndex = dienste.findIndex((d) => d.uebungsdienst && d.wacheId === schuleId);
  const schule = dienste[schulIndex];
  uebungen.push({ dienstId: dienstIds[schulIndex], beginn: schule.beginn, ende: schule.beginn + 210 * MIN, artId: art('Atemschutzübung'), thema: 'Übungsstrecke und Brandcontainer' });
  uebungen.push({ dienstId: dienstIds[schulIndex], beginn: schule.beginn + 270 * MIN, ende: schule.ende, artId: art('Technische Hilfeleistung'), thema: 'Verkehrsunfall, Fahrzeugrettung' });
  // Der Übungsabend: eine Übung füllt den ganzen Dienst.
  const abendIndex = dienste.findIndex((d) => d.uebungsdienst && d.wacheId === uebungswacheId);
  const abend = dienste[abendIndex];
  uebungen.push({ dienstId: dienstIds[abendIndex], beginn: abend.beginn, ende: abend.ende, artId: art('Löschübung'), thema: 'Wasserentnahme aus offenem Gewässer' });
  await db.uebungen.bulkAdd(uebungen);
  await speichereEinstellungen({ letztesBackup: jetzt - 8 * 24 * STUNDE, letzterDienstId: dienstIds[0], standardWacheId: wache1, standardFahrzeugId: rtw, standardRolleId: tf });
  void heute;
}
