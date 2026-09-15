import type { ExchangeGroupId } from '../data/exchangeGroups';

/**
 * SUBGRUPOS QUE NO SE LISTAN UNO A UNO
 *
 * Una porción de fruta es cualquier fruta: los mismos 15 g de hidrato, se
 * coma manzana o arándanos. Así que la fruta no se ofrece como cuarenta
 * alimentos sino como uno —«Fruta»— que se despliega y se busca cuál.
 *
 * Y por eso lo que la nutricionista pone en la despensa son **sugerencias, no
 * una jaula**: si ese día tiene peras en casa, la porción sigue siendo la
 * misma. Lo decidió ya la fase 3 y aquí vive la regla, para que la fase 2 haga
 * lo mismo y no haya dos criterios sobre lo mismo: pedirle a la clienta que
 * coma arándanos porque es la única fruta que le cabía en la despensa es la
 * app mandando donde no le toca.
 *
 * Los demás subgrupos NO entran, ni aquí ni al cambiar un alimento en fase 2:
 * ahí la nutricionista compone la comida entera, y ofrecerle a la clienta los
 * veintiséis proteicos magros del catálogo es quitarle a ella la decisión de
 * qué cena. **La proteína se cambia en las recetas de fase 1**
 * (`IngredientSwap`), donde el plato ya está escrito.
 */
export const SUBGRUPOS_ABIERTOS: Partial<Record<ExchangeGroupId, string>> = {
  fruta: 'Fruta',
  verduras: 'Verdura',
};

/** Si ese subgrupo se ofrece abierto al catálogo entero. */
export function esAbierto(grupo?: ExchangeGroupId): boolean {
  return !!grupo && !!SUBGRUPOS_ABIERTOS[grupo];
}
