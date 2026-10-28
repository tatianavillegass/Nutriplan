import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { composicionDesdeIngredientes } from '../recipeComposition';
import { estadoComida } from '../completitud';
import type { Alimento } from '../../types/food';
import type { Ingrediente, Receta } from '../../types/recipe';
import type { ExchangeCounts } from '../exchanges';

/**
 * LA RECETA SON SUS INGREDIENTES
 *
 * El caso que lo destapó: un desayuno con 3 proteicos y 2 hidratos pautados, y
 * un plato de 30 g de avena con 65 g de plátano que decía cubrir **1 sola
 * porción de hidrato**.
 *
 * La `base` de la receta se guardaba redondeada a medias porciones —que es
 * como se habla, «2 almidones y medio»— pero el escalado partía de esa base
 * redondeada, y ahí el redondeo deja de ser una forma de hablar: 0,75 + 0,5 se
 * guardaba como 1 + 0,5, y los gramos y el recuento salían de ahí. Con dos
 * ingredientes que redondean a la baja se pierde una porción entera.
 */

/** Porciones como las de su catálogo, que no son las de fábrica. */
const AVENA: Alimento = {
  id: 'avena',
  nombre: 'Avena',
  grupo: 'almidones',
  medida_casera: '40 g',
  gramos: 40,
  intercambios: 1,
  nutrientes: { kcal: 355, hc: 60, proteina: 13, grasa: 7 },
  comidas_sugeridas: ['desayuno'],
  alergenos: [],
  apto: [],
};

const PLATANO: Alimento = {
  ...AVENA,
  id: 'platano',
  nombre: 'Plátano',
  grupo: 'fruta',
  medida_casera: '1 unidad',
  gramos: 130,
  nutrientes: { kcal: 100, hc: 22.8, proteina: 1.1, grasa: 0.3 },
};

const FOODS = [AVENA, PLATANO];

