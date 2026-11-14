import type { ReactNode } from 'react';
import { zurueck } from '../router';
import { Icon } from './icons';

interface SeiteProps {
  titel: string;
  /** Ziel des Zurück-Pfeils, falls es keinen Verlauf gibt. */
  zurueckZu?: string;
  aktionen?: ReactNode;
  children: ReactNode;
  /** Feste Leiste am unteren Rand (z. B. „Speichern“); ersetzt die Tab-Leiste. */
  fuss?: ReactNode;
}

export function Seite({ titel, zurueckZu, aktionen, children, fuss }: SeiteProps) {
  return (
    <>
      <header className="kopf">
        {zurueckZu && (
          <button type="button" className="icon-knopf kopf__zurueck" onClick={() => zurueck(zurueckZu)} aria-label="Zurück">
            <Icon name="zurueck" />
          </button>
        )}
        <h1 className="kopf__titel">{titel}</h1>
        {aktionen && <div className="kopf__aktionen">{aktionen}</div>}
      </header>
      <main className={`inhalt${fuss ? ' inhalt--mit-fuss' : ''}`}>{children}</main>
      {fuss && <div className="fussleiste">{fuss}</div>}
    </>
  );
}
