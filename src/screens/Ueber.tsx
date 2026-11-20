import { useState } from 'react';
import { NACA_BEISPIELE } from '../domain/nacaBeispiele';
import { Abschnitt, Knopf } from '../ui/controls';
import { useToast } from '../ui/overlays';
import { Seite } from '../ui/seite';
import { suchePruefeUpdate } from '../ui/update';
import { APP_VERSION } from '../version';

const UPDATE_TEXT = {
  neu: 'Neue Version gefunden. Sie wird geladen, gleich kannst du aktualisieren.',
  aktuell: `Du hast die neueste Version ${APP_VERSION}.`,
  offline: 'Keine Verbindung. Versuche es noch einmal, wenn du Netz hast.',
  'nicht-moeglich': 'Die Suche gibt es nur in der installierten App.',
} as const;

const NACA_ANZAHL = NACA_BEISPIELE.length;
const NACA_LIT = NACA_BEISPIELE.filter((b) => b.lit).length;

export function Ueber() {
  const toast = useToast();
  const [sucht, setSucht] = useState(false);

  const suche = async () => {
    setSucht(true);
    const ergebnis = await suchePruefeUpdate();
    setSucht(false);
    toast.zeige(UPDATE_TEXT[ergebnis]);
  };

  return (
    <Seite titel="Über Einsatzlog" zurueckZu="/mehr">
      <p className="text">
        Einsatzlog ist dein persönliches Einsatzbuch für Rettungsdienst und Feuerwehr. Version <span className="zahl">{APP_VERSION}</span>.
      </p>
      <Knopf variante="sekundaer" onClick={() => void suche()} disabled={sucht}>
        {sucht ? 'Suche läuft …' : 'Nach Updates suchen'}
      </Knopf>

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
          <li>Zusatzdienste und Übungsdienste haben keinen Plan und zählen nicht zu Über- und Minusstunden.</li>
          <li><strong>Übung:</strong> eine Einsatzart neben Rettungsdienst und Feuerwehr, die nicht als Einsatz zählt. Die Zeit, in der du auf Wache übst, zählt nicht zur Wachzeit. In einem Übungsdienst zählt die ganze Zeit als Übung.</li>
          <li><strong>Atemschutz:</strong> Einsätze und Übungen, die du als Atemschutzeinsatz wertest, werden zusammen gezählt, mit der Zeit unter Atemschutz. Die Statistik zeigt beides getrennt und zusammen.</li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="NACA-Beispiele">
        <p className="text">
          Welches Krankheitsbild zu welchem NACA-Wert gehört, ist nirgends amtlich festgelegt: Der Wert beschreibt den Zustand des Patienten, nicht die Diagnose allein. Die Tabelle beim NACA-Feld („Beispiele“) ist deshalb ein Richtwert. Von den <span className="zahl">{NACA_ANZAHL}</span> Einträgen sind <span className="zahl">{NACA_LIT}</span> mit „Lit.“ gekennzeichnet, sie stehen so in der Fachliteratur (DocCheck Flexikon, Wikipedia). Die übrigen sind aus den Definitionen der Stufen und aus Einstufungen nach Schwere abgeleitet (Notarztindikationskatalog Hessen 2024, Notarztindikationen aus Innsbruck, Schutz und Rettung Zürich). Die Einstufung bleibt deine fachliche Entscheidung.
        </p>
      </Abschnitt>

      <Abschnitt titel="Stichworte der Feuerwehr">
        <p className="text">
          Die Stichworte für Feuer, Hilfeleistung und ABC sind nach der AAO der Berufsfeuerwehr Bergisch Gladbach (Version 5.2) vorbelegt. Die „MiG“-Zeilen der AAO erfasst du über den Schalter „MIG“ beim Feuer-Stichwort. Unter Mehr → Listen pflegen kannst du Stichworte umbenennen, ausblenden oder ergänzen.
        </p>
        <p className="text">
          Zu jedem Stichwort schlägt die App die Alarmstufe der AAO vor: Stufe 0 ist ein HLF, ab Stufe 1 zählt die Zahl der Staffeln, Stufe 6 sind sechs Staffeln. Wurde nachalarmiert, wählst du die höchste Stufe. Die Statistik zählt die Einsätze je Stufe und zeigt, wie oft sie höher lag als in der AAO.
        </p>
      </Abschnitt>

      <Abschnitt titel="Maßnahmen auf Befehl">
        <p className="text">
          Im Feuerwehreinsatz erfasst du die Maßnahmen, die du auf Befehl des Einsatzleiters oder Gruppenführers ausgeführt hast, zum Beispiel Löschangriff oder Türöffnung. Dafür gibt es eine eigene Liste, die mit deinen Einsätzen wächst.
        </p>
      </Abschnitt>

      <Abschnitt titel="Maßnahmen in Übungen">
        <p className="text">
          Was du in einer Übung selbst durchgeführt hast, trägst du in der Übung ein, aus der Liste der Feuerwehr oder des Rettungsdienstes. Eine Rechtsgrundlage ist dafür nicht nötig. Diese Maßnahmen werden bei den Übungen getrennt gezählt und fließen nicht in den Maßnahmen-Nachweis der Einsätze ein.
        </p>
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
