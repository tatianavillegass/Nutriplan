import type { Alimento } from '../types/food';
import type { PorcionesMarcadas } from '../types/diary';
import type { OpcionEscalada } from './mealOptions';
import { EXCHANGE_GROUPS, type ExchangeGroupId, type MacroBucket } from '../data/exchangeGroups';
import type { Seleccion, SeleccionGrupos } from './dailyBudget';

/**
 * LO QUE EL CLIENTE VA MARCANDO
 *
 * Todo se guarda igual, sea cual sea la fase: `mealId → foodId → porciones`.
 * Desde ahí se derivan los totales por macro y por subgrupo, así que el
 * presupuesto diario funciona igual pulsando un alimento suelto (fase 3) que
 * una opción completa (fase 2) o una receta sugerida.
 */

/** Agrega lo marcado por macro (proteína / carbohidrato / grasa). */
export function seleccionPorBucket(
  porciones: PorcionesMarcadas,
  foods: Alimento[],
): Seleccion {
  const out: Seleccion = {};
  for (const [mealId, porFood] of Object.entries(porciones)) {
    const acc: Partial<Record<MacroBucket, number>> = {};
    for (const [foodId, n] of Object.entries(porFood)) {
      const food = foods.find((f) => f.id === foodId);
      if (!food || !n) continue;
      const g = food.grupo ? EXCHANGE_GROUPS[food.grupo] : undefined;
      if (!g || g.ilimitado) continue;
      acc[g.bucket] = (acc[g.bucket] ?? 0) + n;
    }
    out[mealId] = acc;
  }
  return out;
}

/** Agrega lo marcado por subgrupo de intercambio. */
export function seleccionPorGrupo(
  porciones: PorcionesMarcadas,
  foods: Alimento[],
): SeleccionGrupos {
  const out: SeleccionGrupos = {};
  for (const [mealId, porFood] of Object.entries(porciones)) {
    const acc: Partial<Record<ExchangeGroupId, number>> = {};
    for (const [foodId, n] of Object.entries(porFood)) {
      const food = foods.find((f) => f.id === foodId);
      if (!food || !n) continue;
      if (!food.grupo || EXCHANGE_GROUPS[food.grupo]?.ilimitado) continue;
      acc[food.grupo] = (acc[food.grupo] ?? 0) + n;
    }
    out[mealId] = acc;
  }
  return out;
}

/** Suma o resta porciones de un alimento en una comida. */
export function marcarAlimento(
  porciones: PorcionesMarcadas,
  mealId: string,
  foodId: string,
  delta: number,
): PorcionesMarcadas {
  const comida = { ...(porciones[mealId] ?? {}) };
  const v = Math.max(0, (comida[foodId] ?? 0) + delta);
  if (v === 0) delete comida[foodId];
  else comida[foodId] = v;
  return { ...porciones, [mealId]: comida };
}

/** Fija una cantidad exacta (0 la borra). */
export function fijarAlimento(
  porciones: PorcionesMarcadas,
  mealId: string,
  foodId: string,
  cantidad: number,
): PorcionesMarcadas {
  const comida = { ...(porciones[mealId] ?? {}) };
  if (cantidad <= 0) delete comida[foodId];
  else comida[foodId] = cantidad;
  return { ...porciones, [mealId]: comida };
}

/** Quita de una comida todos los alimentos de un macro. */
export function limpiarBucket(
  porciones: PorcionesMarcadas,
  mealId: string,
  bucket: MacroBucket,
  foods: Alimento[],
): PorcionesMarcadas {
  const comida = { ...(porciones[mealId] ?? {}) };
  for (const foodId of Object.keys(comida)) {
    const food = foods.find((f) => f.id === foodId);
    if (food?.grupo && EXCHANGE_GROUPS[food.grupo]?.bucket === bucket) delete comida[foodId];
  }
  return { ...porciones, [mealId]: comida };
}

/**
 * Elegir una opción completa de la Fase 2: sustituye lo que hubiera marcado
 * de ese macro en esa comida por los alimentos de la opción.
 */
export function elegirOpcion(
  porciones: PorcionesMarcadas,
  mealId: string,
  opcion: OpcionEscalada,
  foods: Alimento[],
): PorcionesMarcadas {
  let out = limpiarBucket(porciones, mealId, opcion.bucket, foods);
  for (const item of opcion.items) {
    out = fijarAlimento(out, mealId, item.foodId, item.intercambios);
  }
  return out;
}

/** ¿Está esta opción marcada tal cual? */
export function opcionElegida(
  porciones: PorcionesMarcadas,
  mealId: string,
  opcion: OpcionEscalada,
): boolean {
  const comida = porciones[mealId] ?? {};
  return (
    opcion.items.length > 0 &&
    opcion.items.every((i) => (comida[i.foodId] ?? 0) === i.intercambios)
  );
}

/** Porciones marcadas de un macro en una comida. */
export function marcadoDeBucket(
  porciones: PorcionesMarcadas,
  mealId: string,
  bucket: MacroBucket,
  foods: Alimento[],
): number {
  return Object.entries(porciones[mealId] ?? {}).reduce((s, [foodId, n]) => {
    const food = foods.find((f) => f.id === foodId);
    if (!food?.grupo) return s;
    const g = EXCHANGE_GROUPS[food.grupo];
    return g && !g.ilimitado && g.bucket === bucket ? s + (n || 0) : s;
  }, 0);
}
