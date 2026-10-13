import type { Plan, DayType } from '../types/plan';
import type { RegistroDia } from '../types/diary';
import type { Alimento } from '../types/food';
import type { Medicion } from '../types/anthropometry';
import type { Sexo } from '../types/calculations';
import { adherenciaDelDia } from './diary';
import { objetivoDelDia, totalContado } from './conteo';
import { calcComposicion } from './anthropometry';
import { gridMacros } from './exchanges';
import { kcalFromMacros } from './macros';

/**
 * SEGUIMIENTO PARA LA NUTRICIONISTA
 *
 * Tres preguntas que se responden de un vistazo:
 *   ¿está cumpliendo? · ¿está cambiando el cuerpo? · ¿qué come de verdad?
 *
 * Todo se calcula desde lo que ya hay guardado (registros y mediciones): no
 * se pide a nadie que rellene nada aparte.
 */

/** Devuelve la fecha en YYYY-MM-DD, n días antes de la referencia. */
export function fechaMenos(dias: number, desde = new Date()): string {
  const d = new Date(desde);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export interface DiaAdherencia {
  fecha: string;
  /** 0–100. undefined si ese día no hay registro. */
  porcentaje?: number;
  /**
   * Sólo en fase 4: si ese día se quedó dentro del margen del objetivo. Ahí
   * «completo» no es haber marcado todas las comidas, que no hay ninguna que
   * marcar, sino haber cuadrado las calorías.
   */
  dentroDelMargen?: boolean;
  extras: number;
  kcalExtras: number;
}

export interface ResumenAdherencia {
  dias: DiaAdherencia[];
  /** Media de los días con registro. */
  media?: number;
  /** Días con registro sobre los del periodo. */
  registrados: number;
  totalDias: number;
  /** Días en los que se cumplió todo. */
  completos: number;
  kcalExtrasDia?: number;
}

/**
 * Adherencia día a día del último mes. Los días sin registro se dejan en
 * blanco a propósito: no es lo mismo no cumplir que no apuntar.
 */
export function resumenAdherencia(
  plan: Plan,
  registros: RegistroDia[],
  dias = 30,
  hoy = new Date(),
): ResumenAdherencia {
  const porFecha = new Map(registros.map((r) => [r.fecha, r]));
  const lista: DiaAdherencia[] = [];

  for (let i = dias - 1; i >= 0; i--) {
    const fecha = fechaMenos(i, hoy);
    const r = porFecha.get(fecha);
    if (!r) {
      lista.push({ fecha, extras: 0, kcalExtras: 0 });
      continue;
    }
    const dayType = plan.dayTypes.find((d) => d.id === r.dayTypeId) ?? plan.dayTypes[0];

    /*
     * EN FASE 4 NO HAY COMIDAS QUE MARCAR
     *
     * La adherencia se calculaba contando comidas cumplidas, y quien cuenta
     * gramos no marca ninguna: la pestaña decía «0 días apuntados» y un 0 %
     * por mucho que llevara el mes entero apuntando lo que come. Aquí el día
     * se juzga por lo que lleva contado frente a lo que tiene pautado.
     */
    if (plan.fase === 4) {
      const objetivo = objetivoDelDia(dayType);
      const llevado = totalContado(r.bocados ?? []);
      if (!(r.bocados ?? []).length) {
        lista.push({ fecha, extras: 0, kcalExtras: 0 });
        continue;
      }
      const desvio = objetivo.kcal ? Math.abs(llevado.kcal - objetivo.kcal) / objetivo.kcal : 0;
      lista.push({
        fecha,
        porcentaje: Math.max(0, Math.round((1 - desvio) * 100)),
        // Hasta un 10 % arriba o abajo el día cuadra: es el margen de siempre.
        dentroDelMargen: desvio <= 0.1,
        extras: 0,
        kcalExtras: 0,
      });
      continue;
    }

    const a = adherenciaDelDia(r, dayType);
    lista.push({
      fecha,
      porcentaje: a.porcentaje,
      extras: a.extras,
      kcalExtras: a.kcalExtras,
    });
  }

  const conDatos = lista.filter((d) => d.porcentaje !== undefined);
  return {
    dias: lista,
    media: conDatos.length
      ? conDatos.reduce((s, d) => s + (d.porcentaje ?? 0), 0) / conDatos.length
      : undefined,
    registrados: conDatos.length,
    totalDias: dias,
    completos: conDatos.filter((d) =>
      d.dentroDelMargen !== undefined ? d.dentroDelMargen : (d.porcentaje ?? 0) >= 100,
    ).length,
    kcalExtrasDia: conDatos.length
      ? conDatos.reduce((s, d) => s + d.kcalExtras, 0) / conDatos.length
      : undefined,
  };
}

export interface PuntoEvolucion {
  fecha: string;
  peso?: number;
  grasaPct?: number;
  masaMuscularKg?: number;
}

/** Serie de peso, % graso y masa muscular a partir de las mediciones. */
export function evolucionCorporal(
  mediciones: Medicion[],
  sexo: Sexo,
  edad: number,
  formula: 'faulkner' | 'yuhasz' | 'durnin_womersley' = 'faulkner',
): PuntoEvolucion[] {
  return [...mediciones]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => {
      const c = calcComposicion(m, sexo, edad);
      return {
        fecha: m.fecha,
        peso: m.peso,
        grasaPct: c.grasaPct[formula],
        masaMuscularKg: c.masaMuscularKg,
      };
    });
}

