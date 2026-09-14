import { describe, it, expect } from 'vitest';
import { columnasDeComida } from '../combosGuardados';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Meal } from '../../types/plan';

/**
 * LA CLIENTA TIENE QUE PODER CAMBIAR LA FRUTA
 *
 * Con dos porciones de fruta pautadas y cuatro frutas en la despensa, la lista
 * salía con **dos** opciones y las dos del mismo alimento. Se sumaban tres
 * cosas: las candidatas se ordenaban por calorías —así que las treinta primeras
 * eran todas de la fruta que más llena—, la que repetía protagonista se
 * descartaba **en silencio** en vez de pasar al siguiente alimento, y se
 * reservaban dos huecos para las combinaciones mezcladas aunque no fuera a
 * haber ninguna.
 */

const DESAYUNO = { id: 'd', nombre: 'Desayuno', slot: 'desayuno', orden: 1 } as Meal;

/** Una despensa como la que monta ella: cuatro frutas y dos almidones. */
const DESPENSA = [
  'a-platano',
  'a-manzana',
  'a-arandanos',
  'a-pera',
  'a-avena-copos',
  'a-pan-integral',
];

const opciones = (grid: Record<string, number>, seleccion: string[]) => {
  const dayType = {
    id: 'dt',
    nombre: 'Día base',
    meals: [DESAYUNO],
    grid: { d: grid },
    notas: {},
    despensa: { d: { seleccion } },
  } as unknown as DayType;
  const col = columnasDeComida(dayType, DESAYUNO, FOOD_CATALOG).find(
    (c) => c.bucket === 'carbohidrato',
  );
  return col?.opciones ?? [];
};

/** El alimento que da nombre a la opción. */
const protagonistas = (os: ReturnType<typeof opciones>) =>
  os.map((o) => [...o.items].sort((a, b) => b.intercambios - a.intercambios)[0].foodId);

describe('Las frutas se pueden cambiar', () => {
  it('con una porción salen todas las frutas de su despensa', () => {
    const o = opciones({ fruta: 1 }, DESPENSA);
    expect(o.length).toBe(4);
    expect(new Set(protagonistas(o))).toEqual(
      new Set(['a-platano', 'a-manzana', 'a-arandanos', 'a-pera']),
    );
  });

  /**
   * El caso que fallaba: con dos porciones salían dos opciones del mismo
   * alimento. Ahora cada fruta tiene su turno antes de que ninguna repita.
   */
  it('y con dos porciones también, sin repetir ninguna', () => {
    const p = protagonistas(opciones({ fruta: 2 }, DESPENSA));
    expect(p.length).toBe(4);
    expect(new Set(p).size).toBe(4);
  });

  /** Nadie repite hasta que todos han salido una vez. */
  it('ningún alimento se lleva la lista entera', () => {
    const p = protagonistas(opciones({ fruta: 2 }, DESPENSA));
    const veces = new Map<string, number>();
    for (const id of p) veces.set(id, (veces.get(id) ?? 0) + 1);
    expect(Math.max(...veces.values())).toBe(1);
  });

  /**
   * Con almidón y fruta pautados se reservaba un hueco para cada alternativa y
   * quedaban dos opciones de lo que ella pautó. Con uno basta para enseñar que
   * se puede cubrir de otra manera.
   */
  it('con dos familias pautadas quedan al menos tres opciones de lo pautado', () => {
    const o = opciones({ almidones: 1, fruta: 1 }, DESPENSA);
    const conLasDos = o.filter(
      (x) =>
        x.items.some((i) => i.grupo === 'fruta') &&
        x.items.some((i) => i.grupo === 'almidones'),
    );
    expect(conLasDos.length).toBeGreaterThanOrEqual(3);
    /* Y sigue saliendo la alternativa: cubrirlo todo con almidón. */
    expect(o.some((x) => x.items.every((i) => i.grupo === 'almidones'))).toBe(true);
  });

  /**
   * Sin nada más en la despensa no hay nada que ofrecer, y eso es la verdad:
   * lo que hay que hacer es añadir frutas a esa comida.
   */
  it('con una sola fruta en la despensa sale una sola opción', () => {
    const o = opciones({ fruta: 1 }, ['a-arandanos', 'a-avena-copos']);
    expect(o.length).toBe(1);
    expect(o[0].items[0].foodId).toBe('a-arandanos');
  });
});

/**
 * Ordenar por calorías ponía delante lo raro: «370 g de melón» antes que un
 * plátano. Lo que se elige a las ocho de la mañana es un alimento, no una
 * mezcla.
 */
describe('Primero lo sencillo', () => {
  it('las opciones de un solo alimento van antes que las de dos', () => {
    const o = opciones({ fruta: 2 }, DESPENSA);
    const cuantos = o.map((x) => x.items.length);
    expect(cuantos).toEqual([...cuantos].sort((a, b) => a - b));
  });
});
