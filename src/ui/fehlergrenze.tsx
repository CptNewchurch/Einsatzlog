import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Knopf } from './controls';

interface State {
  fehler: Error | null;
}

/** Fängt unerwartete Fehler ab, damit nie eine leere weiße Seite bleibt. Die gespeicherten Daten sind davon nicht betroffen. */
export class Fehlergrenze extends Component<{ children: ReactNode }, State> {
  state: State = { fehler: null };

  static getDerivedStateFromError(fehler: Error): State {
    return { fehler };
  }

  componentDidCatch(fehler: Error, info: ErrorInfo) {
    console.error('Einsatzlog:', fehler, info.componentStack);
  }

  render() {
    if (!this.state.fehler) return this.props.children;
    return (
      <div className="fehlergrenze" role="alert">
        <h1 className="leer__titel">Da ist etwas schiefgegangen</h1>
        <p className="text">Deine gespeicherten Daten sind nicht betroffen. Lade die App neu. Wenn das Problem bleibt, sichere deine Daten unter „Mehr → Sicherung“ und melde dich bei der Person, die dir die App bereitgestellt hat.</p>
        <Knopf variante="primaer" onClick={() => window.location.reload()}>
          App neu laden
        </Knopf>
        <p className="hinweis">{this.state.fehler.message}</p>
      </div>
    );
  }
}
