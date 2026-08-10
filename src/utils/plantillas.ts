import type { Alimento, MealSlot } from '../types/food';
import type { DayType, DespensaComida } from '../types/plan';
import { storage, uid, nowIso } from './storage';
import { PLANTILLAS_INICIALES } from '../data/plantillasIniciales';

/**
 * PLANTILLAS DE DESPENSA
 *
 * "Mi desayuno de siempre": queso fresco batido, huevo, avena, plátano, aceite.
 * Se guardan una vez y se aplican a cualquier cliente, en lugar de volver a
 * componerlas desde cero.
 *
 * Hay dos tamaños:
 *   · de comida — una lista de alimentos para un desayuno, una cena…
 *   · de día    — varias comidas de golpe, para arrancar el plan entero
 *
 * Van fuera del plan porque son de la nutricionista, no del cliente.
 */

export interface PlantillaDespensa {
  id: string;
  nombre: string;
  /** Ids de alimentos, en el orden en que se añadieron. */
  foodIds: string[];
  /** Para qué comida se pensó. Sólo sirve para ordenarlas y sugerirlas. */
  slot?: MealSlot;
  createdAt: string;
}

export interface PlantillaDia {
  id: string;
  nombre: string;
  /** slot de comida → alimentos que se ofrecen en esa comida. */
  comidas: Partial<Record<MealSlot, string[]>>;
  createdAt: string;
}

export const PLANTILLAS_KEY = 'plantillas_despensa';
export const PLANTILLAS_DIA_KEY = 'plantillas_dia';
const SEMBRADAS_KEY = 'plantillas_sembradas';

/**
 * La primera vez se dejan preparadas unas cuantas con los alimentos más
 * corrientes, para no empezar con la pantalla en blanco. Si las borras, no
 * vuelven a aparecer.
 */
function sembrar(): void {
  if (typeof window === 'undefined') return;
  if (storage.getSync<boolean>(SEMBRADAS_KEY)) return;
  storage.set(SEMBRADAS_KEY, true);

  if (!storage.getSync<PlantillaDespensa[]>(PLANTILLAS_KEY)?.length) {
    storage.set(
      PLANTILLAS_KEY,
      PLANTILLAS_INICIALES.comidas.map((p) => ({ ...p, id: uid('pt_'), createdAt: nowIso() })),
    );
  }
  if (!storage.getSync<PlantillaDia[]>(PLANTILLAS_DIA_KEY)?.length) {
    storage.set(
      PLANTILLAS_DIA_KEY,
      PLANTILLAS_INICIALES.dias.map((p) => ({ ...p, id: uid('pd_'), createdAt: nowIso() })),
    );
  }
}

export function leerPlantillas(): PlantillaDespensa[] {
  sembrar();
  return storage.getSync<PlantillaDespensa[]>(PLANTILLAS_KEY) ?? [];
}

export function guardarPlantillas(lista: PlantillaDespensa[]): void {
  void storage.set(PLANTILLAS_KEY, lista);
}

export function leerPlantillasDia(): PlantillaDia[] {
  sembrar();
  return storage.getSync<PlantillaDia[]>(PLANTILLAS_DIA_KEY) ?? [];
}

export function guardarPlantillasDia(lista: PlantillaDia[]): void {
  void storage.set(PLANTILLAS_DIA_KEY, lista);
}

/** Crea o reemplaza por nombre, para no acumular "Desayuno" cuatro veces. */
export function guardarPlantilla(
  lista: PlantillaDespensa[],
  nombre: string,
  foodIds: string[],
  slot?: MealSlot,
): PlantillaDespensa[] {
  const limpio = nombre.trim();
  if (!limpio || !foodIds.length) return lista;

  const existente = lista.find((p) => p.nombre.toLowerCase() === limpio.toLowerCase());
  const siguiente = existente
    ? lista.map((p) => (p.id === existente.id ? { ...p, foodIds: [...foodIds], slot } : p))
    : [
        ...lista,
        { id: uid('pt_'), nombre: limpio, foodIds: [...foodIds], slot, createdAt: nowIso() },
      ];

  guardarPlantillas(siguiente);
  return siguiente;
}

export function borrarPlantilla(lista: PlantillaDespensa[], id: string): PlantillaDespensa[] {
  const siguiente = lista.filter((p) => p.id !== id);
  guardarPlantillas(siguiente);
  return siguiente;
}

