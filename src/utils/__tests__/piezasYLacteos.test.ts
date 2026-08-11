import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { gramosPorPieza, redondearAPiezas } from '../measures';
import { exchangesToMacros } from '../exchanges';
import { kcalFromMacros } from '../macros';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Ingrediente, Receta, RecipeBase } from '../../types/recipe';
import type { ExchangeCounts } from '../exchanges';

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
    expect(de(e, 'Huevo').display).toMatch(/3 huevos/);
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

describe('El proteico manda y el lácteo acompaña', () => {
  // Pollo con un yogur de acompañamiento.
  const conYogur = receta({ proteicos_magros: 2, lacteos_proteicos: 1, almidones: 1 }, [
    ing('Pollo', 'proteicos_magros', 60, pollo.id),
    ing('Yogur', 'lacteos_proteicos', 150),
    ing('Arroz', 'almidones', 20),
  ]);

  it('el yogur se queda como está', () => {
    const e = scaleRecipe(conYogur, { proteicos_magros: 4, almidones: 1 }, FOOD_CATALOG);
    expect(e.factores.lacteos_proteicos).toBe(1);
    expect(de(e, 'Yogur').cantidad_final).toBe(150);
  });

  it('y es el pollo el que sube para cuadrar la proteína', () => {
    // 28 g pautados − 10 del yogur = 18 para el pollo, que trae 14 de base.
    const e = scaleRecipe(conYogur, { proteicos_magros: 4, almidones: 1 }, FOOD_CATALOG);
    expect(e.factores.proteicos_magros!).toBeGreaterThan(1);
    expect(de(e, 'Pollo').cantidad_final!).toBeGreaterThan(60);
  });

  it('cuando el lácteo ya cubre casi todo, al proteico le queda poco', () => {
    // 2 magros son 14 g de proteína y el yogur ya trae 10: sobran 4.
    const e = scaleRecipe(conYogur, { proteicos_magros: 2, almidones: 1 }, FOOD_CATALOG);
    expect(e.factores.lacteos_proteicos).toBe(1);
    expect(e.factores.proteicos_magros!).toBeLessThan(0.3);
    expect(e.factores.proteicos_magros!).toBeGreaterThan(0);
  });

  it('y si ni el lácteo solo cabe, se recorta también y se avisa', () => {
    const e = scaleRecipe(conYogur, { proteicos_magros: 1, almidones: 1 }, FOOD_CATALOG);
    expect(e.factores.proteicos_magros).toBe(0);
    expect(e.factores.lacteos_proteicos!).toBeLessThan(1);
    expect(e.notas.join(' ')).toMatch(/lácteo solo ya se pasa/i);
  });

  it('sin pasarse de las calorías pautadas', () => {
    const pautado: ExchangeCounts = { proteicos_magros: 4, almidones: 1 };
    const e = scaleRecipe(conYogur, pautado, FOOD_CATALOG);
    const counts: ExchangeCounts = {};
    for (const [g, v] of Object.entries(conYogur.base)) {
      if (v === 'ilimitado' || !v) continue;
      counts[g as keyof ExchangeCounts] = v * (e.factores[g as keyof ExchangeCounts] ?? 0);
    }
    const kcalPlan = kcalFromMacros(exchangesToMacros(pautado));
    expect(kcalFromMacros(exchangesToMacros(counts))).toBeLessThanOrEqual(kcalPlan + 0.001);
  });

  it('se explica quién ha cubierto qué', () => {
    const e = scaleRecipe(conYogur, { proteicos_magros: 4 }, FOOD_CATALOG);
    expect(e.notas.join(' ')).toMatch(/lácteo se queda como está/i);
  });

  it('un plato solo de lácteo sigue escalando con normalidad', () => {
    const soloYogur = receta({ lacteos_proteicos: 2 }, [ing('Yogur', 'lacteos_proteicos', 300)]);
    const e = scaleRecipe(soloYogur, { lacteos_proteicos: 1 }, FOOD_CATALOG);
    expect(e.factores.lacteos_proteicos).toBe(0.5);
  });
});
