import { useState } from 'react';
import { speichereEinstellungen } from '../db/einstellungen';
import { regionName, REGIONEN_MIT_DATEN } from '../domain/kompendium';
import { normalisiereUhrzeit, parseUhrzeit } from '../domain/time';
import type { ThemeWahl } from '../domain/types';
import { useDaten } from '../state/daten';
import { Abschnitt, Segment, Toggle, ZeitFeld } from '../ui/controls';
import { Seite } from '../ui/seite';

const ERINNERUNG: { wert: string; label: string; tage: number }[] = [
  { wert: '0', label: 'Aus', tage: 0 },
  { wert: '14', label: '14 Tage', tage: 14 },
  { wert: '30', label: '30 Tage', tage: 30 },
  { wert: '90', label: '90 Tage', tage: 90 },
];

export function Einstellungen() {
  const { einst } = useDaten();
  const [beginn, setBeginn] = useState(einst.regelBeginn);
  const beginnP = parseUhrzeit(beginn);
  const beginnFehler = beginn !== '' && !beginnP ? 'Uhrzeit wie 07:30 eingeben.' : beginn === '' ? 'Bitte eine Uhrzeit angeben.' : undefined;
  const standardRegion = REGIONEN_MIT_DATEN[0]?.code;

  const aendereBeginn = (text: string) => {
    setBeginn(text);
    const p = parseUhrzeit(text);
    if (p && text.length === 5) void speichereEinstellungen({ regelBeginn: normalisiereUhrzeit(text) });
  };

  return (
    <Seite titel="Einstellungen" zurueckZu="/mehr">
      <Abschnitt titel="Darstellung">
        <Segment<ThemeWahl>
          label="Farbschema"
          wert={einst.theme}
          onChange={(theme) => void speichereEinstellungen({ theme })}
          optionen={[
            { wert: 'system', label: 'Wie das Handy' },
            { wert: 'light', label: 'Hell' },
            { wert: 'dark', label: 'Dunkel' },
          ]}
        />
      </Abschnitt>

      <Abschnitt titel="Dienst">
        <ZeitFeld
          label="Üblicher Dienstbeginn"
          wert={beginn}
          onChange={aendereBeginn}
          fehler={beginnFehler}
          hinweis="Ein 24-Stunden-Dienst beginnt und endet zu dieser Uhrzeit, ein 12-Stunden-Dienst endet zwölf Stunden später."
        />
      </Abschnitt>

      <Abschnitt titel="Auswertung">
        <Toggle
          an={einst.wachzeitMitDienstRand}
          onChange={(wachzeitMitDienstRand) => void speichereEinstellungen({ wachzeitMitDienstRand })}
          label="Dienstanfang und -ende als Wachzeit"
          hinweis="Zählt die Zeit vom Dienstbeginn bis zur ersten Alarmierung und vom letzten Status 2 bis zum Dienstende zur Wachzeit."
        />
      </Abschnitt>

      <Abschnitt titel="Maßnahmen">
        <Toggle
          an={einst.region != null}
          onChange={(an) => void speichereEinstellungen({ region: an ? standardRegion : undefined })}
          label="Einordnung aus dem Kompendium vorschlagen"
          hinweis={
            einst.region != null
              ? `Gemeinsames Kompendium Rettungsdienst 2026, Region ${regionName(einst.region)}. In Zusatzdiensten wird nichts vorgeschlagen, weil dort andere Regeln gelten können.`
              : 'Bei Maßnahmen und Medikamenten wird dann keine Einordnung vorgeschlagen. Du wählst die Durchführung selbst.'
          }
        />
      </Abschnitt>

      <Abschnitt titel="Sicherung">
        <Segment<string>
          label="Erinnerung an die Sicherung"
          wert={String(einst.backupErinnerungTage)}
          onChange={(w) => void speichereEinstellungen({ backupErinnerungTage: Number(w) })}
          optionen={ERINNERUNG.map((e) => ({ wert: e.wert, label: e.label }))}
        />
        <p className="hinweis">Die Startseite erinnert dich, wenn die letzte Sicherung so lange her ist.</p>
      </Abschnitt>
    </Seite>
  );
}