/** Igual, para las de día completo. */
export function guardarPlantillaDia(
  lista: PlantillaDia[],
  nombre: string,
  comidas: Partial<Record<MealSlot, string[]>>,
): PlantillaDia[] {
  const limpio = nombre.trim();
  // Se quitan las comidas desmarcadas; una comida marcada pero todavía vacía
  // sí cuenta, porque la plantilla se compone poco a poco.
  const limpias = Object.fromEntries(
    Object.entries(comidas).filter(([, ids]) => Array.isArray(ids)),
  ) as Partial<Record<MealSlot, string[]>>;

  if (!limpio || !Object.keys(limpias).length) return lista;

  const existente = lista.find((p) => p.nombre.toLowerCase() === limpio.toLowerCase());
  const siguiente = existente
    ? lista.map((p) => (p.id === existente.id ? { ...p, comidas: limpias } : p))
    : [...lista, { id: uid('pd_'), nombre: limpio, comidas: limpias, createdAt: nowIso() }];

  guardarPlantillasDia(siguiente);
  return siguiente;
}

export function borrarPlantillaDia(lista: PlantillaDia[], id: string): PlantillaDia[] {
  const siguiente = lista.filter((p) => p.id !== id);
  guardarPlantillasDia(siguiente);
  return siguiente;
}

/**
 * Aplica una plantilla a una comida. Por defecto sustituye la lista; con
 * `sumar` se añade a lo que ya había, sin repetir.
 */
export function aplicarPlantilla(
  despensa: DespensaComida,
  plantilla: PlantillaDespensa,
  sumar = false,
): DespensaComida {
  const previos = sumar ? (despensa.seleccion ?? []) : [];
  const seleccion = [...previos];
  for (const id of plantilla.foodIds) if (!seleccion.includes(id)) seleccion.push(id);
  return { ...despensa, seleccion };
}

/**
 * Aplica una plantilla de día a todas las comidas del tipo de día, casando
 * por el slot de cada comida. Las comidas que la plantilla no cubre se dejan
 * como estaban: es un punto de partida, no un borrado.
 */
export function aplicarPlantillaDia(
  dayType: DayType,
  plantilla: PlantillaDia,
  sumar = false,
): Record<string, DespensaComida> {
  const despensa = { ...(dayType.despensa ?? {}) };

  for (const meal of dayType.meals) {
    const ids = plantilla.comidas[meal.slot];
    if (!ids?.length) continue;
    const actual = despensa[meal.id] ?? {};
    const previos = sumar ? (actual.seleccion ?? []) : [];
    const seleccion = [...previos];
    for (const id of ids) if (!seleccion.includes(id)) seleccion.push(id);
    despensa[meal.id] = { ...actual, seleccion };
  }

  return despensa;
}

/** Cuántas comidas del tipo de día cubre una plantilla. */
export function cobertura(dayType: DayType, plantilla: PlantillaDia): number {
  return dayType.meals.filter((m) => plantilla.comidas[m.slot]?.length).length;
}

/** Total de alimentos de una plantilla de día. */
export function totalAlimentos(plantilla: PlantillaDia): number {
  return Object.values(plantilla.comidas).reduce((s, ids) => s + (ids?.length ?? 0), 0);
}

/** Cuántos alimentos de la plantilla siguen existiendo en el catálogo. */
export function resolverPlantilla(
  plantilla: PlantillaDespensa,
  foods: Alimento[],
): { encontrados: Alimento[]; perdidos: number } {
  const porId = new Map(foods.map((f) => [f.id, f]));
  const encontrados = plantilla.foodIds
    .map((id) => porId.get(id))
    .filter((f): f is Alimento => !!f);
  return { encontrados, perdidos: plantilla.foodIds.length - encontrados.length };
}

/** Guarda el día que está montado como plantilla reutilizable. */
export function desdeDayType(dayType: DayType): Partial<Record<MealSlot, string[]>> {
  const comidas: Partial<Record<MealSlot, string[]>> = {};
  for (const meal of dayType.meals) {
    const ids = dayType.despensa?.[meal.id]?.seleccion;
    if (ids?.length) comidas[meal.slot] = [...ids];
  }
  return comidas;
}
