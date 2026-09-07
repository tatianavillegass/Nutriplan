import type { MenuSemana } from '../types/diary';
import type { MacroBucket } from '../data/exchangeGroups';
import type { OpcionEscalada } from './mealOptions';

/**
 * CUÁNTAS VECES, NO QUÉ DÍA
 *
 * En fase 2 la clienta no come platos: come combinaciones de alimentos que
 * elige cada día entre las que le salen calculadas. Pedirle que diga «el
 * martes desayuno huevos» le quita justo la libertad que esa fase existe para
 * darle — y sin saber qué va a comer el jueves no hay lista de la compra ni
 * manera de organizarse.
 *
 * Decir «huevos tres veces esta semana» resuelve las dos cosas a la vez: la
 * compra sale de una multiplicación y ella sigue eligiendo cada mañana. Son
 * tres o cuatro números por comida en vez de siete casillas por cada opción, y
 * además es como se piensa al hacer la compra: «compro huevos para tres
 * desayunos», no «el martes huevos».
 *
 * NO ES UN MENÚ
 * =============
 * La app no le va a decir «hoy te tocan huevos». Esto es una lista de la
 * compra: si el martes le apetece otra cosa, cambia y no pasa nada. Lo mismo
 * que el menú de fase 1, que también es una propuesta.
 */

/** Los días que hay que cubrir. Una comida al día, siete días. */
export const DIAS_DE_LA_SEMANA = 7;

export function vecesDe(
  menu: MenuSemana | undefined,
  mealId: string,
  opcionId: string,
): number {
  return menu?.veces?.[mealId]?.[opcionId] ?? 0;
}

/** Fija cuántas veces se come una opción. Cero la borra en vez de guardar un 0. */
export function ponerVeces(
  menu: MenuSemana,
  mealId: string,
  opcionId: string,
  veces: number,
): MenuSemana {
  const n = Math.max(0, Math.min(DIAS_DE_LA_SEMANA, Math.round(veces)));
  const deLaComida = { ...(menu.veces?.[mealId] ?? {}) };
  if (n <= 0) delete deLaComida[opcionId];
  else deLaComida[opcionId] = n;
  return { ...menu, veces: { ...(menu.veces ?? {}), [mealId]: deLaComida } };
}

export interface ComoVaElMacro {
  bucket: MacroBucket;
  /** Cuántos días de esa comida tienen ya decidido ese macro. */
  puestas: number;
  /**
   * Días sin decidir. En negativo, se ha pasado de siete.
   *
   * **No es un error.** Dejar dos desayunos sueltos para improvisar es una
   * decisión legítima, así que se dice y ya: ni bloquea, ni riñe.
   */
  faltan: number;
}

/**
 * Cómo va cada macro de una comida. Se mira por macro y no por comida entera
 * porque en fase 2 las columnas son independientes: se elige una proteína, un
 * carbohidrato y una grasa, y cada una tiene que llegar a siete por su cuenta.
 */
export function comoVaLaComida(
  menu: MenuSemana | undefined,
  mealId: string,
  columnas: { bucket: MacroBucket; opciones: OpcionEscalada[] }[],
): ComoVaElMacro[] {
  return columnas.map((c) => {
    const puestas = c.opciones.reduce((s, o) => s + vecesDe(menu, mealId, o.id), 0);
    return { bucket: c.bucket, puestas, faltan: DIAS_DE_LA_SEMANA - puestas };
  });
}

/** Cuántas comidas de la semana tiene decididas, para saber si vale la pena. */
export function comidasDecididas(menu: MenuSemana | undefined): number {
  return Object.values(menu?.veces ?? {}).reduce(
    (s, porOpcion) => s + Object.values(porOpcion).reduce((t, n) => t + (n || 0), 0),
    0,
  );
}
