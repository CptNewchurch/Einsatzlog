import type { ReactNode } from 'react';

interface Props {
  wert: ReactNode;
  label: string;
  /** Kleine Zeile unter dem Label, z. B. „RD 12 · FW 5“. */
  zusatz?: ReactNode;
  ton?: 'rd' | 'fw' | 'ue' | 'neutral';
}

export function Kpi({ wert, label, zusatz, ton = 'neutral' }: Props) {
  return (
    <div className={`kpi kpi--${ton}`}>
      <div className="kpi__wert zahl">{wert}</div>
      <div className="kpi__label">{label}</div>
      {zusatz && <div className="kpi__zusatz zahl">{zusatz}</div>}
    </div>
  );
}

export function KpiRaster({ children }: { children: ReactNode }) {
  return <div className="kpis">{children}</div>;
}
