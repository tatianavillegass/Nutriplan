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
  /**
   * ELEGIR ES VER LAS OPCIONES, NO IR PASANDO
   *
   * Antes se cambiaba de plato de uno en uno: para ver la tercera opción había
   * que pasar por la segunda, y no se sabía cuántas quedaban ni qué había. Con
   * las fotos delante se elige lo que apetece, que es como se decide qué comer.
   */
  const [eligiendo, setEligiendo] = useState(false);
  const desplegada = siempreAbierta || abierta;

  const i = opciones.findIndex((r) => r.id === receta.id);
  const varias = opciones.length > 1;

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
                onClick={() => setEligiendo((v) => !v)}
                aria-expanded={eligiendo}
                title={`Elegir entre ${opciones.length} opciones`}
                className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-semibold text-brand-800 shadow-md transition hover:bg-brand-50"
              >
                ⇄ Cambiar {meal.nombre.toLowerCase()}{' '}
                <span className="tnum text-brand-400">
                  {i + 1}/{opciones.length}
                </span>
              </button>
            )}
            {/* Con un ✓ gris sobre la foto no se veía que fuera pulsable:
                ahora es una pastilla con su palabra, como «Otro plato». */}
            <button
              onClick={onAlternarHecha}
              aria-label={hecha ? 'Desmarcar como hecha' : 'Marcar como hecha'}
              title={hecha ? 'Desmarcar' : 'Marcar como hecha'}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold shadow-md transition ${
                hecha
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white text-brand-800 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              ✓ {hecha ? 'Hecha' : 'Marcar hecha'}
            </button>
          </div>
        </div>

        {/* ── Las opciones, con su foto ─────────────────── */}
        {eligiendo && (
          <div className="mt-3 no-print">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              Cambiar {meal.nombre.toLowerCase()} · {opciones.length} opciones
            </p>
            <ul className="grid grid-cols-2 gap-2">
              {opciones.map((r) => {
                const puesta = r.id === receta.id;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        onElegir(r.id);
                        setEligiendo(false);
                      }}
                      aria-pressed={puesta}
                      className={`w-full overflow-hidden rounded-xl border text-left transition ${
                        puesta
                          ? 'border-brand-500 ring-2 ring-brand-100'
                          : 'border-slate-200 hover:border-brand-300'
                      }`}
                    >
                      {r.foto_url ? (
                        <img
                          src={r.foto_url}
                          alt=""
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : (
                        <span className="flex aspect-[4/3] w-full items-center justify-center bg-brand-50 text-2xl text-brand-200">
                          🍽
                        </span>
                      )}
                      <span className="block px-2 py-1.5">
                        <span className="block text-xs leading-snug font-medium text-slate-800">
                          {r.nombre}
                        </span>
                        <RecipeMeta receta={r} className="mt-1 text-[10px]" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
