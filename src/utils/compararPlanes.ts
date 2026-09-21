import type { DayType, Plan } from '../types/plan';
import type { MealSlot } from '../types/food';
import { recetasDelPlan } from '../types/plan';
import type { Receta } from '../types/recipe';
import { EXCHANGE_GROUPS, type ExchangeGroupId } from '../data/exchangeGroups';
import { gridMacros } from './exchanges';
import { kcalFromMacros } from './macros';

/**
 * QUÉ CAMBIA DE UNA REVISIÓN A LA SIGUIENTE
 *
 * Cada revisión mensual es una planificación nueva: se vuelven a tomar las
 * medidas, se recalcula el gasto y salen otras calorías. La nueva **nace
 * clonada de la anterior** (`nuevaPlanificacion`), así que sobre la pantalla
 * las dos son idénticas hasta que se toca algo — y lo que hace falta ver no es
 * el plan, es **la diferencia**: de dónde viene y adónde va.
 *
 * Sin esto hay que abrir la archivada en otra pestaña e ir comparando a ojo,
 * que es justo el trabajo que una revisión mensual repite doce veces al año.
 *
 * Se compara **el primer tipo de día**, que es el que resume el plan: el día de
 * entreno es el mismo plan con más arroz, y meter los dos al lado convertiría
 * una línea en una tabla.
 */

export interface CambioDeNumero {
  antes: number;
  ahora: number;
  /** ahora − antes. Positivo sube, negativo baja. */
  delta: number;
}

export interface CambioDeComida {
  slot: string;
  nombre: string;
  antes: number;
  ahora: number;
  delta: number;
}

export interface CambioDeRecetas {
  /** Las que estaban y siguen. */
  siguen: string[];
  /** Las que estaban y ya no. */
  fuera: string[];
  /** Las que no estaban. */
  nuevas: string[];
}

export interface Comparacion {
  kcal: CambioDeNumero;
  /** Gramos del día, por macro. */
  macros: { hc: CambioDeNumero; proteina: CambioDeNumero; grasa: CambioDeNumero };
  /** Porcentaje de las calorías que aporta cada macro. */
  pct: { hc: CambioDeNumero; proteina: CambioDeNumero; grasa: CambioDeNumero };
  /** Kcal por comida, emparejadas por slot. */
  comidas: CambioDeComida[];
  recetas: CambioDeRecetas;
  /** Si la fase de entrega cambia. */
  fase?: { antes: number; ahora: number };
}

const cambio = (antes: number, ahora: number): CambioDeNumero => ({
  antes,
  ahora,
  delta: ahora - antes,
});

/** Las kcal que suma una comida de su reparto. */
function kcalDeComida(dayType: DayType, mealId: string): number {
  const celda = dayType.grid[mealId] ?? {};
  let hc = 0;
  let proteina = 0;
  let grasa = 0;
  for (const [g, n] of Object.entries(celda) as [ExchangeGroupId, number][]) {
    const info = EXCHANGE_GROUPS[g];
    /* La verdura no gasta intercambios, así que tampoco suma aquí. */
    if (!info || info.ilimitado || !n) continue;
    hc += info.hc * n;
    proteina += info.proteina * n;
    grasa += info.grasa * n;
  }
  return kcalFromMacros({ hc, proteina, grasa });
}

/** El día que resume el plan: el primero. */
const principal = (plan: Plan): DayType | undefined => plan.dayTypes[0];

/**
 * Las comidas, emparejadas **por slot y no por id**: los ids de comida son de
 * cada plan, así que el desayuno de la anterior y el de la nueva no se llaman
 * igual aunque sean el mismo desayuno.
 */
function porComida(antes: DayType | undefined, ahora: DayType | undefined): CambioDeComida[] {
  const deAntes = new Map<string, { nombre: string; kcal: number }>();
  for (const m of antes?.meals ?? []) {
    deAntes.set(m.slot, { nombre: m.nombre, kcal: kcalDeComida(antes!, m.id) });
  }

  const out: CambioDeComida[] = [];
  const vistos = new Set<string>();

  for (const m of ahora?.meals ?? []) {
    vistos.add(m.slot);
    const viejo = deAntes.get(m.slot);
    out.push({
      slot: m.slot,
      nombre: m.nombre,
      antes: viejo?.kcal ?? 0,
      ahora: kcalDeComida(ahora!, m.id),
      delta: kcalDeComida(ahora!, m.id) - (viejo?.kcal ?? 0),
    });
  }

  /* Una comida que tenía y ya no: sale con cero, que es lo que come ahora. */
  for (const [slot, viejo] of deAntes) {
    if (vistos.has(slot)) continue;
    out.push({ slot, nombre: viejo.nombre, antes: viejo.kcal, ahora: 0, delta: -viejo.kcal });
  }

  return out;
}

/** Los ids de receta de un plan, sin repetir y sin importar en qué comida. */
export function recetasDeUnPlan(plan: Plan): Set<string> {
  const out = new Set<string>();
  for (const ids of Object.values(recetasDelPlan(plan))) {
    for (const id of ids) out.add(id);
  }
  return out;
}

