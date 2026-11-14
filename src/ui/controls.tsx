import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { maskUhrzeit, normalisiereUhrzeit } from '../domain/time';
import { Icon } from './icons';

/** Farbe nach Bereich: Rettungsdienst, Feuerwehr, Übung. */
export type Ton = 'rd' | 'fw' | 'ue' | 'neutral';

/* ---------- Knöpfe ---------- */

interface KnopfProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primaer' | 'sekundaer' | 'gefahr' | 'text';
  voll?: boolean;
}

export function Knopf({ variante = 'sekundaer', voll, className = '', type = 'button', ...rest }: KnopfProps) {
  return (
    <button
      type={type}
      className={`knopf knopf--${variante}${voll ? ' knopf--voll' : ''} ${className}`.trim()}
      {...rest}
    />
  );
}

/* ---------- Chips ---------- */

interface ChipProps {
  aktiv?: boolean;
  onClick: () => void;
  children: ReactNode;
  ton?: Ton;
  klein?: boolean;
  gestrichelt?: boolean;
  disabled?: boolean;
  titel?: string;
}

export function Chip({ aktiv = false, onClick, children, ton = 'neutral', klein, gestrichelt, disabled, titel }: ChipProps) {
  return (
    <button
      type="button"
      className={`chip chip--${ton}${klein ? ' chip--klein' : ''}${gestrichelt ? ' chip--neu' : ''}`}
      aria-pressed={aktiv}
      onClick={onClick}
      disabled={disabled}
      title={titel}
    >
      {children}
    </button>
  );
}

export function ChipReihe({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {children}
    </div>
  );
}

/* ---------- Segment (genau eine Wahl) ---------- */

interface SegmentProps<T extends string> {
  wert: T | undefined;
  optionen: { wert: T; label: string; ton?: Ton }[];
  onChange: (w: T) => void;
  label: string;
  klein?: boolean;
}