const ing = (
  nombre: string,
  foodId: string | undefined,
  grupo: Ingrediente['grupo'],
  cantidad: number,
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

const INGREDIENTES = [
  ing('Avena', AVENA.id, 'almidones', 30),
  ing('Plátano', PLATANO.id, 'fruta', 65),
];

const receta = (base: Receta['base']): Receta =>
  ({
    id: 'r1',
    nombre: 'Avena con plátano',
    categorias: ['desayuno'],
    tags: [],
    base,
    ingredientes: INGREDIENTES,
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  }) as Receta;

const PAUTA: ExchangeCounts = { almidones: 2 };

/** Lo que de verdad cubre el plato ya escalado. */
const cubierto = (e: ReturnType<typeof scaleRecipe>) => {
  const ingredientes = e.ingredientes.map((i) => ({ ...i, cantidad_base: i.cantidad_final }));
  const enPlato = composicionDesdeIngredientes({ ingredientes }, FOODS)
    .exacto as ExchangeCounts;
  return estadoComida(PAUTA, enPlato).filas.find((f) => f.bucket === 'carbohidrato')!;
};

describe('Lo que la receta dice de sí misma', () => {
  it('30 g de avena son 0,75 porciones, no 1', () => {
    const comp = composicionDesdeIngredientes({ ingredientes: INGREDIENTES }, FOODS);
    expect(comp.exacto.almidones).toBeCloseTo(0.75, 3);
    // Lo que se guardaba, y de donde salía el error.
    expect(comp.base.almidones).toBe(1);
  });
});

describe('Con una base guardada que no cuadra con los ingredientes', () => {
  /*
   * Es lo que hay en sus recetas ya guardadas: la base redondeada. Ahora el
   * escalado NO le hace caso y parte de los ingredientes, así que se arreglan
   * sin tener que volver a entrar en ninguna.
   */
  it('mandan los ingredientes, no la base', () => {
    const e = scaleRecipe(receta({ almidones: 1, fruta: 0.5 }), PAUTA, FOODS);
    const f = cubierto(e);
    expect(f.cubierto).toBeCloseTo(2, 1);
  });

  it('y los gramos salen de ahí', () => {
    const e = scaleRecipe(receta({ almidones: 1, fruta: 0.5 }), PAUTA, FOODS);
    const avena = e.ingredientes.find((i) => i.nombre === 'Avena')!;
    /*
     * Los 30 g suben: lo que trae el plato son 1,25 porciones de hidrato y
     * hay 2 pautadas. El redondeo final a lo que se puede pesar deja 45 g.
     */
    expect(avena.cantidad_final).toBeGreaterThan(40);
  });

  it('con la base exacta sale lo mismo, que es la señal de que ya no importa', () => {
    const conExacta = scaleRecipe(receta({ almidones: 0.75, fruta: 0.5 }), PAUTA, FOODS);
    const conRedondeada = scaleRecipe(receta({ almidones: 1, fruta: 0.5 }), PAUTA, FOODS);
    expect(cubierto(conExacta).cubierto).toBeCloseTo(cubierto(conRedondeada).cubierto, 3);
  });
});

/**
 * SÓLO SI SE PUEDE CONTAR LA RECETA ENTERA
 *
 * Si un ingrediente no está enlazado al catálogo no se sabe lo que aporta, así
 * que calcular desde los ingredientes lo dejaría fuera y la receta encogería.
 * Con una línea sin resolver manda lo guardado, que es lo que ella escribió
 * sabiendo lo que hay en el plato.
 */
describe('Con un ingrediente sin enlazar', () => {
  const aMedias = {
    ...receta({ almidones: 1, fruta: 0.5, proteicos_magros: 2 }),
    ingredientes: [...INGREDIENTES, ing('Yogur de casa', undefined, 'proteicos_magros', 150)],
  };

  it('manda la base guardada', () => {
    const e = scaleRecipe(aMedias, { almidones: 1, fruta: 0.5, proteicos_magros: 2 }, FOODS);
    const avena = e.ingredientes.find((i) => i.nombre === 'Avena')!;
    expect(avena.cantidad_final).toBe(30);
  });
});

describe('Sin catálogo', () => {
  it('no hay nada que calcular y se usa lo guardado', () => {
    const e = scaleRecipe(receta({ almidones: 1, fruta: 0.5 }), PAUTA, []);
    expect(e.ingredientes.find((i) => i.nombre === 'Avena')!.cantidad_final).toBeGreaterThan(30);
  });
});

/**
 * EL SUBGRUPO LO DICE EL ALIMENTO, NO LO QUE SE ESCRIBIÓ EN LA RECETA
 *
 * Cada línea de una receta lleva un subgrupo escrito, y el alimento del
 * catálogo trae el suyo. Cuando no coinciden —se elige el subgrupo a mano y
 * luego se enlaza el alimento— había dos verdades: la composición contaba por
 * el del alimento y el escalado aplicaba el factor por el escrito. El factor
 * de ese subgrupo no existía, se caía al 1 y **el ingrediente no escalaba**:
 * 30 g de pollo en una comida de 7 proteínas.
 */
describe('Cuando el subgrupo escrito no es el del alimento', () => {
  const POLLO: Alimento = {
    ...AVENA,
    id: 'pollo',
    nombre: 'Pechuga de pollo',
    grupo: 'proteicos_magros',
    medida_casera: '30 g',
    gramos: 30,
    nutrientes: { kcal: 165, hc: 0, proteina: 23, grasa: 2 },
  };

  const malEscrita = {
    id: 'r2',
    nombre: 'Pollo con lo que sea',
    categorias: ['comida'],
    tags: [],
    base: {},
    /* El pollo, escrito en un subgrupo que no es el suyo. */
    ingredientes: [ing('Pollo', POLLO.id, 'proteicos_semigrasos', 30)],
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  } as unknown as Receta;

  it('el ingrediente escala igual', () => {
    const e = scaleRecipe(malEscrita, { proteicos_magros: 7 }, [...FOODS, POLLO]);
    expect(e.ingredientes[0].cantidad_final).toBeGreaterThan(150);
  });

  it('y con el subgrupo bien escrito sale lo mismo', () => {
    const bien = {
      ...malEscrita,
      ingredientes: [ing('Pollo', POLLO.id, 'proteicos_magros', 30)],
    } as Receta;
    const a = scaleRecipe(malEscrita, { proteicos_magros: 7 }, [...FOODS, POLLO]);
    const b = scaleRecipe(bien, { proteicos_magros: 7 }, [...FOODS, POLLO]);
    expect(a.ingredientes[0].cantidad_final).toBe(b.ingredientes[0].cantidad_final);
  });
});
