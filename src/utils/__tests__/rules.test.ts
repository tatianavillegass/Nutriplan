import { describe, it, expect } from 'vitest';
import { scaleRecipe, canRemoveIngredient } from '../recipeScaling';
import { applyCustomization, findFood } from '../substitutions';
import { matchRecipes } from '../recipeMatcher';
import { exchangesToMacros, bucketExchanges, gridTotals } from '../exchanges';
import { kcalFromMacros } from '../macros';
import { SEED_RECIPES } from '../../data/seedRecipes';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { EXCHANGE_GROUP_LIST } from '../../data/exchangeGroups';
import type { ExchangeGrid, Meal } from '../../types/plan';

const wok = SEED_RECIPES.find((r) => r.id === 'rc_wok_pollo')!;

describe('Escalado proporcional por grupo (§5)', () => {
  // base 1P + 1A + 1G · cliente necesita 5P + 3A + 2G
  const esc = scaleRecipe(wok, { proteicos_magros: 5, almidones: 3, grasas: 2 });
  const byName = (n: string) => esc.ingredientes.find((i) => i.nombre === n)!;

  it('el ejemplo del brief: pollo 150 g · arroz 60 g · aceite 10 g', () => {
    expect(byName('Pechuga de pollo').cantidad_final).toBe(150); // 30 × 5
    expect(byName('Arroz').cantidad_final).toBe(60); //             20 × 3
    expect(byName('Aceite de oliva').cantidad_final).toBe(10); //    5 × 2
  });

  it('cada grupo escala con SU factor, no con uno global', () => {
    expect(esc.factores.proteicos_magros).toBe(5);
    expect(esc.factores.almidones).toBe(3);
    expect(esc.factores.grasas).toBe(2);
  });

  it('las verduras no escalan y se muestran como ilimitadas', () => {
    expect(byName('Brócoli').display).toMatch(/al gusto/);
    expect(byName('Brócoli').display).toMatch(/200 g/);
  });

  it('avisa de los grupos que la receta no cubre', () => {
    const e = scaleRecipe(wok, { proteicos_magros: 2, fruta: 1 });
    expect(e.gruposSinCubrir).toContain('fruta');
  });

  it('con medios intercambios el gramaje sigue la regla de redondeo', () => {
    const e = scaleRecipe(wok, { proteicos_magros: 5.5, almidones: 3, grasas: 1 });
    // 30 × 5.5 = 165 → múltiplo de 5
    expect(e.ingredientes.find((i) => i.nombre === 'Pechuga de pollo')!.cantidad_final).toBe(165);
    // 5 × 1 = 5 → por debajo de 20 g se redondea a 1 g
    expect(e.ingredientes.find((i) => i.nombre === 'Aceite de oliva')!.cantidad_final).toBe(5);
  });
});

describe('Reglas de edición del cliente (§5)', () => {
  const esc = scaleRecipe(wok, { proteicos_magros: 5, almidones: 3, grasas: 2 });
  const ing = (n: string) => esc.ingredientes.find((i) => i.nombre === n)!;

  it('quitar una verdura o un condimento está permitido', () => {
    expect(canRemoveIngredient(ing('Brócoli')).allowed).toBe(true);
    expect(canRemoveIngredient(ing('Salsa de soja')).allowed).toBe(true);
  });

  it('quitar un ingrediente escalable está bloqueado con su motivo', () => {
    const r = canRemoveIngredient(ing('Arroz'));
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/composición de tu plan/i);
  });

  it('el motor ignora un intento de quitar un ingrediente bloqueado', () => {
    const req = { proteicos_magros: 5, almidones: 3, grasas: 2 };
    const out = applyCustomization(
      esc,
      req,
      { quitados: [ing('Arroz').id, ing('Brócoli').id], sustituciones: {} },
      FOOD_CATALOG,
    );
    expect(out.ingredientes.some((i) => i.nombre === 'Arroz')).toBe(true);
    expect(out.ingredientes.some((i) => i.nombre === 'Brócoli')).toBe(false);
    // Quitar verdura no toca macros.
    expect(out.exchangesDespues).toEqual(req);
  });
});

