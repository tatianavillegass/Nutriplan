import { describe, it, expect } from 'vitest';
import { porcionesDeGolpe } from '../rellenoRapido';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Alimento } from '../../types/food';

/**
 * EL PRIMER TOQUE METE LO QUE FALTA
 *
 * La comida se resuelve casi siempre con un alimento por macro: cuatro
 * porciones de pollo, no cuatro alimentos. Pulsar cuatro veces el mismo botón
 * para decir algo que la app ya sabe es trabajo inventado, y se hace de pie en
 * la cocina con una mano.
 */

const pollo = FOOD_CATALOG.find(
  (f) => f.grupo === 'proteicos_magros' && f.id.includes('pollo'),
) as Alimento;

const aceite = FOOD_CATALOG.find((f) => f.grupo === 'grasas') as Alimento;

describe('El primer toque en un alimento', () => {
  it('mete las porciones que le faltan a su macro', () => {
    const n = porcionesDeGolpe({ proteicos_magros: 4 }, undefined, FOOD_CATALOG, pollo, 'comida');
    expect(n).toBe(4);
  });

  it('cuenta lo que ya hay marcado de ese macro', () => {
    const n = porcionesDeGolpe(
      { proteicos_magros: 4 },
      { [aceite.id]: 1 },
      FOOD_CATALOG,
      pollo,
      'cena',
    );
    // El aceite es grasa: no toca la proteína, siguen faltando cuatro.
    expect(n).toBe(4);
  });

  it('y con el macro ya cubierto vale lo de siempre: una', () => {
    const n = porcionesDeGolpe(
      { proteicos_magros: 4 },
      { [pollo.id]: 4 },
      FOOD_CATALOG,
      pollo,
      'comida',
    );
    expect(n).toBe(1);
  });

  it('un macro que no se pautó tampoco dispara nada raro', () => {
    expect(porcionesDeGolpe({ almidones: 3 }, undefined, FOOD_CATALOG, pollo, 'comida')).toBe(1);
  });
});

/**
 * EN EL DESAYUNO SE COMBINAN VARIAS FUENTES
 *
 * El yogur con la whey, el pan con el pavo. Meter de golpe toda la proteína en
 * la primera que toque es justo lo contrario de lo que va a hacer, así que el
 * relleno se queda en la comida y la cena — y sólo con carne, pescado o huevo:
 * un lácteo casi nunca se lleva la proteína entera de un plato.
 */
describe('Fuera de la comida y la cena', () => {
  it('el desayuno suma de una en una', () => {
    expect(porcionesDeGolpe({ proteicos_magros: 4 }, undefined, FOOD_CATALOG, pollo, 'desayuno')).toBe(1);
    expect(porcionesDeGolpe({ proteicos_magros: 4 }, undefined, FOOD_CATALOG, pollo, 'merienda')).toBe(1);
  });

  it('y un lácteo tampoco se lleva el plato entero', () => {
    const yogur = FOOD_CATALOG.find((f) => f.grupo === 'lacteos_proteicos') as Alimento;
    expect(porcionesDeGolpe({ lacteos_proteicos: 3 }, undefined, FOOD_CATALOG, yogur, 'comida')).toBe(1);
  });
});
