import type { Alimento } from '../types/food';
import type { PorcionesMarcadas } from '../types/diary';
import { EXCHANGE_GROUPS, type MacroBucket } from '../data/exchangeGroups';
import type { DayType, Meal } from '../types/plan';
import type { ItemOpcion, OpcionEscalada } from './mealOptions';
import { opcionDeItems } from './combos';
import { alimentosDeComida, tachadoAMano } from './pantry';
import { esAbierto } from './subgruposAbiertos';
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
 * LA DESPENSA MANDA, SALVO EN LA FRUTA Y LA VERDURA
 * =================================================
 * Lo que puede elegir lo decide la nutricionista comida a comida: ahí es donde
 * ya están filtrados sus alérgenos, sus patologías y lo que no le gusta. Con
 * una excepción, que es la misma que ya tenía la fase 3: **una porción de
 * fruta es cualquier fruta**. Si en la despensa del desayuno sólo le cupieron
 * arándanos, esta pantalla decía «no hay nada que cambiar» — y la clienta se
 * quedaba comiendo arándanos todos los días porque la app no le dejaba otra
 * cosa. En esos subgrupos (`SUBGRUPOS_ABIERTOS`) se ofrece el catálogo entero,
 * con las de su despensa primero, que son las que ella le sugirió.
 *
 * Lo que ella haya **quitado a mano** sigue fuera, también del catálogo: una
 * exclusión es una decisión, no un hueco por rellenar. Y en los demás
 * subgrupos no cambia nada: pollo y gambas no son la misma cena, así que ahí
 * la lista corta de la despensa es justo lo que ella decide.
 */

/** Las otras opciones para ese alimento, ya escaladas a sus mismas porciones. */
export function alternativasDe(
  item: ItemOpcion,
  dayType: DayType,
  meal: Meal,
  foods: Alimento[],
): ItemOpcion[] {
  const suyos = alimentosDeComida(dayType, meal, foods).filter((f) => f.grupo === item.grupo);

  /*
   * El resto del subgrupo, detrás de las suyas y sin lo que ella haya tachado.
   * Sólo en fruta y verdura: ver la cabecera.
   */
  const resto = esAbierto(item.grupo)
    ? foods.filter(
        (f) =>
          f.grupo === item.grupo &&
          !suyos.some((s) => s.id === f.id) &&
          !tachadoAMano(dayType, meal.id, f.id),
      )
    : [];

  const deSuDespensa = new Set(suyos.map((f) => f.id));

  return [...suyos, ...resto]
    .filter((f) => f.id !== item.foodId && !!gramosPorIntercambio(f))
    .map((f) => escalarA(f, item.intercambios))
    .filter((x): x is ItemOpcion => !!x)
    /* Las de su despensa primero —son las que ella le sugirió— y dentro de
       cada grupo por orden alfabético, que con cuarenta frutas es lo único
       que se recorre con el dedo. */
    .sort(
      (a, b) =>
        Number(deSuDespensa.has(b.foodId)) - Number(deSuDespensa.has(a.foodId)) ||
        a.nombre.localeCompare(b.nombre),
    );
}

/**
 * LA COMBINACIÓN QUE LA CLIENTA TIENE MARCADA AHORA MISMO
 *
 * Al cambiar la fruta sale una combinación nueva —avena con manzana— que **no
 * está en la lista** que se le enseña: esa lista son las que la nutricionista
 * guardó, o las que propone la app. Así que la clienta cambiaba la fruta y la
 * comida se le quedaba sin nada marcado: «la pulso y desaparece».
 *
 * Esto rehace la opción a partir de lo que hay marcado, para poder añadirla a
 * su columna y enseñarla elegida. Se arma con `opcionDeItems` —la misma del
 * generador— así que si resulta ser una de las que ya estaban, tiene su mismo
 * id y no se duplica.
 */
export function opcionDeLoMarcado(
  porciones: PorcionesMarcadas,
  mealId: string,
  bucket: MacroBucket,
  foods: Alimento[],
): OpcionEscalada | undefined {
  const marcado = porciones[mealId] ?? {};
  const porId = new Map(foods.map((f) => [f.id, f]));

  const items = Object.entries(marcado)
    .filter(([, n]) => n > 0)
    .map(([foodId, n]) => {
      const f = porId.get(foodId);
      const g = f?.grupo;
      /* Sólo lo de esta columna, y nada ilimitado: la verdura y los libres no
         forman parte de ninguna combinación. */
      if (!f || !g || EXCHANGE_GROUPS[g]?.ilimitado || EXCHANGE_GROUPS[g]?.bucket !== bucket) {
        return undefined;
      }
      return escalarA(f, n);
    })
    .filter((x): x is ItemOpcion => !!x)
    .sort((a, b) => a.foodId.localeCompare(b.foodId));

  return items.length ? opcionDeItems(items, bucket) : undefined;
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
