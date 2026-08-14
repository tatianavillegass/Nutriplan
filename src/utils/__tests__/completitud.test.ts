import { describe, it, expect } from 'vitest';
import { estadoComida, huecos, TOLERANCIA_INT } from '../completitud';
import { scaleRecipe } from '../recipeScaling';
import { applyCustomization } from '../substitutions';
import { exchangesToMacros, type ExchangeCounts } from '../exchanges';
import { kcalFromMacros } from '../macros';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { SEED_RECIPES } from '../../data/seedRecipes';

const wok = SEED_RECIPES.find((r) => r.id === 'rc_wok_pollo')!;

describe('¿Está la comida completa?', () => {
  const pautado = { proteicos_magros: 5, almidones: 3, grasas: 2 } as const;

  it('lo pautado cubierto al detalle sale completo', () => {
    const r = estadoComida(pautado, pautado);
    expect(r.estado).toBe('completa');
    expect(r.cuadradas).toBe(r.total);
    expect(r.mensaje).toMatch(/completa/i);
  });

  it('sin nada en el plato, falta todo', () => {
    const r = estadoComida(pautado, {});
    expect(r.estado).toBe('incompleta');
    expect(r.cuadradas).toBe(0);
    expect(huecos(r).map((h) => h.familia).sort()).toEqual(['almidones', 'grasas', 'proteicos']);
  });

  it('dice cuánto falta, no sólo que falta', () => {
    const r = estadoComida(pautado, { proteicos_magros: 3, almidones: 3, grasas: 2 });
    const prot = r.filas.find((f) => f.familia === 'proteicos')!;
    expect(prot.falta).toBe(2);
    expect(prot.cubierto).toBe(3);
    expect(prot.pautado).toBe(5);
  });

  it('pasarse también se avisa, y no como si faltara', () => {
    const r = estadoComida(pautado, { proteicos_magros: 5, almidones: 5, grasas: 2 });
    expect(r.estado).toBe('excedida');
    expect(r.filas.find((f) => f.familia === 'almidones')!.estado).toBe('exceso');
    expect(r.mensaje).toMatch(/pasas/i);
  });

  it('las verduras no entran en la cuenta: son ilimitadas', () => {
    const r = estadoComida({ ...pautado, verduras: 3 }, { ...pautado, verduras: 99 });
    expect(r.filas.some((f) => f.familia === 'verduras')).toBe(false);
    expect(r.estado).toBe('completa');
  });
});

/**
 * SE COMPARA POR MACRO
 *
 * Lo que tiene que cuadrar son las porciones de proteína, carbohidrato y
 * grasa. De dónde salgan es cosa de la receta: si el desayuno pide un almidón
 * y la receta lo cubre con fruta, está cubierto. Antes esto daba dos avisos
 * falsos a la vez —«falta almidón» y «sobra fruta»— por los mismos 15 g de
 * hidrato.
 */
describe('Se compara por macro, no por familia ni subgrupo', () => {
  it('un proteico semigraso cubre el magro pautado', () => {
    const r = estadoComida({ proteicos_magros: 4 }, { proteicos_semigrasos: 4 });
    expect(r.estado).toBe('completa');
    expect(r.filas[0].cubiertoCon).toEqual(['proteicos_semigrasos']);
  });

  it('la fruta cubre un almidón: los dos son carbohidrato', () => {
    const r = estadoComida({ almidones: 2 }, { fruta: 2 });
    expect(r.estado).toBe('completa');
    expect(huecos(r)).toEqual([]);
  });

  it('y al revés: un almidón cubre la fruta pautada', () => {
    const r = estadoComida({ fruta: 1, almidones: 1 }, { almidones: 2 });
    expect(r.estado).toBe('completa');
  });

  it('el carbohidrato se cuenta junto, venga de donde venga', () => {
    // 1 almidón + 1 fruta pautados = 29 g de hidrato ≈ 2 porciones.
    const r = estadoComida({ almidones: 1, fruta: 1 }, { almidones: 1, fruta: 1 });
    const carbo = r.filas.find((f) => f.bucket === 'carbohidrato')!;
    expect(carbo.pautado).toBe(2);
    expect(carbo.cubierto).toBe(2);
  });

  it('lo que sí falta de verdad es un macro que no está', () => {
    const r = estadoComida({ almidones: 2, proteicos_magros: 2 }, { almidones: 2 });
    expect(r.estado).toBe('incompleta');
    expect(huecos(r).map((h) => h.bucket)).toEqual(['proteina']);
  });

  it('la cuenta se lleva en el macro ancla, no en el número de porciones', () => {
    // Un lácteo entero son 8 g de proteína: 2 cubren 16 g, más que los 14
    // pautados en proteicos magros.
    const r = estadoComida({ proteicos_magros: 2 }, { lacteos_enteros: 2 });
    const fila = r.filas[0];
    expect(fila.pautado).toBe(2);
    expect(fila.cubierto).toBeGreaterThan(2);
    expect(fila.estado).toBe('exceso');
  });

  /**
   * El lácteo proteico se igualó a 7 g de proteína justamente para esto: que
   * cambiarlo por un proteico magro no mueva la cuenta.
   */
  it('un lácteo proteico y un proteico magro se cambian 1:1', () => {
    const r = estadoComida({ proteicos_magros: 2 }, { lacteos_proteicos: 2 });
    expect(r.filas[0].cubierto).toBeCloseTo(2, 5);
    expect(r.estado).toBe('completa');
  });
});

