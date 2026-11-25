import { useState } from 'react';
import { TYP_INFO } from '../domain/stichwort';
import { bereichVon, TYPEN, type Typ } from '../domain/types';
import { useDaten } from '../state/daten';
import { Chip, ChipReihe } from './controls';

interface Props {
  /** Gewählte Einsatzart; `uebung` für eine Übung. */
  aktiv: Typ | 'uebung' | null;
  onTyp: (t: Typ) => void;
  /** Ohne Angabe gibt es die Übung nicht zur Wahl (z. B. beim Bearbeiten eines Einsatzes). */
  onUebung?: () => void;
}

/**
 * Die Einsatzarten: Rettungsdienst (R, N), Feuerwehr (F, H, ABC) und Übung. Eine Übung zählt nicht als Einsatz.
 * Je nach Einstellung „Bereiche“ fehlt der nicht genutzte Bereich. Im reinen Rettungsdienst bleiben die
 * Feuerwehr-Einsatzarten hinter einem Chip „Feuerwehr“ erreichbar. Die gewählte Art ist immer sichtbar.
 */
export function EinsatzartReihe({ aktiv, onTyp, onUebung }: Props) {
  const { bereiche } = useDaten().einst;
  const [fwOffen, setFwOffen] = useState(false);
  const aktivTyp = aktiv && aktiv !== 'uebung' ? aktiv : null;
  const sichtbar = (t: Typ): boolean => {
    if (t === aktivTyp) return true;
    const b = bereichVon(t);
    if (bereiche === 'fw') return b === 'FW';
    if (bereiche === 'rd') return b === 'RD' || fwOffen;
    return true;
  };
  return (
    <ChipReihe label="Einsatzart">
      {TYPEN.filter(sichtbar).map((t) => (
        <Chip key={t} ton={bereichVon(t) === 'RD' ? 'rd' : 'fw'} aktiv={aktiv === t} onClick={() => onTyp(t)} titel={TYP_INFO[t].lang}>
          <strong>{t}</strong> {TYP_INFO[t].kurz}
        </Chip>
      ))}
      {bereiche === 'rd' && !fwOffen && !(aktivTyp && bereichVon(aktivTyp) === 'FW') && (
        <Chip ton="fw" aktiv={false} onClick={() => setFwOffen(true)} titel="Einsatz mit der Feuerwehr erfassen, z. B. Brand oder Hilfeleistung.">
          Feuerwehr …
        </Chip>
      )}
      {onUebung && (
        <Chip ton="ue" aktiv={aktiv === 'uebung'} onClick={onUebung} titel="Ü: Übung. Sie zählt nicht als Einsatz.">
          <strong>Ü</strong> Übung
        </Chip>
      )}
    </ChipReihe>
  );
}
