import {
  EXCHANGE_GROUPS,
  EXCHANGE_GROUP_LIST,
  type ExchangeGroupId,
  type MacroBucket,
} from '../data/exchangeGroups';
import type { ExchangeGrid, Meal } from '../types/plan';
import type { MacroGrams } from '../types/calculations';
import { kcalFromMacros } from './macros';

export type ExchangeCounts = Partial<Record<ExchangeGroupId, number>>;

const ZERO: MacroGrams = { proteina: 0, hc: 0, grasa: 0 };

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
    out[g.bucket] += counts[g.id] ?? 0;
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
