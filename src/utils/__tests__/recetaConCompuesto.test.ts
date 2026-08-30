import { describe, it, expect } from 'vitest';
import { composicionDesdeIngredientes, macrosDeIngredientes } from '../recipeComposition';
import type { Alimento } from '../../types/food';
import type { Ingrediente } from '../../types/recipe';

/**
 * UN ALIMENTO QUE GASTA DE VARIOS GRUPOS TAMBIÉN LO GASTA DENTRO DE UNA RECETA
 *
 * Tats tiene el yogur griego light apuntado como lo que es: un lácteo proteico
 * más media grasa y un poco de almidón, porque lleva 2 g de grasa por cada 100
 * y el subgrupo «lácteos proteicos» va a cero. Al marcarlo en su día, la app ya
 * descontaba de los tres.
 *
 * Dentro de una receta, no: la receta apuntaba TODO al grupo principal y esa
 * grasa desaparecía de lo que costaba. Por eso el froyo salía a 60 kcal la
 * ración en «¿Algo dulce?» y a 104 contándolo por gramos.
 */

const YOGUR: Alimento = {
  id: 'a-yogur-griego-light',
  nombre: 'Yogur griego light',
  grupo: 'lacteos_proteicos',
  medida_casera: '120 g',
  gramos: 120,
  intercambios: 1,
  equivale: { lacteos_proteicos: 1, grasas: 0.5, almidones: 0.2 },
  nutrientes: { kcal: 60, hc: 4.7, proteina: 5.8, grasa: 2 },
  comidas_sugeridas: [],
  alergenos: [],
  apto: [],
} as unknown as Alimento;

const ing = (gramos: number): Ingrediente => ({
  id: 'i1',
  nombre: 'Yogur griego light',
  foodId: 'a-yogur-griego-light',
  cantidad_base: gramos,
  unidad: 'g',
  grupo: 'lacteos_proteicos',
  escalable: true,
  opcional: false,
});

describe('Una receta con un alimento compuesto', () => {
  it('gasta de todos sus grupos, no sólo del principal', () => {
    // 240 g son dos medidas de 120 g.
    const c = composicionDesdeIngredientes({ ingredientes: [ing(240)] }, [YOGUR]);
    expect(c.exacto.lacteos_proteicos).toBeCloseTo(2, 6);
    expect(c.exacto.grasas).toBeCloseTo(1, 6);
    expect(c.exacto.almidones).toBeCloseTo(0.4, 6);
  });

  /**
   * Y así lo que la receta dice que cuesta se parece a lo que de verdad se
   * come: antes, contándolo sólo como lácteo, salía a 80 kcal.
   */
  it('y entonces lo que cuesta se parece a lo que trae la etiqueta', () => {
    const c = composicionDesdeIngredientes({ ingredientes: [ing(240)] }, [YOGUR]);
    const real = macrosDeIngredientes({ ingredientes: [ing(240)] }, [YOGUR]);

    expect(real.kcal).toBeCloseTo(144, 0); // 240 g × 60 kcal/100 g
    expect(c.kcal).toBeGreaterThan(130);
    expect(Math.abs(c.kcal - real.kcal) / real.kcal).toBeLessThan(0.1);
  });

  it('un alimento normal sigue yendo entero a su grupo', () => {
    const pollo = {
      id: 'a-pollo',
      nombre: 'Pollo',
      grupo: 'proteicos_magros',
      medida_casera: '30 g',
      gramos: 30,
      intercambios: 1,
      nutrientes: { kcal: 120, hc: 0, proteina: 22, grasa: 2.5 },
      comidas_sugeridas: [],
      alergenos: [],
      apto: [],
    } as unknown as Alimento;

    const c = composicionDesdeIngredientes(
      {
        ingredientes: [
          { ...ing(90), foodId: 'a-pollo', nombre: 'Pollo', grupo: 'proteicos_magros' },
        ],
      },
      [pollo],
    );
    expect(c.exacto.proteicos_magros).toBeCloseTo(3, 6);
    expect(Object.keys(c.exacto)).toEqual(['proteicos_magros']);
  });
});

describe('Las calorías se leen de la etiqueta', () => {
  it('de los gramos de cada ingrediente y sus nutrientes por 100 g', () => {
    const r = macrosDeIngredientes({ ingredientes: [ing(240)] }, [YOGUR]);
    expect(r.proteina).toBeCloseTo(13.92, 2);
    expect(r.hc).toBeCloseTo(11.28, 2);
    expect(r.grasa).toBeCloseTo(4.8, 2);
    expect(r.gramos).toBe(240);
    expect(r.sinResolver).toEqual([]);
  });

  /** Lo que no está en el catálogo se dice, en vez de contarlo como cero. */
  it('y lo que no está enlazado se cuenta aparte', () => {
    const r = macrosDeIngredientes(
      {
        ingredientes: [
          ing(120),
          { ...ing(10), id: 'i2', nombre: 'Edulcorante', foodId: undefined },
        ],
      },
      [YOGUR],
    );
    expect(r.gramos).toBe(120);
    expect(r.sinResolver).toEqual(['Edulcorante']);
  });

  /** «Al gusto» no falta: es que no tiene cantidad. */
  it('y lo que va al gusto no se echa en falta', () => {
    const r = macrosDeIngredientes(
      {
        ingredientes: [
          ing(120),
          {
            id: 'i3',
            nombre: 'Canela',
            cantidad_base: null,
            unidad: 'al gusto',
            grupo: 'condimento',
            escalable: false,
            opcional: true,
          },
        ],
      },
      [YOGUR],
    );
    expect(r.sinResolver).toEqual([]);
  });
});
