import type { Alimento } from '../types/food';
import { gramosPorIntercambio } from './recipeComposition';
import { singularizar } from './measures';
import { EXCHANGE_GROUPS } from '../data/exchangeGroups';

/**
 * ¿QUÉ SE PARECE MÁS A ESTO?
 *
 * Al cambiar un ingrediente, no todas las alternativas del grupo valen igual:
 * cambiar pollo por pavo es natural, por tofu ya es otra comida. Se ordenan
 * por parecido para que arriba salga siempre lo más obvio.
 *
 * El parecido mezcla tres cosas, de más a menos peso:
 *   1 · Palabras compartidas en el nombre (pechuga, crudo, light…)
 *   2 · Perfil de macros por 100 g
 *   3 * Tamaño de la porción: 30 g y 35 g se sustituyen sin pensar
 */

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Palabras vacías que no dicen nada del alimento. */
const VACIAS = new Set(['de', 'del', 'la', 'el', 'con', 'sin', 'en', 'y', 'al', 'a']);

function palabras(nombre: string): Set<string> {
  return new Set(
    norm(nombre)
      .split(/[\s,()%+]+/)
      .filter((p) => p.length > 2 && !VACIAS.has(p)),
  );
}

/** Jaccard entre los nombres: 1 = mismas palabras, 0 = ninguna en común. */
export function parecidoNombre(a: string, b: string): number {
  const pa = palabras(a);
  const pb = palabras(b);
  if (!pa.size || !pb.size) return 0;
  let comunes = 0;
  for (const p of pa) if (pb.has(p)) comunes++;
  return comunes / (pa.size + pb.size - comunes);
}

/** Distancia entre perfiles de macros por 100 g, normalizada a 0–1. */
export function parecidoMacros(a: Alimento, b: Alimento): number {
  const na = a.nutrientes;
  const nb = b.nutrientes;
  if (!na || !nb) return 0;
  const dif =
    Math.abs((na.hc ?? 0) - (nb.hc ?? 0)) / 100 +
    Math.abs((na.proteina ?? 0) - (nb.proteina ?? 0)) / 100 +
    Math.abs((na.grasa ?? 0) - (nb.grasa ?? 0)) / 100;
  return Math.max(0, 1 - dif / 1.5);
}

/** Porciones parecidas se cambian sin rehacer la receta. */
export function parecidoPorcion(a: Alimento, b: Alimento): number {
  const ga = gramosPorIntercambio(a);
  const gb = gramosPorIntercambio(b);
  if (!ga || !gb) return 0;
  return Math.min(ga, gb) / Math.max(ga, gb);
}

/**
 * Puntuación total, 0–1. Sólo tiene sentido comparar alimentos del mismo
 * subgrupo: entre grupos distintos los macros ya son incomparables.
 */
export function similitud(a: Alimento, b: Alimento): number {
  return (
    0.5 * parecidoNombre(a.nombre, b.nombre) +
    0.3 * parecidoMacros(a, b) +
    0.2 * parecidoPorcion(a, b)
  );
}

/**
 * Alternativas del mismo subgrupo ordenadas por parecido.
 * El propio alimento nunca sale en su lista.
 */
export function equivalentesOrdenados(original: Alimento, foods: Alimento[]): Alimento[] {
  if (!original.grupo) return [];
  return foods
    .filter((f) => f.id !== original.id && f.grupo === original.grupo && !!gramosPorIntercambio(f))
    .map((f) => ({ f, s: similitud(original, f) }))
    .sort((a, b) => b.s - a.s || a.f.nombre.localeCompare(b.f.nombre))
    .map((x) => x.f);
}

/**
 * GRASA ESCONDIDA
 *
 * Un intercambio de proteico graso son 5 g de grasa. El parmesano cumple
 * (6.2 g por cada 7 g de proteína), pero el feta trae 10 g y el cheddar 9:
 * su porción vale por dos de grasa. En vez de sacarlos del grupo — la porción
 * la sigue definiendo la proteína — se avisa de lo que traen de más.
 */
export function grasaExtra(food: Alimento): number | undefined {
  if (!food.grupo || !food.nutrientes) return undefined;
  const info = EXCHANGE_GROUPS[food.grupo];
  const gpi = gramosPorIntercambio(food);
  if (!info || !gpi || info.ilimitado) return undefined;

  const grasaReal = ((food.nutrientes.grasa ?? 0) * gpi) / 100;
  const exceso = grasaReal - info.grasa;
  // Medio gramo de margen: por debajo no cambia nada en el plato.
  return exceso > Math.max(1, info.grasa * 0.4) ? exceso : undefined;
}

/** Aviso listo para pintar, o undefined si el alimento encaja en su grupo. */
export function avisoGrasaExtra(food: Alimento): string | undefined {
  const extra = grasaExtra(food);
  if (extra === undefined) return undefined;
  const porciones = extra / 5;
  return porciones >= 0.5
    ? `+${extra.toFixed(1)} g de grasa: cuenta también ${porciones.toFixed(1)} porciones de grasa`
    : `+${extra.toFixed(1)} g de grasa sobre su grupo`;
}

/**
 * Filtro por texto para las listas largas: sin tildes y por cualquier palabra.
 *
 * También en singular. El catálogo dice "Espinaca" y "Nuez", pero nadie
 * escribe eso: se escribe "espinacas" y "nueces". Sin esto la búsqueda no
 * devolvía nada y parecía que el alimento no existía.
 */
export function coincide(nombre: string, consulta: string): boolean {
  const bruto = consulta.trim();
  const q = norm(bruto);
  if (!q) return true;

  const n = norm(nombre);
  const palabras = n.split(/[\s,()]+/);
  const casa = (t: string) => !!t && (n.includes(t) || palabras.some((p) => p.startsWith(t)));

  if (casa(q)) return true;

  const singular = norm(singularizar(bruto));
  return singular !== q && casa(singular);
}
