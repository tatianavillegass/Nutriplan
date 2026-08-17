import { useState } from 'react';
import type { Alimento } from '../../types/food';
import type { Acompanamiento, DayType } from '../../types/plan';
import { ajustesDeReceta, acompanamientosDeReceta } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { Reto } from '../../types/reto';
import { semanaDeDia } from '../../utils/retos';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { AjustarCantidades } from '../phase1/AjustarCantidades';
import { Button } from '../common/ui';

interface Props {
  reto: Reto;
  dayType: DayType;
  recetas: Receta[];
  foods: Alimento[];
  onAjustar: (
    mealId: string,
    recetaId: string,
    ajustes: Record<string, number>,
    acompanamientos: Acompanamiento[],
  ) => void;
}

/**
 * LAS RECETAS DEL RETO, EN SUS GRAMOS
 *
 * Las recetas son del grupo y se eligen una vez, pero los gramos son de cada
 * una: la misma tortilla no lleva lo mismo con 1.500 kcal que con 2.200. Aquí
 * se ven ya escaladas a lo que tiene pautado ella y se pueden retocar, que es
 * lo que hacía falta para poder revisar antes de enviar.
 *
 * Lo que se toque se guarda en SU plan y no en la receta del banco: la misma
 * receta se cuadra distinto según a quién se le pauta.
 */
export function RecetasDeLaParticipante({ reto, dayType, recetas, foods, onAjustar }: Props) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState<string | null>(null);

  /** Todas las del reto, abiertas o no: aquí se prepara, no se cocina. */
  const suyas = reto.recetas
    .map((r) => {
      const receta = recetas.find((x) => x.id === r.recetaId);
      const meal = dayType.meals.find((m) => m.slot === r.slot);
      return receta && meal ? { r, receta, meal } : undefined;
    })
    .filter(Boolean) as {
    r: (typeof reto.recetas)[number];
    receta: Receta;
    meal: DayType['meals'][number];
  }[];

  if (!suyas.length) {
    return (
      <p className="text-sm text-slate-500">
        Cuando pongas recetas en el reto, aparecerán aquí con los gramos de esta persona.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {[...suyas]
        .sort((a, b) => a.r.desdeDia - b.r.desdeDia || a.meal.orden - b.meal.orden)
        .map(({ r, receta, meal }) => {
          const clave = `${r.recetaId}-${r.slot}`;
          const requeridos = dayType.grid[meal.id] ?? {};
          const ajustes = ajustesDeReceta(dayType, meal.id, receta.id);

          return (
            <li key={clave}>
              <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="tnum w-20 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-center text-[11px] text-slate-500">
                  Semana {semanaDeDia(r.desdeDia)}
                </span>
                <span className="w-20 shrink-0 text-[11px] text-slate-400">{meal.nombre}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {receta.nombre}
                  {Object.keys(ajustes).length > 0 && (
                    <span className="ml-2 text-[11px] font-medium text-brand-700">ajustada</span>
                  )}
                </span>
                <button
                  onClick={() => {
                    setAbierta(abierta === clave ? null : clave);
                    setAjustando(null);
                  }}
                  className="shrink-0 rounded px-2 py-1 text-xs text-brand-700 hover:bg-brand-50"
                >
                  {abierta === clave ? 'Cerrar' : 'Ver con sus gramos'}
                </button>
              </div>

              {abierta === clave && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-3">
                  {ajustando === clave ? (
                    <AjustarCantidades
                      receta={receta}
                      requeridos={requeridos}
                      foods={foods}
                      ajustes={ajustes}
                      acompanamientos={acompanamientosDeReceta(dayType, meal.id, receta.id)}
                      recetas={recetas}
                      onGuardar={(a, ac) => {
                        onAjustar(meal.id, receta.id, a, ac);
                        setAjustando(null);
                      }}
                      onCerrar={() => setAjustando(null)}
                    />
                  ) : (
                    <>
                      <ScaledRecipeView
                        receta={receta}
                        requeridos={requeridos}
                        foods={foods}
                        ajustes={ajustes}
                        acompanamientos={acompanamientosDeReceta(dayType, meal.id, receta.id)}
                        paraNutricionista
                        soloLectura
                      />
                      <div className="mt-2 flex justify-end">
                        <Button variant="outline" onClick={() => setAjustando(clave)}>
                          Ajustar cantidades
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
    </ul>
  );
}
