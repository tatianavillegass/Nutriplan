import type { DayType } from '../../types/plan';
import { comidasConPauta } from '../../types/plan';
import type { PorcionesMarcadas } from '../../types/diary';

interface Props {
  dayType: DayType;
  /** Lo marcado hoy: mealId → foodId → porciones. */
  porciones: PorcionesMarcadas;
  /** Comidas que el cliente ha dado por hechas. */
  cumplidas: string[];
  /** Ir a esa comida al pulsarla. */
  onIr?: (mealId: string) => void;
}

type EstadoComida = 'pendiente' | 'elegida' | 'hecha';

function estadoDe(mealId: string, porciones: PorcionesMarcadas, cumplidas: string[]): EstadoComida {
  if (cumplidas.includes(mealId)) return 'hecha';
  const marcadas = Object.values(porciones[mealId] ?? {}).some((n) => (n ?? 0) > 0);
  return marcadas ? 'elegida' : 'pendiente';
}

/**
 * CÓMO VA EL DÍA
 *
 * Una fila con las comidas: se van llenando según el cliente elige y marca.
 * Sirve para saber de un vistazo qué le queda por decidir, sin bajar por toda
 * la página.
 */
export function DayProgressBar({ dayType, porciones, cumplidas, onIr }: Props) {
  /** Sólo las comidas con algo pautado: las vacías ese día no existen. */
  const estados = comidasConPauta(dayType).map((m) => ({
    meal: m,
    estado: estadoDe(m.id, porciones, cumplidas),
  }));

  const hechas = estados.filter((e) => e.estado === 'hecha').length;
  const empezadas = estados.filter((e) => e.estado !== 'pendiente').length;

  return (
    <div className="rounded-xl border border-brand-100 bg-white px-4 py-3 no-print">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800">Cómo va tu día</p>
        <p className="tnum text-[11px] text-slate-500">
          {hechas} de {estados.length} comidas hechas
          {empezadas > hechas && ` · ${empezadas - hechas} empezadas`}
        </p>
      </div>

      <div className="flex gap-1.5">
        {estados.map(({ meal, estado }) => {
          const clases = {
            pendiente: 'border-slate-200 bg-slate-50 text-slate-400',
            elegida: 'border-brand-300 bg-brand-100 text-brand-800',
            hecha: 'border-brand-600 bg-brand-600 text-white',
          }[estado];

          return (
            <button
              key={meal.id}
              onClick={() => onIr?.(meal.id)}
              title={
                estado === 'hecha'
                  ? `${meal.nombre}: hecha`
                  : estado === 'elegida'
                    ? `${meal.nombre}: ya has elegido, marca cuando la comas`
                    : `${meal.nombre}: sin elegir`
              }
              className={`flex-1 rounded-lg border px-2 py-2 text-center transition hover:opacity-90 ${clases}`}
            >
              <span className="block truncate text-[11px] font-medium">{meal.nombre}</span>
              <span className="mt-0.5 block text-[10px] opacity-80">
                {estado === 'hecha' ? '✓ hecha' : estado === 'elegida' ? 'elegida' : '—'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
