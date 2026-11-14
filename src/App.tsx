import { useEffect, useLayoutEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Backup } from './screens/Backup';
import { DienstDetail } from './screens/DienstDetail';
import { DienstForm } from './screens/DienstForm';
import { Einsaetze } from './screens/Einsaetze';
import { EinsatzForm } from './screens/EinsatzForm';
import { Einstellungen } from './screens/Einstellungen';
import { KatalogListeScreen, KatalogUebersicht } from './screens/Kataloge';
import { Mehr } from './screens/Mehr';
import { Start } from './screens/Start';
import { Statistik } from './screens/Statistik';
import { Ueber } from './screens/Ueber';
import { DatenProvider, useDaten } from './state/daten';
import { navigate, tabVon, useRoute, type Route } from './router';
import { Knopf, Leer } from './ui/controls';
import { Fehlergrenze } from './ui/fehlergrenze';
import { Icon, type IconName } from './ui/icons';
import { ToastProvider, useToast } from './ui/overlays';
import { Seite } from './ui/seite';
import { useTheme } from './ui/theme';

const TABS: { id: ReturnType<typeof tabVon>; label: string; pfad: string; icon: IconName }[] = [
  { id: 'dienste', label: 'Dienste', pfad: '/', icon: 'dienste' },
  { id: 'einsaetze', label: 'Einsätze', pfad: '/einsaetze', icon: 'einsaetze' },
  { id: 'statistik', label: 'Statistik', pfad: '/statistik', icon: 'statistik' },
  { id: 'mehr', label: 'Mehr', pfad: '/mehr', icon: 'mehr' },
];

/** Auf diesen Seiten steht unten eine Leiste mit der Hauptaktion statt der Reiter. */
const OHNE_REITER: ReadonlySet<Route['name']> = new Set(['dienstNeu', 'dienstBearbeiten', 'dienst', 'einsatzNeu', 'einsatz']);
const WURZELN: ReadonlySet<Route['name']> = new Set(['start', 'einsaetze', 'statistik', 'mehr']);

// Die Listen springen beim Zurückgehen an die alte Stelle; alles andere beginnt oben.
const gemerkteScroll = new Map<string, number>();
const hashVon = (url: string) => {
  try {
    return new URL(url).hash || '#/';
  } catch {
    return '#/';
  }
};
window.addEventListener('hashchange', (e) => gemerkteScroll.set(hashVon(e.oldURL), window.scrollY));

function Bildschirm({ route }: { route: Route }) {
  switch (route.name) {
    case 'start':
      return <Start />;
    case 'dienstNeu':
      return <DienstForm zusatz={route.zusatz} />;
    case 'dienstBearbeiten':
      return <DienstForm id={route.id} zeitenOffen={route.zeiten} />;
    case 'dienst':
      return <DienstDetail id={route.id} />;
    case 'einsatzNeu':
      return <EinsatzForm dienstId={route.dienstId} />;
    case 'einsatz':
      return <EinsatzForm id={route.id} />;
    case 'einsaetze':
      return <Einsaetze />;
    case 'statistik':
      return <Statistik />;
    case 'mehr':
      return <Mehr />;
    case 'einstellungen':
      return <Einstellungen />;
    case 'kataloge':
      return <KatalogUebersicht />;
    case 'katalog':
      return <KatalogListeScreen typ={route.typ} />;
    case 'backup':
      return <Backup />;
    case 'ueber':
      return <Ueber />;
    default:
      return (
        <Seite titel="Nicht gefunden" zurueckZu="/">
          <Leer titel="Diese Seite gibt es nicht" text="Der Link stimmt nicht oder die Seite wurde verschoben." aktion={<Knopf variante="primaer" onClick={() => navigate('/', true)}>Zur Startseite</Knopf>} />
        </Seite>
      );
  }
}

/** Meldet, wenn die App offline bereit ist oder eine neue Version vorliegt. */
function UpdateHinweise() {
  const toast = useToast();
  const {
    needRefresh: [neueVersion],
    offlineReady: [offlineBereit, setOfflineBereit],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineBereit) return;
    toast.zeige('Einsatzlog funktioniert jetzt auch ohne Netz.');
    setOfflineBereit(false);
  }, [offlineBereit, setOfflineBereit, toast]);

  useEffect(() => {
    if (!neueVersion) return;
    toast.zeige('Eine neue Version ist da.', {
      dauerhaft: true,
      aktion: { label: 'Aktualisieren', onClick: () => void updateServiceWorker(true) },
    });
  }, [neueVersion, toast, updateServiceWorker]);

  return null;
}

function Huelle() {
  const { einst } = useDaten();
  const route = useRoute();
  useTheme(einst.theme);

  const schluessel = window.location.hash || '#/';
  useLayoutEffect(() => {
    window.scrollTo(0, WURZELN.has(route.name) ? (gemerkteScroll.get(schluessel) ?? 0) : 0);
    // route ist bei jedem Rendern ein neues Objekt; der Hash bestimmt, wann die Seite wechselt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);

  const aktiv = tabVon(route);
  return (
    <>
      <Bildschirm route={route} />
      {!OHNE_REITER.has(route.name) && (
        <nav className="tabs" aria-label="Hauptnavigation">
          {TABS.map((t) => (
            <a key={t.id} className="tab" href={`#${t.pfad}`} aria-current={aktiv === t.id ? 'page' : undefined}>
              <Icon name={t.icon} />
              {t.label}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}

export function App() {
  return (
    <Fehlergrenze>
      <ToastProvider>
        <UpdateHinweise />
        <DatenProvider>
          <Huelle />
        </DatenProvider>
      </ToastProvider>
    </Fehlergrenze>
  );
}
