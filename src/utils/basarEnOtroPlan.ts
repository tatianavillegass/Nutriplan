import type { DayType, ExchangeGrid, Meal, Plan } from '../types/plan';
import { recetasDelPlan } from '../types/plan';
import type { ExchangeGroupId } from '../data/exchangeGroups';
import { exchangesToKcal, gridTotals } from './exchanges';
import { snapHalf } from './macros';

/**
 * BASAR EL PLAN DE UNA EN EL DE OTRA
 *
 * Muchas parejas comen lo mismo: los mismos platos, la misma compra, la misma
 * nevera — pero no las mismas cantidades. Montarle a ella el plan entero desde
 * cero cuando ya está hecho el de él es repetir el trabajo dos veces, y encima
 * salen dos listas de la compra distintas para una sola casa.
 *
 * LAS RECETAS SE COPIAN; LAS CANTIDADES SON DE CADA UNO
 * =====================================================
 * Es la misma regla que ya manda en todo lo demás: los platos son del plan y
 * **las cantidades salen del reparto de cada persona**. La misma tortilla
 * escalada a 1.800 kcal y a 2.600 son dos platos en la cocina y una sola
 * decisión al pautar. Así que copiar las recetas de él no le da a ella sus
 * gramos: se los calcula la app con los de ella.
 *
 * EL REPARTO SE COPIA EN FORMA, NO EN PORCIONES
 * =============================================
 * Copiar el grid tal cual sería darle el plan de él. Lo que se copia es **la
 * forma** —qué macros en qué comidas y en qué proporción— y se escala a las
 * calorías que ella tiene calculadas, que es exactamente lo que ya hacen las
 * plantillas de reparto guardadas. Si él desayuna fuerte y cena flojo, ella
 * también; con sus números.
 *
 * LO QUE NO CUADRA SE DICE, NO SE ESCONDE NI SE TIRA
 * ==================================================
 * Si él lleva carbohidrato en la cena y ella no, sus recetas de cena no van a
 * cubrir lo de ella. Se copian igual y se avisa en ámbar comida a comida: la
 * nutricionista las cambia a mano, que es lo que iba a hacer de todas formas.
 * Descartarlas dejaría una cena con cero recetas y el trabajo por hacer;
 * callarlo sería enviarle un plan que no cuadra sin que nadie lo mire.
 */

/** Qué se copia. Se marca al copiar: para una pareja suele ser todo. */
export interface QueCopiar {
  recetas: boolean;
  reparto: boolean;
  /** Despensa y combinaciones de fase 2: van juntas, son la misma decisión. */
  despensa: boolean;
  /** La semana ya repartida por comidas. */
  menu: boolean;
}

export const TODO: QueCopiar = {
  recetas: true,
  reparto: true,
  despensa: true,
  menu: true,
};

/** Las kcal que suma un tipo de día con su reparto puesto. */
export function kcalDelDia(dayType: DayType): number {
  return Math.round(exchangesToKcal(gridTotals(dayType.grid, dayType.meals)));
}

/**
 * EL REPARTO DE ÉL, A LA ESCALA DE ELLA
 *
 * Se copia comida a comida **por slot** y no por id: los ids de comida son de
 * cada plan, así que copiándolos por id no cuadraría ni una. Cada porción se
 * multiplica por la razón de calorías y se redondea a media, que es la unidad
 * con la que se pauta.
 *
 * Las comidas que él no tiene se quedan **como estaban**: es un punto de
 * partida, no un borrado. Si ella hace cinco comidas y él cuatro, la quinta
 * sigue siendo suya.
 */
export function repartoEscalado(
  destino: DayType,
  origen: DayType,
  /** Sin esto —o con las mismas kcal— se copia tal cual. */
  factor: number,
): ExchangeGrid {
  const grid: ExchangeGrid = { ...destino.grid };
  const porSlot = new Map<string, Meal>();
  for (const m of origen.meals) if (!porSlot.has(m.slot)) porSlot.set(m.slot, m);

  for (const meal of destino.meals) {
    const suya = porSlot.get(meal.slot);
    const celdas = suya ? origen.grid[suya.id] : undefined;
    if (!celdas) continue;

    const escalada: Partial<Record<ExchangeGroupId, number>> = {};
    for (const [grupo, n] of Object.entries(celdas) as [ExchangeGroupId, number][]) {
      if (!n) continue;
      const v = snapHalf(n * factor);
      if (v > 0) escalada[grupo] = v;
    }
    grid[meal.id] = escalada;
  }
  return grid;
}