describe('Sustituciones trazables al catálogo (§5, §10.6)', () => {
  it('resuelve el sustituto contra el catálogo aunque el nombre sea parcial', () => {
    expect(findFood('Pavo', FOOD_CATALOG)?.nombre).toBe('Pechuga de pavo');
    expect(findFood('Aguacate', FOOD_CATALOG)?.nombre).toBe('Aguacate hass');
  });

  it('recalcula el gramaje según los gramos por intercambio del sustituto', () => {
    const esc = scaleRecipe(wok, { proteicos_magros: 5, almidones: 3, grasas: 2 });
    const pollo = esc.ingredientes.find((i) => i.nombre === 'Pechuga de pollo')!;
    const out = applyCustomization(
      esc,
      { proteicos_magros: 5, almidones: 3, grasas: 2 },
      { quitados: [], sustituciones: { [pollo.id]: 'Merluza' } },
      FOOD_CATALOG,
    );
    // Merluza: 35 g = 1 intercambio → 5 intercambios = 175 g
    expect(out.ingredientes.find((i) => i.nombre === 'Merluza')!.cantidad_final).toBe(175);
  });

  it('una sustitución dentro del mismo grupo NO altera los macros (§10.4)', () => {
    const req = { proteicos_magros: 5, almidones: 3, grasas: 2 };
    const esc = scaleRecipe(wok, req);
    const arroz = esc.ingredientes.find((i) => i.nombre === 'Arroz')!;
    const out = applyCustomization(
      esc,
      req,
      { quitados: [], sustituciones: { [arroz.id]: 'Quinoa' } },
      FOOD_CATALOG,
    );
    expect(out.exchangesDespues).toEqual(req);
    expect(exchangesToMacros(out.exchangesDespues)).toEqual(exchangesToMacros(req));
    // Quinoa: 20 g crudo por intercambio → 3 intercambios = 60 g
    expect(out.ingredientes.find((i) => i.nombre === 'Quinoa')!.cantidad_final).toBe(60);
  });

  it('un sustituto de otro grupo mueve el intercambio y genera aviso', () => {
    const req = { proteicos_magros: 5, almidones: 3, grasas: 2 };
    const esc = scaleRecipe(wok, req);
    const pollo = esc.ingredientes.find((i) => i.nombre === 'Pechuga de pollo')!;
    const out = applyCustomization(
      esc,
      req,
      { quitados: [], sustituciones: { [pollo.id]: 'Tofu firme' } },
      FOOD_CATALOG,
    );
    expect(out.exchangesDespues.proteicos_magros).toBeUndefined();
    expect(out.exchangesDespues.proteicos_semigrasos).toBe(5);
    expect(out.avisos.length).toBe(1);
    // magro 0.5 g grasa vs semigraso 2 g → +7.5 g de grasa
    const antes = exchangesToMacros(req);
    const despues = exchangesToMacros(out.exchangesDespues);
    expect(despues.grasa - antes.grasa).toBeCloseTo(7.5, 4);
    expect(despues.proteina).toBeCloseTo(antes.proteina, 4);
  });

  it('un sustituto que no está en el catálogo conserva el gramaje original', () => {
    const req = { proteicos_grasos: 4, almidones: 2 };
    const bowl = SEED_RECIPES.find((r) => r.id === 'rc_bowl_salmon')!;
    const esc = scaleRecipe(bowl, req);
    const salmon = esc.ingredientes.find((i) => i.nombre === 'Salmón')!;
    const out = applyCustomization(
      esc,
      req,
      { quitados: [], sustituciones: { [salmon.id]: 'Caballa' } },
      FOOD_CATALOG,
    );
    const nuevo = out.ingredientes.find((i) => i.nombre === 'Caballa')!;
    expect(nuevo.cantidad_final).toBe(salmon.cantidad_final);
    expect(out.exchangesDespues).toEqual(req);
  });
});

