import { useEffect, useMemo, useRef, useState } from 'react';
import { loescheEinsatz, speichereEinsatz, verlaengereDienst } from '../db/speichern';
import { aaoStufe, ALARMSTUFEN, istAlarmstufe, stufeKraefte, stufeText } from '../domain/alarmstufe';
import { kategorieNutzungFuerTyp, sortiereNachNutzung } from '../domain/katalogLogik';
import { kraefteText, standardKraefte, stichwortText } from '../domain/stichwort';
import {
  fmtDatumZeit,
  fmtDauer,
  fmtSaldo,
  fmtZeit,
  MIN,
  minutenZwischen,
  naechsteUhrzeit,
  parseUhrzeit,
  STUNDE,
  uhrzeitImFenster,
} from '../domain/time';
import {
  AUSGANG_INFO,
  ausgangBrauchtNotarzt,
  BEWERTUNG_INFO,
  bereichVon,
  hatPlan,
  type AlarmBewertung,
  type Altersgruppe,
  type Ausgang,
  type Dienst,
  type Einsatz,
  type MassnahmeEintrag,
  type Nachforderung,
  type Typ,
} from '../domain/types';
import { bewertungVorschlag, NACA_INFO } from '../domain/triage';
import { dienstSaldo } from '../domain/zeiten';
import { brauchtDurchfuehrung, FwMassnahmenBlock, MassnahmenBlock } from '../ui/massnahmen';
import { navigate, zurueck } from '../router';
import { einsatzTitel, katalogName, laufenderDienst, useDaten } from '../state/daten';
import { Abschnitt, Aufklappen, Chip, ChipReihe, Feld, Knopf, Leer, Meldung, Segment, Stepper, TextFeld, Toggle, ZeitFeld } from '../ui/controls';
import { DienstWahl } from '../ui/dienstwahl';
import { EinsatzartReihe } from '../ui/einsatzart';
import { KatalogAuswahl } from '../ui/katalogwahl';
import { ohneLeere, useKatalogListe } from '../ui/katalogListen';
import { Bestaetigung, useToast } from '../ui/overlays';
import { Seite } from '../ui/seite';
import { AlarmierungBewerten, AlterWahl, AusgangWahl, JaNein, NacaWahl } from './ErgebnisBloecke';

/* ---------- Formularzustand ---------- */

interface FormState {
  dienstId: number;
  typ: Typ | null;
  kategorie: number[];
  mig: boolean;
  /** Gewählte Alarmstufe (Feuerwehr); ohne Wahl gilt die Stufe, die die AAO für das Stichwort vorsieht. */
  alarmstufe: number | null;
  rtw: number;
  nef: number;
  alarm: string;
  status1: string;
  status2: string;
  /** Danach aus Status 1 heraus alarmiert (nur ohne Status 2). */
  folgeAusStatus1: boolean;
  fahrzeug: number[];
  rolle: number[];
  nachalarmiert: boolean;
  nachforderungen: Nachforderung[];
  ort: string;
  notiz: string;
  tagIds: number[];
  naca: number | null;
  alter: Altersgruppe | null;
  notarzt: boolean | null;
  ausgang: Ausgang | null;
  /** Verdachtsdiagnose vor Ort (höchstens eine). */
  diagnose: number[];
  /** Verdacht laut Leitstelle (höchstens einer). */
  leitstelle: number[];
  bewertung: AlarmBewertung | null;
  massnahmen: MassnahmeEintrag[];
  atemschutz: boolean;
  atemschutzMin: number;
}

const ENTWURF = 'einsatzlog.entwurf';
const ENTWURF_MAX_ALTER = 48 * STUNDE;

function neuerEntwurf(dienst: Dienst): FormState {
  return {
    dienstId: dienst.id!,
    typ: null,
    kategorie: [],
    mig: false,
    alarmstufe: null,
    rtw: 1,
    nef: 0,
    alarm: '',
    status1: '',
    status2: '',
    folgeAusStatus1: false,
    fahrzeug: dienst.fahrzeugId != null ? [dienst.fahrzeugId] : [],
    rolle: dienst.rolleId != null ? [dienst.rolleId] : [],
    nachalarmiert: false,
    nachforderungen: [],
    ort: '',
    notiz: '',
    tagIds: [],
    naca: null,
    alter: null,
    notarzt: null,
    ausgang: null,
    diagnose: [],
    leitstelle: [],
    bewertung: null,
    massnahmen: [],
    atemschutz: false,
    atemschutzMin: 20,
  };
}

/** Setzt die Einsatzart samt Vorbelegung des Kräfteansatzes. */
function mitTyp(f: FormState, typ: Typ): FormState {
  const k = standardKraefte(typ);
  return { ...f, typ, rtw: k?.rtw ?? 1, nef: k?.nef ?? 0 };
}

