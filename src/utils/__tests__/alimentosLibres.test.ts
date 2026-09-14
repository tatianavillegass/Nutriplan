import { describe, it, expect } from 'vitest';
import { alimentosDeComida, alimentosDeBucket, libresDeComida } from '../pantry';
import { columnasDeComida } from '../combosGuardados';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Alimento } from '../../types/food';
import type { DayType, Meal } from '../../types/plan';

/**
 * ALIMENTOS LIBRES EN LA DESPENSA
 *
 * La bebida de almendras, el zumo de limón, el café o una infusión no caben en
 * ningún grupo de intercambio: no aportan nada que pautar. Antes eso los dejaba
 * fuera de la despensa, así que o se les inventaba un subgrupo con el que no
 * cuadran o no se le podían ofrecer a la clienta.
 *
 * Ahora entran sin gastar nada: cero porciones, «al gusto».
 */

const DESAYUNO = { id: 'd', nombre: 'Desayuno', slot: 'desayuno', orden: 1 } as Meal;

const BEBIDA = FOOD_CATALOG.find(
  (f) => !f.grupo && /almendra/i.test(f.nombre),
)!;

const dia = (seleccion: string[]): DayType =>
  ({
    id: 'dt',
    nombre: 'Día base',
    meals: [DESAYUNO],
    grid: { d: { almidones: 2, fruta: 1 } },
    notas: {},
    despensa: { d: { seleccion } },
  }) as unknown as DayType;

describe('Un alimento libre en la despensa', () => {
  it('el catálogo trae bebidas sin subgrupo', () => {
    expect(BEBIDA).toBeTruthy();
    expect(BEBIDA.grupo).toBeUndefined();
  });

  /** Antes se caía del filtro y no había forma de ofrecérselo. */
  it('se puede poner en una comida', () => {
    const dayType = dia([BEBIDA.id, 'a-avena-copos']);
    const dentro = alimentosDeComida(dayType, DESAYUNO, FOOD_CATALOG);
    expect(dentro.map((f) => f.id)).toContain(BEBIDA.id);
  });

  it('y sale en su propia lista de libres', () => {
    const dayType = dia([BEBIDA.id, 'a-avena-copos']);
    expect(libresDeComida(dayType, DESAYUNO, FOOD_CATALOG).map((f) => f.id)).toEqual([BEBIDA.id]);
  });

  /**
   * Lo importante: que no se cuele en lo que se pauta. No tiene porción, así
   * que no puede estar en una columna de macro ni en una combinación.
   */
  it('pero no entra en ninguna columna de macro', () => {
    const dayType = dia([BEBIDA.id, 'a-avena-copos', 'a-platano']);
    for (const bucket of ['proteina', 'carbohidrato', 'grasa'] as const) {
      const dentro = alimentosDeBucket(dayType, DESAYUNO, bucket, FOOD_CATALOG);
      expect(dentro.some((f) => f.id === BEBIDA.id)).toBe(false);
    }
  });

  it('ni en las combinaciones que se le proponen', () => {
    const dayType = dia([BEBIDA.id, 'a-avena-copos', 'a-platano']);
    const columnas = columnasDeComida(dayType, DESAYUNO, FOOD_CATALOG);
    for (const col of columnas) {
      for (const o of col.opciones) {
        expect(o.items.some((i) => i.foodId === BEBIDA.id)).toBe(false);
      }
    }
    /* Y las combinaciones se siguen generando igual que sin él. */
    expect(columnas.some((c) => c.opciones.length > 0)).toBe(true);
  });

  /** La verdura es libre también, pero tiene su regla de medio plato aparte. */
  it('la verdura no se cuela en la despensa por esta puerta', () => {
    const sinLista = {
      id: 'dt',
      nombre: 'Día base',
      meals: [DESAYUNO],
      grid: { d: { almidones: 2 } },
      notas: {},
    } as unknown as DayType;
    const dentro = alimentosDeComida(sinLista, DESAYUNO, FOOD_CATALOG);
    expect(dentro.some((f) => f.grupo === 'verduras')).toBe(false);
  });

  /** Un alimento roto —sin grupo y sin nutrientes— no rompe nada. */
  it('y uno que no existe se ignora, como siempre', () => {
    const dayType = dia(['no-existe', 'a-avena-copos']);
    const dentro = alimentosDeComida(dayType, DESAYUNO, FOOD_CATALOG);
    expect(dentro.map((f) => f.id)).toEqual(['a-avena-copos']);
  });
});

/** Lo libre no se pauta, pero sí se come: sus calorías cuentan. */
describe('Lo que aporta', () => {
  it('no gasta intercambios', () => {
    const libre = BEBIDA as Alimento;
    expect(libre.grupo).toBeUndefined();
    /* Tiene nutrientes, así que donde se cuentan calorías cuenta. */
    expect(libre.nutrientes?.kcal).toBeGreaterThanOrEqual(0);
  });
});
