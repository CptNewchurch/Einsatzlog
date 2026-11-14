import { useEffect, useRef, useState } from 'react';
import { backupDateiname, BackupFehler, erzeugeBackup, leseBackupText, merkeBackupZeitpunkt, stelleWiederHer, type BackupDatei } from '../db/backup';
import { csvDateiname, erzeugeDiensteCsv, erzeugeEinsaetzeCsv } from '../db/csv';
import { loescheAlleDaten } from '../db/speichern';
import { fmtDatumZeit, fmtZahl } from '../domain/time';
import { navigate } from '../router';
import { useDaten } from '../state/daten';
import { Abschnitt, Knopf, Meldung, TextFeld } from '../ui/controls';
import { Bestaetigung, useToast } from '../ui/overlays';
import { Seite } from '../ui/seite';

/** Lädt eine Datei über den Browser herunter. */
function ladeHerunter(inhalt: string, name: string, typ: string) {
  const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

/** Teilt eine Datei über das Android-Menü (Drive, Dateien, Mail …). Liefert false, wenn das nicht möglich ist. */
async function teileDatei(inhalt: string, name: string, typ: string): Promise<boolean> {
  const datei = new File([inhalt], name, { type: typ });
  if (!navigator.canShare?.({ files: [datei] })) return false;
  try {
    await navigator.share({ files: [datei], title: name });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    throw e;
  }
}

const teilenMoeglich = () => typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.json', { type: 'application/json' })] });

function vorAlterText(letztes: number | undefined, jetzt: number): string {
  if (letztes == null) return 'Noch nie gesichert';
  const tage = Math.floor((jetzt - letztes) / 86_400_000);
  const wann = tage <= 0 ? 'heute' : tage === 1 ? 'gestern' : `vor ${tage} Tagen`;
  return `${fmtDatumZeit(letztes)} (${wann})`;
}

export function Backup() {
  const { dienste, einsaetze, katalog, katalogMap, einst } = useDaten();
  const toast = useToast();
  const [geschuetzt, setGeschuetzt] = useState<boolean | null>(null);
  const [fehler, setFehler] = useState<string | undefined>();
  const [vorschau, setVorschau] = useState<BackupDatei | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const [tippe, setTippe] = useState('');
  const dateiFeld = useRef<HTMLInputElement>(null);
  const jetzt = Date.now();

  useEffect(() => {
    navigator.storage?.persisted?.().then(setGeschuetzt).catch(() => setGeschuetzt(null));
  }, []);

  const sichern = async (teilen: boolean) => {
    setArbeitet(true);
    try {
      const datei = await erzeugeBackup();
      const text = JSON.stringify(datei);
      const name = backupDateiname(datei.exportiertAm);
      if (teilen) {
        const ok = await teileDatei(text, name, 'application/json');
        if (!ok) {
          setArbeitet(false);
          return;
        }
      } else {
        ladeHerunter(text, name, 'application/json');
      }
      await merkeBackupZeitpunkt();
      toast.zeige(teilen ? 'Sicherung geteilt' : 'Sicherung gespeichert');
    } catch {
      toast.zeige('Die Sicherung hat nicht geklappt. Bitte noch einmal versuchen.');
    }
    setArbeitet(false);
  };

  const exportiere = async (art: 'einsaetze' | 'dienste') => {
    const text =
      art === 'einsaetze'
        ? erzeugeEinsaetzeCsv(dienste, einsaetze, katalogMap)
        : erzeugeDiensteCsv(dienste, einsaetze, katalogMap, einst.wachzeitMitDienstRand);
    const name = csvDateiname(art, Date.now());
    if (teilenMoeglich() && (await teileDatei(text, name, 'text/csv').catch(() => false))) return;
    ladeHerunter(text, name, 'text/csv;charset=utf-8');
  };

  const waehleDatei = async (datei: File | undefined) => {
    setFehler(undefined);
    if (!datei) return;
    try {
      setVorschau(leseBackupText(await datei.text()));
    } catch (e) {
      setFehler(e instanceof BackupFehler ? e.message : 'Die Datei lässt sich nicht lesen.');
    }
    if (dateiFeld.current) dateiFeld.current.value = '';
  };

  const spieleEin = async () => {
    if (!vorschau) return;
    setArbeitet(true);
    try {
      const r = await stelleWiederHer(vorschau);
      setVorschau(null);
      toast.zeige(`${fmtZahl(r.dienste)} Dienste und ${fmtZahl(r.einsaetze)} Einsätze eingespielt`);
      navigate('/', true);
    } catch {
      setFehler('Das Einspielen hat nicht geklappt. Deine bisherigen Daten sind unverändert.');
      setVorschau(null);
    }
    setArbeitet(false);
  };

  const alsLeer = dienste.length === 0 && einsaetze.length === 0;

  return (
    <Seite titel="Sicherung" zurueckZu="/mehr">
      <Meldung art={einst.letztesBackup == null && !alsLeer ? 'warnung' : 'info'}>
        <strong>Letzte Sicherung:</strong> {vorAlterText(einst.letztesBackup, jetzt)}
        <br />
        Alle Daten liegen nur auf diesem Handy. Wenn es verloren geht oder du den Browser zurücksetzt, sind sie weg – es sei denn, du hast gesichert.
      </Meldung>

      <Abschnitt titel="Sichern">
        <p className="hinweis">
          Die Sicherung ist eine Datei mit allen Diensten, Einsätzen und Listen. Sie ist nicht verschlüsselt; bewahre sie dort auf, wo du auch andere persönliche Dokumente aufbewahrst.
        </p>
        <div className="knopfstapel">
          <Knopf variante="primaer" voll onClick={() => void sichern(false)} disabled={arbeitet || alsLeer}>
            Sicherung speichern
          </Knopf>
          {teilenMoeglich() && (
            <Knopf voll onClick={() => void sichern(true)} disabled={arbeitet || alsLeer}>
              Sicherung teilen …
            </Knopf>
          )}
        </div>
        <p className="hinweis">
          „Speichern“ legt die Datei im Download-Ordner ab. Über „Teilen“ schickst du sie direkt in Google Drive, Dateien oder eine andere App.
        </p>
      </Abschnitt>

      <Abschnitt titel="Sicherung einspielen">
        <p className="hinweis">Ersetzt alle Daten auf diesem Handy durch den Inhalt einer Sicherung, zum Beispiel auf einem neuen Gerät.</p>
        <input
          ref={dateiFeld}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          aria-label="Sicherungsdatei wählen"
          onChange={(e) => void waehleDatei(e.target.files?.[0])}
        />
        <Knopf voll onClick={() => dateiFeld.current?.click()} disabled={arbeitet}>
          Sicherungsdatei wählen
        </Knopf>
        {fehler && <Meldung art="fehler">{fehler}</Meldung>}
      </Abschnitt>

      <Abschnitt titel="Für Excel und Tabellen">
        <p className="hinweis">CSV-Dateien öffnest du in Excel, Numbers oder LibreOffice, zum Beispiel für eigene Nachweise.</p>
        <div className="knopfstapel">
          <Knopf voll onClick={() => void exportiere('einsaetze')} disabled={einsaetze.length === 0}>
            Einsätze als CSV
          </Knopf>
          <Knopf voll onClick={() => void exportiere('dienste')} disabled={dienste.length === 0}>
            Dienste mit Über-/Minusstunden als CSV
          </Knopf>
        </div>
      </Abschnitt>

      <Abschnitt titel="Speicher">
        <dl className="angaben">
          <div>
            <dt>Dienste</dt>
            <dd className="zahl">{fmtZahl(dienste.length)}</dd>
          </div>
          <div>
            <dt>Einsätze</dt>
            <dd className="zahl">{fmtZahl(einsaetze.length)}</dd>
          </div>
          <div>
            <dt>Listeneinträge</dt>
            <dd className="zahl">{fmtZahl(katalog.length)}</dd>
          </div>
          <div>
            <dt>Schutz vor automatischem Löschen</dt>
            <dd>{geschuetzt == null ? 'unbekannt' : geschuetzt ? 'aktiv' : 'nicht aktiv'}</dd>
          </div>
        </dl>
        {geschuetzt === false && (
          <p className="hinweis">
            Installiere die App über das Chrome-Menü („Zum Startbildschirm hinzufügen“). Dann schützt Android die Daten besser vor dem automatischen Aufräumen.
          </p>
        )}
      </Abschnitt>

      <Abschnitt titel="Alles löschen">
        <p className="hinweis">Entfernt alle Dienste, Einsätze und eigenen Listeneinträge von diesem Handy. Die Startlisten kommen zurück.</p>
        <Knopf variante="gefahr" voll onClick={() => { setTippe(''); setLoeschen(true); }} disabled={alsLeer && katalog.length === 0}>
          Alle Daten löschen …
        </Knopf>
      </Abschnitt>

      <Bestaetigung
        offen={vorschau != null}
        titel="Sicherung einspielen?"
        gefahr
        jaText="Jetzt einspielen"
        jaAktiv={!arbeitet}
        onNein={() => setVorschau(null)}
        onJa={() => void spieleEin()}
        text={
          vorschau && (
            <>
              <p>
                Sicherung vom <strong>{fmtDatumZeit(vorschau.exportiertAm)}</strong>: {fmtZahl(vorschau.daten.dienste.length)} Dienste,{' '}
                {fmtZahl(vorschau.daten.einsaetze.length)} Einsätze, {fmtZahl(vorschau.daten.katalog.length)} Listeneinträge.
              </p>
              <p>
                Auf diesem Handy sind jetzt {fmtZahl(dienste.length)} Dienste und {fmtZahl(einsaetze.length)} Einsätze. <strong>Sie werden ersetzt.</strong>
              </p>
            </>
          )
        }
      />

      <Bestaetigung
        offen={loeschen}
        titel="Wirklich alles löschen?"
        gefahr
        jaText="Endgültig löschen"
        jaAktiv={tippe.trim().toUpperCase() === 'LÖSCHEN' && !arbeitet}
        onNein={() => setLoeschen(false)}
        onJa={async () => {
          setArbeitet(true);
          await loescheAlleDaten();
          setArbeitet(false);
          setLoeschen(false);
          toast.zeige('Alle Daten gelöscht');
          navigate('/', true);
        }}
        text="Das lässt sich nicht rückgängig machen. Sichere vorher, wenn du die Daten noch brauchst."
        extra={<TextFeld label="Zur Bestätigung LÖSCHEN eintippen" wert={tippe} onChange={setTippe} maxLength={10} />}
      />
    </Seite>
  );
}
