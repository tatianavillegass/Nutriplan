import {
  EXCHANGE_GROUPS,
  EXCHANGE_GROUP_LIST,
  bucketsDeGrupo,
  type ExchangeGroupId,
  type MacroBucket,
} from '../data/exchangeGroups';
import type { ExchangeGrid, Meal } from '../types/plan';
import type { MacroGrams } from '../types/calculations';
import type { Alimento } from '../types/food';
import { kcalFromMacros } from './macros';

export type ExchangeCounts = Partial<Record<ExchangeGroupId, number>>;

const ZERO: MacroGrams = { proteina: 0, hc: 0, grasa: 0 };

/** Un alimento que gasta intercambios de más de un grupo a la vez. */
export function esCompuesto(food: Alimento): boolean {
  return !!food.equivale && Object.values(food.equivale).some((n) => (n ?? 0) > 0);
}

/**
 * QUÉ GASTA LO QUE SE HA MARCADO
 *
 * Para casi todo, marcar n porciones gasta n intercambios de su grupo. Para un
 * alimento compuesto, cada porción es una medida casera y gasta el reparto que
 * lleva declarado: una medida de mezcla de tortitas descuenta almidones y
 * proteína a la vez, que es justo lo que se come.
 */
export function aporteDeAlimento(food: Alimento, porciones: number): ExchangeCounts {
  if (!porciones) return {};
  if (esCompuesto(food)) {
    const out: ExchangeCounts = {};
    for (const [g, n] of Object.entries(food.equivale!) as [ExchangeGroupId, number][]) {
      if (n) out[g] = (out[g] ?? 0) + n * porciones;
    }
    return out;
  }
  return food.grupo ? { [food.grupo]: porciones } : {};
}

/** Los grupos que ocupa un alimento: uno normalmente, varios si es compuesto. */
export function gruposDeAlimento(food: Alimento): ExchangeGroupId[] {
  if (esCompuesto(food)) {
    return (Object.entries(food.equivale!) as [ExchangeGroupId, number][])
      .filter(([, n]) => n > 0)
      .map(([g]) => g);
  }
  return food.grupo ? [food.grupo] : [];
}

/**
 * Lo que gasta una medida, en palabras: «2 almidones + 2 proteicos magros».
 * Es lo que hace entendible el alimento compuesto, porque si no la clienta no
 * sabe por qué al marcarlo se le mueven dos contadores.
 */
export function describeEquivalencia(food: Alimento): string {
  if (!esCompuesto(food)) return '';
  return (Object.entries(food.equivale!) as [ExchangeGroupId, number][])
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => (EXCHANGE_GROUPS[a]?.orden ?? 0) - (EXCHANGE_GROUPS[b]?.orden ?? 0))
    .map(([g, n]) => {
      const nombre = EXCHANGE_GROUPS[g]?.nombre.toLowerCase() ?? g;
      const cantidad = n === 0.5 ? '½' : String(n);
      return `${cantidad} ${nombre}`;
    })
    .join(' + ');
}

/** Suma dos repartos de intercambios. */
export function sumarCounts(a: ExchangeCounts, b: ExchangeCounts): ExchangeCounts {
  const out: ExchangeCounts = { ...a };
  for (const [g, n] of Object.entries(b) as [ExchangeGroupId, number][]) {
    if (n) out[g] = (out[g] ?? 0) + n;
  }
  return out;
}

/** Intercambios → macros. Única vía permitida (regla §10.6: todo trazable a la tabla). */
export function exchangesToMacros(counts: ExchangeCounts): MacroGrams {
  return EXCHANGE_GROUP_LIST.reduce<MacroGrams>((acc, g) => {
    const n = counts[g.id] ?? 0;
    if (!n) return acc;
    return {
      proteina: acc.proteina + n * g.proteina,
      hc: acc.hc + n * g.hc,
      grasa: acc.grasa + n * g.grasa,
    };
  }, { ...ZERO });
}

export function exchangesToKcal(counts: ExchangeCounts): number {
  return kcalFromMacros(exchangesToMacros(counts));
}

/** kcal que aporta 1 intercambio de un grupo. */
export function kcalPerExchange(id: ExchangeGroupId): number {
  const g = EXCHANGE_GROUPS[id];
  return kcalFromMacros({ proteina: g.proteina, hc: g.hc, grasa: g.grasa });
}

/** Suma de una columna (comida) de la grilla. */
export function mealExchanges(grid: ExchangeGrid, mealId: string): ExchangeCounts {
  return grid[mealId] ?? {};
}

/** Suma de una fila (grupo) a lo largo de todas las comidas. */
export function groupTotal(grid: ExchangeGrid, group: ExchangeGroupId, meals: Meal[]): number {
  return meals.reduce((s, m) => s + (grid[m.id]?.[group] ?? 0), 0);
}

/** Totales de toda la grilla, por grupo. */
export function gridTotals(grid: ExchangeGrid, meals: Meal[]): ExchangeCounts {
  const out: ExchangeCounts = {};
  for (const g of EXCHANGE_GROUP_LIST) {
    const t = groupTotal(grid, g.id, meals);
    if (t) out[g.id] = t;
  }
  return out;
}

/** Macros PAUTADAS del día completo. */
export function gridMacros(grid: ExchangeGrid, meals: Meal[]): MacroGrams {
  return exchangesToMacros(gridTotals(grid, meals));
}

/**
 * Agregación para el "Esquema del plan" (§6.1):
 *   proteicos magros/semigrasos/grasos → Proteína
 *   almidones + fruta + legumbres + azúcares → Carbohidrato
 *   grasas → Grasa
 * (verduras quedan fuera del esquema: son ilimitadas, §10.1)
 */
export function bucketExchanges(counts: ExchangeCounts): Record<MacroBucket, number> {
  const out: Record<MacroBucket, number> = { proteina: 0, carbohidrato: 0, grasa: 0 };
  for (const g of EXCHANGE_GROUP_LIST) {
    if (g.ilimitado) continue;
    const n = counts[g.id] ?? 0;
    if (!n) continue;
    // Las legumbres cuentan en dos: son hidrato y proteína a la vez.
    for (const b of bucketsDeGrupo(g.id)) out[b] += n;
  }
  return out;
}

/** Perfil de grupos presentes (para el matcher de recetas). */
export function groupProfile(counts: ExchangeCounts): ExchangeGroupId[] {
  return EXCHANGE_GROUP_LIST.filter((g) => (counts[g.id] ?? 0) > 0).map((g) => g.id);
}

export function isGridEmpty(counts: ExchangeCounts): boolean {
  return Object.values(counts).every((v) => !v);
}
