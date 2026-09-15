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
 * OJO: esta lista es sólo **cómo se pinta la fase 3**, no quién se puede
 * cambiar por quién. Al cambiar un alimento dentro de una combinación de fase
 * 2 se abre el catálogo de **cualquier** subgrupo (ver `cambiarAlimento`):
 * dentro de un subgrupo la porción es la misma, así que pollo por merluza es
 * tan exacto como manzana por pera. Lo que no se hace en fase 3 es enseñar
 * «Proteico magro» plegado: ahí la clienta compone la comida entera y la lista
 * de ella es la sugerencia que se lee.
 */
export const SUBGRUPOS_ABIERTOS: Partial<Record<ExchangeGroupId, string>> = {
  fruta: 'Fruta',
  verduras: 'Verdura',
};

/** Si ese subgrupo se ofrece abierto al catálogo entero. */
export function esAbierto(grupo?: ExchangeGroupId): boolean {
  return !!grupo && !!SUBGRUPOS_ABIERTOS[grupo];
}
