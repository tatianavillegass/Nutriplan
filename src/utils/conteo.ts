import type { DayType } from '../types/plan';
import type { Bocado, RegistroDia } from '../types/diary';
import type { MacroGrams } from '../types/calculations';
import type { Alimento } from '../types/food';
import { gridMacros } from './exchanges';
import { kcalFromMacros } from './macros';
import { hcNeto } from './portions';

/**
 * FASE 4 — CONTAR MACROS
 *
 * La última fase: la misma pauta de siempre, dicha en gramos. Es para quien ya
 * domina el sistema y va a seguir sola, así que aquí no hay porciones, ni
 * comidas que marcar, ni recetas que seguir. Hay un objetivo de día y una
 * lista de lo que se ha comido.
 *
 * Lo que NO hace, y es a propósito:
 *
 *  · No cuenta atrás. Lo que se enseña es lo que llevas, no lo que «te queda»:
 *    un número que baja hasta cero y se pone en rojo convierte cenar en un
 *    descubierto bancario.
 *  · No lleva racha de días apuntados. Premiar el registro por el registro es
 *    lo que engancha a la gente al contador y no a comer mejor.
 *  · No proyecta el peso. El «si cada día fuera como hoy pesarías X» es una
 *    cuenta falsa —un día no es una tendencia— y encima invita a compensar.
 */

export interface ObjetivoDia extends MacroGrams {
  kcal: number;
}

const CERO: MacroGrams = { proteina: 0, hc: 0, grasa: 0 };

/**
 * El objetivo del día sale de la misma pauta de intercambios, traducida a
 * gramos. No es un número nuevo que haya que escribir en otro sitio: es su
 * plan de siempre visto de otra manera, así que pasar de fase 3 a fase 4 no
 * cambia lo que tiene que comer, sólo cómo se lo cuenta.
 */
export function objetivoDelDia(dayType: DayType | undefined): ObjetivoDia {
  if (!dayType) return { ...CERO, kcal: 0 };
  const macros = gridMacros(dayType.grid, dayType.meals);
  return { ...macros, kcal: kcalFromMacros(macros) };
}

/** Lo que aportan unos gramos de un alimento del catálogo. */
export function macrosDeCantidad(
  cantidad: number,
  food: Alimento | undefined,
): { macros: MacroGrams; kcal: number } {
  if (!food?.nutrientes || !(cantidad > 0)) return { macros: { ...CERO }, kcal: 0 };
  const f = cantidad / 100;
  const macros: MacroGrams = {
    proteina: (food.nutrientes.proteina || 0) * f,
    // El carbohidrato neto, igual que en el resto de la app: la fibra alta no
    // se absorbe y contarla entera infla el día sin que se haya comido más.
    hc: hcNeto(food.nutrientes) * f,
    grasa: (food.nutrientes.grasa || 0) * f,
  };
  return { macros, kcal: kcalFromMacros(macros) };
}

/** Lo que lleva del día, sumando lo apuntado. */
export function totalContado(bocados: Bocado[] | undefined): ObjetivoDia {
  const macros = (bocados ?? []).reduce<MacroGrams>(
    (acc, b) => ({
      proteina: acc.proteina + (b.macros?.proteina || 0),
      hc: acc.hc + (b.macros?.hc || 0),
      grasa: acc.grasa + (b.macros?.grasa || 0),
    }),
    { ...CERO },
  );
  return { ...macros, kcal: kcalFromMacros(macros) };
}

/**
 * DE QUÉ COLOR VA CADA MACRO
 *
 * El mismo lenguaje que en los anillos: ámbar te queda, verde está, rojo te
 * has pasado. El margen aquí es del 10 % del objetivo —en gramos no existe la
 * media porción— y es el mismo 10 % con el que ya se juzga un día en el resto
 * de la app. Sobre 1.900 kcal son 190: nadie cuadra un día al gramo, y exigir
 * que lo haga es lo que convierte contar en pelearse.
 */
export type EstadoConteo = 'falta' | 'enPunto' | 'pasado';

export const MARGEN = 0.1;

export function estadoDeConteo(llevas: number, objetivo: number): EstadoConteo {
  if (objetivo <= 0) return 'enPunto';
  if (llevas < objetivo * (1 - MARGEN)) return 'falta';
  if (llevas > objetivo * (1 + MARGEN)) return 'pasado';
  return 'enPunto';
}

/**
 * Cómo va el día, en una frase. Sin nota, sin porcentaje de adherencia y sin
 * «te quedan X»: sólo lo que ha pasado, dicho como se lo diría una persona.
 */
export function comoVaElDia(
  total: ObjetivoDia,
  objetivo: ObjetivoDia,
  hayAlgo: boolean,
): string {
  if (!hayAlgo) return 'Todavía no has apuntado nada de hoy.';
  if (objetivo.kcal <= 0) return 'Apunta lo que comas y aquí se va sumando.';

  switch (estadoDeConteo(total.kcal, objetivo.kcal)) {
    case 'falta':
      return 'Vas por debajo de tus calorías. Si el día ya está terminado, mañana no hay que compensar nada.';
    case 'pasado':
      return 'Hoy has ido por encima. Un día no es una tendencia: mañana sigues con lo tuyo.';
    default:
      return 'El día te ha cuadrado.';
  }
}

/**
 * En fase 4 el día se cierra apuntando. No hay comidas que marcar, así que
 * exigir el botón de siempre le rompería la racha a quien lo está haciendo
 * bien. Se pide algo apuntado, no un día perfecto: la racha premia aparecer.
 */
export function diaContado(registro: RegistroDia | undefined): boolean {
  return (registro?.bocados?.length ?? 0) > 0;
}
