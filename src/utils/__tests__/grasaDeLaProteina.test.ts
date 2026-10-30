import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Ingrediente, Receta } from '../../types/recipe';
import type { ExchangeCounts } from '../exchanges';

/**
 * LA GRASA DE LA PROTEÍNA SE LE BAJA AL ACEITE
 *
 * «Si he pautado proteínas bajas en grasa y la receta tiene proteína alta en
 * grasa —por ejemplo salmón—, podemos compensar el exceso bajando un poco la
 * grasa pautada.»
 *
 * Antes se hacía al revés: el tope de grasa recortaba el salmón, y salían 60 g
 * donde tocaban 140. La comida se quedaba corta justo de lo que no puede
 * faltar, y había que corregir el gramaje a mano en cada receta.
 */

const salmon = FOOD_CATALOG.find((f) => /salm[oó]n/i.test(f.nombre))!;
const merluza = FOOD_CATALOG.find((f) => /merluza/i.test(f.nombre))!;
const aceite = FOOD_CATALOG.find((f) => f.nombre === 'Aceite de oliva virgen extra')!;
const arroz = FOOD_CATALOG.find((f) => f.nombre === 'Arroz blanco crudo')!;

const ing = (nombre: string, food: { id: string; grupo?: string }, c: number): Ingrediente =>
  ({
    id: `i-${nombre}`,
    nombre,
    foodId: food.id,
    cantidad_base: c,
    unidad: 'g',
    grupo: food.grupo,
    escalable: true,
    opcional: false,
  }) as Ingrediente;

const plato = (proteina: { id: string; grupo?: string }, gramos: number): Receta =>
  ({
    id: 'r',
    nombre: 'Plato',
    categorias: ['comida'],
    tags: [],
    base: {},
    ingredientes: [
      ing('Proteína', proteina, gramos),
      ing('Arroz', arroz, 20),
      ing('Aceite', aceite, 5),
    ],
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  }) as unknown as Receta;

const PAUTA: ExchangeCounts = { proteicos_magros: 4, almidones: 3, grasas: 3 };
const de = (e: ReturnType<typeof scaleRecipe>, nombre: string) =>
  e.ingredientes.find((i) => i.nombre === nombre)!.cantidad_final!;

describe('Con una proteína más grasa de la pautada', () => {
  const e = scaleRecipe(plato(salmon, 40), PAUTA, FOOD_CATALOG);

  it('la proteína cubre lo pautado y no se recorta', () => {
    // 4 porciones de salmón, no las 2 que cabían contando su grasa.
    expect(de(e, 'Proteína')).toBeGreaterThan(120);
  });

  it('y el aceite baja para compensar', () => {
    const magro = scaleRecipe(plato(merluza, 50), PAUTA, FOOD_CATALOG);
    expect(de(e, 'Aceite')).toBeLessThan(de(magro, 'Aceite'));
  });

  /* Callarlo sería esconder que el plato lleva más grasa de la pautada. */
  it('y se dice en las notas', () => {
    expect(e.notas.join(' ')).toMatch(/grasa de más|sobran/i);
  });
});

describe('Con una proteína magra no cambia nada', () => {
  it('el aceite se queda con lo suyo', () => {
    const e = scaleRecipe(plato(merluza, 50), PAUTA, FOOD_CATALOG);
    // 3 porciones de aceite: las pautadas, enteras.
    expect(de(e, 'Aceite')).toBeCloseTo(15, 0);
    expect(e.notas.join(' ')).not.toMatch(/grasa de más/i);
  });
});

describe('Cuando ni quitando el aceite cabe', () => {
  it('se dice cuánto sobra, en vez de recortar la proteína', () => {
    const e = scaleRecipe(plato(salmon, 40), { ...PAUTA, grasas: 1 }, FOOD_CATALOG);
    expect(de(e, 'Aceite')).toBe(0);
    expect(e.notas.join(' ')).toMatch(/sobran/i);
    expect(de(e, 'Proteína')).toBeGreaterThan(120);
  });
});
