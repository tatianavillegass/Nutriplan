import type { ExchangeGroupId } from '../data/exchangeGroups';
import type { MealSlot } from '../types/food';
import type { DayType, ExchangeGrid } from '../types/plan';
import { exchangesToKcal, gridTotals } from './exchanges';
import { storage, uid, nowIso } from './storage';
import { avisarDelCambio } from './plantillas';

/**
 * REPARTOS GUARDADOS
 *
 * Un reparto es cuántas porciones de cada grupo van en cada comida: lo que se
 * monta en «Cálculo plan». Dos personas con calorías parecidas y el mismo
 * número de comidas llevan casi el mismo reparto, así que rehacerlo desde cero
 * con cada una es repetir el mismo trabajo veinte veces — y en un reto son
 * literalmente veinte.
 *
 * SE GUARDA POR SLOT, NO POR COMIDA
 * =================================
 * Los ids de las comidas son de cada plan, así que un reparto guardado con
 * ellos sólo valdría para esa persona. Guardándolo por «desayuno», «comida»…
 * se puede aplicar a cualquiera, y las comidas que no encajen se dejan como
 * estaban: es un punto de partida, no un borrado.
 *
 * SE SUGIERE, NO SE IMPONE
 * ========================
 * Se ofrecen primero los que encajan por comidas y calorías, pero se ven todos
 * y la decisión es de la nutricionista: dos personas con las mismas calorías
 * pueden necesitar repartos distintos y eso no lo sabe la app.
 */

export interface PlantillaReparto {
  id: string;
  nombre: string;
  /** slot de comida → grupo → porciones. */
  comidas: Partial<Record<MealSlot, Partial<Record<ExchangeGroupId, number>>>>;
  /** Para poder sugerirlo: con cuántas comidas y qué calorías se guardó. */
  comidasDia: number;
  kcal: number;
  createdAt: string;
}

export const REPARTOS_KEY = 'plantillas_reparto';

export function leerRepartos(): PlantillaReparto[] {
  return storage.getSync<PlantillaReparto[]>(REPARTOS_KEY) ?? [];
}

/**
 * Igual que las otras plantillas: viven fuera del store, y la subida escucha
 * al store. Sin este aviso se guardaban sólo en este navegador y al volver a
 * entrar las pisaba lo que hubiera en el servidor.
 */
export function guardarRepartos(lista: PlantillaReparto[]): void {
  storage.set(REPARTOS_KEY, lista);
  avisarDelCambio();
}

/** El reparto que está montado ahora mismo, listo para guardarse con nombre. */
export function desdeDayType(dayType: DayType): PlantillaReparto['comidas'] {
  const comidas: PlantillaReparto['comidas'] = {};
  for (const meal of dayType.meals) {
    const celdas = dayType.grid[meal.id];
    if (!celdas) continue;
    const conAlgo = Object.entries(celdas).filter(([, n]) => (n ?? 0) > 0);
    if (conAlgo.length) comidas[meal.slot] = Object.fromEntries(conAlgo);
  }
  return comidas;
}

export function guardarReparto(
  lista: PlantillaReparto[],
  nombre: string,
  dayType: DayType,
): PlantillaReparto[] {
  const comidas = desdeDayType(dayType);
  const totales = gridTotals(dayType.grid, dayType.meals);

  return [
    ...lista,
    {
      id: uid('rp_'),
      nombre: nombre.trim(),
      comidas,
      comidasDia: Object.keys(comidas).length,
      kcal: Math.round(exchangesToKcal(totales)),
      createdAt: nowIso(),
    },
  ];
}

export function borrarReparto(lista: PlantillaReparto[], id: string): PlantillaReparto[] {
  return lista.filter((p) => p.id !== id);
}

/**
 * Aplica el reparto al tipo de día. Lo que la plantilla no cubre se deja como
 * estaba: si ella ya había puesto la cena a mano, no se le borra.
 */
export function aplicarReparto(dayType: DayType, plantilla: PlantillaReparto): ExchangeGrid {
  const grid: ExchangeGrid = { ...dayType.grid };

  for (const meal of dayType.meals) {
    const celdas = plantilla.comidas[meal.slot];
    if (!celdas) continue;
    grid[meal.id] = { ...celdas };
  }
  return grid;
}

/** Cuántas comidas del día cubre: sin esto no se sabe si encaja o va a medias. */
export function cobertura(dayType: DayType, plantilla: PlantillaReparto): number {
  return dayType.meals.filter((m) => plantilla.comidas[m.slot]).length;
}

/**
 * LO QUE ENCAJA, PRIMERO
 *
 * Encaja el que tiene el mismo número de comidas y no se aleja más de un 10 %
 * de las calorías —el mismo margen con el que se juzga un día—. Los demás no
 * se esconden: se ordenan detrás.
 */
export function repartosQueEncajan(
  lista: PlantillaReparto[],
  kcal: number,
  comidasDia: number,
): { plantilla: PlantillaReparto; encaja: boolean }[] {
  const cerca = (p: PlantillaReparto) =>
    kcal > 0 && p.kcal > 0 && Math.abs(p.kcal - kcal) <= kcal * 0.1;

  return lista
    .map((plantilla) => ({
      plantilla,
      encaja: plantilla.comidasDia === comidasDia && cerca(plantilla),
    }))
    .sort((a, b) => {
      if (a.encaja !== b.encaja) return a.encaja ? -1 : 1;
      return Math.abs(a.plantilla.kcal - kcal) - Math.abs(b.plantilla.kcal - kcal);
    });
}


/**
 * ALIMENTOS DE CLIENTES QUE NO ENTRAN
 *
 * No todo lo que apunta alguien sirve para el catálogo: la mitad son productos
 * de una marca que no vende aquí, o etiquetas mal copiadas. Al descartar uno se
 * guarda su nombre para que no vuelva a proponerse; el alimento no se toca, que
 * es de quien lo creó y lo sigue usando.
 */
export const OMITIDOS_KEY = 'alimentos_omitidos';

export function leerOmitidos(): string[] {
  return storage.getSync<string[]>(OMITIDOS_KEY) ?? [];
}

export function guardarOmitidos(lista: string[]): void {
  storage.set(OMITIDOS_KEY, lista);
  avisarDelCambio();
}

/** Se compara por nombre, que es lo que la nutricionista reconoce. */
export function omitir(lista: string[], nombre: string): string[] {
  const clave = nombre.trim().toLowerCase();
  return lista.includes(clave) ? lista : [...lista, clave];
}
