import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { exchangesToMacros } from '../exchanges';
import { kcalFromMacros } from '../macros';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Ingrediente, Receta, RecipeBase } from '../../types/recipe';
import type { ExchangeCounts } from '../exchanges';

/**
 * EL LÁCTEO ES COMPLEMENTO, NUNCA LA PROTEÍNA DEL PLATO
 *
 * En un plato con pollo y un yogur, la proteína pautada la pone el pollo. El
 * yogur sólo cubre el lácteo que esté pautado; si no hay ninguno, entra con
 * el sitio que sobre. Lo que se recorta cuando no cuadra es el yogur.
 */

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
  nombre: 'Pollo con yogur',
  categorias: ['comida'],
  tags: [],
  base,
  ingredientes,
  preparacion: '',
  notas: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const PLATO = receta({ proteicos_magros: 2, lacteos_proteicos: 1, almidones: 1 }, [
  ing('Pollo', 'proteicos_magros', 60, pollo.id),
  ing('Yogur', 'lacteos_proteicos', 150),
  ing('Arroz', 'almidones', 20),
]);

const de = (e: ReturnType<typeof scaleRecipe>, nombre: string) =>
  e.ingredientes.find((i) => i.nombre === nombre)!;

const kcalDe = (base: RecipeBase, factores: Record<string, number | undefined>) => {
  const counts: ExchangeCounts = {};
  for (const [g, v] of Object.entries(base)) {
    if (v === 'ilimitado' || !v) continue;
    counts[g as keyof ExchangeCounts] = v * (factores[g] ?? 0);
  }
  return kcalFromMacros(exchangesToMacros(counts));
};

describe('Cuando el lácteo también está pautado', () => {
  const pautado: ExchangeCounts = {
    proteicos_magros: 2,
    lacteos_proteicos: 1,
    almidones: 1,
  };

  it('cada uno cubre lo suyo y no se toca nada', () => {
    const e = scaleRecipe(PLATO, pautado, FOOD_CATALOG);
    expect(e.factores.proteicos_magros).toBeCloseTo(1, 3);
    expect(e.factores.lacteos_proteicos).toBeCloseTo(1, 3);
    expect(de(e, 'Pollo').cantidad_final).toBe(60);
    expect(de(e, 'Yogur').cantidad_final).toBe(150);
  });

  it('con el doble pautado, el pollo dobla y el yogur también', () => {
    const e = scaleRecipe(
      PLATO,
      { proteicos_magros: 4, lacteos_proteicos: 2, almidones: 1 },
      FOOD_CATALOG,
    );
    expect(e.factores.proteicos_magros).toBeCloseTo(2, 3);
    expect(e.factores.lacteos_proteicos).toBeCloseTo(2, 3);
  });
});

describe('Cuando sólo se pauta proteína', () => {
  it('la proteína la cubre entera el pollo, no el yogur', () => {
    const e = scaleRecipe(PLATO, { proteicos_magros: 4, almidones: 1 }, FOOD_CATALOG);
    // 28 g de proteína pautados / 14 g del pollo en la receta.
    expect(e.factores.proteicos_magros).toBeCloseTo(2, 3);
    expect(de(e, 'Pollo').cantidad_final).toBe(120);
  });

  it('y el yogur sale del plato, porque no hay sitio para él', () => {
    const e = scaleRecipe(PLATO, { proteicos_magros: 4, almidones: 1 }, FOOD_CATALOG);
    expect(e.factores.lacteos_proteicos).toBe(0);
    expect(e.notas.join(' ')).toMatch(/no queda sitio/i);
  });

  it('nunca se pasa de lo pautado', () => {
    const pautado: ExchangeCounts = { proteicos_magros: 4, almidones: 1 };
    const e = scaleRecipe(PLATO, pautado, FOOD_CATALOG);
    const kcalPlan = kcalFromMacros(exchangesToMacros(pautado));
    expect(kcalDe(PLATO.base, e.factores)).toBeLessThanOrEqual(kcalPlan + 0.001);
  });
});

describe('Un plato sin proteico: ahí el lácteo sí es la proteína', () => {
  const soloYogur = receta({ lacteos_proteicos: 2, almidones: 1 }, [
    ing('Yogur', 'lacteos_proteicos', 300),
    ing('Avena', 'almidones', 20),
  ]);

  it('escala con normalidad, sin reglas raras', () => {
    const e = scaleRecipe(soloYogur, { lacteos_proteicos: 1, almidones: 1 }, FOOD_CATALOG);
    expect(e.factores.lacteos_proteicos).toBe(0.5);
  });

  it('y también cubre unos proteicos pautados, como cualquier otro de su familia', () => {
    const e = scaleRecipe(soloYogur, { proteicos_magros: 2, almidones: 1 }, FOOD_CATALOG);
    expect(e.factores.lacteos_proteicos!).toBeGreaterThan(0);
  });
});