/**
 * La razón entre lo que come ella y lo que come él. Si a ella aún no se le ha
 * repartido nada no hay con qué comparar, y entonces se copia tal cual: es
 * mejor un punto de partida que una pantalla en blanco.
 */
export function factorDeEscala(destino: DayType, origen: DayType): number {
  const suyas = kcalDelDia(destino);
  const deEl = kcalDelDia(origen);
  if (!suyas || !deEl) return 1;
  return suyas / deEl;
}

/**
 * Las recetas, traducidas de los ids de comida de él a los de ella **por
 * slot**. Una comida que ella no tiene se pierde, y eso es correcto: no hay
 * dónde ponerla.
 */
export function recetasPorSlot(
  origen: Plan,
  dayTypeOrigen: DayType,
  dayTypeDestino: DayType,
): Record<string, string[]> {
  const deEl = recetasDelPlan(origen);
  const slotDe = new Map(dayTypeOrigen.meals.map((m) => [m.id, m.slot]));

  /** slot → recetas, juntando lo que él tuviera repetido en ese slot. */
  const porSlot = new Map<string, string[]>();
  for (const [mealId, recetas] of Object.entries(deEl)) {
    const slot = slotDe.get(mealId);
    if (!slot || !recetas?.length) continue;
    const ya = porSlot.get(slot) ?? [];
    porSlot.set(slot, [...ya, ...recetas.filter((r) => !ya.includes(r))]);
  }

  const salida: Record<string, string[]> = {};
  for (const meal of dayTypeDestino.meals) {
    const recetas = porSlot.get(meal.slot);
    if (recetas?.length) salida[meal.id] = recetas;
  }
  return salida;
}

/** Lo mismo para lo que va por comida dentro del tipo de día. */
function porSlotDeDayType<T>(
  origen: DayType,
  destino: DayType,
  mapa: Record<string, T> | undefined,
): Record<string, T> {
  if (!mapa) return {};
  const slotDe = new Map(origen.meals.map((m) => [m.id, m.slot]));
  const porSlot = new Map<string, T>();
  for (const [mealId, valor] of Object.entries(mapa)) {
    const slot = slotDe.get(mealId);
    if (slot && !porSlot.has(slot)) porSlot.set(slot, valor);
  }

  const salida: Record<string, T> = {};
  for (const meal of destino.meals) {
    const valor = porSlot.get(meal.slot);
    if (valor !== undefined) salida[meal.id] = valor;
  }
  return salida;
}

export interface Copiado {
  /** Para `updatePlan`. */
  plan: Partial<Plan>;
  /** Para `updateDayType`, sobre el tipo de día que se esté editando. */
  dayType: Partial<DayType>;
  /** Cuántas comidas de ella recibieron algo, para poder decirlo. */
  comidas: number;
}

/**
 * Lo que hay que escribir para basar el plan de ella en el de él. No toca
 * nada: devuelve los parches y quien llama decide cuándo guardarlos.
 */
