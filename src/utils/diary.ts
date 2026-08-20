import type { Alimento } from '../types/food';
import type { DayType } from '../types/plan';
import { comidasConPauta } from '../types/plan';
import type { Extra, RegistroDia } from '../types/diary';
import type { MacroGrams } from '../types/calculations';
import {
  EXCHANGE_GROUPS,
  bucketsDeGrupo,
  type MacroBucket,
  type ExchangeGroupId,
} from '../data/exchangeGroups';
import { exchangesToMacros, gridTotals, bucketExchanges, aporteDeAlimento } from './exchanges';
import { kcalFromMacros } from './macros';
import { gramosPorIntercambio } from './recipeComposition';
import { hcNeto } from './portions';

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
      // El carbohidrato neto, igual que en el cálculo de porciones: si no, un
      // extra alto en fibra sumaría calorías que no se absorben.
      hc: hcNeto(food.nutrientes) * f,
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

/**
 * MARGEN ACEPTABLE DE EXTRAS
 *
 * Un extra no rompe el día, lo desplaza. Hasta un 10 % sobre lo pautado el
 * día sigue en línea; hasta un 25 % es un desvío que sólo importa si se
 * repite. Por encima, se dice y se pasa página.
 *
 * Los dos sitios donde se habla de extras (cada comida y el resumen del día)
 * usan estos mismos números: si no, la app se contradice sola.
 */
export const MARGEN_EXTRAS_VERDE = 10;
export const MARGEN_EXTRAS_AMBAR = 25;

export type TonoExtras = 'ok' | 'aviso' | 'alto';

export function veredictoExtras(pesoExtras: number): { tono: TonoExtras; texto: string } {
  if (pesoExtras < MARGEN_EXTRAS_VERDE) {
    return { tono: 'ok', texto: 'Un desvío pequeño: el día sigue en línea.' };
  }
  if (pesoExtras < MARGEN_EXTRAS_AMBAR) {
    return {
      tono: 'aviso',
      texto: 'Desvío moderado. Si se repite varios días, coméntalo en consulta.',
    };
  }
  return { tono: 'alto', texto: 'Desvío grande sobre lo pautado de hoy. Mañana se retoma sin más.' };
}

/** Los extras que se tomaron en una comida concreta. */
export function extrasDeComida(extras: Extra[], mealId: string): Extra[] {
  return extras.filter((e) => e.momento === mealId);
}

/**
 * ¿HAY ALGO APUNTADO YA EN ESTE DÍA?
 *
 * Hace falta al cambiar de tipo de día. Lo marcado no se borra al cambiar, así
 * que quien marca su desayuno en «día descanso» y luego se pasa a «día base»
 * se encuentra el desayuno ya hecho, y si vuelve a marcar porciones se le
 * suman a las de antes: acaba con el doble de lo que ha comido.
 */
export function hayAlgoMarcado(registro: RegistroDia | undefined): boolean {
  if (!registro) return false;
  if ((registro.cumplidas ?? []).length > 0) return true;
  if ((registro.extras ?? []).length > 0) return true;
  return Object.values(registro.porciones ?? {}).some((porComida) =>
    Object.values(porComida ?? {}).some((n) => (n ?? 0) > 0),
  );
}

/** Deja el día en blanco conservando la fecha y el cliente. */
export function vaciarLoMarcado(): Pick<
  RegistroDia,
  'cumplidas' | 'porciones' | 'recetaElegida' | 'sustituciones' | 'extras'
> {
  return { cumplidas: [], porciones: {}, recetaElegida: {}, sustituciones: {}, extras: [] };
}

/** Los que no se apuntaron en ninguna comida: picoteo suelto del día. */
export function extrasSinComida(extras: Extra[], mealIds: string[]): Extra[] {
  return extras.filter((e) => !e.momento || !mealIds.includes(e.momento));
}

