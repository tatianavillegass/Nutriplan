import { describe, it, expect } from 'vitest';
import {
  aporteAnadidos,
  alternarCuenta,
  buscarParaAnadir,
  crearAnadido,
  esLibre,
  opcionesParaGrupo,
  sumarIntercambios,
  verdurasLibres,
} from '../anadidos';
import { estadoComida, huecos } from '../completitud';
import { scaleRecipe } from '../recipeScaling';
import { applyCustomization } from '../substitutions';
import { exchangesToMacros } from '../exchanges';
import { kcalFromMacros } from '../macros';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { SEED_RECIPES } from '../../data/seedRecipes';

const foods = FOOD_CATALOG;
const porNombre = (n: string) => foods.find((f) => f.nombre === n)!;
const wok = SEED_RECIPES.find((r) => r.id === 'rc_wok_pollo')!;

describe('Verduras libres (§10.1)', () => {
  it('el catálogo trae espinaca y tomate', () => {
    const lista = verdurasLibres(foods);
    expect(lista.map((o) => o.food.nombre)).toEqual(
      expect.arrayContaining(['Espinaca', 'Tomate']),
    );
  });

  it('van al gusto y no gastan intercambios', () => {
    const espinaca = verdurasLibres(foods, 'espinaca')[0];
    expect(espinaca.libre).toBe(true);
    expect(espinaca.intercambios).toBe(0);
    expect(espinaca.cantidad).toBeNull();
  });

  it('una verdura añadida no mueve ni un macro', () => {
    const a = crearAnadido(porNombre('Tomate'), 3, true);
    expect(a.grupo).toBeUndefined();
    expect(a.cuenta).toBe(false); // ni aunque se pida que cuente
    expect(aporteAnadidos([a])).toEqual({ cuenta: {}, extra: {} });
  });

  it('el buscador filtra sin tildes', () => {
    expect(verdurasLibres(foods, 'espinacas').length).toBeGreaterThan(0);
  });
});

describe('Completar lo pautado con su gramaje', () => {
  it('el gramaje sale de la tabla de intercambios, no a ojo', () => {
    // El melón es 1 intercambio por 185 g → media fruta son ~90 g.
    const opciones = opcionesParaGrupo('fruta', 1, foods, 'melón');
    expect(opciones[0].cantidad).toBe(porNombre('Melón').gramos);

    const media = opcionesParaGrupo('fruta', 0.5, foods, 'melón')[0];
    expect(media.cantidad).toBeLessThan(opciones[0].cantidad!);
  });

  it('sólo ofrece alimentos del grupo que falta', () => {
    const opciones = opcionesParaGrupo('fruta', 1, foods);
    expect(opciones.length).toBeGreaterThan(0);
    expect(opciones.every((o) => o.food.grupo === 'fruta')).toBe(true);
  });

  it('lo añadido para completar cuenta en el plan', () => {
    const a = crearAnadido(porNombre('Melón'), 1, true);
    expect(a.cuenta).toBe(true);
    expect(aporteAnadidos([a]).cuenta).toEqual({ fruta: 1 });
  });
});

describe('Extras: cuenta en el plan o va por encima', () => {
  const leche = porNombre('Leche semidesnatada');

  it('la leche del café es un lácteo de verdad, no un alimento libre', () => {
    expect(esLibre(leche)).toBe(false);
    expect(leche.grupo).toBe('lacteos_semi');
  });

  it('marcado como extra no toca lo pautado, va aparte', () => {
    const a = crearAnadido(leche, 1, false);
    const { cuenta, extra } = aporteAnadidos([a]);
    expect(cuenta).toEqual({});
    expect(extra).toEqual({ lacteos_semi: 1 });
  });

  it('el interruptor lo cambia de sitio sin recalcular nada', () => {
    const a = crearAnadido(leche, 1, false);
    const b = alternarCuenta(a);
    expect(b.cuenta).toBe(true);
    expect(b.cantidad).toBe(a.cantidad);
    expect(aporteAnadidos([b]).cuenta).toEqual({ lacteos_semi: 1 });
  });

  it('un alimento libre no se puede marcar como que cuenta', () => {
    const bebida = foods.find((f) => !f.grupo)!;
    const a = crearAnadido(bebida, 1, true);
    expect(a.cuenta).toBe(false);
    expect(alternarCuenta(a).cuenta).toBe(false);
  });

  it('el buscador abierto no devuelve nada sin consulta', () => {
    expect(buscarParaAnadir(foods, '')).toEqual([]);
    expect(buscarParaAnadir(foods, 'leche').length).toBeGreaterThan(0);
  });
});

