import { useState } from 'react';
import type { Alimento } from '../../types/food';
import type { DayType } from '../../types/plan';
import { comidasConPauta, recetasDeComida, ajustesDeReceta, acompanamientosDeReceta } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';

interface Props {
  dayType: DayType;
  recipes: Receta[];
  foods: Alimento[];
}

/**
 * SUS RECETAS, EN FASE 4
 *
 * Terminar el proceso no es perder el material. Quien pasa a contar macros ya
 * no necesita que le digan qué comer, pero sigue cocinando lo mismo de
 * siempre: las recetas se quedan, plegadas y con sus gramos hechos, para
 * cuando no se le ocurra qué hacer de cena.
 *
 * Plegadas a propósito: si se abren solas, la pantalla vuelve a decirle qué
 * tiene que comer, que es justo lo que esta fase deja atrás.
 */
export function RecetasDeConsulta({ dayType, recipes, foods }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [viendo, setViendo] = useState<string | null>(null);

  const porComida = comidasConPauta(dayType)
    .map((m) => ({
      meal: m,
      recetas: recetasDeComida(dayType.recetasAsignadas, m.id)
        .map((id) => recipes.find((r) => r.id === id))
        .filter(Boolean) as Receta[],
    }))
    .filter((x) => x.recetas.length > 0);

  if (!porComida.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 no-print">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-baseline justify-between gap-2 text-left"
      >
        <span className="text-sm font-bold tracking-wide text-brand-800 uppercase">
          Tus recetas
        </span>
        <span className="text-[11px] text-slate-500">{abierto ? 'Ocultar ⌃' : 'Verlas ⌄'}</span>
      </button>

      {!abierto ? (
        <p className="mt-1 text-xs leading-snug text-slate-500">
          Las de siempre, con sus gramos hechos, por si no se te ocurre qué cocinar.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {porComida.map(({ meal, recetas }) => (
            <div key={meal.id}>
              <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                {meal.nombre}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {recetas.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setViendo(viendo === r.id ? null : r.id)}
                    aria-pressed={viendo === r.id}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      viendo === r.id
                        ? 'border-brand-400 bg-brand-50 text-brand-900'
                        : 'border-slate-200 text-slate-700 hover:border-brand-300'
                    }`}
                  >
                    {r.nombre}
                  </button>
                ))}
              </div>

              {recetas
                .filter((r) => r.id === viendo)
                .map((r) => (
                  <div key={r.id} className="mt-2">
                    <ScaledRecipeView
                      receta={r}
                      requeridos={dayType.grid[meal.id] ?? {}}
                      foods={foods}
                      ajustes={ajustesDeReceta(dayType, meal.id, r.id)}
                      acompanamientos={acompanamientosDeReceta(dayType, meal.id, r.id)}
                      soloLectura
                    />
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
