import { TYP_INFO } from '../domain/stichwort';
import { bereichVon, TYPEN, type Typ } from '../domain/types';
import { Chip, ChipReihe } from './controls';

interface Props {
  /** Gewählte Einsatzart; `uebung` für eine Übung. */
  aktiv: Typ | 'uebung' | null;
  onTyp: (t: Typ) => void;
  /** Ohne Angabe gibt es die Übung nicht zur Wahl (z. B. beim Bearbeiten eines Einsatzes). */
  onUebung?: () => void;
}

/** Die Einsatzarten: Rettungsdienst (R, N), Feuerwehr (F, H, ABC) und Übung. Eine Übung zählt nicht als Einsatz. */
export function EinsatzartReihe({ aktiv, onTyp, onUebung }: Props) {
  return (
    <ChipReihe label="Einsatzart">
      {TYPEN.map((t) => (
        <Chip key={t} ton={bereichVon(t) === 'RD' ? 'rd' : 'fw'} aktiv={aktiv === t} onClick={() => onTyp(t)} titel={TYP_INFO[t].lang}>
          <strong>{t}</strong> {TYP_INFO[t].kurz}
        </Chip>
      ))}
      {onUebung && (
        <Chip ton="ue" aktiv={aktiv === 'uebung'} onClick={onUebung} titel="Ü: Übung. Sie zählt nicht als Einsatz.">
          <strong>Ü</strong> Übung
        </Chip>
      )}
    </ChipReihe>
  );
}
