import { useState } from 'react';
import type { Alimento } from '../../types/food';
import type { DayType, Meal, Plan } from '../../types/plan';
import {
  acompanamientosDeReceta,
  ajustesDeReceta,
  anadidosDeReceta,
  comidasConPauta,
  quitadosDeReceta,
  recetasDeLaComida,
} from '../../types/plan';
import type { Receta } from '../../types/recipe';
import { scaleRecipe } from '../../utils/recipeScaling';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { Button } from '../common/ui';

interface Props {
  /** De dónde salen las recetas: son del plan, no del día. */
  plan: Plan;
  /** De dónde salen los gramos: eso sí es del día. */
  dayType: DayType;
  recipes: Receta[];
  foods: Alimento[];
  /**
   * MARCARLA DE UN TOQUE
   *
   * En fase 3 le fija las porciones de esa comida (`fijarAlimento`); en fase 4
   * le apunta los gramos. Sin esto la biblioteca sólo se mira, que también
   * vale — es lo que pasa en la vista previa y en el PDF.
   */
  onUsar?: (meal: Meal, receta: Receta) => void;
  /** «Me lo he comido» sólo lo pulsa quien come, no quien pauta. */
  soyElCliente?: boolean;
}

/**
 * SU BIBLIOTECA DE RECETAS
 *
 * Hay quien quiere la autonomía de la fase 3 —componerse la comida con sus
 * porciones— y a la vez las ideas de la fase 1: saber que le tocan dos
 * almidones y un proteico no contesta la pregunta de «¿pero qué cocino?».
 *
 * Por eso esto es **una pestaña y no un trozo del día**: en su pantalla de hoy
 * lo que manda son sus porciones, y meter las recetas ahí volvería a decirle
 * qué comer, que es justo lo que esta fase deja atrás. Aquí se entra cuando no
 * se te ocurre nada, que es cuando hace falta.
 *
 * Las recetas son **las que ella le eligió** (`recetasAsignadas`), agrupadas
 * por comida y **con los gramos escalados a lo que le toca ese día**: la misma
 * receta en un día de entreno lleva más arroz, y una biblioteca con los gramos
 * del banco obligaría a echar la cuenta a mano cada vez.
 */
export function BibliotecaDeRecetas({
  plan,
  dayType,
  recipes,
  foods,
  onUsar,
  soyElCliente = false,
}: Props) {
  const [viendo, setViendo] = useState<string | null>(null);
  /** De qué comida es la receta abierta: la misma puede estar en dos. */
  const [deLaComida, setDeLaComida] = useState<string | null>(null);

  const porComida = comidasConPauta(dayType)
    .map((m) => ({
      meal: m,
      recetas: recetasDeLaComida(plan, m.id)
        .map((id) => recipes.find((r) => r.id === id))
        .filter(Boolean) as Receta[],
    }))
    .filter((x) => x.recetas.length > 0);

  if (!porComida.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
        <p className="text-sm font-medium text-slate-700">Aún no tienes recetas aquí</p>
        <p className="mt-1 text-xs leading-snug text-slate-500">
          Tu nutricionista te irá poniendo ideas para cada comida. Mientras tanto, tus
          porciones del día siguen en «Hoy».
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-snug text-slate-500">
        Ideas para cada comida, con los gramos ya ajustados a lo que te toca hoy. No tienes
        que comer esto: están aquí para cuando no se te ocurra qué hacer.
      </p>

      {porComida.map(({ meal, recetas }) => (
        <section key={meal.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">
              {meal.nombre}
            </h2>
            <span className="text-[11px] text-slate-400">
              {recetas.length} {recetas.length === 1 ? 'idea' : 'ideas'}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {recetas.map((r) => {
              const abierta = viendo === r.id && deLaComida === meal.id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setViendo(abierta ? null : r.id);
                    setDeLaComida(abierta ? null : meal.id);
                  }}
                  aria-pressed={abierta}
                  className={`flex items-center gap-1.5 rounded-lg border py-1 pr-2.5 pl-1 text-xs transition ${
                    abierta
                      ? 'border-brand-400 bg-brand-50 text-brand-900'
                      : 'border-slate-200 text-slate-700 hover:border-brand-300'
                  }`}
                >
                  {/* La foto es como se reconoce una receta: antes que el nombre. */}
                  {r.foto_url ? (
                    <img
                      src={r.foto_url}
                      alt=""
                      loading="lazy"
                      className="h-7 w-7 rounded object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-7 w-7 items-center justify-center rounded bg-slate-100 text-[11px] text-slate-400"
                    >
                      🍽
                    </span>
                  )}
                  {r.nombre}
                </button>
              );
            })}
          </div>

          {recetas
            .filter((r) => r.id === viendo && deLaComida === meal.id)
            .map((r) => (
              <div key={r.id} className="mt-3">
                <ScaledRecipeView
                  receta={r}
                  recetas={recipes}
                  requeridos={dayType.grid[meal.id] ?? {}}
                  foods={foods}
                  ajustes={ajustesDeReceta(dayType, meal.id, r.id)}
                  acompanamientos={acompanamientosDeReceta(dayType, meal.id, r.id)}
                  quitados={quitadosDeReceta(dayType, meal.id, r.id)}
                  anadidos={anadidosDeReceta(dayType, meal.id, r.id)}
                  soloLectura
                />

                {onUsar && soyElCliente && (
                  <div className="mt-2">
                    <Button onClick={() => onUsar(meal, r)} className="text-xs">
                      Me lo he comido
                    </Button>
                    <p className="mt-1 text-[10px] leading-snug text-slate-400">
                      Te lo apunta en {meal.nombre.toLowerCase()}. Después puedes retocar lo
                      que quieras.
                    </p>
                  </div>
                )}
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

/**
 * QUÉ PORCIONES SE MARCAN AL DECIR «ME LO HE COMIDO»
 *
 * Los mismos aportes que ya usa el atajo de receta de fase 2 y 3: cada
 * ingrediente del catálogo se apunta con **las porciones que la comida tiene
 * pautadas de su grupo**, que es lo que la receta viene a cubrir. Lo que no
 * está enlazado al catálogo no se puede marcar y se queda fuera, como siempre.
 */
export function aportesDeLaReceta(
  receta: Receta,
  reparto: Record<string, number>,
  foods: Alimento[],
): { foodId: string; intercambios: number }[] {
  const escalada = scaleRecipe(receta, reparto, foods);
  return escalada.ingredientes
    .filter((i) => i.foodId && i.grupo)
    .map((i) => ({
      foodId: i.foodId as string,
      intercambios: reparto[i.grupo as string] ?? 0,
    }))
    .filter((a) => a.intercambios > 0);
}
