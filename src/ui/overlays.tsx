import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';
import { Knopf } from './controls';

/* ---------- Bottom Sheet ---------- */

interface SheetProps {
  offen: boolean;
  titel: string;
  onClose: () => void;
  children: ReactNode;
  /** Feste Leiste unten, z. B. „Fertig“. */
  fuss?: ReactNode;
}

export function Sheet({ offen, titel, onClose, children, fuss }: SheetProps) {
  const titelId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const vorherFokus = useRef<Element | null>(null);
  // onClose ist bei jedem Rendern eine neue Funktion. Der Effekt darf deshalb nicht davon abhängen,
  // sonst wird bei jedem Rendern Fokus und Scroll-Sperre neu gesetzt.
  const schliesseRef = useRef(onClose);
  useEffect(() => {
    schliesseRef.current = onClose;
  });

  useEffect(() => {
    if (!offen) return;
    vorherFokus.current = document.activeElement;
    const el = ref.current;
    el?.focus();
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliesseRef.current();
    };
    document.addEventListener('keydown', taste);
    const alt = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', taste);
      document.body.style.overflow = alt;
      if (vorherFokus.current instanceof HTMLElement) vorherFokus.current.focus();
    };
  }, [offen]);

  if (!offen) return null;
  return createPortal(
    <div className="sheet-huelle">
      <div className="sheet-hintergrund" onClick={onClose} />
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titelId}
        tabIndex={-1}
      >
        <div className="sheet__kopf">
          <h2 id={titelId} className="sheet__titel">
            {titel}
          </h2>
          <button type="button" className="icon-knopf" onClick={onClose} aria-label="Schließen">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet__inhalt">{children}</div>
        {fuss && <div className="sheet__fuss">{fuss}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Bestätigung ---------- */

interface BestaetigungProps {
  offen: boolean;
  titel: string;
  text: ReactNode;
  jaText: string;
  gefahr?: boolean;
  onJa: () => void;
  onNein: () => void;
  /** Zusätzliche Eingabe, die vor dem Bestätigen nötig ist. */
  extra?: ReactNode;
  jaAktiv?: boolean;
}

export function Bestaetigung({ offen, titel, text, jaText, gefahr, onJa, onNein, extra, jaAktiv = true }: BestaetigungProps) {
  return (
    <Sheet
      offen={offen}
      titel={titel}
      onClose={onNein}
      fuss={
        <div className="knopfreihe">
          <Knopf onClick={onNein}>Abbrechen</Knopf>
          <Knopf variante={gefahr ? 'gefahr' : 'primaer'} onClick={onJa} disabled={!jaAktiv}>
            {jaText}
          </Knopf>
        </div>
      }
    >
      <div className="sheet__text">{text}</div>
      {extra}
    </Sheet>
  );
}

/* ---------- Toasts ---------- */

interface ToastEintrag {
  id: number;
  text: string;
  aktion?: { label: string; onClick: () => void };
  dauerhaft?: boolean;
}

interface ToastApi {
  zeige: (text: string, optionen?: { aktion?: { label: string; onClick: () => void }; dauerhaft?: boolean }) => number;
  schliesse: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const t = useContext(ToastContext);
  if (!t) throw new Error('useToast außerhalb des ToastProvider');
  return t;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [eintraege, setEintraege] = useState<ToastEintrag[]>([]);
  const zaehler = useRef(0);

  const schliesse = useCallback((id: number) => setEintraege((l) => l.filter((t) => t.id !== id)), []);
  const zeige = useCallback<ToastApi['zeige']>(
    (text, optionen) => {
      const id = ++zaehler.current;
      setEintraege((l) => [...l.slice(-1), { id, text, ...optionen }]);
      if (!optionen?.dauerhaft) window.setTimeout(() => schliesse(id), optionen?.aktion ? 8000 : 3500);
      return id;
    },
    [schliesse],
  );
  const api = useMemo(() => ({ zeige, schliesse }), [zeige, schliesse]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {eintraege.map((t) => (
          <div key={t.id} className="toast">
            <span className="toast__text">{t.text}</span>
            {t.aktion && (
              <button
                type="button"
                className="toast__aktion"
                onClick={() => {
                  t.aktion!.onClick();
                  schliesse(t.id);
                }}
              >
                {t.aktion.label}
              </button>
            )}
            {t.dauerhaft && (
              <button type="button" className="icon-knopf icon-knopf--hell" onClick={() => schliesse(t.id)} aria-label="Schließen">
                <Icon name="close" groesse={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
