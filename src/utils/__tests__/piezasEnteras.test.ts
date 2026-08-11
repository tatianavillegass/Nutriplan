import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { gramosPorPieza, redondearAPiezas } from '../measures';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Ingrediente, Receta, RecipeBase } from '../../types/recipe';

const huevo = FOOD_CATALOG.find((f) => f.id === 'a-huevo')!;
const pollo = FOOD_CATALOG.find((f) => f.nombre === 'Pechuga de pollo cruda')!;

const ing = (
  nombre: string,
  grupo: Ingrediente['grupo'],
  cantidad: number,
  foodId?: string,
): Ingrediente => ({
  id: `i-${nombre}`,
  nombre,
  foodId,
  cantidad_base: cantidad,
  unidad: 'g',
  grupo,
  escalable: true,
  opcional: false,
});

const receta = (base: RecipeBase, ingredientes: Ingrediente[]): Receta => ({
  id: 'r1',
  nombre: 'Prueba',
  categorias: ['comida'],
  tags: [],
  base,
  ingredientes,
  preparacion: '',
  notas: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const de = (e: ReturnType<typeof scaleRecipe>, nombre: string) =>
  e.ingredientes.find((i) => i.nombre === nombre)!;

describe('Qué se cuenta y qué se pesa', () => {
  it('el huevo se cuenta: 55 g la pieza', () => {
    expect(gramosPorPieza(huevo)).toBe(55);
  });

  it('las tortitas vienen de dos en dos: la pieza es la mitad', () => {
    const tortitas = FOOD_CATALOG.find((f) => f.id === 'a-tortitas-de-maiz')!;
    expect(gramosPorPieza(tortitas)).toBeCloseTo(8.5, 2);
  });

  it('lo que se pesa no tiene pieza', () => {
    expect(gramosPorPieza(pollo)).toBeUndefined();
    expect(gramosPorPieza({ medida_casera: '1/4 taza', gramos: 19 })).toBeUndefined();
    expect(gramosPorPieza({ medida_casera: 'Filete pequeño', gramos: 100 })).toBeUndefined();
  });

  it('redondear nunca deja el plato a cero', () => {
    expect(redondearAPiezas(20, 55)).toBe(55);
    expect(redondearAPiezas(80, 55)).toBe(55);
    expect(redondearAPiezas(90, 55)).toBe(110);
  });
});

describe('Nunca hay huevo y medio', () => {
  const tortilla = receta({ proteicos_grasos: 2, almidones: 1 }, [
    ing('Huevo', 'proteicos_grasos', 110, 'a-huevo'),
    ing('Pan', 'almidones', 20),
  ]);

  it('para 3 proteicos grasos salen 3 huevos, no 2,7', () => {
    const e = scaleRecipe(tortilla, { proteicos_grasos: 3, almidones: 1 }, FOOD_CATALOG);
    expect(de(e, 'Huevo').cantidad_final).toBe(165);
    // Tres huevos justos: 165 / 55. En pantalla salen los gramos, y las
    // piezas sólo si se pide la medida casera.
    expect(de(e, 'Huevo').display).toBe('165 g');
  });

  it('un intercambio y medio se resuelve en un huevo entero', () => {
    const e = scaleRecipe(tortilla, { proteicos_grasos: 1.5, almidones: 1 }, FOOD_CATALOG);
    const g = de(e, 'Huevo').cantidad_final!;
    expect(g % 55).toBe(0);
  });

  it('sin catálogo se comporta como antes: gramos redondos', () => {
    const e = scaleRecipe(tortilla, { proteicos_grasos: 3, almidones: 1 });
    expect(de(e, 'Huevo').cantidad_final).toBe(165);
    expect(de(e, 'Huevo').display).toBe('165 g');
  });

  it('lo que se pesa sigue pesándose', () => {
    const e = scaleRecipe(tortilla, { proteicos_grasos: 3, almidones: 2 }, FOOD_CATALOG);
    expect(de(e, 'Pan').cantidad_final).toBe(40);
  });
});
