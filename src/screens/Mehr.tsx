import { navigate } from '../router';
import { useDaten } from '../state/daten';
import { fmtDatum } from '../domain/time';
import { Icon } from '../ui/icons';
import { Seite } from '../ui/seite';
import { APP_VERSION } from '../version';

export function Mehr() {
  const { einst, einsaetze } = useDaten();
  const jetzt = Date.now();
  const tage = einst.letztesBackup != null ? Math.floor((jetzt - einst.letztesBackup) / 86_400_000) : null;
  const faellig = einsaetze.length > 0 && einst.backupErinnerungTage > 0 && (tage == null || tage >= einst.backupErinnerungTage);
  const backupInfo =
    einst.letztesBackup == null ? 'Noch nie gesichert' : `Zuletzt am ${fmtDatum(einst.letztesBackup)}`;

  const zeilen: { pfad: string; titel: string; info: string; hinweis?: boolean }[] = [
    { pfad: '/mehr/einstellungen', titel: 'Einstellungen', info: 'Farbschema, Dienstbeginn, Auswertung' },
    { pfad: '/mehr/kataloge', titel: 'Listen pflegen', info: 'Stichworte, Maßnahmen, Wachen, Standorte' },
    { pfad: '/mehr/backup', titel: 'Sicherung', info: `${backupInfo} · CSV-Export`, hinweis: faellig },
    { pfad: '/mehr/ueber', titel: 'Über Einsatzlog', info: `Version ${APP_VERSION}, Datenschutz, Quellen` },
  ];

  return (
    <Seite titel="Mehr">
      <ul className="menue">
        {zeilen.map((z) => (
          <li key={z.pfad}>
            <button type="button" className="menuezeile" onClick={() => navigate(z.pfad)}>
              <span className="menuezeile__text">
                <span className="menuezeile__titel">{z.titel}</span>
                <span className="menuezeile__info">{z.info}</span>
              </span>
              {z.hinweis && <span className="menuezeile__punkt" role="img" aria-label="Sicherung fällig" />}
              <Icon name="weiter" groesse={20} />
            </button>
          </li>
        ))}
      </ul>
    </Seite>
  );
}
