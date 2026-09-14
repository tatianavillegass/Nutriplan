import type { Alimento } from '../types/food';
import type { DayType, Meal } from '../types/plan';
import type { ItemOpcion, OpcionEscalada } from './mealOptions';
import { opcionDeItems } from './combos';
import { alimentosDeComida } from './pantry';
import { gramosPorIntercambio } from './recipeComposition';
import { escalarMedida } from './measures';
import { roundPortion } from './macros';

/**
 * CAMBIAR UN ALIMENTO DENTRO DE UNA OPCIÓN
 *
 * En fase 2 la clienta elige entre combinaciones ya calculadas. En cuanto la
 * nutricionista compone una a mano —avena con arándanos— la app deja de
 * proponer y esa es la única que sale: si ese día no le apetecen arándanos, no
 * hay nada que hacer. Y pedirle a ella que escriba avena+arándanos,
 * avena+plátano y avena+manzana es repetir el mismo trabajo tres veces por cada
 * comida y cada clienta.
 *
 * Así que la combinación deja de ser un bloque cerrado: se pulsa el alimento
 * que se quiere cambiar y salen las alternativas, con los gramos ya hechos. La
 * avena se queda donde está. Es el mismo gesto que en fase 1, donde se cambia
 * un ingrediente de la receta pulsándolo.
 *
 * SE CAMBIA POR SU MISMO SUBGRUPO
 * ===============================
 * Fruta por fruta, almidón por almidón. Dentro de un subgrupo la porción es la
 * misma —los mismos 15 g de hidrato— así que el cambio es exacto y no hay que
 * comprobar ningún techo ni avisar de nada: 125 g de arándanos y 65 g de
 * plátano son la misma porción.
 *
 * Cubrir la fruta con almidón **también se puede**, pero eso ya existe y es
 * otra cosa: es una de las opciones de la columna, con su nota de cuántos
 * gramos se queda. Meterlo aquí mezclaría una sustitución exacta con una que
 * cambia lo que se pautó, y en el mismo gesto.
 *
 * Y SALEN DE SU DESPENSA, NO DEL CATÁLOGO
 * =======================================
 * Lo que puede elegir lo decide la nutricionista comida a comida, como en todo
 * lo demás: ahí es donde ya están filtrados sus alérgenos, sus patologías y lo
 * que no le gusta. Ofrecerle el catálogo entero sería saltarse eso justo en el
 * momento de comer.
 */

/** Las otras opciones para ese alimento, ya escaladas a sus mismas porciones. */
export function alternativasDe(
  item: ItemOpcion,
  dayType: DayType,
  meal: Meal,
  foods: Alimento[],
): ItemOpcion[] {
  return alimentosDeComida(dayType, meal, foods)
    .filter((f) => f.grupo === item.grupo && f.id !== item.foodId && !!gramosPorIntercambio(f))
    .map((f) => escalarA(f, item.intercambios))
    .filter((x): x is ItemOpcion => !!x)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** El alimento con los gramos de esas porciones. */
function escalarA(f: Alimento, intercambios: number): ItemOpcion | undefined {
  const gpi = gramosPorIntercambio(f);
  if (!gpi || !f.grupo || intercambios <= 0) return undefined;
  return {
    foodId: f.id,
    nombre: f.nombre,
    grupo: f.grupo,
    intercambios,
    gramos: roundPortion(gpi * intercambios),
    unidad: f.unidad ?? 'g',
    medida: escalarMedida(f.medida_casera, intercambios),
    gramosCocido: f.equivalencia_cocido
      ? roundPortion(f.equivalencia_cocido * intercambios)
      : undefined,
  };
}

/**
 * La opción con ese alimento cambiado por otro.
 *
 * Se rehace con `opcionDeItems`, la misma que usa el generador: así el id sale
 * **ordenado igual** y la opción resultante es indistinguible de la que habría
 * salido sola. Si se armara a mano, «avena + plátano» tendría un id y la misma
 * combinación propuesta por la app otro, y la pantalla no la daría por elegida.
 *
 * Son las mismas porciones del mismo subgrupo, así que lo que cubre no cambia —
 * que es justo lo que hace exacto este cambio.
 */
export function conAlimentoCambiado(
  opcion: OpcionEscalada,
  foodId: string,
  nuevo: ItemOpcion,
): OpcionEscalada {
  return opcionDeItems(
    opcion.items.map((i) => (i.foodId === foodId ? nuevo : i)),
    opcion.bucket,
    opcion.unificada,
  );
}