function ausEinsatz(e: Einsatz): FormState {
  return {
    dienstId: e.dienstId,
    typ: e.typ,
    kategorie: [e.kategorieId],
    mig: !!e.mig,
    alarmstufe: istAlarmstufe(e.alarmstufe) ? e.alarmstufe : null,
    rtw: e.kraefteRtw ?? 1,
    nef: e.kraefteNef ?? 0,
    alarm: fmtZeit(e.alarm),
    status1: fmtZeit(e.status1),
    status2: e.status2 != null ? fmtZeit(e.status2) : '',
    folgeAusStatus1: !!e.folgeAusStatus1,
    fahrzeug: e.fahrzeugId != null ? [e.fahrzeugId] : [],
    rolle: e.rolleId != null ? [e.rolleId] : [],
    nachalarmiert: !!e.nachalarmiert,
    nachforderungen: e.nachforderungen ?? [],
    ort: e.ortGrob ?? '',
    notiz: e.notiz ?? '',
    tagIds: e.tagIds ?? [],
    naca: e.naca ?? null,
    alter: e.altersgruppe ?? null,
    notarzt: e.notarztVorOrt ?? null,
    ausgang: e.ausgang ?? null,
    diagnose: e.diagnoseId != null ? [e.diagnoseId] : [],
    leitstelle: e.leitstelleDiagnoseId != null ? [e.leitstelleDiagnoseId] : [],
    bewertung: e.alarmBewertung ?? null,
    massnahmen: e.massnahmen ?? [],
    atemschutz: !!e.atemschutz,
    atemschutzMin: e.atemschutzMin ?? 20,
  };
}

function inhaltVorhanden(f: FormState): boolean {
  return !!(
    f.typ ||
    f.alarm ||
    f.status1 ||
    f.status2 ||
    f.kategorie.length ||
    f.massnahmen.length ||
    f.notiz ||
    f.ort ||
    f.tagIds.length ||
    f.ausgang ||
    f.diagnose.length ||
    f.leitstelle.length
  );
}

function ladeEntwurf(dienstMap: ReadonlyMap<number, Dienst>): FormState | null {
  try {
    const roh = localStorage.getItem(ENTWURF);
    if (!roh) return null;
    const { gespeichert, f } = JSON.parse(roh) as { gespeichert: number; f?: Partial<FormState> };
    if (!f || Date.now() - gespeichert > ENTWURF_MAX_ALTER) return null;
    const dienst = f.dienstId != null ? dienstMap.get(f.dienstId) : undefined;
    if (!dienst) return null;
    // Entwürfe einer älteren Version kennen neuere Felder nicht: mit Startwerten auffüllen.
    const gemischt = { ...neuerEntwurf(dienst), ...f } as FormState & { transport?: unknown };
    delete gemischt.transport;
    return inhaltVorhanden(gemischt) ? gemischt : null;
  } catch {
    return null;
  }
}

function loescheEntwurf() {
  try {
    localStorage.removeItem(ENTWURF);
  } catch {
    /* ohne Speicher gibt es keinen Entwurf */
  }
}

/* ---------- Einstieg ---------- */

interface Props {
  /** Bestehender Einsatz zum Bearbeiten. */
  id?: number;
  /** Vorgewählter Dienst für einen neuen Einsatz. */
  dienstId?: number;
  /** Vorgewählte Einsatzart für einen neuen Einsatz. */
  typ?: Typ;
}