export interface UsoAlimento {
  foodId: string;
  nombre: string;
  /** Porciones sumadas en todo el periodo. Cero en fase 4, que va en gramos. */
  porciones: number;
  /** Veces que lo ha apuntado. Es lo que se cuenta cuando no hay porciones. */
  veces: number;
  /** Gramos sumados, en fase 4. */
  gramos: number;
  /** Días distintos en los que aparece. */
  dias: number;
}

export interface UsoDeAlimentos {
  elegidos: UsoAlimento[];
  /** Alimentos de la despensa pautada que no ha tocado nunca. */
  sinTocar: { foodId: string; nombre: string }[];
}

/**
 * Qué repite el cliente y qué no toca nunca. Sirve para limpiar la despensa:
 * un alimento que lleva un mes sin marcarse probablemente no le gusta.
 */
export function usoDeAlimentos(
  registros: RegistroDia[],
  dayTypes: DayType[],
  foods: Alimento[],
): UsoDeAlimentos {
  const nombre = new Map(foods.map((f) => [f.id, f.nombre]));
  const porciones = new Map<string, number>();
  const veces = new Map<string, number>();
  const gramos = new Map<string, number>();
  const comoSeLlama = new Map<string, string>();
  const dias = new Map<string, Set<string>>();
  const apunta = (foodId: string, fecha: string) => {
    if (!dias.has(foodId)) dias.set(foodId, new Set());
    dias.get(foodId)!.add(fecha);
  };

  for (const r of registros) {
    for (const comida of Object.values(r.porciones ?? {})) {
      for (const [foodId, n] of Object.entries(comida ?? {})) {
        if (!n) continue;
        porciones.set(foodId, (porciones.get(foodId) ?? 0) + n);
        veces.set(foodId, (veces.get(foodId) ?? 0) + 1);
        apunta(foodId, r.fecha);
      }
    }

    /*
     * EN FASE 4 LO QUE HAY SON BOCADOS, NO PORCIONES
     *
     * Esto sólo leía `porciones`, así que con una clienta contando gramos la
     * tarjeta decía «todavía no ha marcado nada» por mucho que llevara el mes
     * entero apuntando. Se cuenta cuántas veces lo apunta y cuántos gramos
     * lleva; el nombre sale del bocado porque un alimento calculado de una
     * etiqueta no está en el catálogo de ella.
     */
    for (const b of r.bocados ?? []) {
      const foodId = b.foodId ?? `txt_${b.nombre.toLowerCase()}`;
      veces.set(foodId, (veces.get(foodId) ?? 0) + 1);
      gramos.set(foodId, (gramos.get(foodId) ?? 0) + (b.cantidad ?? 0));
      if (!comoSeLlama.has(foodId)) comoSeLlama.set(foodId, b.nombre);
      apunta(foodId, r.fecha);
    }
  }

  const elegidos: UsoAlimento[] = [...dias.keys()]
    .map((foodId) => ({
      foodId,
      nombre: nombre.get(foodId) ?? comoSeLlama.get(foodId) ?? foodId,
      porciones: porciones.get(foodId) ?? 0,
      veces: veces.get(foodId) ?? 0,
      gramos: gramos.get(foodId) ?? 0,
      dias: dias.get(foodId)?.size ?? 0,
    }))
    // Por porciones donde las hay y por veces donde se cuentan gramos.
    .sort(
      (a, b) =>
        b.porciones - a.porciones || b.veces - a.veces || a.nombre.localeCompare(b.nombre),
    );

  // Lo que se le ofrece: la selección de cada comida de cada tipo de día.
  const ofrecidos = new Set<string>();
  for (const d of dayTypes) {
    for (const desp of Object.values(d.despensa ?? {})) {
      for (const id of desp?.seleccion ?? []) ofrecidos.add(id);
    }
  }

  const sinTocar = [...ofrecidos]
    .filter((id) => !porciones.has(id))
    .map((foodId) => ({ foodId, nombre: nombre.get(foodId) ?? foodId }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return { elegidos, sinTocar };
}

/** Kcal y macros que suma la grilla de un tipo de día. Para la tarjeta del plan. */
export function resumenDelPlan(plan: Plan) {
  const principal = plan.dayTypes[0];
  if (!principal) return undefined;
  const macros = gridMacros(principal.grid, principal.meals);
  const kcal = kcalFromMacros(macros);
  const total = macros.hc * 4 + macros.proteina * 4 + macros.grasa * 9 || 1;
  return {
    macros,
    kcal,
    pct: {
      hc: (macros.hc * 4 * 100) / total,
      proteina: (macros.proteina * 4 * 100) / total,
      grasa: (macros.grasa * 9 * 100) / total,
    },
    dias: plan.dayTypes.length,
  };
}
