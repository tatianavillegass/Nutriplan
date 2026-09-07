import type { Alimento } from '../types/food';
import type { CombinacionGuardada, DayType, Meal } from '../types/plan';
import type { MacroBucket } from '../data/exchangeGroups';
import { textoItem, type OpcionEscalada } from './mealOptions';
import { generarCombinaciones, objetivoDeBucket, type ObjetivoBucket } from './combos';
import { alimentosDeBucket, repartoElegible } from './pantry';
import { cubiertoPorOtroMacro } from './marcado';
import type { PorcionesMarcadas } from '../types/diary';
import { roundPortion, snapHalf } from './macros';
import { gramosPorIntercambio } from './recipeComposition';
import { escalarMedida } from './measures';
import type { ExchangeCounts } from './exchanges';

/**
 * COMBINACIONES GUARDADAS
 *
 * Manda lo que decide la nutricionista. Las propuestas automáticas son un
 * punto de partida: en cuanto guarda alguna para esa comida y macro, el
 * cliente ve las suyas y sólo las suyas.
 */

/** Convierte una combinación guardada en la opción escalada que ve el cliente. */
export function materializar(
  guardada: CombinacionGuardada,
  foods: Alimento[],
): OpcionEscalada | undefined {
  const items = fusionarItems(guardada.items)
    .map((it) => {
      const food = foods.find((f) => f.id === it.foodId);
      const gpi = food ? gramosPorIntercambio(food) : undefined;
      if (!food?.grupo || !gpi || it.porciones <= 0) return undefined;
      return {
        foodId: food.id,
        nombre: food.nombre,
        grupo: food.grupo,
        intercambios: it.porciones,
        gramos: roundPortion(gpi * it.porciones),
        unidad: food.unidad ?? 'g',
        medida: escalarMedida(food.medida_casera, it.porciones),
        gramosCocido: food.equivalencia_cocido
          ? roundPortion(food.equivalencia_cocido * it.porciones)
          : undefined,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  if (!items.length) return undefined;

  const cubre: ExchangeCounts = {};
  for (const it of items) cubre[it.grupo] = (cubre[it.grupo] ?? 0) + it.intercambios;

  return {
    id: guardada.id,
    bucket: guardada.bucket,
    items,
    texto: items
      .map(textoItem)
      .join(' + '),
    cubre,
    unificada: false,
  };
}

/** Combinaciones guardadas de una comida y macro. */
export function guardadasDe(
  dayType: DayType,
  mealId: string,
  bucket: MacroBucket,
): CombinacionGuardada[] {
  return (dayType.combinaciones?.[mealId] ?? []).filter((c) => c.bucket === bucket);
}

export interface ColumnaFase2 {
  bucket: MacroBucket;
  objetivo: ObjetivoBucket;
  /** Lo que verá el cliente. */
  opciones: OpcionEscalada[];
  /** true si son las guardadas por la nutricionista. */
  propias: boolean;
  /**
   * Porciones que este macro ya tiene cubiertas por otro: las lentejas del
   * carbohidrato traen proteína. Se dice en pantalla para que se entienda por
   * qué la columna pide menos de lo pautado.
   */
  cubiertoPorOtro?: number;
  /** Lo otro ya lo cubre entero: no hay nada que elegir en esta columna. */
  cubiertoDelTodo?: boolean;
}

/**
 * Columnas de una comida en Fase 2: guardadas si las hay, propuestas si no.
 *
 * SI YA HA ELEGIDO LENTEJAS, LA PROTEÍNA PIDE MENOS
 * =================================================
 * Una porción de legumbre son 14 g de hidrato Y 7 g de proteína. Al elegirla en
 * la columna del carbohidrato, la proteína de esa comida ya está medio hecha —
 * pero la columna se calculaba sólo del reparto pautado, así que seguía
 * pidiendo las cuatro porciones enteras y quien las marcaba se comía la
 * proteína dos veces.
 *
 * Pasando lo que lleva marcado, el objetivo de cada macro descuenta lo que ya
 * le trae otro. Es lo mismo que ya se hace con el aceite de cocinar, que se
 * descuenta de las grasas del día porque no se elige.
 *
 * Sin `porciones` se comporta como siempre: en el PDF y en la pantalla de la
 * nutricionista no hay nada marcado que descontar.
 */
export function columnasDeComida(
  dayType: DayType,
  meal: Meal,
  foods: Alimento[],
  opciones: { limite?: number; porciones?: PorcionesMarcadas } = {},
): ColumnaFase2[] {
  const { reparto } = repartoElegible(dayType, meal);

  return (['proteina', 'carbohidrato', 'grasa'] as MacroBucket[])
    .map((bucket): ColumnaFase2 | undefined => {
      const objetivo = objetivoDeBucket(reparto, bucket);
      if (!objetivo) return undefined;

      const guardadas = guardadasDe(dayType, meal.id, bucket);
      if (guardadas.length) {
        const opcs = guardadas
          .map((g) => materializar(g, foods))
          .filter((x): x is OpcionEscalada => !!x);
        if (opcs.length) return { bucket, objetivo, opciones: opcs, propias: true };
      }

      /*
       * Las porciones que otro macro ya le ha traído. Si las cubre todas, la
       * columna desaparece: no hay nada que elegir, y eso es la verdad.
       */
      const deOtro = opciones.porciones
        ? cubiertoPorOtroMacro(opciones.porciones, meal.id, bucket, foods)
        : 0;

      const pendiente = deOtro > 0 ? restarDelObjetivo(objetivo, deOtro) : objetivo;
      if (!pendiente)
        return {
          bucket,
          objetivo,
          opciones: [],
          propias: false,
          cubiertoPorOtro: deOtro,
          cubiertoDelTodo: true,
        };

      const despensa = alimentosDeBucket(dayType, meal, bucket, foods);
      return {
        bucket,
        objetivo: pendiente,
        opciones: generarCombinaciones(pendiente, despensa, {
          limite: opciones.limite ?? 5,
        }),
        propias: false,
        ...(deOtro > 0 ? { cubiertoPorOtro: deOtro } : {}),
      };
    })
    .filter((x): x is ColumnaFase2 => !!x);
}

/**
 * El mismo objetivo con menos porciones. Se quitan de los subgrupos con más
 * porciones primero, que es lo que menos deforma el reparto: de «4 magros» se
 * pasa a «1 magro», no a un subgrupo distinto.
 */
function restarDelObjetivo(
  objetivo: ObjetivoBucket,
  porciones: number,
): ObjetivoBucket | undefined {
  let quedan = porciones;
  const counts: ExchangeCounts = {};

  for (const [g, n] of [...objetivo.porSubgrupo].sort((a, b) => b[1] - a[1])) {
    const quita = Math.min(n, quedan);
    quedan -= quita;
    const resto = snapHalf(n - quita);
    if (resto > 0) counts[g] = resto;
  }

  return Object.keys(counts).length
    ? objetivoDeBucket(counts, objetivo.bucket)
    : undefined;
}

/** Guarda una combinación en una comida. */
export function guardarCombinacion(
  dayType: DayType,
  mealId: string,
  combinacion: CombinacionGuardada,
): Record<string, CombinacionGuardada[]> {
  const actuales = dayType.combinaciones?.[mealId] ?? [];
  const existe = actuales.some((c) => c.id === combinacion.id);
  return {
    ...(dayType.combinaciones ?? {}),
    [mealId]: existe
      ? actuales.map((c) => (c.id === combinacion.id ? combinacion : c))
      : [...actuales, combinacion],
  };
}

/** Quita una combinación guardada. */
export function quitarCombinacion(
  dayType: DayType,
  mealId: string,
  comboId: string,
): Record<string, CombinacionGuardada[]> {
  const actuales = dayType.combinaciones?.[mealId] ?? [];
  return { ...(dayType.combinaciones ?? {}), [mealId]: actuales.filter((c) => c.id !== comboId) };
}

/** Vacía las combinaciones de un macro para volver a las propuestas. */
export function volverAPropuestas(
  dayType: DayType,
  mealId: string,
  bucket: MacroBucket,
): Record<string, CombinacionGuardada[]> {
  const actuales = dayType.combinaciones?.[mealId] ?? [];
  return { ...(dayType.combinaciones ?? {}), [mealId]: actuales.filter((c) => c.bucket !== bucket) };
}

/**
 * Suma un alimento al borrador de una combinación.
 * Si ya estaba, sube su número de porciones en vez de repetir la línea:
 * dos veces "huevo" son "2 huevos (120 g)", no "1 huevo + 1 huevo".
 */
export function sumarItem(
  items: { foodId: string; porciones: number }[],
  foodId: string,
  cantidad = 1,
): { foodId: string; porciones: number }[] {
  const i = items.findIndex((x) => x.foodId === foodId);
  if (i === -1) return [...items, { foodId, porciones: cantidad }];
  return items.map((x, k) => (k === i ? { ...x, porciones: x.porciones + cantidad } : x));
}

/** Une las líneas repetidas de una combinación ya guardada. */
export function fusionarItems(
  items: { foodId: string; porciones: number }[],
): { foodId: string; porciones: number }[] {
  const out: { foodId: string; porciones: number }[] = [];
  for (const it of items) {
    const previo = out.find((x) => x.foodId === it.foodId);
    if (previo) previo.porciones += it.porciones;
    else out.push({ ...it });
  }
  return out;
}

/** Pasa una opción propuesta a combinación guardable. */
export function desdeOpcion(opcion: OpcionEscalada): CombinacionGuardada {
  return {
    id: opcion.id,
    bucket: opcion.bucket,
    items: opcion.items.map((i) => ({ foodId: i.foodId, porciones: i.intercambios })),
  };
}
