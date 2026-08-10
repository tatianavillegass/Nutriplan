import type { Alimento } from '../types/food';
import type { CombinacionGuardada, DayType, Meal } from '../types/plan';
import type { MacroBucket } from '../data/exchangeGroups';
import { textoItem, type OpcionEscalada } from './mealOptions';
import { generarCombinaciones, objetivoDeBucket, type ObjetivoBucket } from './combos';
import { alimentosDeBucket, repartoElegible } from './pantry';
import { roundPortion } from './macros';
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
}

/**
 * Columnas de una comida en Fase 2: guardadas si las hay, propuestas si no.
 */
export function columnasDeComida(
  dayType: DayType,
  meal: Meal,
  foods: Alimento[],
  opciones: { limite?: number } = {},
): ColumnaFase2[] {
  const { reparto } = repartoElegible(dayType, meal);

  return (['proteina', 'carbohidrato', 'grasa'] as MacroBucket[])
    .map((bucket) => {
      const objetivo = objetivoDeBucket(reparto, bucket);
      if (!objetivo) return undefined;

      const guardadas = guardadasDe(dayType, meal.id, bucket);
      if (guardadas.length) {
        const opcs = guardadas
          .map((g) => materializar(g, foods))
          .filter((x): x is OpcionEscalada => !!x);
        if (opcs.length) return { bucket, objetivo, opciones: opcs, propias: true };
      }

      const despensa = alimentosDeBucket(dayType, meal, bucket, foods);
      return {
        bucket,
        objetivo,
        opciones: generarCombinaciones(objetivo, despensa, { limite: opciones.limite ?? 5 }),
        propias: false,
      };
    })
    .filter((x): x is ColumnaFase2 => !!x);
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