export function EinsatzForm({ id, dienstId, typ: typVorgabe }: Props) {
  const daten = useDaten();
  const { dienste, dienstMap, einst } = daten;
  const bestehend = id != null ? daten.einsaetze.find((e) => e.id === id) : undefined;
  const [version, setVersion] = useState(0);

  const start = useMemo(() => {
    if (bestehend) return { f: ausEinsatz(bestehend), entwurf: false };
    const entwurf = ladeEntwurf(dienstMap);
    const vorgabe =
      (dienstId != null && dienstMap.has(dienstId) ? dienstId : undefined) ??
      laufenderDienst(daten)?.id ??
      (einst.letzterDienstId != null && dienstMap.has(einst.letzterDienstId) ? einst.letzterDienstId : undefined) ??
      dienste[0]?.id;
    if (entwurf) {
      const f = { ...entwurf, dienstId: dienstId != null && dienstMap.has(dienstId) ? dienstId : entwurf.dienstId };
      return { f: typVorgabe && !f.typ ? mitTyp(f, typVorgabe) : f, entwurf: true };
    }
    const frisch = vorgabe != null ? neuerEntwurf(dienstMap.get(vorgabe)!) : null;
    return { f: frisch && typVorgabe ? mitTyp(frisch, typVorgabe) : frisch, entwurf: false };
    // Nur beim Öffnen (oder nach „Verwerfen“) auswerten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, id, dienstId, typVorgabe]);

  if (id != null && !bestehend) {
    return (
      <Seite titel="Einsatz" zurueckZu="/einsaetze">
        <Leer titel="Einsatz nicht gefunden" text="Dieser Einsatz existiert nicht mehr." aktion={<Knopf onClick={() => navigate('/einsaetze')}>Zur Einsatzliste</Knopf>} />
      </Seite>
    );
  }
  if (!start.f) {
    return (
      <Seite titel="Einsatz erfassen" zurueckZu="/">
        <Leer
          titel="Zuerst ein Dienst"
          text="Jeder Einsatz gehört zu einem Dienst. Lege den Dienst an, dann erfasst du den Einsatz darin."
          aktion={
            <div className="knopfstapel">
              <Knopf variante="primaer" voll onClick={() => navigate('/dienst/neu')}>Dienst anlegen</Knopf>
              <Knopf voll onClick={() => navigate('/dienst/neu/zusatz')}>Zusatzdienst anlegen</Knopf>
              <Knopf voll onClick={() => navigate('/dienst/neu/uebung')}>Übungsdienst anlegen</Knopf>
            </div>
          }
        />
      </Seite>
    );
  }
  return (
    <Formular
      key={`${version}-${id ?? 'neu'}-${dienstId ?? ''}-${typVorgabe ?? ''}`}
      bestehend={bestehend}
      start={start.f}
      entwurfGeladen={start.entwurf}
      onVerwerfen={() => {
        loescheEntwurf();
        setVersion((v) => v + 1);
      }}
    />
  );
}

/* ---------- Kleine Bausteine ---------- */

function SchnellZeiten({ label, basis, minuten, aktivMs, onWahl, jetzt }: { label: string; basis: number | null; minuten: number[]; aktivMs: number | null; onWahl: (hhmm: string) => void; jetzt?: boolean }) {
  return (
    <ChipReihe label={label}>
      {basis != null &&
        minuten.map((m) => (
          <Chip key={m} klein aktiv={aktivMs === basis + m * MIN} onClick={() => onWahl(fmtZeit(basis + m * MIN))}>
            {m} min
          </Chip>
        ))}
      {jetzt && (
        <Chip klein gestrichelt onClick={() => onWahl(fmtZeit(Date.now()))}>
          Jetzt
        </Chip>
      )}
    </ChipReihe>
  );
}

/* ---------- Formular ---------- */

interface FormProps {
  bestehend?: Einsatz;
  start: FormState;
  entwurfGeladen: boolean;
  onVerwerfen: () => void;
}

function Formular({ bestehend, start, entwurfGeladen, onVerwerfen }: FormProps) {
  const daten = useDaten();
  const toast = useToast();
  const { dienstMap, einst, einsaetze } = daten;
  const neu = !bestehend;

  const [f, setF] = useState<FormState>(start);
  const set = (patch: Partial<FormState>) =>
    setF((alt) => {
      const gleich = (Object.keys(patch) as (keyof FormState)[]).every((k) => Object.is(alt[k], patch[k]));
      return gleich ? alt : { ...alt, ...patch };
    });
  const [versucht, setVersucht] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [ergebnisOffen, setErgebnisOffen] = useState(true);
  const [massnahmenOffen, setMassnahmenOffen] = useState(f.massnahmen.length > 0 || (neu && f.typ != null));
  const [bewertungOffen, setBewertungOffen] = useState(f.bewertung != null || f.leitstelle.length > 0);
  const [weitereOffen, setWeitereOffen] = useState(!!(f.ort || f.notiz || f.tagIds.length));
  const [fahrzeugOffen, setFahrzeugOffen] = useState(false);
  const [nachfOffen, setNachfOffen] = useState(f.nachalarmiert || f.nachforderungen.length > 0);
  const [entwurfHinweis, setEntwurfHinweis] = useState(entwurfGeladen);
  const oben = useRef<HTMLDivElement>(null);

  const dienst = dienstMap.get(f.dienstId)!;
  const typ = f.typ;
  const bereich = typ ? bereichVon(typ) : null;
  const region = hatPlan(dienst) ? einst.region : undefined;

  /* Entwurf sichern (nur für neue Einsätze) */
  useEffect(() => {
    if (!neu || !inhaltVorhanden(f)) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(ENTWURF, JSON.stringify({ gespeichert: Date.now(), f }));
      } catch {
        /* ohne Speicher gibt es keinen Entwurf */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [f, neu]);

  /* ---- Listen ---- */
  const kategorien = useKatalogListe('kategorie');
  // Nur Stichworte des gewählten Typs, häufig genutzte zuerst. Ein Stichwort eines anderen Typs legst du mit „+ Neu“ an.
  const kategorieZaehler = useMemo(() => (typ ? kategorieNutzungFuerTyp(einsaetze, typ) : new Map<number, number>()), [typ, einsaetze]);
  const kategorieVorschlaege = useMemo(() => {
    if (!typ) return [];
    return sortiereNachNutzung(
      kategorien.alle.filter((k) => (k.typen ?? []).includes(typ)),
      kategorieZaehler,
    );
  }, [typ, kategorien.alle, kategorieZaehler]);
  const fahrzeuge = useKatalogListe('fahrzeug', { bereich: bereich ?? undefined });
  const rollen = useKatalogListe('rolle', { bereich: bereich ?? undefined });
  const ressourcen = useKatalogListe('ressource');
  const tags = useKatalogListe('tag');
  const diagnosen = useKatalogListe('diagnose');

  /* ---- Zeiten ---- */
  const alarmP = parseUhrzeit(f.alarm);
  const alarmAuf = useMemo(() => {
    if (!alarmP) return null;
    const imDienst = uhrzeitImFenster(alarmP.h, alarmP.m, dienst.beginn, dienst.ende);
    if (imDienst != null) return imDienst;
    return uhrzeitImFenster(alarmP.h, alarmP.m, dienst.ende, dienst.ende + 6 * STUNDE);
  }, [alarmP, dienst.beginn, dienst.ende]);
  const p1 = parseUhrzeit(f.status1);
  const p2 = parseUhrzeit(f.status2);
  const status1Ms = alarmAuf != null && p1 ? naechsteUhrzeit(p1.h, p1.m, alarmAuf, false) : null;
  const status2Ms = status1Ms != null && p2 ? naechsteUhrzeit(p2.h, p2.m, status1Ms, false) : null;

  const fehler = {
    alarm: !f.alarm ? 'Uhrzeit der Alarmierung angeben.' : !alarmP ? 'Uhrzeit wie 14:35 eingeben.' : alarmAuf == null ? `Liegt nicht im Dienst (${fmtZeit(dienst.beginn)}–${fmtZeit(dienst.ende)}). Dienst ändern oder die Zeit prüfen.` : undefined,
    status1: !f.status1 ? 'Status 1 angeben (einsatzbereit über Funk).' : !p1 ? 'Uhrzeit wie 15:10 eingeben.' : status1Ms != null && alarmAuf != null && status1Ms <= alarmAuf ? 'Status 1 muss nach der Alarmierung liegen.' : undefined,
    status2: f.status2 && !p2 ? 'Uhrzeit wie 15:25 eingeben.' : undefined,
    typ: !typ ? 'Wähle die Einsatzart.' : undefined,
    kategorie: typ && f.kategorie.length === 0 ? 'Wähle oder lege ein Stichwort an.' : undefined,
    notarzt:
      bereich === 'RD' && f.ausgang && ausgangBrauchtNotarzt(f.ausgang) && f.notarzt !== true
        ? `Bei „${AUSGANG_INFO[f.ausgang].kurz}“ war ein Notarzt vor Ort. Wähle „Ja“ oder ändere das Ergebnis.`
        : undefined,
  };
  const zeigeZeit = (feld: 'alarm' | 'status1' | 'status2') => (versucht || f[feld] !== '' ? fehler[feld] : undefined);

  // Bei einem Fehleinsatz entfallen Befund, Maßnahmen, Bewertung und Atemschutz. Eingetragenes bleibt im Formular
  // erhalten, falls das Ergebnis wieder geändert wird, wird aber nicht gespeichert.
  const fehleinsatz = f.ausgang === 'fehleinsatz';

  const fehlendeMassnahmen = useMemo(() => {
    const s = new Set<number>();
    if (fehleinsatz) return s;
    f.massnahmen.forEach((m, i) => {
      const art = daten.katalogMap.get(m.massnahmeId)?.art;
      if (brauchtDurchfuehrung(art) && !m.durchfuehrung) s.add(i);
    });
    return s;
  }, [f.massnahmen, daten.katalogMap, fehleinsatz]);

  const hatFehler = Object.values(fehler).some(Boolean) || fehlendeMassnahmen.size > 0;

  /* ---- Hinweise ---- */
  const ende = status2Ms ?? status1Ms ?? alarmAuf;
  const neuesDienstende = ende != null && ende > dienst.ende ? ende : null;
  const dauerMin = alarmAuf != null && status1Ms != null ? minutenZwischen(alarmAuf, status1Ms) : null;
  const rueckMin = status1Ms != null && status2Ms != null ? minutenZwischen(status1Ms, status2Ms) : null;
  const ueberschneidung = useMemo(() => {
    if (alarmAuf == null || status1Ms == null) return undefined;
    return (daten.einsaetzeNachDienst.get(f.dienstId) ?? []).find((e) => e.id !== bestehend?.id && e.alarm < status1Ms && alarmAuf < e.status1);
  }, [alarmAuf, status1Ms, daten.einsaetzeNachDienst, f.dienstId, bestehend?.id]);

  /* ---- Alarmstufe (Feuerwehr): Vorgabe der AAO, solange nichts anderes gewählt ist ---- */
  const kategorieName = typ && f.kategorie[0] != null ? katalogName(daten, f.kategorie[0]) : undefined;
  const aaoVorgabe = typ && bereich === 'FW' && kategorieName ? aaoStufe(typ, kategorieName, f.mig) : undefined;
  const stufe = bereich === 'FW' ? (f.alarmstufe ?? aaoVorgabe) : undefined;

  /* ---- Aktionen ---- */
  const waehleTyp = (t: Typ) => {
    if (t === f.typ) return;
    const k = standardKraefte(t);
    const bleibt = f.kategorie.filter((id) => (daten.katalogMap.get(id)?.typen ?? []).includes(t));
    const wechselt = bereichVon(t) !== bereich;
    // Rettungsdienst und Feuerwehr haben getrennte Maßnahmenlisten: beim Wechsel passt die bisherige nicht mehr.
    const massnahmen = wechselt
      ? f.massnahmen.filter((m) => (daten.katalogMap.get(m.massnahmeId)?.typ === 'fwmassnahme') === (bereichVon(t) === 'FW'))
      : f.massnahmen;
    const verworfen = f.massnahmen.length - massnahmen.length;
    set({
      typ: t,
      kategorie: bleibt,
      mig: t === 'F' ? f.mig : false,
      alarmstufe: null,
      rtw: k?.rtw ?? 1,
      nef: k?.nef ?? 0,
      // Zwischen Rettungsdienst und Feuerwehr passen nur Fehleinsätze zu beiden.
      ausgang: wechselt && f.ausgang !== 'fehleinsatz' ? null : f.ausgang,
      massnahmen,
    });
    if (verworfen > 0) {
      toast.zeige(`${verworfen === 1 ? 'Eine Maßnahme' : `${verworfen} Maßnahmen`} entfernt: Rettungsdienst und Feuerwehr haben getrennte Listen.`);
    }
    if (wechselt) setMassnahmenOffen(true);
  };

  const wechsleDienst = (neuerDienst: Dienst) => {
    const alt = dienst;
    set({
      dienstId: neuerDienst.id!,
      fahrzeug: f.fahrzeug[0] === alt.fahrzeugId && neuerDienst.fahrzeugId != null ? [neuerDienst.fahrzeugId] : f.fahrzeug,
      rolle: f.rolle[0] === alt.rolleId && neuerDienst.rolleId != null ? [neuerDienst.rolleId] : f.rolle,
    });
  };

  /** Ein Ergebnis mit Notarzt (Transport mit NA, Transport ohne NA) setzt „Notarzt vor Ort“ auf Ja. */
  const waehleAusgang = (ausgang: Ausgang | null) => {
    if (ausgangBrauchtNotarzt(ausgang) && f.notarzt !== true) {
      set({ ausgang, notarzt: true });
      toast.zeige('„Notarzt vor Ort“ auf Ja gesetzt');
    } else {
      set({ ausgang });
    }
  };

  const speichern = async () => {
    setVersucht(true);
    if (hatFehler || !typ || alarmAuf == null || status1Ms == null) {
      if (fehlendeMassnahmen.size > 0) setMassnahmenOffen(true);
      if (fehler.notarzt) setErgebnisOffen(true);
      window.setTimeout(() => document.querySelector('.feld--fehler, .massnahme--fehler')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      return;
    }
    setSpeichert(true);
    const rd = bereichVon(typ) === 'RD';
    const einsatz: Einsatz = ohneLeere({
      ...(bestehend ?? {}),
      dienstId: f.dienstId,
      typ,
      kategorieId: f.kategorie[0],
      mig: typ === 'F' && f.mig ? true : undefined,
      kraefteRtw: rd ? f.rtw : undefined,
      kraefteNef: rd ? f.nef : undefined,
      alarm: alarmAuf,
      status1: status1Ms,
      status2: status2Ms ?? undefined,
      folgeAusStatus1: status2Ms == null && f.status2 === '' && f.folgeAusStatus1 ? true : undefined,
      fahrzeugId: f.fahrzeug[0],
      rolleId: f.rolle[0],
      nachalarmiert: f.nachalarmiert ? true : undefined,
      nachforderungen: f.nachforderungen.length > 0 ? f.nachforderungen : undefined,
      ortGrob: f.ort.trim() || undefined,
      notiz: f.notiz.trim() || undefined,
      tagIds: f.tagIds.length > 0 ? f.tagIds : undefined,
      naca: rd && !fehleinsatz ? (f.naca ?? undefined) : undefined,
      altersgruppe: rd && !fehleinsatz ? (f.alter ?? undefined) : undefined,
      notarztVorOrt: rd && !fehleinsatz ? (f.notarzt ?? undefined) : undefined,
      ausgang: rd || f.ausgang === 'fehleinsatz' ? (f.ausgang ?? undefined) : undefined,
      diagnoseId: rd && !fehleinsatz ? f.diagnose[0] : undefined,
      leitstelleDiagnoseId: rd && !fehleinsatz ? f.leitstelle[0] : undefined,
      alarmBewertung: rd && !fehleinsatz ? (f.bewertung ?? undefined) : undefined,
      massnahmen: !fehleinsatz && f.massnahmen.length > 0 ? f.massnahmen : undefined,
      atemschutz: !fehleinsatz && f.atemschutz ? true : undefined,
      atemschutzMin: !fehleinsatz && f.atemschutz ? f.atemschutzMin : undefined,
      alarmstufe: !rd && stufe != null ? stufe : undefined,
    });
    try {
      await speichereEinsatz(einsatz);
      if (neuesDienstende != null) await verlaengereDienst(f.dienstId, neuesDienstende);
      loescheEntwurf();
      if (neu) {
        toast.zeige('Einsatz gespeichert', {
          aktion: { label: 'Weiterer Einsatz', onClick: () => navigate(`/einsatz/neu?dienst=${f.dienstId}`) },
        });
        navigate(`/dienst/${f.dienstId}`, true);
      } else {
        toast.zeige('Einsatz gespeichert');
        zurueck(`/dienst/${f.dienstId}`);
      }
    } catch {
      toast.zeige('Das Speichern hat nicht geklappt. Bitte noch einmal versuchen.');
      setSpeichert(false);
    }
  };

  const titel = bestehend ? 'Einsatz bearbeiten' : 'Einsatz erfassen';
  const vorschau = typ && f.kategorie[0] != null ? stichwortText(typ, katalogName(daten, f.kategorie[0]), f.mig) : null;

  const fuss = (
    <div className="knopfreihe knopfreihe--fuss">
      {bestehend && (
        <Knopf variante="gefahr" onClick={() => setLoeschen(true)}>
          Löschen
        </Knopf>
      )}
      <Knopf variante="primaer" onClick={() => void speichern()} disabled={speichert}>
        {bestehend ? 'Speichern' : 'Einsatz speichern'}
      </Knopf>
    </div>
  );

  const vorschlag = typ ? bewertungVorschlag({ typ, naca: f.naca, ausgang: f.ausgang }) : null;
  const ergebnisSumme =
    fehleinsatz
      ? 'Fehleinsatz'
      : bereich === 'RD'
      ? [
          f.ausgang ? AUSGANG_INFO[f.ausgang].kurz : '',
          f.naca != null ? `NACA ${NACA_INFO[f.naca - 1]?.roemisch ?? ''}` : '',
          katalogName(daten, f.diagnose[0]),
        ]
          .filter(Boolean)
          .join(' · ')
      : [f.ausgang === 'fehleinsatz' ? 'Fehleinsatz' : '', f.atemschutz ? `Atemschutz ${f.atemschutzMin} min` : ''].filter(Boolean).join(' · ');
  const leitstelleName = katalogName(daten, f.leitstelle[0]);
  const bewertungSumme = f.bewertung
    ? [BEWERTUNG_INFO[f.bewertung].kurz, leitstelleName ? `Leitstelle: ${leitstelleName}` : ''].filter(Boolean).join(' · ')
    : vorschlag
      ? `Vorschlag: ${BEWERTUNG_INFO[vorschlag.bewertung].kurz.toLowerCase()}`
      : leitstelleName
        ? `Leitstelle: ${leitstelleName}`
        : undefined;
  const nachfSumme = f.nachforderungen.map((n) => katalogName(daten, n.ressourceId)).join(', ');
  const fahrzeugSumme = [katalogName(daten, f.fahrzeug[0]), katalogName(daten, f.rolle[0])].filter(Boolean).join(' · ');

  return (
    <Seite titel={titel} zurueckZu={bestehend ? `/dienst/${f.dienstId}` : '/'} fuss={fuss}>
      <div ref={oben} />
      {entwurfHinweis && (
        <Meldung
          art="info"
          aktion={
            <Knopf
              variante="text"
              onClick={() => {
                setEntwurfHinweis(false);
                onVerwerfen();
              }}
            >
              Verwerfen
            </Knopf>
          }
        >
          Dein letzter, nicht gespeicherter Entwurf ist wieder da.
        </Meldung>
      )}

      <DienstWahl dienst={dienst} onWahl={wechsleDienst} zaehle="einsaetze" />

      <Abschnitt titel="Stichwort">
        <Feld label="Einsatzart" fehler={versucht ? fehler.typ : undefined}>
          <EinsatzartReihe
            aktiv={typ}
            onTyp={waehleTyp}
            onUebung={neu ? () => navigate(`/uebung/neu?dienst=${f.dienstId}`, true) : undefined}
          />
        </Feld>

        {typ ? (
          <KatalogAuswahl
            label="Kategorie"
            katalogTyp="kategorie"
            vorschlaege={kategorieVorschlaege}
            alle={kategorieVorschlaege}
            ausgewaehlt={f.kategorie}
            onChange={(ids) => set({ kategorie: ids, alarmstufe: ids[0] === f.kategorie[0] ? f.alarmstufe : null })}
            neuExtra={{ typen: [typ] }}
            ton={bereich === 'RD' ? 'rd' : 'fw'}
            fehler={versucht ? fehler.kategorie : undefined}
            nutzung={kategorieZaehler}
            namenAusgewaehlt={kategorien.namen}
            hinweis={kategorieVorschlaege.length === 0 ? 'Noch keine Kategorie für diesen Typ. Lege mit „+ Neu“ die erste an.' : undefined}
          />
        ) : null}

        {typ === 'F' && <Toggle an={f.mig} onChange={(mig) => set({ mig })} label="MIG – Menschenleben in Gefahr" />}

        {bereich === 'FW' && f.kategorie[0] != null && (
          <Feld
            label="Alarmstufe"
            hinweis={
              aaoVorgabe != null
                ? `Laut AAO Stufe ${aaoVorgabe} (${stufeKraefte(aaoVorgabe)}). Wurde sie erhöht, wähle die höchste Stufe.`
                : 'Dieses Stichwort steht nicht in der AAO. Wähle die Stufe, wenn du sie kennst.'
            }
          >
            <Segment
              wert={stufe != null ? String(stufe) : undefined}
              label="Alarmstufe"
              klein
              onChange={(w) => set({ alarmstufe: Number(w) })}
              optionen={ALARMSTUFEN.map((s) => ({ wert: String(s), label: String(s), ton: 'fw' as const }))}
            />
          </Feld>
        )}

        {bereich === 'RD' && (
          <Feld label="Initialer Kräfteansatz" hinweis="Was bei der Alarmierung vorgesehen war.">
            <div className="kraefte">
              <Stepper label="RTW" wert={f.rtw} min={0} max={5} onChange={(rtw) => set({ rtw })} einheit="RTW" />
              <Stepper label="Notarzt" wert={f.nef} min={0} max={3} onChange={(nef) => set({ nef })} einheit="NEF" />
            </div>
          </Feld>
        )}
        {vorschau && (
          <p className="vorschau" aria-live="polite">
            Stichwort <strong className="zahl">{vorschau}</strong>
            {bereich === 'RD' && <span className="vorschau__kraefte zahl">{kraefteText(f.rtw, f.nef)}</span>}
            {stufe != null && <span className="vorschau__kraefte zahl">{stufeText(stufe)}</span>}
          </p>
        )}
      </Abschnitt>

      <Abschnitt titel="Zeiten">
        <ZeitFeld
          label="Alarmierung"
          wert={f.alarm}
          onChange={(alarm) => set({ alarm })}
          fehler={zeigeZeit('alarm')}
          hinweis={alarmAuf != null ? fmtDatumZeit(alarmAuf) : undefined}
          rechts={<SchnellZeiten label="Alarmierung jetzt" basis={null} minuten={[]} aktivMs={null} jetzt onWahl={(alarm) => set({ alarm })} />}
        />

        <ZeitFeld
          label="Status 1 – einsatzbereit über Funk"
          wert={f.status1}
          onChange={(status1) => set({ status1 })}
          fehler={zeigeZeit('status1')}
          hinweis={dauerMin != null && dauerMin > 0 ? `Einsatzdauer ${fmtDauer(dauerMin)}` : undefined}
          rechts={<SchnellZeiten label="Einsatzdauer wählen" basis={alarmAuf} minuten={bereich === 'FW' ? [30, 60, 90, 120] : [15, 30, 45, 60]} aktivMs={status1Ms} jetzt onWahl={(status1) => set({ status1 })} />}
        />

        <ZeitFeld
          label="Status 2 – einsatzbereit auf Wache"
          wert={f.status2}
          onChange={(status2) => set({ status2 })}
          fehler={zeigeZeit('status2')}
          optional
          hinweis={
            rueckMin != null
              ? `Rückfahrt ${fmtDauer(rueckMin)}`
              : f.folgeAusStatus1
                ? 'Entfällt, weil du aus Status 1 heraus alarmiert wurdest.'
                : 'Für die Wachzeit. Kann auch später nachgetragen werden.'
          }
          rechts={<SchnellZeiten label="Rückfahrt wählen" basis={status1Ms} minuten={[5, 10, 15, 20]} aktivMs={status2Ms} jetzt onWahl={(status2) => set({ status2 })} />}
        />

        {f.status2 === '' && (
          <Toggle
            an={f.folgeAusStatus1}
            onChange={(folgeAusStatus1) => set({ folgeAusStatus1 })}
            label="Danach aus Status 1 alarmiert"
            hinweis="Du warst noch unterwegs und wurdest zum nächsten Einsatz alarmiert, ohne auf Wache zu sein. Status 2 fehlt dann nicht."
          />
        )}

        {dauerMin != null && dauerMin > 8 * 60 && <Meldung art="warnung">Der Einsatz dauert über 8 Stunden. Stimmen Alarmierung und Status 1?</Meldung>}
        {rueckMin != null && rueckMin > 3 * 60 && <Meldung art="warnung">Die Rückfahrt dauert über 3 Stunden. Stimmt Status 2?</Meldung>}
        {ueberschneidung && (
          <Meldung art="warnung">
            Überschneidet sich mit {einsatzTitel(daten, ueberschneidung)} ({fmtZeit(ueberschneidung.alarm)}–{fmtZeit(ueberschneidung.status1)}).
          </Meldung>
        )}
        {neuesDienstende != null && (
          <Meldung art="info">
            Der Einsatz reicht über das Dienstende ({fmtZeit(dienst.ende)}) hinaus. Beim Speichern wird das Dienstende auf{' '}
            <strong className="zahl">{fmtZeit(neuesDienstende)}</strong> gesetzt
            {hatPlan(dienst) && (
              <>
                {' '}
                – <span className="zahl">{fmtSaldo(dienstSaldo({ ...dienst, ende: neuesDienstende }).saldoMin)}</span> gegenüber dem Plan
              </>
            )}
            .
          </Meldung>
        )}
      </Abschnitt>

      {bereich === 'RD' && (
        <Aufklappen titel="Ergebnis und Befund" zusatz={ergebnisSumme || undefined} offen={ergebnisOffen} onToggle={() => setErgebnisOffen((o) => !o)}>
          <AusgangWahl wert={f.ausgang} onChange={waehleAusgang} />
          {fehleinsatz ? (
            <p className="hinweis">Bei einem Fehleinsatz entfallen Befund, Maßnahmen und Bewertung.</p>
          ) : (
            <>
              <NacaWahl wert={f.naca} onChange={(naca) => set({ naca })} />
              <KatalogAuswahl
                label="Verdachtsdiagnose"
                katalogTyp="diagnose"
                vorschlaege={diagnosen.vorschlaege}
                alle={diagnosen.alle}
                ausgewaehlt={f.diagnose}
                onChange={(ids) => set({ diagnose: ids })}
                klein
                nutzung={diagnosen.zaehler}
                namenAusgewaehlt={diagnosen.namen}
                hinweis="Dein Befund vor Ort. Was fehlt, legst du mit „+ Neu“ an."
              />
              <AlterWahl wert={f.alter} onChange={(alter) => set({ alter })} />
              <JaNein label="Notarzt vor Ort" wert={f.notarzt} onChange={(notarzt) => set({ notarzt })} fehler={fehler.notarzt} />
            </>
          )}
        </Aufklappen>
      )}

      {bereich === 'FW' && (
        <Aufklappen titel="Ergebnis und Atemschutz" zusatz={ergebnisSumme || undefined} offen={ergebnisOffen} onToggle={() => setErgebnisOffen((o) => !o)}>
          <Toggle
            an={f.ausgang === 'fehleinsatz'}
            onChange={(an) => set({ ausgang: an ? 'fehleinsatz' : null })}
            label="Fehleinsatz"
            hinweis="Keine Einsatzstelle oder kein Einsatzgrund vorgefunden, z. B. Fehlalarm oder abgebrochen."
          />
          {!fehleinsatz && <Toggle an={f.atemschutz} onChange={(atemschutz) => set({ atemschutz })} label="Atemschutzeinsatz" />}
          {!fehleinsatz && f.atemschutz && (
            <Feld label="Dauer unter Atemschutz">
              <Stepper label="Minuten unter Atemschutz" wert={f.atemschutzMin} min={5} max={240} schritt={5} onChange={(atemschutzMin) => set({ atemschutzMin })} einheit="min" />
            </Feld>
          )}
        </Aufklappen>
      )}

      {bereich && !fehleinsatz && (
        <Aufklappen
          titel={bereich === 'FW' ? 'Maßnahmen auf Befehl' : 'Maßnahmen und Medikamente'}
          zusatz={f.massnahmen.length > 0 ? `${f.massnahmen.length} Maßnahme${f.massnahmen.length === 1 ? '' : 'n'}` : undefined}
          offen={massnahmenOffen}
          onToggle={() => setMassnahmenOffen((o) => !o)}
        >
          {bereich === 'FW' ? (
            <>
              <p className="hinweis">Nur, was du selbst auf Befehl ausgeführt hast.</p>
              <FwMassnahmenBlock werte={f.massnahmen} onChange={(massnahmen) => set({ massnahmen })} />
            </>
          ) : (
            <>
              <p className="hinweis">Nur, was du selbst durchgeführt hast.</p>
              <MassnahmenBlock werte={f.massnahmen} onChange={(massnahmen) => set({ massnahmen })} fehlende={versucht ? fehlendeMassnahmen : undefined} region={region} />
            </>
          )}
        </Aufklappen>
      )}

      {bereich === 'RD' && !fehleinsatz && (
        <Aufklappen titel="Alarmierung bewerten" zusatz={bewertungSumme} offen={bewertungOffen} onToggle={() => setBewertungOffen((o) => !o)}>
          <AlarmierungBewerten
            bewertung={f.bewertung}
            onBewertung={(bewertung) => set({ bewertung })}
            vorschlag={vorschlag}
            leitstelle={f.leitstelle}
            onLeitstelle={(leitstelle) => set({ leitstelle })}
            diagnosen={diagnosen}
            diagnoseVorOrt={f.diagnose[0]}
          />
        </Aufklappen>
      )}

      <Aufklappen titel="Fahrzeug und Rolle" zusatz={fahrzeugSumme || undefined} offen={fahrzeugOffen} onToggle={() => setFahrzeugOffen((o) => !o)}>
        <KatalogAuswahl
          label="Fahrzeug"
          katalogTyp="fahrzeug"
          vorschlaege={fahrzeuge.vorschlaege}
          alle={fahrzeuge.alle}
          ausgewaehlt={f.fahrzeug}
          onChange={(ids) => set({ fahrzeug: ids })}
          nutzung={fahrzeuge.zaehler}
          namenAusgewaehlt={fahrzeuge.namen}
          neuExtra={bereich ? { bereich } : undefined}
        />
        <KatalogAuswahl
          label="Rolle"
          katalogTyp="rolle"
          vorschlaege={rollen.vorschlaege}
          alle={rollen.alle}
          ausgewaehlt={f.rolle}
          onChange={(ids) => set({ rolle: ids })}
          nutzung={rollen.zaehler}
          namenAusgewaehlt={rollen.namen}
          neuExtra={bereich ? { bereich } : undefined}
        />
      </Aufklappen>

      <Aufklappen titel="Nachforderungen" zusatz={f.nachalarmiert ? `nachalarmiert${nachfSumme ? ' · ' + nachfSumme : ''}` : nachfSumme || undefined} offen={nachfOffen} onToggle={() => setNachfOffen((o) => !o)}>
        <Toggle an={f.nachalarmiert} onChange={(nachalarmiert) => set({ nachalarmiert })} label="Mein Fahrzeug wurde nachalarmiert" hinweis="Du wurdest zu einem laufenden Einsatz nachgefordert." />
        <KatalogAuswahl
          label="Nachgefordert"
          katalogTyp="ressource"
          vorschlaege={ressourcen.vorschlaege}
          alle={ressourcen.alle}
          ausgewaehlt={f.nachforderungen.map((n) => n.ressourceId)}
          mehrfach
          onChange={(ids) =>
            set({
              nachforderungen: ids.map((rid) => f.nachforderungen.find((n) => n.ressourceId === rid) ?? { ressourceId: rid, vonMir: true }),
            })
          }
          nutzung={ressourcen.zaehler}
          namenAusgewaehlt={ressourcen.namen}
        />
        {f.nachforderungen.map((n) => (
          <Feld key={n.ressourceId} label={`${katalogName(daten, n.ressourceId)} nachgefordert von`}>
            <Segment<'mir' | 'andere'>
              klein
              label={`${katalogName(daten, n.ressourceId)} nachgefordert von`}
              wert={n.vonMir ? 'mir' : 'andere'}
              onChange={(w) => set({ nachforderungen: f.nachforderungen.map((x) => (x.ressourceId === n.ressourceId ? { ...x, vonMir: w === 'mir' } : x)) })}
              optionen={[
                { wert: 'mir', label: 'Mir' },
                { wert: 'andere', label: 'Anderen' },
              ]}
            />
          </Feld>
        ))}
      </Aufklappen>

      <Aufklappen titel="Ort, Stichwörter, Notiz" zusatz={f.ort || f.notiz || f.tagIds.length ? 'ausgefüllt' : undefined} offen={weitereOffen} onToggle={() => setWeitereOffen((o) => !o)}>
        <TextFeld label="Ort (grob)" wert={f.ort} onChange={(ort) => set({ ort })} maxLength={60} hinweis="Nur grob, z. B. Stadtteil oder Straßenart. Keine Adresse, keine Namen." />
        <KatalogAuswahl
          label="Stichwörter (Tags)"
          katalogTyp="tag"
          vorschlaege={tags.vorschlaege}
          alle={tags.alle}
          ausgewaehlt={f.tagIds}
          mehrfach
          onChange={(ids) => set({ tagIds: ids })}
          nutzung={tags.zaehler}
          namenAusgewaehlt={tags.namen}
          hinweis="Zum Wiederfinden, z. B. „Reanimation“ oder „Verkehrsunfall“."
        />
        <TextFeld label="Notiz" wert={f.notiz} onChange={(notiz) => set({ notiz })} mehrzeilig maxLength={500} hinweis="Keine Patientendaten, keine Namen, keine genauen Adressen." />
      </Aufklappen>

      {versucht && hatFehler && <Meldung art="fehler">Bitte prüfe die markierten Felder.</Meldung>}

      <Bestaetigung
        offen={loeschen}
        titel="Einsatz löschen?"
        gefahr
        jaText="Endgültig löschen"
        text={`${vorschau ?? 'Der Einsatz'} wird gelöscht. Das lässt sich nicht rückgängig machen.`}
        onNein={() => setLoeschen(false)}
        onJa={async () => {
          if (!bestehend) return;
          await loescheEinsatz(bestehend.id!);
          setLoeschen(false);
          toast.zeige('Einsatz gelöscht');
          navigate(`/dienst/${f.dienstId}`, true);
        }}
      />
    </Seite>
  );
}