/**
 * LAS RECETAS DE UN PLAN, PUESTAS POR SLOT
 *
 * Para poder decir «ésta ya la tenía» al pautar la nueva. Va **por slot y no
 * por id de comida**: los ids son de cada plan, así que el desayuno de la
 * anterior y el de ésta no se llaman igual aunque sean el mismo desayuno.
 */
export function recetasPorSlot(plan: Plan): Partial<Record<MealSlot, string[]>> {
  const asignadas = recetasDelPlan(plan);
  const out: Partial<Record<MealSlot, string[]>> = {};
  for (const dt of plan.dayTypes) {
    for (const m of dt.meals) {
      const ids = asignadas[m.id];
      if (!ids?.length) continue;
      const ya = out[m.slot] ?? [];
      /* Sin repetir: la misma comida existe en varios tipos de día. */
      out[m.slot] = [...ya, ...ids.filter((id) => !ya.includes(id))];
    }
  }
  return out;
}

/**
 * Qué pasó con las recetas. Se devuelven **nombres** y no ids: esto se lee, no
 * se procesa. Una receta que ya no está en el banco sale por su id antes que
 * desaparecer de la cuenta sin decir nada.
 */
function recetasQueCambian(antes: Plan, ahora: Plan, recetas: Receta[]): CambioDeRecetas {
  const nombreDe = new Map(recetas.map((r) => [r.id, r.nombre]));
  const comoSeLlama = (id: string) => nombreDe.get(id) ?? id;

  const viejas = recetasDeUnPlan(antes);
  const nuevas = recetasDeUnPlan(ahora);

  const ordenadas = (ids: string[]) => ids.map(comoSeLlama).sort((a, b) => a.localeCompare(b));

  return {
    siguen: ordenadas([...nuevas].filter((id) => viejas.has(id))),
    fuera: ordenadas([...viejas].filter((id) => !nuevas.has(id))),
    nuevas: ordenadas([...nuevas].filter((id) => !viejas.has(id))),
  };
}

/** Todo lo que cambia de una planificación a la siguiente. */
export function compararPlanes(antes: Plan, ahora: Plan, recetas: Receta[] = []): Comparacion {
  const dAntes = principal(antes);
  const dAhora = principal(ahora);

  const mAntes = dAntes ? gridMacros(dAntes.grid, dAntes.meals) : { hc: 0, proteina: 0, grasa: 0 };
  const mAhora = dAhora ? gridMacros(dAhora.grid, dAhora.meals) : { hc: 0, proteina: 0, grasa: 0 };

  const kcalAntes = kcalFromMacros(mAntes);
  const kcalAhora = kcalFromMacros(mAhora);

  /* El porcentaje sobre cero no existe: sin reparto, los tres salen a cero. */
  const pctDe = (m: { hc: number; proteina: number; grasa: number }, kcal: number) =>
    kcal > 0
      ? {
          hc: (m.hc * 4 * 100) / kcal,
          proteina: (m.proteina * 4 * 100) / kcal,
          grasa: (m.grasa * 9 * 100) / kcal,
        }
      : { hc: 0, proteina: 0, grasa: 0 };

  const pAntes = pctDe(mAntes, kcalAntes);
  const pAhora = pctDe(mAhora, kcalAhora);

  return {
    kcal: cambio(kcalAntes, kcalAhora),
    macros: {
      hc: cambio(mAntes.hc, mAhora.hc),
      proteina: cambio(mAntes.proteina, mAhora.proteina),
      grasa: cambio(mAntes.grasa, mAhora.grasa),
    },
    pct: {
      hc: cambio(pAntes.hc, pAhora.hc),
      proteina: cambio(pAntes.proteina, pAhora.proteina),
      grasa: cambio(pAntes.grasa, pAhora.grasa),
    },
    comidas: porComida(dAntes, dAhora),
    recetas: recetasQueCambian(antes, ahora, recetas),
    fase: antes.fase !== ahora.fase ? { antes: antes.fase, ahora: ahora.fase } : undefined,
  };
}

/**
 * La planificación anterior a ésta, de la misma clienta. La más reciente de las
 * que se pautaron antes — por fecha, no por el orden del array.
 */
export function anteriorA(plan: Plan, plans: Plan[]): Plan | undefined {
  const cuando = (p: Plan) => p.fecha ?? p.createdAt;
  return plans
    .filter((p) => p.clientId === plan.clientId && p.id !== plan.id && cuando(p) <= cuando(plan))
    .sort((a, b) => cuando(b).localeCompare(cuando(a)))[0];
}

/** Si de verdad hay algo que contar: dos planes clonados no cambian nada. */
export function hayCambios(c: Comparacion): boolean {
  return (
    Math.abs(c.kcal.delta) >= 1 ||
    !!c.fase ||
    c.recetas.fuera.length > 0 ||
    c.recetas.nuevas.length > 0 ||
    c.comidas.some((m) => Math.abs(m.delta) >= 1)
  );
}
