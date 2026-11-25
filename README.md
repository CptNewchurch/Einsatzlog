# Einsatzlog

Persönliche Einsatzdokumentation für Notfallsanitäter und Feuerwehr: Dienste und Einsätze erfassen, Maßnahmen nachweisen und alles auswerten. Die App läuft im Browser, lässt sich auf dem Android-Handy wie eine App installieren und funktioniert danach **ohne Internet**.

## Was sie kann

- **Dienste** mit Soll- und Ist-Zeiten (z. B. 07:30–07:30), automatisch berechneten Über- und Minusstunden und Wachen. Dazu **Zusatzdienste** (anderer Ort, kein Plan) und reine **Übungsdienste** (z. B. Übungsabend oder Lehrgangstag).
- **Einsätze** in Sekunden erfassen, Details sind optional und auch nach dem Dienst nachtragbar.
  - Alarmstichwort wie in der Praxis: Rettungsdienst `R`/`N` mit Fachrichtung und Kräfteansatz (z. B. R1N1), Feuerwehr `F`/`H`/`ABC` mit Kategorie, MIG, **Alarmstufe** (0–6, Vorschlag aus der AAO, bei Nachalarmierung die höchste Stufe) und Atemschutz. Die Stichworte der Feuerwehr sind nach der AAO der Berufsfeuerwehr Bergisch Gladbach (V 5.2) vorbelegt und lassen sich unter **Mehr → Listen pflegen** anpassen.
  - Zeiten: Alarm, Status 1, Status 2. Daraus folgen Einsatzdauer, Rückfahrt und Wachzeit. Fehlt Status 2, weil du aus Status 1 heraus zum nächsten Einsatz alarmiert wurdest, markierst du das („Danach aus Status 1 alarmiert“): Die Zeit bis dahin zählt als Rückfahrt, und der fehlende Status 2 gilt nicht als Lücke.
  - **Ergebnis** (Transport, Transport mit NA, Transport ohne NA, ambulant versorgt, lehnt ab, verstorben, nur Transport, Hilfeleistung, Fehleinsatz), **NACA** (mit durchsuchbarer Beispieltabelle: Krankheitsbilder und Verletzungen je Wert), **Verdachtsdiagnose** und der **Verdacht laut Leitstelle**.
  - **Alarmierung bewerten**: passend, zu hoch oder zu niedrig – mit automatischem Vorschlag aus NACA und Ergebnis.
  - **Maßnahmen und Medikamente** nach dem Gemeinsamen Kompendium Rettungsdienst 2026, getrennt nach Vorabdelegation, eigenverantwortlich und auf Anordnung.
  - **Maßnahmen auf Befehl** im Feuerwehreinsatz (z. B. Löschangriff, Türöffnung, Messen) aus einer eigenen, wachsenden Liste in fünf Gruppen.
- **Übungen** als eigene Einsatzart neben Rettungsdienst und Feuerwehr: Art, Thema, Ort, Beginn und Ende. Sie zählen nicht als Einsatz und haben eine eigene Auswertung. Die Übungszeit in der Schicht wird aus der Wachzeit herausgerechnet, in einem Übungsdienst zählt die ganze Dienstzeit als Übung.
  - **Atemschutz:** Eine Übung lässt sich als Atemschutzeinsatz werten, mit der Zeit unter Atemschutz. Die Statistik zählt Einsätze und Übungen zusammen und zeigt beides auch getrennt.
  - **Maßnahmen in Übungen** aus der Liste der Feuerwehr oder des Rettungsdienstes, ohne Rechtsgrundlage. Sie werden getrennt bei den Übungen gezählt und nicht im Maßnahmen-Nachweis der Einsätze.
- **Statistik**: Einsätze je Monat, Wochentag und Tageszeit, häufigste Stichworte, Dienstzeit-Aufteilung, Über-/Minusstunden, Maßnahmen-Nachweis (Rettungsdienst) und Maßnahmen auf Befehl (Feuerwehr), Einsätze nach Alarmstufe, Atemschutz aus Einsätzen und Übungen, Übungszeit nach Art, Maßnahmen in Übungen, Schweregrad (NACA), Übertriage und Abweichungen zwischen Leitstelle und Befund.
- **Sicherung** als Datei, **CSV-Export** für Excel (Einsätze, Dienste, Übungen), Hell- und Dunkelmodus.

## Datenschutz

Alle Daten bleiben **auf dem Gerät** (IndexedDB im Browser). Es gibt keinen Server, kein Konto, keine Cloud, kein Tracking und keine externen Schriften. Trage keine Patientendaten ein: Notiz und Ort sind nur für grobe Hinweise gedacht.

Weil die Daten nur auf dem Handy liegen, sind sie weg, wenn du die Browserdaten löschst oder das Handy verlierst. Erstelle deshalb regelmäßig eine Sicherung (**Mehr → Sicherung**). Die Startseite erinnert dich daran, wenn die letzte Sicherung zu lange her ist (einstellbar unter **Mehr → Einstellungen**).

## Auf dem Handy installieren (Android)

1. Die Adresse der App in **Chrome** öffnen.
2. Menü (⋮) → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.
3. Die App startet danach wie jede andere und braucht kein Netz mehr. Updates holt sie sich, sobald du wieder online bist; die App fragt, ob sie neu laden soll.

## Veröffentlichen mit GitHub Pages

Das ist einmalig nötig, damit die App unter einer Adresse erreichbar ist. Im Repository liegt nur der Programmcode, keine Daten von dir.

1. Auf GitHub ein **neues, leeres Repository** anlegen (öffentlich, z. B. `einsatzlog`). Es darf nichts Persönliches enthalten.
2. Den Inhalt dieses Ordners hineinlegen, Hauptzweig `main`.
3. Im Repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Der Workflow unter `.github/workflows/deploy.yml` baut die App und veröffentlicht sie. Fortschritt im Reiter **Actions**.
5. Die Adresse lautet `https://<dein-name>.github.io/<repository>/`.

Heißt das Repository `<dein-name>.github.io`, muss der Pfad `/` statt `/<repository>/` sein. Dann im Workflow `BASE_PATH` auf `/` setzen.

## Entwicklung

```bash
npm install
npm run dev          # Entwicklungsserver
npm test             # Tests
npm run build        # Produktionsbuild nach dist/
```

- Für GitHub Pages wird beim Bauen `BASE_PATH` gesetzt, z. B. `BASE_PATH=/einsatzlog/ npm run build`.
- Nur im Entwicklungsserver füllt `http://localhost:5173/?demo=1` die App mit Beispieldaten. Dieser Code ist im fertigen Build nicht enthalten.
- Technik: React, TypeScript, Vite, Dexie (IndexedDB), vite-plugin-pwa, Vitest.

## Quellen und Hinweise

- Die Liste der Maßnahmen und Medikamente folgt dem **Gemeinsamen Kompendium Rettungsdienst 2026** (Region: Rheinisch-Bergischer Kreis). Die Einordnung als Vorabdelegation (§ 4 Abs. 2 Nr. 2c NotSanG) oder eigenverantwortliche Durchführung (§ 2a NotSanG) stammt von dort. „Auf Anordnung“ (§ 4 Abs. 2 Nr. 2b NotSanG) ist eine Ergänzung für Maßnahmen auf Anweisung von Notarzt oder Telenotarzt.
- Die App ist ein persönliches Hilfsmittel für eigene Aufzeichnungen und ersetzt weder das Einsatzprotokoll noch die offizielle Dokumentation.
