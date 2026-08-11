import { useState, type ReactNode } from 'react';
import type { Receta } from '../../types/recipe';
import type { Meal } from '../../types/plan';
import { RecipeMeta } from '../common/RecipeMeta';

/**
 * LA COMIDA, PLEGADA
 *
 * El día entero cabe en una pantalla: cada comida es una tarjeta con su
 * nombre, el plato que toca y si ya está hecha. La receta con ingredientes y
 * preparación sale al pulsarla.
 *
 * Antes cada comida ocupaba media pantalla y había que bajar mucho para ver
 * qué tocaba en la cena. Además, los botones («Marcar como hecha»,
 * «Personalizar») se comían el título de los platos con nombre largo: ahora
 * el título tiene la línea para él solo.
 */

interface Props {
  meal: Meal;
  receta: Receta;
  /** Todas las que la nutricionista dejó para esta comida. */
  opciones: Receta[];
  hecha: boolean;
  onElegir: (recetaId: string) => void;
  onAlternarHecha: () => void;
  /** La receta desplegada. Sólo se pinta cuando está abierta. */
  children: ReactNode;
  /** Abierta de entrada (para imprimir el plan entero). */
  siempreAbierta?: boolean;
}

export function MealCard({
  meal,
  receta,
  opciones,
  hecha,
  onElegir,
  onAlternarHecha,
  children,
  siempreAbierta = false,
}: Props) {
  const [abierta, setAbierta] = useState(false);
  const desplegada = siempreAbierta || abierta;

  const i = opciones.findIndex((r) => r.id === receta.id);
  const varias = opciones.length > 1;
  const mover = (paso: number) => {
    const siguiente = opciones[(i + paso + opciones.length) % opciones.length];
    if (siguiente) onElegir(siguiente.id);
  };

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        hecha ? 'border-emerald-200' : 'border-brand-100'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={desplegada}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {receta.foto_url ? (
            <img
              src={receta.foto_url}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg text-brand-300">
              🍽
            </span>
          )}

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                {meal.nombre}
              </span>
              {hecha && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  ✓ hecha
                </span>
              )}
            </span>
            {/* El título tiene la línea entera: ya no lo pisa ningún botón. */}
            <span className="mt-0.5 block truncate text-[15px] leading-tight font-semibold text-brand-900">
              {receta.nombre}
            </span>
            <RecipeMeta receta={receta} className="mt-1" />
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1 no-print">
          {varias && (
            <>
              <button
                onClick={() => mover(-1)}
                aria-label="Plato anterior"
                className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ‹
              </button>
              <span className="tnum text-[10px] text-slate-400">
                {i + 1}/{opciones.length}
              </span>
              <button
                onClick={() => mover(1)}
                aria-label="Plato siguiente"
                className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ›
              </button>
            </>
          )}
          <button
            onClick={onAlternarHecha}
            aria-label={hecha ? 'Desmarcar como hecha' : 'Marcar como hecha'}
            title={hecha ? 'Desmarcar' : 'Marcar como hecha'}
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm transition ${
              hecha
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-200 text-slate-300 hover:border-emerald-400 hover:text-emerald-500'
            }`}
          >
            ✓
          </button>
          {!siempreAbierta && (
            <button
              onClick={() => setAbierta((v) => !v)}
              aria-label={desplegada ? 'Cerrar la receta' : 'Ver la receta'}
              className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              {desplegada ? '⌃' : '⌄'}
            </button>
          )}
        </div>
      </div>

      {desplegada && <div className="border-t border-slate-100">{children}</div>}
    </article>
  );
}
