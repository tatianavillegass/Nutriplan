import type { Alimento } from '../types/food';

/**
 * EL MISMO ALIMENTO, DOS VECES EN LA LISTA
 *
 * A la clienta se le juntan tres orígenes: el catálogo de la nutricionista, lo
 * que ella se ha calculado con la etiqueta (`alimentosPropios`) y lo que cocina
 * (`recetasPropias`). Cada uno pone su propio id —`f_`, `mio_`, `rp_`— y hasta
 * ahora sólo se quitaban los repetidos **por id**, que por construcción nunca
 * chocan. Así que el mismo yogur salía dos veces en el buscador.
 *
 * Pasa por dos caminos, y los dos son normales:
 *
 * 1. **La nutricionista acepta un alimento de una clienta** y se lo lleva a su
 *    catálogo. Ahí nace una copia con id nuevo, y la de la clienta **no se
 *    borra**: no se puede, el registro del día es suyo y sólo lo escribe ella.
 *    Desde ese momento el alimento existe dos veces, y es correcto que exista:
 *    lo que no es correcto es enseñarlo dos veces.
 * 2. **La clienta calcula la misma etiqueta dos días distintos**, sin que nadie
 *    toque nada.
 *
 * Así que se quitan **por nombre**, sin tildes ni mayúsculas. Manda el primero
 * de la lista, y por eso se pasa el catálogo delante: el de la nutricionista
 * está revisado —tiene sus alérgenos, su medida casera, su equivalencia de
 * cocido— y el de la clienta se escribió deprisa con una etiqueta delante.
 */

const llave = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * La misma lista sin repetidos. Gana el que aparece antes, así que el orden en
 * que se juntan las listas es la decisión de cuál manda.
 */
export function sinRepetidos(foods: Alimento[]): Alimento[] {
  const vistos = new Set<string>();
  const out: Alimento[] = [];
  for (const f of foods) {
    const k = llave(f.nombre);
    /* Sin nombre no hay con qué comparar: entra, que perderlo sería peor. */
    if (k && vistos.has(k)) continue;
    if (k) vistos.add(k);
    out.push(f);
  }
  return out;
}

/** El que ya tiene con ese nombre, si lo tiene. */
export function mismoNombre(foods: Alimento[], nombre: string): Alimento | undefined {
  const k = llave(nombre);
  return k ? foods.find((f) => llave(f.nombre) === k) : undefined;
}

/**
 * Uno **suyo** con ese nombre: de los que se calculó con la etiqueta, no del
 * catálogo. Sirve para reutilizar su id en vez de crear otro igual.
 *
 * Nunca devuelve uno del catálogo a propósito: si escribe «yogur griego» y su
 * nutricionista tiene otro con ese nombre, los macros que ella acaba de copiar
 * de la etiqueta son los de SU bote, no los del catálogo.
 */
export function suyoConEseNombre(foods: Alimento[], nombre: string): Alimento | undefined {
  const k = llave(nombre);
  return k ? foods.find((f) => f.id.startsWith('mio_') && llave(f.nombre) === k) : undefined;
}
