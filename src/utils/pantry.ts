import type { Alimento } from '../types/food';
import type { DayType, DespensaComida, Meal } from '../types/plan';
import { FOOD_ACEITE, SLOTS_CON_COCCION } from '../types/plan';
import { EXCHANGE_GROUPS, type MacroBucket } from '../data/exchangeGroups';
import { gramosPorIntercambio } from './recipeComposition';

/**
 * DESPENSA POR COMIDA
 *
 * Lo que el cliente ve en cada comida. Antes había una única lista de
 * exclusiones para todo el día, y tachar el huevo en la merienda lo quitaba
 * también del desayuno. Ahora cada comida tiene la suya.
 */

export function despensaDe(dayType: DayType, mealId: string): DespensaComida {
  return dayType.despensa?.[mealId] ?? {};
}

/** Alimentos que ve el cliente en una comida, ya resueltos. */
export function alimentosDeComida(
  dayType: DayType,
  meal: Meal,
  foods: Alimento[],
): Alimento[] {
  const d = despensaDe(dayType, meal.id);
  const globalmenteExcluidos = dayType.alimentosExcluidos ?? [];
  const porId = new Map(foods.map((f) => [f.id, f]));

  // 1 · Lista propia: manda sobre todo lo demás. Una lista vacía es una
  // lista vacía, no "usa el catálogo": si no hay nada, no se ofrece nada.
  if (d.seleccion) {
    return d.seleccion
      .map((id) => porId.get(id))
      .filter((f): f is Alimento => !!f && !!gramosPorIntercambio(f));
  }

  // 2 · Catálogo por tipo de comida, ajustado.
  const excluidos = new Set([...globalmenteExcluidos, ...(d.excluidos ?? [])]);
  const base = foods.filter(
    (f) =>
      f.comidas_sugeridas.includes(meal.slot) &&
      !excluidos.has(f.id) &&
      !!f.grupo &&
      !EXCHANGE_GROUPS[f.grupo]?.ilimitado &&
      !!gramosPorIntercambio(f),
  );

  // 3 · Añadidos: alimentos que no estaban sugeridos para esa comida.
  const anadidos = (d.anadidos ?? [])
    .filter((id) => !excluidos.has(id) && !base.some((f) => f.id === id))
    .map((id) => porId.get(id))
    .filter((f): f is Alimento => !!f && !!gramosPorIntercambio(f));

  return [...base, ...anadidos];
}

/** Los de un macro concreto. */
export function alimentosDeBucket(
  dayType: DayType,
  meal: Meal,
  bucket: MacroBucket,
  foods: Alimento[],
): Alimento[] {
  return alimentosDeComida(dayType, meal, foods).filter(
    (f) => !!f.grupo && EXCHANGE_GROUPS[f.grupo]?.bucket === bucket,
  );
}

export function estaExcluido(dayType: DayType, mealId: string, foodId: string): boolean {
  const d = despensaDe(dayType, mealId);
  if (d.seleccion) return !d.seleccion.includes(foodId);
  return (
    (d.excluidos ?? []).includes(foodId) || (dayType.alimentosExcluidos ?? []).includes(foodId)
  );
}

/** Devuelve la despensa con un alimento quitado o repuesto en esa comida. */
export function alternarExclusion(
  dayType: DayType,
  mealId: string,
  foodId: string,
): Record<string, DespensaComida> {
  const d = despensaDe(dayType, mealId);
  const despensa = { ...(dayType.despensa ?? {}) };

  if (d.seleccion) {
    const seleccion = d.seleccion.includes(foodId)
      ? d.seleccion.filter((x) => x !== foodId)
      : [...d.seleccion, foodId];
    despensa[mealId] = { ...d, seleccion };
    return despensa;
  }

  const excluidos = d.excluidos ?? [];
  const anadidos = d.anadidos ?? [];

  // Si estaba añadido a mano, quitarlo es sacarlo de los añadidos.
  if (anadidos.includes(foodId)) {
    despensa[mealId] = { ...d, anadidos: anadidos.filter((x) => x !== foodId) };
    return despensa;
  }

  despensa[mealId] = {
    ...d,
    excluidos: excluidos.includes(foodId)
      ? excluidos.filter((x) => x !== foodId)
      : [...excluidos, foodId],
  };
  return despensa;
}

/** Añade un alimento a una comida aunque no esté sugerido para ella. */
export function anadirAlimento(
  dayType: DayType,
  mealId: string,
  foodId: string,
): Record<string, DespensaComida> {
  const d = despensaDe(dayType, mealId);
  const despensa = { ...(dayType.despensa ?? {}) };

  if (d.seleccion) {
    despensa[mealId] = d.seleccion.includes(foodId)
      ? d
      : { ...d, seleccion: [...d.seleccion, foodId] };
    return despensa;
  }

  despensa[mealId] = {
    ...d,
    anadidos: (d.anadidos ?? []).includes(foodId) ? d.anadidos : [...(d.anadidos ?? []), foodId],
    excluidos: (d.excluidos ?? []).filter((x) => x !== foodId),
  };
  return despensa;
}

// ── Aceite de cocción ───────────────────────────────────────

/**
 * Porciones de grasa que se reservan para el aceite en una comida.
 * Por defecto, 1 en comida y cena si hay grasa pautada; nunca más de la mitad.
 */
export function reservaAceite(dayType: DayType, meal: Meal): number {
  const pautadoGrasa = dayType.grid[meal.id]?.grasas ?? 0;
  if (pautadoGrasa <= 0) return 0;

  const explicita = dayType.aceiteCoccion?.[meal.id];
  if (explicita != null) return Math.min(explicita, pautadoGrasa);

  return SLOTS_CON_COCCION.includes(meal.slot) ? Math.min(1, pautadoGrasa) : 0;
}

/** Nota que se imprime cuando hay aceite reservado. */
export function notaAceite(foods: Alimento[], porciones: number): string | undefined {
  if (porciones <= 0) return undefined;
  const aceite = foods.find((f) => f.id === FOOD_ACEITE);
  const gpi = aceite ? gramosPorIntercambio(aceite) : 5;
  const gramos = Math.round((gpi ?? 5) * porciones);
  const medida = porciones === 1 ? '1 cdta' : `${porciones} cdtas`;
  return `Aceite de cocción: ${gramos} g (${medida})`;
}

/**
 * Intercambios de una comida ya descontado el aceite reservado.
 * Es lo que se ofrece a elegir.
 */
export function repartoElegible(dayType: DayType, meal: Meal) {
  const reparto = { ...(dayType.grid[meal.id] ?? {}) };
  const reserva = reservaAceite(dayType, meal);
  if (reserva > 0 && reparto.grasas) {
    const resto = reparto.grasas - reserva;
    if (resto > 0) reparto.grasas = resto;
    else delete reparto.grasas;
  }
  return { reparto, reserva };
}
