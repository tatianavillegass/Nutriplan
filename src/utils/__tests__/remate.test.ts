import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import type { Ingrediente, Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';

/**
 * EL QUESO REMATA, NO ES LA FUENTE
 *
 * En un plato de pollo con queso feta, la proteína pautada la pone el pollo.
 * Pero para la tabla de intercambios un queso graso es una fuente de proteína
 * como cualquier otra, así que al escalar a un día de más calorías crecían
 * los dos por igual: con 4 proteínas pautadas salían 120 g de feta.
 *
 * La regla ya existía para el yogur; lo que faltaba era que los quesos —que
 * no son lácteos en la tabla, sino proteicos grasos— pudieran entrar en ella.
 */

const POLLO: Alimento = {
  id: 'a-pollo',
  nombre: 'Pechuga de pollo',
  grupo: 'proteicos_magros',
  medida_casera: '30 g',
  gramos: 30,
  intercambios: 1,
  nutrientes: { kcal: 165, hc: 0, proteina: 23, grasa: 2 },
  comidas_sugeridas: ['comida'],
  alergenos: [],
  apto: [],
};

const FETA: Alimento = {
  ...POLLO,
  id: 'a-feta',
  nombre: 'Queso feta',
  grupo: 'proteicos_grasos',
  medida_casera: '45 g',
  gramos: 45,
  nutrientes: { kcal: 277, hc: 1, proteina: 16, grasa: 23.2 },
};

const ing = (
  id: string,
  nombre: string,
  foodId: string,
  grupo: Ingrediente['grupo'],
  cantidad: number,
): Ingrediente => ({
  id,
  nombre,
  foodId,
  cantidad_base: cantidad,
  unidad: 'g',
  grupo,
  escalable: true,
  opcional: false,
});

const PLATO: Receta = {
  id: 'r1',
  nombre: 'Pollo con feta',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_magros: 1, proteicos_grasos: 0.5 },
  ingredientes: [
    ing('i-pollo', 'Pollo', POLLO.id, 'proteicos_magros', 30),
    ing('i-feta', 'Feta', FETA.id, 'proteicos_grasos', 45),
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

/**
 * El día de entreno, que es donde se desmadraba: cuatro proteicos magros y
 * uno graso —el hueco del queso— pautados en esa comida.
 */
const PAUTA = { proteicos_magros: 4, proteicos_grasos: 1 };

const gramos = (e: ReturnType<typeof scaleRecipe>, id: string) =>
  e.ingredientes.find((i) => i.id === id)!.cantidad_final!;

/**
 * Lo que pasaba antes, y que es peor de lo que parece: el feta no sólo crece,
 * es que **se come la grasa del plato y obliga a recortar el pollo**. Con
 * cuatro proteínas pautadas el pollo se quedaba en 70 g.
 */
describe('Sin marcar', () => {
  const e = scaleRecipe(PLATO, PAUTA, [POLLO, FETA]);

  it('el queso crece', () => {
    expect(gramos(e, 'i-feta')).toBeGreaterThan(45);
  });

  it('y el pollo se queda corto para no pasarse de grasa', () => {
    expect(gramos(e, 'i-pollo')).toBeLessThan(80);
    expect(e.notas.some((n) => /recortado/i.test(n))).toBe(true);
  });
});

describe('Marcado como remate', () => {
  const FETA_REMATE: Alimento = { ...FETA, remate: true };
  const e = scaleRecipe(PLATO, PAUTA, [POLLO, FETA_REMATE]);

  /*
   * Se queda en lo que trae la receta: una porción, que es el máximo de un
   * remate. «Un plato de 5 porciones son 4 de pollo y 1 de queso.»
   */
  it('el feta se queda en su porción y no se estira', () => {
    expect(gramos(e, 'i-feta')).toBeCloseTo(45, 0);
  });

  /* Y ya no hay que recortar a nadie: la grasa cuadra sola. */
  it('el pollo carga con la proteína del día, entero', () => {
    expect(gramos(e, 'i-pollo')).toBeGreaterThan(100);
    expect(e.notas.some((n) => /recortado/i.test(n))).toBe(false);
  });

  /* Lo que de verdad ahorra trabajo: el otro tipo de día sale solo. */
  it('en el día de descanso baja el pollo y el queso se queda igual', () => {
    const corto = scaleRecipe(PLATO, { proteicos_magros: 2, proteicos_grasos: 1 }, [
      POLLO,
      FETA_REMATE,
    ]);
    expect(gramos(corto, 'i-feta')).toBeCloseTo(45, 0);
    expect(gramos(corto, 'i-pollo')).toBeLessThan(gramos(e, 'i-pollo'));
  });
});

/**
 * «Feta, entre 20 y 40»: que pueda estirarse un poco sin llegar al absurdo.
 */
describe('Con rango', () => {
  it('no pasa del máximo', () => {
    const conTecho: Alimento = { ...FETA, remate: true, remateMax: 30 };
    const e = scaleRecipe(PLATO, PAUTA, [POLLO, conTecho]);
    expect(gramos(e, 'i-feta')).toBeLessThanOrEqual(30);
    // Y el recorte es del queso: el pollo no paga por él.
    expect(gramos(e, 'i-pollo')).toBeGreaterThan(100);
  });

  it('sube al mínimo cuando cabe', () => {
    const conSuelo: Alimento = { ...FETA, remate: true, remateMin: 30 };
    // Con poco graso pautado le saldrían 11 g: el mínimo lo sube.
    const e = scaleRecipe(PLATO, { proteicos_magros: 4, proteicos_grasos: 2 }, [
      POLLO,
      conSuelo,
    ]);
    expect(gramos(e, 'i-feta')).toBeGreaterThanOrEqual(30);
  });

  /*
   * Una cantidad ridícula callada es justo lo que hay que ir a buscar receta
   * por receta: si el mínimo no cabe, se dice.
   */
  it('y si el mínimo no cabe en lo pautado, lo dice', () => {
    const conSuelo: Alimento = { ...FETA, remate: true, remateMin: 30 };
    const e = scaleRecipe(PLATO, { proteicos_magros: 4, proteicos_grasos: 0.25 }, [
      POLLO,
      conSuelo,
    ]);
    expect(e.notas.some((n) => /por debajo de su mínimo/i.test(n))).toBe(true);
  });

  it('el rango se nota en los gramos', () => {
    const conTecho: Alimento = { ...FETA, remate: true, remateMax: 10 };
    const e = scaleRecipe(PLATO, PAUTA, [POLLO, conTecho]);
    expect(gramos(e, 'i-feta')).toBeLessThanOrEqual(10);
  });
});

/**
 * Lo que ella decidió: una ensalada de feta sin más no puede quedarse corta de
 * proteína porque el feta «remate». Sin otra fuente, vuelve a serlo él.
 */
describe('Si es la única fuente del plato', () => {
  const SOLO_FETA: Receta = {
    ...PLATO,
    base: { proteicos_grasos: 1 },
    ingredientes: [ing('i-feta', 'Feta', FETA.id, 'proteicos_grasos', 45)],
  };

  it('escala como siempre, aunque esté marcado', () => {
    const e = scaleRecipe(SOLO_FETA, { proteicos_grasos: 2 }, [
      POLLO,
      { ...FETA, remate: true },
    ]);
    expect(gramos(e, 'i-feta')).toBeGreaterThan(45);
  });
});

/** El yogur ya se portaba así: marcarlo uno por uno sería trabajo de más. */
describe('Los lácteos siguen como estaban', () => {
  const YOGUR: Alimento = {
    ...POLLO,
    id: 'a-yogur',
    nombre: 'Yogur griego light',
    grupo: 'lacteos_proteicos',
    medida_casera: '170 g',
    gramos: 170,
    nutrientes: { kcal: 60, hc: 4.7, proteina: 5.8, grasa: 2 },
  };

  const CON_YOGUR: Receta = {
    ...PLATO,
    base: { proteicos_magros: 1, lacteos_proteicos: 1 },
    ingredientes: [
      ing('i-pollo', 'Pollo', POLLO.id, 'proteicos_magros', 30),
      ing('i-yogur', 'Yogur', YOGUR.id, 'lacteos_proteicos', 170),
    ],
  };

  it('con lácteo pautado, el yogur cubre el suyo y el pollo el resto', () => {
    const e = scaleRecipe(CON_YOGUR, { proteicos_magros: 3, lacteos_proteicos: 1 }, [
      POLLO,
      YOGUR,
    ]);
    expect(gramos(e, 'i-yogur')).toBeCloseTo(170, 0);
  });
});

/**
 * LAS REGLAS, TAL Y COMO ELLA LAS ESCRIBIÓ
 *
 * «Un plato que tenga 5 porciones de proteína utiliza 4 de pollo (120 g) y 1
 * de queso (45 g como máximo).» Y: «si he puesto 2 intercambios de proteína
 * alta en grasa y la receta no tiene, se compensa con la baja en grasa que
 * tenga — no me importa que escoja una baja en grasa.»
 */
describe('El reparto entre la fuente y el remate', () => {
  const FETA_REMATE: Alimento = { ...FETA, remate: true };
  const foods = [POLLO, FETA_REMATE];

  it('5 porciones son 4 de pollo y 1 de queso', () => {
    const e = scaleRecipe(PLATO, { proteicos_magros: 4, proteicos_grasos: 1 }, foods);
    expect(gramos(e, 'i-pollo')).toBeCloseTo(120, 0);
    expect(gramos(e, 'i-feta')).toBeCloseTo(45, 0);
  });

  /*
   * El caso de los «0 g de pollo»: pautaba proteína alta en grasa, el queso
   * era el único graso del plato y se le pedía que lo cubriera todo él.
   */
  it('con proteína alta en grasa pautada, el pollo no se queda en cero', () => {
    const e = scaleRecipe(PLATO, { proteicos_grasos: 2 }, foods);
    expect(gramos(e, 'i-pollo')).toBeGreaterThan(0);
    expect(gramos(e, 'i-feta')).toBeLessThanOrEqual(45);
  });

  it('y el queso nunca pasa de una porción', () => {
    for (const pauta of [
      { proteicos_grasos: 2 },
      { proteicos_grasos: 3 },
      { proteicos_magros: 2, proteicos_grasos: 2 },
    ]) {
      const e = scaleRecipe(PLATO, pauta, foods);
      expect(gramos(e, 'i-feta')).toBeLessThanOrEqual(46);
    }
  });

  /* Lo que falte lo pone la fuente, venga pautado como magro o como graso. */
  it('la fuente carga con lo que el remate no pone', () => {
    const e = scaleRecipe(PLATO, { proteicos_magros: 2, proteicos_grasos: 2 }, foods);
    // 4 porciones pautadas, 1 la pone el queso: al pollo le tocan 3.
    expect(gramos(e, 'i-pollo')).toBeCloseTo(90, 0);
  });
});