describe('Los añadidos llegan al plato (applyCustomization)', () => {
  const requeridos = { proteicos_magros: 5, almidones: 3, grasas: 2, fruta: 1 } as const;
  const esc = scaleRecipe(wok, requeridos, foods);

  /**
   * La receta no trae fruta, pero el escalado le da al almidón el hidrato de
   * la fruta también: de macros la comida cuadra. Antes esto salía como
   * «incompleta» y mandaba a la clienta a buscar una fruta que no le faltaba.
   */
  it('sin fruta en la receta, el almidón cubre el carbohidrato igual', () => {
    const r = applyCustomization(esc, requeridos, { quitados: [], sustituciones: {} }, foods);
    expect(r.enPlato.fruta ?? 0).toBe(0);
    expect(estadoComida(requeridos, r.enPlato).estado).toBe('completa');
  });

  it('añadir fruta encima sí sobra: el carbohidrato ya estaba puesto', () => {
    const r = applyCustomization(
      esc,
      requeridos,
      { quitados: [], sustituciones: {}, anadidos: [crearAnadido(porNombre('Melón'), 1, true)] },
      foods,
    );
    expect(r.enPlato.fruta).toBe(1);
    expect(estadoComida(requeridos, r.enPlato).estado).toBe('excedida');
  });

  it('un extra no entra en el plato: va por encima del plan', () => {
    const r = applyCustomization(
      esc,
      requeridos,
      {
        quitados: [],
        sustituciones: {},
        anadidos: [crearAnadido(porNombre('Leche semidesnatada'), 1, false)],
      },
      foods,
    );
    expect(r.enPlato.lacteos_semi).toBeUndefined();
    expect(r.extras).toEqual({ lacteos_semi: 1 });
    expect(kcalFromMacros(exchangesToMacros(r.extras))).toBeGreaterThan(0);
  });

  it('la verdura añadida no aparece en ningún recuento', () => {
    const r = applyCustomization(
      esc,
      requeridos,
      { quitados: [], sustituciones: {}, anadidos: [crearAnadido(porNombre('Espinaca'), 0, false)] },
      foods,
    );
    expect(r.extras).toEqual({});
    expect(r.anadidos).toHaveLength(1);
    expect(r.cambios.some((c) => c.includes('espinaca'))).toBe(true);
  });

  it('el estado sin añadidos es el mismo que antes de existir la función', () => {
    const r = applyCustomization(esc, requeridos, { quitados: [], sustituciones: {} }, foods);
    expect(r.anadidos).toEqual([]);
    expect(r.extras).toEqual({});
  });
});

describe('sumarIntercambios', () => {
  it('suma sin perder grupos ni inventar ceros', () => {
    expect(sumarIntercambios({ fruta: 1 }, { fruta: 0.5, grasas: 2 }, {})).toEqual({
      fruta: 1.5,
      grasas: 2,
    });
  });
});

describe('El hueco se cierra al taparlo', () => {
  /** Una pauta con proteína que la receta no puede cubrir del todo. */
  const requeridos = { proteicos_magros: 8, almidones: 3, grasas: 2 } as const;
  const esc = scaleRecipe(wok, { ...requeridos, proteicos_magros: 5 }, foods);

  it('primero falta proteína y al añadirla se cierra', () => {
    const sin = applyCustomization(esc, requeridos, { quitados: [], sustituciones: {} }, foods);
    const antes = huecos(estadoComida(requeridos, sin.enPlato));
    expect(antes.map((h) => h.bucket)).toEqual(['proteina']);
    expect(antes[0].falta).toBe(3);

    const con = applyCustomization(
      esc,
      requeridos,
      {
        quitados: [],
        sustituciones: {},
        anadidos: [crearAnadido(porNombre('Pechuga de pollo cruda'), 3, true)],
      },
      foods,
    );
    expect(huecos(estadoComida(requeridos, con.enPlato))).toEqual([]);
  });
});