describe('Tolerancia', () => {
  it('una diferencia de redondeo no marca la comida en rojo', () => {
    const r = estadoComida({ grasas: 2 }, { grasas: 2 - TOLERANCIA_INT / 2 });
    expect(r.estado).toBe('completa');
  });

  it('media porción sí se avisa', () => {
    const r = estadoComida({ grasas: 2 }, { grasas: 1.5 });
    expect(r.estado).toBe('incompleta');
  });
});

describe('Comida sin nada pautado', () => {
  it('no inventa un estado: no hay nada contra lo que medir', () => {
    const r = estadoComida({}, {});
    expect(r.estado).toBe('sin_pauta');
    expect(r.filas).toEqual([]);
  });
});

describe('Enganche con el escalado real', () => {
  const pautado = { proteicos_magros: 5, almidones: 3, grasas: 2, fruta: 1 } as const;

  /**
   * El wok no trae fruta, pero sí almidón, y el escalado le da el hidrato de
   * los dos. Contando por macro el carbohidrato queda cubierto: a la clienta
   * no se le dice que le falta nada, porque no le falta.
   */
  it('la receta cubre el carbohidrato aunque no traiga fruta', () => {
    const esc = scaleRecipe(wok, pautado, FOOD_CATALOG);
    const r = estadoComida(pautado, esc.cubiertos);

    // De macros la comida cuadra: el almidón lleva el hidrato de la fruta.
    expect(r.estado).toBe('completa');
    expect(huecos(r)).toEqual([]);
    expect(esc.gruposSinCubrir).toEqual([]);
    // Pero a quien pauta se le dice con qué lo ha cubierto.
    expect(esc.notas.join(' ')).toMatch(/fruta/i);
  });

  it('`cubiertos` es la base por el factor, no lo pautado copiado', () => {
    const esc = scaleRecipe(wok, { proteicos_magros: 5, almidones: 3, grasas: 2 }, FOOD_CATALOG);
    expect(esc.cubiertos.proteicos_magros).toBeCloseTo(5, 5);
    expect(esc.cubiertos.almidones).toBeCloseTo(3, 5);
    expect(esc.cubiertos.grasas).toBeCloseTo(2, 5);
  });

  /**
   * La barra de macros pasó a mostrar lo que hay en el plato en vez de lo
   * pautado. Con una receta que encaja no puede notarse la diferencia: si
   * este test se pone rojo, es que la barra ha empezado a derivar.
   */
  it('ninguna receta semilla deriva respecto a su propia pauta', () => {
    const problemas: string[] = [];

    for (const r of SEED_RECIPES) {
      const req: ExchangeCounts = {};
      for (const [g, v] of Object.entries(r.base)) {
        if (v !== 'ilimitado' && v) req[g as keyof ExchangeCounts] = v;
      }
      if (!Object.keys(req).length) continue;

      const esc = scaleRecipe(r, req, FOOD_CATALOG);
      const out = applyCustomization(esc, req, { quitados: [], sustituciones: {} }, FOOD_CATALOG);
      const kPauta = kcalFromMacros(exchangesToMacros(req));
      const kPlato = kcalFromMacros(exchangesToMacros(out.enPlato));
      const st = estadoComida(req, out.enPlato).estado;

      if (Math.abs(kPauta - kPlato) > 1 || st !== 'completa') {
        problemas.push(`${r.nombre}: ${kPauta.toFixed(0)} vs ${kPlato.toFixed(0)} kcal → ${st}`);
      }
    }

    expect(problemas).toEqual([]);
  });
});
