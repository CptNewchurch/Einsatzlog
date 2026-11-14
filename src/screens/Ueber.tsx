import { Abschnitt } from '../ui/controls';
import { Seite } from '../ui/seite';
import { APP_VERSION } from '../version';

export function Ueber() {
  return (
    <Seite titel="Über Einsatzlog" zurueckZu="/mehr">
      <p className="text">
        Einsatzlog ist dein persönliches Einsatzbuch für Rettungsdienst und Feuerwehr. Version <span className="zahl">{APP_VERSION}</span>.
      </p>

      <Abschnitt titel="Deine Daten bleiben bei dir">
        <p className="text">
          Alle Einträge liegen ausschließlich im Speicher dieses Handys. Es gibt kein Konto, keinen Server und keine Auswertung durch Dritte. Nach der Installation lädt die App nichts mehr aus dem Internet nach und funktioniert auch ohne Netz.
        </p>
        <p className="text">
          Erfasse keine Patientendaten: keine Namen, Adressen oder Geburtsdaten. Ort und Notiz sind für grobe Hinweise gedacht.
        </p>
      </Abschnitt>

      <Abschnitt titel="So wird gerechnet">
        <ul className="punkte">
          <li><strong>Einsatzdauer:</strong> Alarmierung bis Status 1.</li>
          <li><strong>Rückfahrt:</strong> Status 1 bis Status 2.</li>
          <li><strong>Wachzeit:</strong> Status 2 bis zur nächsten Alarmierung, auf Wunsch auch Dienstanfang und -ende.</li>
          <li><strong>Überstunden:</strong> Dienstantritt vor dem geplanten Beginn plus Dienstende nach dem geplanten Ende.</li>
          <li><strong>Minusstunden:</strong> später angetreten oder früher abgelöst.</li>
          <li>Zusatzdienste haben keinen Plan und zählen nicht zu Über- und Minusstunden.</li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="Maßnahmen und Rechtsgrundlage">
        <p className="text">
          Die Liste der Medikamente und invasiven Maßnahmen sowie die vorgeschlagene Einordnung stammen aus dem Gemeinsamen Kompendium Rettungsdienst 2026 (Region Rheinisch-Bergischer Kreis).
        </p>
        <ul className="punkte">
          <li><strong>Vorabdelegation:</strong> § 4 Abs. 2 Nr. 2c NotSanG, im Kompendium mit ★ gekennzeichnet.</li>
          <li><strong>Eigenverantwortlich:</strong> § 2a NotSanG, bis zum Eintreffen des Notarztes bei Lebensgefahr.</li>
          <li><strong>Auf Anordnung:</strong> § 4 Abs. 2 Nr. 2b NotSanG, durch Notarzt oder Telenotarzt.</li>
        </ul>
        <p className="text">
          Der Vorschlag ist eine Orientierung und keine Rechtsberatung. Verbindlich sind immer die aktuellen Vorgaben deines Ärztlichen Leiters Rettungsdienst. Die App ersetzt kein Einsatzprotokoll.
        </p>
      </Abschnitt>
    </Seite>
  );
}
