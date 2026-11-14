import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-semi-condensed/latin-500.css';
import '@fontsource/barlow-semi-condensed/latin-600.css';
import '@fontsource/barlow-semi-condensed/latin-700.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

async function starte() {
  // Nur im Entwicklungsmodus: ?demo=1 füllt die Datenbank mit Beispieldaten.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')) {
    const { ladeDemodaten } = await import('./dev/demo');
    await ladeDemodaten();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void starte();
