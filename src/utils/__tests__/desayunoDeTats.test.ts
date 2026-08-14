import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { estadoComida, huecos, avisoDeGrasa } from '../completitud';
import { exchangesToMacros } from '../exchanges';
import type { Ingrediente, Receta, RecipeBase } from '../../types/recipe';

/**
 * EL DESAYUNO, COMO LO PAUTA TATS A MANO
 *
 * Su flujo: la clienta tiene 4 porciones de proteína (2 grasas y 2 magras),
 * 2 de carbohidrato (1 almidón y 1 fruta) y 2 de grasa (1 proteica y 1 normal).
 * Luego mira las recetas que tiene y ajusta cantidades para que los macros
 * cuadren, sin preocuparse de que los subgrupos coincidan uno a uno:
 *
 *   «en la primera opción no hay fruta, no pasa nada, los 2 carbos se sacan
 *    del almidón»
 *   «no incluí grasa proteica, no pasa nada»
 *
 * Esto fija ese criterio: lo que tiene que cuadrar son los macros.
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
  id: 'r',
  nombre: 'Prueba',
  categorias: ['desayuno'],
  tags: [],
  base,
  ingredientes,
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
});

/** 4 proteínas (2+2), 2 carbohidratos (1+1), 2 grasas (1+1). */
const DESAYUNO = {
  proteicos_grasos: 2,
  proteicos_magros: 2,
  almidones: 1,
  fruta: 1,
  frutos_secos: 1,
  grasas: 1,
} as const;

describe('Opción 1: pan con huevos y claras', () => {
  /**
   * Sin fruta y sin grasa proteica: el pan lleva todo el carbohidrato y el
   * aceite con el aguacate llevan toda la grasa.
   */
  const panYHuevos = receta(
    { almidones: 1, proteicos_grasos: 1, proteicos_magros: 1, grasas: 1 },
    [
      ing('Pan integral', 'almidones', 30),
      ing('Huevo', 'proteicos_grasos', 55),
      ing('Clara de huevo', 'proteicos_magros', 60),
      ing('Aceite de oliva', 'grasas', 5),
    ],
  );

  const e = scaleRecipe(panYHuevos, DESAYUNO);
  const r = estadoComida(DESAYUNO, e.cubiertos);

  it('el pan crece para llevar también el carbohidrato de la fruta', () => {
    /**
     * 1 almidón + 1 fruta pautados son 29 g de hidrato. El pan se queda en
     * 27,5 y no en 29 porque el tope de calorías lo frena: un almidón trae 2 g
     * de proteína y una fruta sólo 1, así que cubrir el hidrato entero con pan
     * costaría unas kcal de más. La diferencia es media porción escasa y entra
     * en la tolerancia, que para eso está.
     */
    expect(exchangesToMacros(e.cubiertos).hc).toBeGreaterThan(26);
    expect(e.factores.almidones!).toBeGreaterThan(1.9);
    expect(r.filas.find((f) => f.bucket === 'carbohidrato')!.estado).toBe('ok');
  });

  it('la grasa la cubren el aceite y lo que traiga el plato', () => {
    const pautada = exchangesToMacros(DESAYUNO).grasa;
    const enPlato = exchangesToMacros(e.cubiertos).grasa;
    expect(enPlato).toBeGreaterThan(pautada * 0.9);
  });

  it('no le dice a nadie que falta fruta ni grasa proteica', () => {
    expect(e.gruposSinCubrir).toEqual([]);
    expect(huecos(r)).toEqual([]);
    expect(r.estado).toBe('completa');
  });

  it('pero a Tats sí le cuenta con qué lo ha cubierto', () => {
    expect(e.notas.join(' ')).toMatch(/fruta/i);
  });
});

describe('Opción 2: avena con yogur, whey, chía y crema de almendras', () => {
  /**
   * Aquí sí hay fruta y lácteo, y la grasa entera sale de fuentes proteicas
   * (chía y crema de almendras) porque no hay aceite. Tampoco pasa nada.
   */
  const avena = receta(
    { almidones: 1, fruta: 1, lacteos_proteicos: 1, proteicos_magros: 1, frutos_secos: 2 },
    [
      ing('Avena', 'almidones', 25),
      ing('Arándanos', 'fruta', 80),
      ing('Yogur proteico', 'lacteos_proteicos', 70),
      ing('Proteína whey', 'proteicos_magros', 25),
      ing('Chía', 'frutos_secos', 10),
    ],
  );

  const e = scaleRecipe(avena, DESAYUNO);
  const r = estadoComida(DESAYUNO, e.cubiertos);

  it('cubre las 2 porciones de grasa sin usar aceite', () => {
    // Se mira el macro grasa, que es lo que se pauta: 2 porciones.
    expect(r.filas.find((f) => f.bucket === 'grasa')!.estado).toBe('ok');
  });

  it('el carbohidrato cuadra entre la avena y los arándanos', () => {
    expect(r.filas.find((f) => f.bucket === 'carbohidrato')!.estado).toBe('ok');
  });

  it('no falta nada', () => {
    expect(huecos(r)).toEqual([]);
  });

  /**
   * El yogur y la whey se reparten las 4 porciones de proteína en la
   * proporción que trae la receta. Antes la whey se estiraba hasta cubrirlas
   * ella sola y el yogur sumaba encima: salían 5 porciones donde había 4.
   */
  it('el yogur y la whey se reparten la proteína, no suman encima', () => {
    expect(r.filas.find((f) => f.bucket === 'proteina')!.estado).toBe('ok');
    expect(e.factores.lacteos_proteicos).toBeCloseTo(e.factores.proteicos_magros!, 5);
  });

  it('la comida queda completa', () => {
    expect(r.estado).toBe('completa');
  });
});

/**
 * Lo único que se pierde al contar por macro es la grasa escondida en la
 * proteína. No es una alerta —los macros cuadran— pero Tats lo pautó a
 * propósito, así que se le dice a ella y sólo a ella.
 */
describe('El aviso de grasa es para quien pauta', () => {
  it('avisa si la receta pone la proteína más magra de lo pautado', () => {
    // Pautados 2 grasos y 2 magros; la receta lo hace todo con claras.
    const a = avisoDeGrasa(DESAYUNO, { proteicos_magros: 4 });
    expect(a).toBeDefined();
    expect(a!.gramos).toBeLessThan(0);
    expect(a!.texto).toMatch(/más magra/i);
  });

  it('y si la pone más grasa', () => {
    const a = avisoDeGrasa({ proteicos_magros: 4 }, { proteicos_grasos: 4 });
    expect(a!.gramos).toBeGreaterThan(0);
    expect(a!.texto).toMatch(/más grasa/i);
  });

  it('un cambio pequeño no dice nada', () => {
    const a = avisoDeGrasa({ proteicos_magros: 2 }, { proteicos_semigrasos: 2 });
    // 3 g de diferencia: por debajo de una porción de grasa.
    expect(a).toBeUndefined();
  });

  it('la grasa de fuera de los proteicos no cuenta aquí', () => {
    expect(avisoDeGrasa({ grasas: 2 }, { grasas: 4 })).toBeUndefined();
  });
});
