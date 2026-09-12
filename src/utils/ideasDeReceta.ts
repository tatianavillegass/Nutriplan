import type { Client } from '../types/client';
import type { Alimento } from '../types/food';
import type { Meal, Plan } from '../types/plan';
import { recetasDeLaComida } from '../types/plan';
import type { Receta } from '../types/recipe';
import type { ExchangeCounts } from './exchanges';
import { matchRecipes, type MatchResult } from './recipeMatcher';

/** Cuántas ideas caben sin que dejen de ser ideas. */
export const TOPE_DE_IDEAS = 3;

/**
 * LAS IDEAS DE UNA COMIDA: LAS SUYAS SI LAS HAY
 *
 * En fase 2 la clienta no come platos cerrados: come combinaciones que elige
 * ella. Las recetas son **ideas** de cómo juntar lo que le toca, y salen en la
 * hoja de la nevera y en el «¿sin ideas?» de su app.
 *
 * Las elegía el recomendador por su cuenta, y eso tiene dos problemas. El
 * pequeño: acierta a medias, porque sabe de macros pero no de si a esa persona
 * le apetece. El grande: **no había forma de quitar una**. Si el recomendador
 * le ponía un café proteico en la cena, ahí se quedaba.
 *
 * Ahora manda lo que la nutricionista asigne a esa comida
 * (`Plan.recetasAsignadas`, la misma tarjeta que en fase 1). Si no ha asignado
 * ninguna, se sigue proponiendo: una hoja sin ideas es peor que unas ideas
 * mejorables, y a quien acaba de montar su primer plan no se le puede pedir
 * que además elija recetas para que la hoja salga completa.
 */
export function ideasDeLaComida(
  plan: Plan,
  meal: Meal,
  reparto: ExchangeCounts,
  recetas: Receta[],
  foods: Alimento[],
  client: Client,
  limite = TOPE_DE_IDEAS,
): MatchResult[] {
  const elegidas = recetasDeLaComida(plan, meal.id);
  const suyas = elegidas
    .map((id) => recetas.find((r) => r.id === id))
    .filter((r): r is Receta => !!r);

  if (suyas.length) {
    /*
     * Se pasan igual por el recomendador —así traen lo que cubren y lo que les
     * falta, que es lo que se enseña debajo— pero **sin filtrar por comida**:
     * si ella ha puesto ahí esa receta, es que va ahí. Y se devuelven en SU
     * orden, no en el del marcador: la primera que puso es la que quiere que
     * se vea primero.
     */
    const evaluadas = matchRecipes(suyas, reparto, {
      slot: 'todas',
      preferencias: client.preferencias,
      limite: suyas.length,
      client,
      foods,
    });
    return elegidas
      .map((id) => evaluadas.find((e) => e.receta.id === id))
      .filter((e): e is MatchResult => !!e)
      .slice(0, limite);
  }

  return matchRecipes(recetas, reparto, {
    slot: meal.slot,
    preferencias: client.preferencias,
    limite,
    client,
    foods,
  });
}
