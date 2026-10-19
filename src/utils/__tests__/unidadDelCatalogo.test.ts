import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { unidadDeIngrediente } from '../../types/food';
import type { Ingrediente, Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';

/**
 * EL CHOCOLATE NO SE MIDE EN MILILITROS
 *
 * Salía «11 ml de chocolate 85%». En el catálogo son gramos —es un sólido—
 * pero esa línea de la receta llevaba `ml` escrito a mano: el editor copia la
 * unidad del alimento al elegirlo, así que una línea escrita antes, o
 * duplicada de una de leche, se queda con la unidad vieja para siempre.
 *
 * La regla: con alimento del catálogo detrás, manda el catálogo. Y sólo para
 * `g` ↔ `ml`, que son las dos que el catálogo conoce.
 */

const CHOCOLATE: Alimento = {
  id: 'a-chocolate-85-cacao',
  nombre: 'Chocolate 85% cacao',
  grupo: 'grasas',
  medida_casera: '11 g',
  gramos: 11,
  intercambios: 1,
  nutrientes: { kcal: 576, hc: 22, proteina: 12, grasa: 46 },
  comidas_sugeridas: ['merienda'],
  alergenos: [],
  apto: [],
};

const LECHE: Alimento = {
  ...CHOCOLATE,
  id: 'a-leche-entera',
  nombre: 'Leche entera',
  grupo: 'lacteos_enteros',
  medida_casera: '1 vaso',
  gramos: 250,
  unidad: 'ml',
  nutrientes: { kcal: 64, hc: 4.8, proteina: 3.2, grasa: 3.6 },
};

const ARROZ: Alimento = {
  ...CHOCOLATE,
  id: 'a-arroz',
  nombre: 'Arroz blanco',
  grupo: 'almidones',
  medida_casera: '1/4 taza',
  gramos: 20,
  equivalencia_cocido: 55,
  nutrientes: { kcal: 350, hc: 78, proteina: 7, grasa: 0.6 },
};

describe('De quién es la unidad', () => {
  it('con alimento detrás, del alimento: el chocolate se pesa', () => {
    expect(unidadDeIngrediente('ml', CHOCOLATE)).toBe('g');
  });

  it('y si de verdad se mide, se mide: la leche sigue en ml', () => {
    expect(unidadDeIngrediente('g', LECHE)).toBe('ml');
  });

  /*
   * Lo que ella escribió con sentido propio no se toca: ahí la línea sabe algo
   * que el alimento no.
   */
  it('«g en crudo» se respeta tal cual', () => {
    expect(unidadDeIngrediente('g en crudo', ARROZ)).toBe('g en crudo');
  });

  it('y «uds» o «cdta» también', () => {
    expect(unidadDeIngrediente('uds', CHOCOLATE)).toBe('uds');
    expect(unidadDeIngrediente('cdta', LECHE)).toBe('cdta');
  });

  it('sin alimento detrás manda lo escrito, que es lo único que se sabe', () => {
    expect(unidadDeIngrediente('ml', undefined)).toBe('ml');
    expect(unidadDeIngrediente('', undefined)).toBe('g');
  });

  it('en blanco con alimento detrás, la del alimento', () => {
    expect(unidadDeIngrediente('', LECHE)).toBe('ml');
    expect(unidadDeIngrediente(undefined, CHOCOLATE)).toBe('g');
  });
});

/** Y lo que importa: que llegue a la línea que lee la clienta. */
describe('La receta ya escalada', () => {
  const receta: Receta = {
    id: 'r1',
    nombre: 'Yogur con chocolate',
    categorias: ['merienda'],
    tags: [],
    base: { grasas: 1, lacteos_enteros: 1 },
    ingredientes: [
      {
        id: 'i1',
        nombre: 'Chocolate 85% cacao',
        foodId: CHOCOLATE.id,
        cantidad_base: 11,
        // Lo que estaba mal en su receta.
        unidad: 'ml',
        grupo: 'grasas',
        escalable: true,
        opcional: false,
      } as Ingrediente,
      {
        id: 'i2',
        nombre: 'Leche entera',
        foodId: LECHE.id,
        cantidad_base: 250,
        unidad: 'g',
        grupo: 'lacteos_enteros',
        escalable: true,
        opcional: false,
      } as Ingrediente,
    ],
    preparacion: '',
    notas: '',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const escalada = scaleRecipe(receta, { grasas: 2, lacteos_enteros: 1 }, [CHOCOLATE, LECHE]);
  const linea = (nombre: string) => escalada.ingredientes.find((i) => i.nombre === nombre)!;

  it('el chocolate sale en gramos', () => {
    expect(linea('Chocolate 85% cacao').display).toMatch(/ g$/);
    expect(linea('Chocolate 85% cacao').display).not.toMatch(/ml/);
  });

  it('y la leche en mililitros, aunque la línea dijera gramos', () => {
    expect(linea('Leche entera').display).toMatch(/ml/);
  });

  it('la unidad corregida viaja con el ingrediente, no sólo en el texto', () => {
    expect(linea('Chocolate 85% cacao').unidad).toBe('g');
    expect(linea('Leche entera').unidad).toBe('ml');
  });
});