describe('Recomendador de recetas (§5)', () => {
  it('devuelve como máximo 4 y prioriza la categoría de la comida', () => {
    const s = matchRecipes(
      SEED_RECIPES,
      { proteicos_magros: 5, almidones: 3, grasas: 2 },
      { slot: 'comida', limite: 4 },
    );
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(4);
    expect(s[0].receta.categorias).toContain('comida');
  });

  it('penaliza recetas ya asignadas esa semana (variedad)', () => {
    const base = matchRecipes(SEED_RECIPES, { proteicos_magros: 5, almidones: 3, grasas: 2 }, {
      slot: 'comida',
      limite: 4,
    });
    const top = base[0].receta.id;
    const conVariedad = matchRecipes(
      SEED_RECIPES,
      { proteicos_magros: 5, almidones: 3, grasas: 2 },
      { slot: 'comida', limite: 4, yaAsignadas: [top] },
    );
    expect(conVariedad[0].receta.id).not.toBe(top);
  });
});

describe('Cambio de fase y trazabilidad (§10.5, §10.6)', () => {
  const meals: Meal[] = [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 3 },
  ];
  const grid: ExchangeGrid = {
    desayuno: { proteicos_magros: 2, almidones: 3, grasas: 1 },
    comida: { proteicos_magros: 5, almidones: 3, grasas: 2, verduras: 2 },
    cena: { proteicos_semigrasos: 3, almidones: 2, grasas: 1, verduras: 2 },
  };

  it('el esquema de Fase 2 se deriva de la MISMA grilla que usa Fase 1', () => {
    // Fase 2: "Desayuno → Proteína 2 · Carbohidrato 3 · Grasa 1"
    expect(bucketExchanges(grid.desayuno!)).toEqual({ proteina: 2, carbohidrato: 3, grasa: 1 });
    // Fase 1: la comida escala la receta con esos mismos intercambios.
    const esc = scaleRecipe(wok, grid.comida!);
    expect(esc.ingredientes.find((i) => i.nombre === 'Pechuga de pollo')!.cantidad_final).toBe(150);
  });

  it('cambiar de fase no altera los totales del día', () => {
    const totales = gridTotals(grid, meals);
    const macros = exchangesToMacros(totales);
    // Recalcular desde la tabla de intercambios da exactamente lo mismo.
    const manual = EXCHANGE_GROUP_LIST.reduce(
      (acc, g) => {
        const n = totales[g.id] ?? 0;
        return {
          proteina: acc.proteina + n * g.proteina,
          hc: acc.hc + n * g.hc,
          grasa: acc.grasa + n * g.grasa,
        };
      },
      { proteina: 0, hc: 0, grasa: 0 },
    );
    expect(macros).toEqual(manual);
    expect(kcalFromMacros(macros)).toBeCloseTo(
      macros.hc * 4 + macros.proteina * 4 + macros.grasa * 9,
      6,
    );
  });

  it('las verduras cuentan en macros pero no en el esquema de porciones', () => {
    const b = bucketExchanges(grid.comida!);
    expect(b.carbohidrato).toBe(3); // sólo almidones, las 2 de verdura no suman
    expect(exchangesToMacros(grid.comida!).hc).toBeCloseTo(3 * 14 + 2 * 4, 4);
  });
});

describe('Catálogo de alimentos (§7)', () => {
  it('todo alimento declara grupo, medida casera, gramos e intercambios', () => {
    for (const f of FOOD_CATALOG) {
      expect(f.intercambios).toBeGreaterThan(0);
      expect(f.gramos).toBeGreaterThan(0);
      expect(f.medida_casera.length).toBeGreaterThan(0);
      expect(EXCHANGE_GROUP_LIST.some((g) => g.id === f.grupo)).toBe(true);
      expect(f.comidas_sugeridas.length).toBeGreaterThan(0);
    }
  });

  it('no hay ids duplicados', () => {
    const ids = FOOD_CATALOG.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada comida del esquema tiene opciones de los tres buckets', () => {
    for (const slot of ['desayuno', 'comida', 'cena', 'merienda'] as const) {
      const buckets = new Set(
        FOOD_CATALOG.filter((f) => f.comidas_sugeridas.includes(slot))
          .map((f) => EXCHANGE_GROUP_LIST.find((g) => g.id === f.grupo)!)
          .filter((g) => !g.ilimitado)
          .map((g) => g.bucket),
      );
      expect(buckets).toContain('proteina');
      expect(buckets).toContain('carbohidrato');
      expect(buckets).toContain('grasa');
    }
  });
});
