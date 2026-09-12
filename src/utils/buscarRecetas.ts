import type { Receta } from '../types/recipe';
import type { Alimento } from '../types/food';
import { coincide } from './similitud';

/**
 * BUSCAR POR LO QUE LLEVA, NO SÓLO POR CÓMO SE LLAMA
 *
 * Hasta ahora sólo se buscaba por el nombre del plato, y eso obliga a
 * acordarse de cómo lo bautizaste. Al pautar la pregunta casi nunca es «¿cómo
 * se llamaba?» sino «¿qué tengo con salmón?» — porque lo que se está buscando
 * es una idea para esta persona, no un plato concreto.
 *
 * Se mira el nombre **y** los ingredientes, con la misma comparación de
 * siempre: sin tildes, por cualquier palabra y en singular, que el catálogo
 * dice «Nuez» y nadie escribe eso.
 *
 * SE BUSCA EN EL NOMBRE ESCRITO, NO EN EL DEL CATÁLOGO
 * ====================================================
 * Un ingrediente puede estar enlazado (`foodId`) o suelto —la verdura, una
 * gelatina, lo que se escribió a mano—. Buscando sólo por lo enlazado, media
 * receta se volvería invisible. Se mira el texto del ingrediente y, si está
 * enlazado, también el nombre del alimento: la receta pone «salmón» y el
 * catálogo «Salmón fresco», y las dos formas tienen que encontrarla.
 *
 * Los **tags** entran también: es lo que ella escribe cuando piensa en
 * categorías —«sin gluten», «rápido»— y esconderlos aquí la obligaría a usar
 * dos buscadores distintos para la misma pregunta.
 */
export function recetaCoincide(
  receta: Receta,
  consulta: string,
  foods: Alimento[] = [],
): boolean {
  const q = consulta.trim();
  if (!q) return true;

  if (coincide(receta.nombre, q)) return true;
  if (receta.tags.some((t) => coincide(t, q))) return true;

  const porId = new Map(foods.map((f) => [f.id, f]));
  return receta.ingredientes.some((i) => {
    if (i.nombre && coincide(i.nombre, q)) return true;
    const food = i.foodId ? porId.get(i.foodId) : undefined;
    return !!food && coincide(food.nombre, q);
  });
}

/** Las que encajan, en el orden en que venían. */
export function buscarRecetas(
  recetas: Receta[],
  consulta: string,
  foods: Alimento[] = [],
): Receta[] {
  const q = consulta.trim();
  if (!q) return recetas;
  return recetas.filter((r) => recetaCoincide(r, q, foods));
}

/**
 * Por qué salió esa receta, cuando no fue por el nombre. Sin esto, buscando
 * «huevo» aparece un bizcocho y parece un fallo del buscador — cuando lo que
 * pasa es que lleva dos huevos.
 */
export function porQueCoincide(
  receta: Receta,
  consulta: string,
  foods: Alimento[] = [],
): string | undefined {
  const q = consulta.trim();
  if (!q || coincide(receta.nombre, q)) return undefined;

  const porId = new Map(foods.map((f) => [f.id, f]));
  const ing = receta.ingredientes.find((i) => {
    if (i.nombre && coincide(i.nombre, q)) return true;
    const food = i.foodId ? porId.get(i.foodId) : undefined;
    return !!food && coincide(food.nombre, q);
  });
  if (ing) {
    const food = ing.foodId ? porId.get(ing.foodId) : undefined;
    return `lleva ${(ing.nombre || food?.nombre || '').toLowerCase()}`;
  }

  const tag = receta.tags.find((t) => coincide(t, q));
  return tag ? `etiqueta «${tag}»` : undefined;
}
