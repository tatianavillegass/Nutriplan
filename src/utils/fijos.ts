import type { Alimento } from '../types/food';
import type { DayType, Fijo } from '../types/plan';
import { aporteDeAlimento, type ExchangeCounts } from './exchanges';
import { gramosPorIntercambio } from './recipeComposition';
import type { ExchangeGroupId } from '../data/exchangeGroups';

/**
 * LO QUE VA SIEMPRE, Y EL POSTRE
 * ==============================
 * Casi todo el mundo le añade algo al desayuno —un café con leche, un matcha
 * con bebida de coco— y muchos se toman un cuadrito de chocolate después de
 * cenar. Hasta ahora eso había que meterlo **opción por opción**: si el
 * desayuno tenía cinco platos entre los que elegir, el café había que ponerlo
 * cinco veces, y si luego se cambiaba la leche, otras cinco.
 *
 * Un fijo se pone **una vez en la comida** y va con todas sus opciones.
 *
 * GASTA, NO SE SUMA
 * =================
 * El café con leche se lleva ½ lácteo del desayuno, así que a las opciones les
 * queda ½ y se escalan con eso. Si se sumara por encima, el día acabaría
 * teniendo más de lo pautado y las kcal del plan dejarían de ser las del plan.
 * Es la misma regla del aceite de cocción (`repartoElegible`), que ya reservaba
 * su grasa antes de repartir.
 *
 * EL POSTRE ES UN FIJO CON DÍAS
 * =============================
 * «Chocolate los martes y los viernes» es lo mismo que el café, pero sin ir
 * todos los días. Un solo concepto y una sola cuenta: sin `dias`, va siempre.
 *
 * LO QUE NO SE PAUTÓ SE DICE, NO SE INVENTA
 * =========================================
 * Si le pone café con leche a un desayuno que no lleva lácteo, la app **no**
 * se lo quita a otra comida por su cuenta: eso sería mover su pauta sin que lo
 * vea. Lo deja en `sinPautar` y la pantalla lo avisa, que es quien decide.
 */

/** Los fijos de una comida; con `dia`, sólo los que van ese día. */
export function fijosDeComida(
  dayType: Pick<DayType, 'fijos'>,
  mealId: string,
  dia?: number,
): Fijo[] {
  const suyos = dayType.fijos?.[mealId] ?? [];
  if (dia == null) return suyos;
  return suyos.filter((f) => !f.dias?.length || f.dias.includes(dia));
}

/** Lo que gasta un fijo, en intercambios. Sin alimento detrás no gasta nada. */
export function aporteDeFijo(fijo: Fijo, foods: Alimento[]): ExchangeCounts {
  if (!fijo.foodId) return {};
  const food = foods.find((f) => f.id === fijo.foodId);
  if (!food) return {};
  const gpi = gramosPorIntercambio(food);
  if (!gpi) return {};
  return aporteDeAlimento(food, (fijo.gramos || 0) / gpi);
}

/** Lo que gastan varios, sumado. */
export function aporteDeFijos(fijos: Fijo[], foods: Alimento[]): ExchangeCounts {
  const out: ExchangeCounts = {};
  for (const f of fijos) {
    for (const [g, n] of Object.entries(aporteDeFijo(f, foods)) as [
      ExchangeGroupId,
      number,
    ][]) {
      if (n) out[g] = (out[g] ?? 0) + n;
    }
  }
  return out;
}

export interface PautaDeComida {
  /** Lo que les queda a las opciones, ya descontados los fijos. */
  pauta: ExchangeCounts;
  /** Lo que se llevan los fijos. */
  gastado: ExchangeCounts;
  /**
   * Lo que gastan y NO estaba pautado en esa comida: grupo → cuánto sobra.
   * No se le quita a nadie; se avisa.
   */
  sinPautar: ExchangeCounts;
  fijos: Fijo[];
}

/**
 * La pauta de una comida con los fijos ya descontados: es lo que tienen que
 * cubrir las recetas y las opciones.
 */
export function pautaDeComida(
  dayType: Pick<DayType, 'fijos' | 'grid'>,
  mealId: string,
  foods: Alimento[],
  dia?: number,
): PautaDeComida {
  const fijos = fijosDeComida(dayType, mealId, dia);
  const pauta: ExchangeCounts = { ...(dayType.grid[mealId] ?? {}) };
  const gastado = aporteDeFijos(fijos, foods);
  const sinPautar: ExchangeCounts = {};

  for (const [g, n] of Object.entries(gastado) as [ExchangeGroupId, number][]) {
    const hay = pauta[g] ?? 0;
    const resto = hay - n;
    if (resto > 0.001) pauta[g] = resto;
    else {
      delete pauta[g];
      /*
       * Lo que no cabía. Con 1 lácteo pautado y un café que gasta 1,5, sobra
       * 0,5: eso es lo que se avisa, no el intercambio entero.
       */
      if (resto < -0.001) sinPautar[g] = -resto;
    }
  }

  return { pauta, gastado, sinPautar, fijos };
}

/** Si hay algo que avisar en esta comida. */
export function hayDescuadre(p: PautaDeComida): boolean {
  return Object.keys(p.sinPautar).length > 0;
}
