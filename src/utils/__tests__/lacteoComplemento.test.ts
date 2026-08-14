import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { exchangesToMacros } from '../exchanges';
import { kcalFromMacros } from '../macros';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Ingrediente, Receta, RecipeBase } from '../../types/recipe';
import type { ExchangeCounts } from '../exchanges';

/**
 * EL LÁCTEO, SEGÚN SI SE PAUTÓ O NO
 *
 * Si el plan pauta un lácteo, cada uno cubre lo suyo: es el plato de pollo con
 * un yogur de postre, y ahí la proteína la pone el pollo.
 *
 * Si NO se pautó lácteo, los dos son fuentes de proteína y se reparten lo
 * pautado en la proporción que traiga la receta. Antes el proteico se estiraba
 * hasta cubrirlo todo él solo y el lácteo entraba con el sitio que sobrara: en
 * un bol de avena con yogur y whey eso daba 5 porciones de proteína donde
 * había 4 pautadas, y en un plato de pollo el yogur desaparecía del todo.
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

describe('Cuando sólo se pauta proteína, se la reparten', () => {
  it('el pollo y el yogur escalan a la vez, con el mismo factor', () => {
    const e = scaleRecipe(PLATO, { proteicos_magros: 4, almidones: 1 }, FOOD_CATALOG);
    expect(e.factores.lacteos_proteicos).toBeCloseTo(e.factores.proteicos_magros!, 5);
    expect(e.factores.proteicos_magros!).toBeGreaterThan(1.2);
  });

  it('el yogur ya no desaparece del plato', () => {
    const e = scaleRecipe(PLATO, { proteicos_magros: 4, almidones: 1 }, FOOD_CATALOG);
    expect(e.factores.lacteos_proteicos!).toBeGreaterThan(0);
    expect(de(e, 'Yogur').cantidad_final).toBeGreaterThan(0);
  });

  /**
   * Se quedan en 26 g y no en los 28 pautados porque el tope de calorías los
   * frena: el yogur arrastra 3 g de hidrato que una pechuga no tiene, así que
   * cubrir la proteína entera con esta mezcla costaría más de lo pautado. Es
   * la regla de siempre —en proteicos se miran grasa y calorías— y aquí actúa
   * a favor: antes esto se resolvía borrando el yogur del plato.
   */
  it('se acercan a la proteína pautada sin pasarse de calorías', () => {
    const e = scaleRecipe(PLATO, { proteicos_magros: 4, almidones: 1 }, FOOD_CATALOG);
    const deProteicos = exchangesToMacros({
      proteicos_magros: e.cubiertos.proteicos_magros ?? 0,
      lacteos_proteicos: e.cubiertos.lacteos_proteicos ?? 0,
    }).proteina;
    const pedida = exchangesToMacros({ proteicos_magros: 4 }).proteina; // 28 g
    expect(deProteicos).toBeGreaterThan(pedida * 0.9);
    expect(deProteicos).toBeLessThanOrEqual(pedida);
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
