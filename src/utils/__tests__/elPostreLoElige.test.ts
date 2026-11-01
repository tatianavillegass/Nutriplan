import { describe, it, expect } from 'vitest';
import { fijoSeElige, fijoElegido, fijosElegidos, pautaDeComida } from '../fijos';
import type { Alimento } from '../../types/food';
import type { Fijo } from '../../types/plan';

/**
 * LA MANZANA DEL POSTRE ES UNA PORCIÓN DE FRUTA
 *
 * Sus palabras: «a Luis le voy a poner manzana de postre todos los días, pero
 * es sólo un reflejo de que de postre tiene una porción de fruta — él puede
 * elegir la que quiera.»
 *
 * Lo mismo que ya decidían la despensa y las combinaciones de fase 2: una
 * porción de fruta es cualquier fruta. Lo que faltaba era que lo fijo de la
 * comida se rigiera por esa regla y no fuera una jaula.
 */

const MANZANA: Alimento = {
  id: 'a-manzana',
  nombre: 'Manzana',
  grupo: 'fruta',
  medida_casera: '1 pieza',
  gramos: 130,
  intercambios: 1,
  nutrientes: { kcal: 52, hc: 14, proteina: 0.3, grasa: 0.2 },
  comidas_sugeridas: [],
  alergenos: [],
  apto: [],
};

/* Media ración de plátano son los mismos 15 g de hidrato en menos gramos. */
const PLATANO: Alimento = { ...MANZANA, id: 'a-platano', nombre: 'Plátano', gramos: 65 };
const GAMBAS: Alimento = {
  ...MANZANA,
  id: 'a-gambas',
  nombre: 'Gambas',
  grupo: 'proteicos_magros',
  gramos: 40,
};
const LECHE: Alimento = {
  ...MANZANA,
  id: 'a-leche',
  nombre: 'Leche semi',
  grupo: 'lacteos_semi',
  gramos: 200,
};

const FOODS = [MANZANA, PLATANO, GAMBAS, LECHE];

const postre: Fijo = {
  id: 'fj1',
  foodId: MANZANA.id,
  nombre: 'Manzana',
  gramos: 130,
  unidad: 'g',
  tipo: 'postre',
};

describe('Quién elige el alimento', () => {
  it('la fruta se abre sola: es el caso de la manzana', () => {
    expect(fijoSeElige(postre, FOODS)).toBe(true);
  });

  /*
   * Y la leche del café no, a propósito: puede ser la pauta y no un ejemplo.
   * Es la misma línea que ya se trazó en fase 2 al cambiar un alimento.
   */
  it('una leche concreta no', () => {
    expect(fijoSeElige({ ...postre, foodId: LECHE.id }, FOODS)).toBe(false);
  });

  it('pero ella puede abrirla a mano', () => {
    expect(fijoSeElige({ ...postre, foodId: LECHE.id, abierto: true }, FOODS)).toBe(true);
  });

  it('y cerrar la fruta cuando esa fruta es la pauta', () => {
    expect(fijoSeElige({ ...postre, abierto: false }, FOODS)).toBe(false);
  });

  /* «Un café» a secas es una nota: no gasta nada y no hay nada que cambiar. */
  it('lo que no es un alimento del catálogo, no', () => {
    expect(fijoSeElige({ ...postre, foodId: undefined }, FOODS)).toBe(false);
  });
});

describe('Al cambiarlo', () => {
  it('cambia el nombre y los gramos se rehacen', () => {
    const e = fijoElegido(postre, PLATANO.id, FOODS);
    expect(e.nombre).toBe('Plátano');
    expect(e.gramos).toBeCloseTo(65, 0);
  });

  /*
   * Media manzana es medio plátano: la porción manda, no los gramos. Y sale
   * en 35, no en 32,5: los gramos se redondean a lo que se puede pesar
   * (`roundPortion`), como en todo lo demás.
   */
  it('y respeta las porciones que tenía', () => {
    const media = fijoElegido({ ...postre, gramos: 65 }, PLATANO.id, FOODS);
    expect(media.gramos).toBe(35);
  });

  /*
   * Lo importante: la comida sigue gastando lo mismo, así que las opciones se
   * escalan igual y la pauta del día no se mueve.
   */
  it('la comida gasta exactamente lo mismo', () => {
    const dayType = { grid: { cena: { fruta: 1, proteicos_magros: 4 } }, fijos: {} };
    const con = (f: Fijo) =>
      pautaDeComida({ ...dayType, fijos: { cena: [f] } }, 'cena', FOODS);
    expect(con(fijoElegido(postre, PLATANO.id, FOODS)).pauta).toEqual(con(postre).pauta);
  });

  /* Antes que mover su pauta por la espalda, se queda como estaba. */
  it('no se cambia por algo de otro grupo', () => {
    expect(fijoElegido(postre, GAMBAS.id, FOODS)).toEqual(postre);
  });

  it('ni por un alimento que no existe', () => {
    expect(fijoElegido(postre, 'a-fantasma', FOODS)).toEqual(postre);
  });

  it('sin cambio elegido, se queda el suyo', () => {
    expect(fijosElegidos([postre], undefined, FOODS)).toEqual([postre]);
    expect(fijosElegidos([postre], {}, FOODS)[0]).toEqual(postre);
  });

  it('y el cambio es de ese fijo, no de los demás', () => {
    const cafe: Fijo = { id: 'fj2', foodId: LECHE.id, nombre: 'Leche semi', gramos: 200 };
    const [uno, dos] = fijosElegidos([postre, cafe], { fj1: PLATANO.id }, FOODS);
    expect(uno.nombre).toBe('Plátano');
    expect(dos).toEqual(cafe);
  });
});
