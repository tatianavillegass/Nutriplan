import type { Alimento } from '../types/food';
import type { DayType } from '../types/plan';
import type { Extra, RegistroDia } from '../types/diary';
import type { MacroGrams } from '../types/calculations';
import { EXCHANGE_GROUPS, type MacroBucket } from '../data/exchangeGroups';
import { exchangesToMacros, gridTotals, bucketExchanges } from './exchanges';
import { kcalFromMacros } from './macros';
import { gramosPorIntercambio } from './recipeComposition';

/**
 * SEGUIMIENTO DEL DÍA
 *
 * Compara lo pautado con lo que el cliente ha marcado, sumando los extras.
 * No juzga: informa. Un extra no "rompe" el plan, lo desplaza y se ve cuánto.
 */

export interface BalanceDia {
  pautado: MacroGrams;
  kcalPautado: number;
  /** Lo marcado dentro del plan (porciones y recetas cumplidas). */
  delPlan: MacroGrams;
  /** Lo consumido fuera del plan. */
  deExtras: MacroGrams;
  total: MacroGrams;
  kcalTotal: number;
  diferencia: MacroGrams;
  kcalDiferencia: number;
  /** % de las calorías pautadas que suponen los extras. */
  pesoExtras: number;
}

const CERO: MacroGrams = { proteina: 0, hc: 0, grasa: 0 };

const suma = (a: MacroGrams, b: MacroGrams): MacroGrams => ({
  proteina: a.proteina + b.proteina,
  hc: a.hc + b.hc,
  grasa: a.grasa + b.grasa,
});

/** Macros de un extra a partir del catálogo, si está enlazado. */
export function macrosDeExtra(
  cantidad: number,
  food: Alimento | undefined,
): { macros: MacroGrams; kcal: number } {
  if (food?.nutrientes) {
    const f = cantidad / 100;
    const macros = {
      proteina: food.nutrientes.proteina * f,
      hc: food.nutrientes.hc * f,
      grasa: food.nutrientes.grasa * f,
    };
    return { macros, kcal: kcalFromMacros(macros) };
  }
  return { macros: { ...CERO }, kcal: 0 };
}

export function totalExtras(extras: Extra[]): { macros: MacroGrams; kcal: number } {
  const macros = extras.reduce((acc, e) => suma(acc, e.macros), { ...CERO });
  return { macros, kcal: extras.reduce((s, e) => s + e.kcal, 0) };
}

/** Macros que aportan las porciones que el cliente ha marcado (Fase 3). */
export function macrosDePorciones(registro: RegistroDia, foods: Alimento[]): MacroGrams {
  let acc: MacroGrams = { ...CERO };
  for (const porComida of Object.values(registro.porciones ?? {})) {
    for (const [foodId, n] of Object.entries(porComida)) {
      if (!n) continue;
      const food = foods.find((f) => f.id === foodId);
      if (!food?.grupo) continue;
      acc = suma(acc, exchangesToMacros({ [food.grupo]: n }));
    }
  }
  return acc;
}

/**
 * Balance del día. Si el cliente no ha marcado nada dentro del plan se asume
 * que sigue lo pautado: lo interesante entonces es el efecto de los extras.
 */
export function balanceDelDia(
  dayType: DayType | undefined,
  registro: RegistroDia | undefined,
  foods: Alimento[],
  opciones: { asumirPlanCumplido?: boolean } = {},
): BalanceDia {
  const pautado = dayType
    ? exchangesToMacros(gridTotals(dayType.grid, dayType.meals))
    : { ...CERO };

  const marcado = registro ? macrosDePorciones(registro, foods) : { ...CERO };
  const hayMarcado = marcado.proteina + marcado.hc + marcado.grasa > 0;

  const delPlan =
    hayMarcado || !opciones.asumirPlanCumplido ? (hayMarcado ? marcado : { ...CERO }) : pautado;

  const { macros: deExtras, kcal: kcalExtras } = totalExtras(registro?.extras ?? []);

  const total = suma(delPlan, deExtras);
  const kcalPautado = kcalFromMacros(pautado);

  return {
    pautado,
    kcalPautado,
    delPlan,
    deExtras,
    total,
    kcalTotal: kcalFromMacros(total),
    diferencia: {
      proteina: total.proteina - pautado.proteina,
      hc: total.hc - pautado.hc,
      grasa: total.grasa - pautado.grasa,
    },
    kcalDiferencia: kcalFromMacros(total) - kcalPautado,
    pesoExtras: kcalPautado > 0 ? (kcalExtras / kcalPautado) * 100 : 0,
  };
}

/** Porciones marcadas de un bucket en una comida. */
export function porcionesDeBucket(
  registro: RegistroDia | undefined,
  mealId: string,
  bucket: MacroBucket,
  foods: Alimento[],
): number {
  const porComida = registro?.porciones?.[mealId] ?? {};
  return Object.entries(porComida).reduce((s, [foodId, n]) => {
    const food = foods.find((f) => f.id === foodId);
    if (!food?.grupo) return s;
    const g = EXCHANGE_GROUPS[food.grupo];
    return g && !g.ilimitado && g.bucket === bucket ? s + (n || 0) : s;
  }, 0);
}

/** Gramos acumulados de un alimento concreto: 3 porciones de pollo → 90 g. */
export function gramosMarcados(food: Alimento, porciones: number): number {
  const gpi = gramosPorIntercambio(food);
  return gpi ? Math.round(gpi * porciones) : 0;
}

export interface AdherenciaDia {
  fecha: string;
  dayTypeId?: string;
  /** Comidas cumplidas sobre el total del día. */
  comidasCumplidas: number;
  comidasTotales: number;
  extras: number;
  kcalExtras: number;
  /** 0–100. */
  porcentaje: number;
}

/** Resumen para el calendario y para la pestaña de seguimiento. */
export function adherenciaDelDia(
  registro: RegistroDia | undefined,
  dayType: DayType | undefined,
): AdherenciaDia {
  const comidasTotales = dayType?.meals.length ?? 0;
  const comidasCumplidas = registro?.cumplidas?.length ?? 0;
  const { kcal } = totalExtras(registro?.extras ?? []);
  return {
    fecha: registro?.fecha ?? '',
    dayTypeId: registro?.dayTypeId ?? dayType?.id,
    comidasCumplidas,
    comidasTotales,
    extras: registro?.extras?.length ?? 0,
    kcalExtras: kcal,
    porcentaje: comidasTotales ? Math.round((comidasCumplidas / comidasTotales) * 100) : 0,
  };
}

/** Calorías pautadas de un tipo de día, para pintarlas en el calendario. */
export function kcalDelDia(dayType: DayType | undefined): number {
  if (!dayType) return 0;
  return kcalFromMacros(exchangesToMacros(gridTotals(dayType.grid, dayType.meals)));
}

/** Porciones pautadas de un bucket en una comida. */
export function pautadoBucket(dayType: DayType, mealId: string, bucket: MacroBucket): number {
  return bucketExchanges(dayType.grid[mealId] ?? {})[bucket] ?? 0;
}