export function Segment<T extends string>({ wert, optionen, onChange, label, klein }: SegmentProps<T>) {
  return (
    <div className={`segment${klein ? ' segment--klein' : ''}`} role="radiogroup" aria-label={label}>
      {optionen.map((o) => (
        <button
          key={o.wert}
          type="button"
          role="radio"
          aria-checked={wert === o.wert}
          className={`segment__opt segment__opt--${o.ton ?? 'neutral'}`}
          onClick={() => onChange(o.wert)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Zähler ---------- */

interface StepperProps {
  wert: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  schritt?: number;
  label: string;
  /** Beschriftung neben der Zahl, z. B. „RTW“. */
  einheit?: string;
}

export function Stepper({ wert, onChange, min = 0, max = 99, schritt = 1, label, einheit }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper__knopf"
        onClick={() => onChange(Math.max(min, wert - schritt))}
        disabled={wert <= min}
        aria-label={`${label} verringern`}
      >
        −
      </button>
      <span className="stepper__wert" aria-live="polite">
        <span className="zahl">{wert}</span>
        {einheit && <span className="stepper__einheit">{einheit}</span>}
      </span>
      <button
        type="button"
        className="stepper__knopf"
        onClick={() => onChange(Math.min(max, wert + schritt))}
        disabled={wert >= max}
        aria-label={`${label} erhöhen`}
      >
        +
      </button>
    </div>
  );
}

/* ---------- Schalter ---------- */

interface ToggleProps {
  an: boolean;
  onChange: (an: boolean) => void;
  label: string;
  hinweis?: string;
}

export function Toggle({ an, onChange, label, hinweis }: ToggleProps) {
  const id = useId();
  return (
    <div className="toggle">
      <div className="toggle__text">
        <label htmlFor={id} className="toggle__label">
          {label}
        </label>
        {hinweis && <div className="hinweis">{hinweis}</div>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={an}
        className="toggle__schalter"
        onClick={() => onChange(!an)}
      >
        <span className="toggle__knauf" />
      </button>
    </div>
  );
}

/* ---------- Felder ---------- */

interface FeldProps {
  label: string;
  hinweis?: string;
  fehler?: string;
  children: ReactNode;
  htmlFor?: string;
}

export function Feld({ label, hinweis, fehler, children, htmlFor }: FeldProps) {
  return (
    <div className={`feld${fehler ? ' feld--fehler' : ''}`}>
      <label className="feld__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {fehler ? (
        <div className="feld__fehler" role="alert">
          {fehler}
        </div>
      ) : hinweis ? (
        <div className="hinweis">{hinweis}</div>
      ) : null}
    </div>
  );
}

interface ZeitFeldProps {
  label: string;
  wert: string;
  onChange: (w: string) => void;
  fehler?: string;
  /** Aufgelöstes Datum unter dem Feld, z. B. „Sa 14.11.“ */
  hinweis?: string;
  optional?: boolean;
  /** Schnellwahl neben dem Eingabefeld, z. B. „Jetzt“ oder Minuten ab Alarm. */
  rechts?: ReactNode;
}

/** Uhrzeit mit Zifferntastatur: „743“ wird zu „7:43“, beim Verlassen zu „07:43“. */
export function ZeitFeld({ label, wert, onChange, fehler, hinweis, optional, rechts }: ZeitFeldProps) {
  const id = useId();
  return (
    <Feld label={label} fehler={fehler} hinweis={hinweis} htmlFor={id}>
      <div className="zeitfeld">
        <input
          id={id}
          className="eingabe eingabe--zeit zahl"
          inputMode="numeric"
          autoComplete="off"
          placeholder={optional ? 'optional' : 'HH:MM'}
          value={wert}
          maxLength={5}
          aria-invalid={!!fehler}
          onChange={(e) => onChange(maskUhrzeit(e.target.value))}
          onBlur={() => {
            const norm = normalisiereUhrzeit(wert);
            if (norm !== wert) onChange(norm);
          }}
        />
        {rechts && <div className="zeitfeld__rechts">{rechts}</div>}
      </div>
    </Feld>
  );
}

interface TextFeldProps {
  label: string;
  wert: string;
  onChange: (w: string) => void;
  hinweis?: string;
  fehler?: string;
  mehrzeilig?: boolean;
  maxLength?: number;
  placeholder?: string;
}

export function TextFeld({ label, wert, onChange, hinweis, fehler, mehrzeilig, maxLength, placeholder }: TextFeldProps) {
  const id = useId();
  return (
    <Feld label={label} hinweis={hinweis} fehler={fehler} htmlFor={id}>
      {mehrzeilig ? (
        <textarea
          id={id}
          className="eingabe eingabe--mehrzeilig"
          rows={3}
          value={wert}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="eingabe"
          value={wert}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={!!fehler}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Feld>
  );
}

/* ---------- Gliederung ---------- */

export function Abschnitt({
  titel,
  children,
  rechts,
}: {
  titel: string;
  children: ReactNode;
  rechts?: ReactNode;
}) {
  return (
    <section className="abschnitt">
      <div className="abschnitt__kopf">
        <h2 className="abschnitt__titel">{titel}</h2>
        {rechts}
      </div>
      <div className="abschnitt__inhalt">{children}</div>
    </section>
  );
}

export function Aufklappen({
  titel,
  offen,
  onToggle,
  children,
  zusatz,
}: {
  titel: string;
  offen: boolean;
  onToggle: () => void;
  children: ReactNode;
  zusatz?: string;
}) {
  const id = useId();
  return (
    <section className="aufklappen">
      <button
        type="button"
        className="aufklappen__kopf"
        aria-expanded={offen}
        aria-controls={id}
        onClick={onToggle}
      >
        <span className="abschnitt__titel">{titel}</span>
        {zusatz && <span className="aufklappen__zusatz">{zusatz}</span>}
        <Icon name={offen ? 'oben' : 'unten'} groesse={20} />
      </button>
      <div id={id} hidden={!offen} className="aufklappen__inhalt">
        {children}
      </div>
    </section>
  );
}

/* ---------- Hinweise ---------- */

export function Meldung({
  art,
  children,
  aktion,
}: {
  art: 'info' | 'warnung' | 'fehler';
  children: ReactNode;
  aktion?: ReactNode;
}) {
  return (
    <div className={`meldung meldung--${art}`} role={art === 'fehler' ? 'alert' : 'status'}>
      <Icon name={art === 'info' ? 'info' : 'warnung'} groesse={20} />
      <div className="meldung__text">{children}</div>
      {aktion}
    </div>
  );
}

export function Leer({ titel, text, aktion }: { titel: string; text: string; aktion?: ReactNode }) {
  return (
    <div className="leer">
      <h2 className="leer__titel">{titel}</h2>
      <p>{text}</p>
      {aktion}
    </div>
  );
}
