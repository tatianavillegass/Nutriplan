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
      <div className="p-3 sm:p-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            {meal.nombre}
          </span>
          {hecha && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              ✓ hecha
            </span>
          )}
        </div>

        {/* El título, entero y con la anchura para él solo. */}
        <button
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={desplegada}
          className="block w-full text-left"
        >
          <span className="block text-lg leading-tight font-semibold text-balance text-brand-900">
            {receta.nombre}
          </span>
        </button>
        <RecipeMeta receta={receta} className="mt-1.5" />

        {/* La foto, en grande: es lo que hace apetecible el plato. */}
        <div className="relative mt-3">
          <button
            onClick={() => setAbierta((v) => !v)}
            aria-label={desplegada ? 'Cerrar la receta' : 'Ver la receta'}
            className="block w-full"
          >
            {receta.foto_url ? (
              <img
                src={receta.foto_url}
                alt={receta.nombre}
                className="aspect-[4/3] w-full rounded-xl object-cover"
              />
            ) : (
              <span className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-brand-50 text-4xl text-brand-200">
                🍽
              </span>
            )}
          </button>

          {/* Los controles, encima de la foto como en la referencia. */}
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5 no-print">
            {varias && (
              <button
                onClick={() => mover(1)}
                aria-label="Cambiar de plato"
                title={`Cambiar de plato (${i + 1} de ${opciones.length})`}
                className="flex h-9 items-center gap-1.5 rounded-full bg-black/55 px-3 text-xs font-medium text-white backdrop-blur transition hover:bg-black/75"
              >
                ⇄ <span className="tnum">{i + 1}/{opciones.length}</span>
              </button>
            )}
            <button
              onClick={onAlternarHecha}
              aria-label={hecha ? 'Desmarcar como hecha' : 'Marcar como hecha'}
              title={hecha ? 'Desmarcar' : 'Marcar como hecha'}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm backdrop-blur transition ${
                hecha
                  ? 'bg-emerald-500 text-white'
                  : 'bg-black/55 text-white/70 hover:bg-black/75 hover:text-white'
              }`}
            >
              ✓
            </button>
          </div>
        </div>

        {!siempreAbierta && (
          <button
            onClick={() => setAbierta((v) => !v)}
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-brand-600 transition hover:bg-brand-50 no-print"
          >
            {desplegada ? 'Ocultar la receta ⌃' : 'Ver ingredientes y preparación ⌄'}
          </button>
        )}
      </div>

      {desplegada && <div className="border-t border-slate-100">{children}</div>}
    </article>
  );
}