export function basarEn(
  destino: { plan: Plan; dayType: DayType },
  origen: { plan: Plan; dayType: DayType },
  que: QueCopiar,
): Copiado {
  const plan: Partial<Plan> = {};
  const dayType: Partial<DayType> = {};

  if (que.reparto) {
    dayType.grid = repartoEscalado(
      destino.dayType,
      origen.dayType,
      factorDeEscala(destino.dayType, origen.dayType),
    );
  }

  const recetas = que.recetas
    ? recetasPorSlot(origen.plan, origen.dayType, destino.dayType)
    : {};
  if (que.recetas) {
    /*
     * Se suman a lo que ella ya tuviera en vez de pisarlo: si le habías puesto
     * un desayuno suyo porque él desayuna algo que ella no toma, no se pierde.
     */
    const ya = recetasDelPlan(destino.plan);
    plan.recetasAsignadas = { ...ya };
    for (const [mealId, lista] of Object.entries(recetas)) {
      const antes = ya[mealId] ?? [];
      plan.recetasAsignadas[mealId] = [
        ...antes,
        ...lista.filter((r) => !antes.includes(r)),
      ];
    }
  }

  if (que.despensa) {
    dayType.despensa = {
      ...(destino.dayType.despensa ?? {}),
      ...porSlotDeDayType(origen.dayType, destino.dayType, origen.dayType.despensa),
    };
    dayType.combinaciones = {
      ...(destino.dayType.combinaciones ?? {}),
      ...porSlotDeDayType(origen.dayType, destino.dayType, origen.dayType.combinaciones),
    };
  }

  /*
   * El menú se reparte por día de la semana y por comida, y los ids de comida
   * son de cada plan: se traduce por slot igual que todo lo demás.
   */
  if (que.menu && origen.plan.menuPropuesto) {
    const slotDe = new Map(origen.dayType.meals.map((m) => [m.id, m.slot]));
    const mealDe = new Map(destino.dayType.meals.map((m) => [m.slot, m.id]));

    plan.menuPropuesto = {
      ...origen.plan.menuPropuesto,
      semanas: origen.plan.menuPropuesto.semanas.map((semana) => ({
        ...semana,
        dias: Object.fromEntries(
          Object.entries(semana.dias ?? {}).map(([dia, delDia]) => [
            dia,
            {
              ...delDia,
              comidas: Object.fromEntries(
                Object.entries(delDia.comidas ?? {})
                  .map(([mealId, recetaId]) => {
                    const slot = slotDe.get(mealId);
                    return [slot ? mealDe.get(slot) : undefined, recetaId];
                  })
                  .filter(([mealId]) => !!mealId) as [string, string][],
              ),
            },
          ]),
        ),
      })),
    };
  }

  return { plan, dayType, comidas: Object.keys(recetas).length };
}

export interface ComidaQueNoCuadra {
  mealId: string;
  comida: string;
  /** Nombre de las recetas que no cubren lo pautado a ella. */
  recetas: string[];
  /** Los macros que les faltan, ya en castellano y sin repetir. */
  faltan: string[];
}

/**
 * QUÉ HAY QUE REVISAR DESPUÉS DE COPIAR
 *
 * Él lleva carbohidrato en la cena y ella no: sus recetas de cena siguen ahí,
 * pero traen un arroz que a ella no se le ha pautado. Se dice comida a comida y
 * con nombres, que es lo que hace falta para arreglarlo — «la cena no cuadra» a
 * secas obliga a abrirlas todas para ver cuál.
 *
 * **No bloquea y no borra nada.** Es exactamente lo que la nutricionista iba a
 * hacer de todas formas: mirar la cena y cambiar dos recetas.
 */
export function loQueNoCuadra(
  plan: Plan,
  dayType: DayType,
  recetas: { id: string; nombre: string; base: Record<string, number | 'ilimitado'> }[],
  /** Qué le falta a una receta para cubrir esa comida. Lo sabe el recomendador. */
  faltantesDe: (recetaId: string, mealId: string) => string[],
): ComidaQueNoCuadra[] {
  const asignadas = recetasDelPlan(plan);
  const porId = new Map(recetas.map((r) => [r.id, r]));

  return dayType.meals
    .map((meal) => {
      /* Un avituallamiento no lleva recetas: ahí no hay nada que cuadrar. */
      if (dayType.avituallamientos?.[meal.id]) return undefined;

      const sinCuadrar = (asignadas[meal.id] ?? [])
        .map((id) => ({ receta: porId.get(id), faltan: faltantesDe(id, meal.id) }))
        .filter((x) => !!x.receta && x.faltan.length > 0);
      if (!sinCuadrar.length) return undefined;

      return {
        mealId: meal.id,
        comida: meal.nombre,
        recetas: sinCuadrar.map((x) => x.receta!.nombre),
        faltan: [...new Set(sinCuadrar.flatMap((x) => x.faltan))],
      };
    })
    .filter((x): x is ComidaQueNoCuadra => !!x);
}
