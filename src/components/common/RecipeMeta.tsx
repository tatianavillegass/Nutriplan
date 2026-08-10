import type { Receta } from '../../types/recipe';
import { kcalFromMacros } from '../../utils/macros';
import type { MacroGrams } from '../../types/calculations';
import { fmt } from './ui';

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const };

function Reloj() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" {...trazo}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Gorro() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" {...trazo}>
      <path d="M6 13a4 4 0 111.5-7.7 4 4 0 019 0A4 4 0 1118 13v6H6z" />
      <path d="M6 16h12" />
    </svg>
  );
}

function Tupper() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" {...trazo}>
      <path d="M4 9h16l-1.2 9.2A2 2 0 0116.8 20H7.2a2 2 0 01-2-1.8z" />
      <path d="M3 9h18M8 6h8" />
    </svg>
  );
}

/** Las tres etiquetas de cabecera: tiempo, dificultad y si va a tupper. */
export function RecipeMeta({ receta, className = '' }: { receta: Receta; className?: string }) {
  const items: { icono: React.ReactNode; texto: string }[] = [];
  if (receta.tiempo) items.push({ icono: <Reloj />, texto: receta.tiempo });
  if (receta.dificultad) items.push({ icono: <Gorro />, texto: receta.dificultad });
  if (receta.tupper !== undefined)
    items.push({ icono: <Tupper />, texto: receta.tupper ? 'Apto para tupper' : 'No apto para tupper' });
  if (!items.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500 ${className}`}>
      {items.map((i) => (
        <span key={i.texto} className="flex items-center gap-1.5">
          {i.icono}
          {i.texto}
        </span>
      ))}
    </div>
  );
}

const COLORES = {
  hc: '#38bdf8',
  proteina: '#f472b6',
  grasa: '#818cf8',
} as const;

/**
 * Kcal grandes con la barra de proporción H / P / G.
 * El rango min-max sale del margen de ±25 % que deja el escalado de porciones.
 */
export function MacroBar({
  macros,
  margen = 0.25,
  compacto = false,
}: {
  macros: MacroGrams;
  margen?: number;
  compacto?: boolean;
}) {
  const kcal = kcalFromMacros(macros);
  const partes = [
    { k: 'hc' as const, g: macros.hc, kcal: macros.hc * 4, sigla: 'H' },
    { k: 'proteina' as const, g: macros.proteina, kcal: macros.proteina * 4, sigla: 'P' },
    { k: 'grasa' as const, g: macros.grasa, kcal: macros.grasa * 9, sigla: 'G' },
  ];
  const total = partes.reduce((s, p) => s + p.kcal, 0) || 1;

  return (
    <div className={compacto ? '' : 'space-y-1.5'}>
      <p className="flex items-baseline gap-2">
        <span className={`tnum font-semibold text-brand-900 ${compacto ? 'text-base' : 'text-2xl'}`}>
          {fmt(kcal)}
        </span>
        <span className="text-xs text-slate-500">kcal</span>
        {!compacto && margen > 0 && (
          <span className="tnum text-[11px] text-slate-400">
            min {fmt(kcal * (1 - margen))}–{fmt(kcal * (1 + margen))} max
          </span>
        )}
      </p>
      <div className="flex h-1.5 gap-1 overflow-hidden rounded-full">
        {partes.map((p) => (
          <span
            key={p.k}
            style={{ backgroundColor: COLORES[p.k], width: `${(p.kcal / total) * 100}%` }}
            className="block rounded-full"
          />
        ))}
      </div>
      <p className="tnum flex gap-4 text-xs">
        {partes.map((p) => (
          <span key={p.k}>
            <span style={{ color: COLORES[p.k] }} className="font-semibold">
              {p.sigla}
            </span>{' '}
            <span className="text-slate-600">{fmt(p.g)}</span>
          </span>
        ))}
      </p>
    </div>
  );
}
