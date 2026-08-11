import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { exchangesToMacros } from '../exchanges';
import { kcalFromMacros } from '../macros';
import type { Ingrediente, Receta, RecipeBase } from '../../types/recipe';
import type { ExchangeCounts, } from '../exchanges';

/**
 * LA RECETA SE ADAPTA A LO PAUTADO, POR FAMILIA
 *
 * Es la misma regla de la fase 3 traída a las recetas: lo que se compara no
 * es subgrupo contra subgrupo, sino familia contra familia. Si el plan pauta
 * una grasa y la receta lleva nueces, las nueces SON esa grasa.
 */

const ing = (nombre: string, grupo: Ingrediente['grupo'], cantidad: number): Ingrediente => ({
  id: `i-${nombre}`,
  nombre,
  cantidad_base: cantidad,
  unidad: 'g',
  grupo,
  escalable: true,
  opcional: false,
});

const receta = (base: RecipeBase, ingredientes: Ingrediente[]): Receta => ({
  id: 'r1',
  nombre: 'Prueba',
  categorias: ['desayuno'],
  tags: [],
  base,
  ingredientes,
  preparacion: '',
  notas: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const gramos = (e: ReturnType<typeof scaleRecipe>, nombre: string) =>
  e.ingredientes.find((i) => i.nombre === nombre)!.cantidad_final;

/** Lo que acaba costando la receta ya escalada, en kcal. */
const kcalDe = (base: RecipeBase, factores: Record<string, number | undefined>) => {
  const counts: ExchangeCounts = {};
  for (const [g, v] of Object.entries(base)) {
    if (v === 'ilimitado' || !v) continue;
    counts[g as keyof ExchangeCounts] = v * (factores[g] ?? 0);
  }
  return kcalFromMacros(exchangesToMacros(counts));
};

describe('Los frutos secos cuentan como la grasa pautada', () => {
  const conNueces = receta({ frutos_secos: 1, almidones: 1 }, [
    ing('Nueces', 'frutos_secos', 20),
    ing('Avena', 'almidones', 20),
  ]);

  it('el plan pauta aceite y la receta lleva nueces: se quedan', () => {
    // Antes el factor salía 0 y las nueces desaparecían del plato.
    const e = scaleRecipe(conNueces, { grasas: 1, almidones: 2 });
    expect(e.factores.frutos_secos).toBe(1);
    expect(gramos(e, 'Nueces')).toBe(20);
  });

  it('con 2 grasas pautadas se dobla la ración de nueces', () => {
    const e = scaleRecipe(conNueces, { grasas: 2, almidones: 2 });
    expect(e.factores.frutos_secos).toBe(2);
    expect(gramos(e, 'Nueces')).toBe(40);
  });

  it('y el almidón sigue escalando por su cuenta', () => {
    const e = scaleRecipe(conNueces, { grasas: 1, almidones: 3 });
    expect(e.factores.almidones).toBe(3);
    expect(e.factores.frutos_secos).toBe(1);
  });

  it('se explica que la grasa la cubren los frutos secos', () => {
    const e = scaleRecipe(conNueces, { grasas: 1, almidones: 1 });
    expect(e.notas.join(' ')).toMatch(/frutos secos/i);
  });

  it('sin grasa pautada de ninguna clase, no hay grasa que repartir', () => {
    const e = scaleRecipe(conNueces, { almidones: 1 });
    expect(e.factores.frutos_secos).toBe(0);
  });

  it('al revés también: pauta nueces y la receta lleva aceite', () => {
    const conAceite = receta({ grasas: 1 }, [ing('Aceite', 'grasas', 10)]);
    const e = scaleRecipe(conAceite, { frutos_secos: 1 });
    // 5 g de grasa en los dos casos: una porción de aceite.
    expect(e.factores.grasas).toBe(1);
    expect(gramos(e, 'Aceite')).toBe(10);
  });
});

describe('Dos magros pueden cubrir un graso y un magro', () => {
  const dosMagros = receta({ proteicos_magros: 2, almidones: 1 }, [
    ing('Pollo', 'proteicos_magros', 60),
    ing('Arroz', 'almidones', 20),
  ]);

  it('cuadra la proteína y no toca el gramaje', () => {
    const e = scaleRecipe(dosMagros, { proteicos_grasos: 1, proteicos_magros: 1, almidones: 1 });
    // 14 g de proteína pautados, 14 en la receta.
    expect(e.factores.proteicos_magros).toBe(1);
    expect(gramos(e, 'Pollo')).toBe(60);
  });

  it('y no se pasa ni de grasa ni de calorías', () => {
    const pautado: ExchangeCounts = { proteicos_grasos: 1, proteicos_magros: 1, almidones: 1 };
    const e = scaleRecipe(dosMagros, pautado);
    const kcalPlan = kcalFromMacros(exchangesToMacros(pautado));
    expect(kcalDe(dosMagros.base, e.factores)).toBeLessThanOrEqual(kcalPlan + 0.001);
  });

  it('lo dice, para que se vea qué ha cubierto qué', () => {
    const e = scaleRecipe(dosMagros, { proteicos_grasos: 1, proteicos_magros: 1 });
    expect(e.notas.join(' ')).toMatch(/proteicos grasos/i);
  });
});

describe('El yogur proteico también sirve de proteína', () => {
  const conYogur = receta({ lacteos_proteicos: 2 }, [ing('Yogur proteico', 'lacteos_proteicos', 300)]);

  it('cubre lo pautado ajustando por la proteína', () => {
    const e = scaleRecipe(conYogur, { proteicos_grasos: 1, proteicos_magros: 1 });
    // 14 g pautados / 20 g de la receta = 0.7
    expect(e.factores.lacteos_proteicos).toBeCloseTo(0.7, 3);
  });

  it('sin pasarse de las calorías pautadas', () => {
    const pautado: ExchangeCounts = { proteicos_grasos: 1, proteicos_magros: 1 };
    const e = scaleRecipe(conYogur, pautado);
    const kcalPlan = kcalFromMacros(exchangesToMacros(pautado));
    expect(kcalDe(conYogur.base, e.factores)).toBeLessThanOrEqual(kcalPlan + 0.001);
  });
});

describe('Lo que sí se recorta', () => {
  it('un lácteo entero donde había magros se ajusta por la grasa', () => {
    const conEnteros = receta({ lacteos_enteros: 2 }, [ing('Leche entera', 'lacteos_enteros', 400)]);
    const pautado: ExchangeCounts = { proteicos_magros: 2 };
    const e = scaleRecipe(conEnteros, pautado);

    // 1 g de grasa pautada frente a los 16 g de la receta: hay que recortar.
    expect(e.factores.lacteos_enteros!).toBeLessThan(0.5);
    expect(e.notas.join(' ')).toMatch(/recortado/i);
    const kcalPlan = kcalFromMacros(exchangesToMacros(pautado));
    expect(kcalDe(conEnteros.base, e.factores)).toBeLessThanOrEqual(kcalPlan + 0.001);
  });

  it('un lácteo desnatado se frena por las calorías, no por la grasa', () => {
    // No tiene grasa que lo limite, pero arrastra hidratos que un filete no.
    const conDesnatados = receta({ lacteos_desnatados: 3 }, [ing('Leche', 'lacteos_desnatados', 600)]);
    const pautado: ExchangeCounts = { proteicos_grasos: 1, proteicos_magros: 1 };
    const e = scaleRecipe(conDesnatados, pautado);
    const kcalPlan = kcalFromMacros(exchangesToMacros(pautado));
    expect(kcalDe(conDesnatados.base, e.factores)).toBeLessThanOrEqual(kcalPlan + 0.001);
  });
});

describe('Lo de siempre no cambia', () => {
  const clasica = receta({ proteicos_magros: 1, almidones: 1, grasas: 1 }, [
    ing('Pollo', 'proteicos_magros', 30),
    ing('Arroz', 'almidones', 20),
    ing('Aceite', 'grasas', 5),
  ]);

  it('cuando los subgrupos coinciden, el factor es el de toda la vida', () => {
    const e = scaleRecipe(clasica, { proteicos_magros: 5, almidones: 3, grasas: 2 });
    expect(e.factores.proteicos_magros).toBe(5);
    expect(e.factores.almidones).toBe(3);
    expect(e.factores.grasas).toBe(2);
    expect(e.notas).toEqual([]);
  });

  it('una familia que la receta no trae sigue avisando', () => {
    const e = scaleRecipe(clasica, { proteicos_magros: 2, fruta: 1 });
    expect(e.gruposSinCubrir).toContain('fruta');
  });

  it('pero un subgrupo distinto de la misma familia ya no cuenta como sin cubrir', () => {
    const e = scaleRecipe(clasica, { proteicos_semigrasos: 2, almidones: 1, grasas: 1 });
    expect(e.gruposSinCubrir).not.toContain('proteicos_semigrasos');
  });
});