/** Macros que aportan las porciones que el cliente ha marcado (Fase 3). */
export function macrosDePorciones(registro: RegistroDia, foods: Alimento[]): MacroGrams {
  let acc: MacroGrams = { ...CERO };
  for (const porComida of Object.values(registro.porciones ?? {})) {
    for (const [foodId, n] of Object.entries(porComida)) {
      if (!n) continue;
      const food = foods.find((f) => f.id === foodId);
      if (!food) continue;
      // `aporteDeAlimento` reparte los compuestos entre sus grupos.
      acc = suma(acc, exchangesToMacros(aporteDeAlimento(food, n)));
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

  /**
   * LO QUE CAMBIÓ POR UN POSTRE NO SE COME
   *
   * Si se ha dejado la merienda para comerse el bizcocho, el día no puede
   * seguir contando la merienda: el postre entra como extra y el total diría
   * que se ha pasado cuando lo que ha hecho es cambiar una cosa por otra.
   *
   * Lo pautado no se toca —es lo que su cuerpo necesitaba— y lo que baja es lo
   * que se ha comido del plan. Así, si el postre pesa parecido, el día cuadra;
   * si pesa más, se pasa; y si pesa menos, se queda corta. Que es la verdad.
   */
  const cambiadas = Object.keys(registro?.cambiadasPorPostre ?? {});
  const delPlanEntero =
    dayType && cambiadas.length
      ? exchangesToMacros(
          gridTotals(
            dayType.grid,
            dayType.meals.filter((m) => !cambiadas.includes(m.id)),
          ),
        )
      : pautado;

  const marcado = registro ? macrosDePorciones(registro, foods) : { ...CERO };
  const hayMarcado = marcado.proteina + marcado.hc + marcado.grasa > 0;

  const delPlan =
    hayMarcado || !opciones.asumirPlanCumplido
      ? hayMarcado
        ? marcado
        : { ...CERO }
      : delPlanEntero;

  const extras = registro?.extras ?? [];
  const { macros: deExtras, kcal: kcalExtras } = totalExtras(extras);

  /**
   * Un extra apuntado a ojo («una cerveza, 150 kcal») no tiene macros, así que
   * no aparecía en el total del día por mucho que el panel de extras sí lo
   * contara: el cliente apuntaba algo y el contador de arriba no se movía.
   * Esas calorías sin macros se suman aparte.
   */
  const kcalSinMacros = extras.reduce(
    (s, e) => s + Math.max(0, e.kcal - kcalFromMacros(e.macros)),
    0,
  );

  const total = suma(delPlan, deExtras);
  const kcalPautado = kcalFromMacros(pautado);
  const kcalTotal = kcalFromMacros(total) + kcalSinMacros;

  return {
    pautado,
    kcalPautado,
    delPlan,
    deExtras,
    total,
    kcalTotal,
    diferencia: {
      proteina: total.proteina - pautado.proteina,
      hc: total.hc - pautado.hc,
      grasa: total.grasa - pautado.grasa,
    },
    kcalDiferencia: kcalTotal - kcalPautado,
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
    if (!food || !n) return s;
    let suma_ = 0;
    for (const [gid, cuantos] of Object.entries(aporteDeAlimento(food, n)) as [
      ExchangeGroupId,
      number,
    ][]) {
      const g = EXCHANGE_GROUPS[gid];
      if (g && !g.ilimitado && bucketsDeGrupo(gid).includes(bucket)) suma_ += cuantos ?? 0;
    }
    return s + suma_;
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
  /**
   * Sólo cuentan las comidas que ese día llevan algo pautado: si no hay
   * merienda, el anillo no puede quedarse corto por una merienda que no
   * existe.
   */
  const comidas = dayType ? comidasConPauta(dayType) : [];
  const comidasTotales = comidas.length;
  const ids = new Set(comidas.map((m) => m.id));
  const cumplidas = registro?.cumplidas ?? [];
  const comidasCumplidas = comidasTotales
    ? cumplidas.filter((id) => ids.has(id)).length
    : cumplidas.length;
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
