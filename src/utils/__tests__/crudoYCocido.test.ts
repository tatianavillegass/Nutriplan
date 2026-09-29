import { describe, it, expect } from 'vitest';
import { gramosEnCrudo, losDosGramajes, seSabeEnCrudo } from '../../types/food';
import { seCocinaEnTanda } from '../batchCooking';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Alimento } from '../../types/food';

/**
 * LO QUE SE COME Y LO QUE SE COMPRA NO PESAN LO MISMO
 *
 * La receta habla del plato y la lista de la compra del paquete: 150 g de
 * arroz cocido se compran con 54 g de arroz crudo. Eso salía como «150 g de
 * arroz» en la lista, porque no había ni un alimento del catálogo con la
 * equivalencia rellena — y rellenarla tal cual habría roto lo que sí estaba
 * bien, porque la cuenta daba por hecho que todos los gramos eran de cocido.
 */

const de = (id: string) => FOOD_CATALOG.find((f) => f.id === id) as Alimento;

describe('El catálogo sabe la equivalencia en los dos sentidos', () => {
  it('el arroz crudo dice lo que pesa cocido', () => {
    expect(de('a-arroz-blanco-crudo').gramos).toBe(18);
    expect(de('a-arroz-blanco-crudo').equivalencia_cocido).toBe(50);
  });

  it('y el arroz cocido, lo que hay que comprar', () => {
    expect(de('a-arroz-blanco-cocido').gramos).toBe(50);
    expect(de('a-arroz-blanco-cocido').equivalencia_cruda).toBe(18);
  });

  it('los doce pares están rellenos, y nunca los dos campos a la vez', () => {
    const conEquivalencia = FOOD_CATALOG.filter(
      (f) => f.equivalencia_cocido || f.equivalencia_cruda,
    );
    expect(conEquivalencia).toHaveLength(24);
    for (const f of conEquivalencia) {
      expect(!!f.equivalencia_cocido && !!f.equivalencia_cruda).toBe(false);
    }
  });
});

describe('De lo que se come a lo que se compra', () => {
  it('150 g de arroz cocido se compran con 54 g de arroz', () => {
    expect(Math.round(gramosEnCrudo(150, de('a-arroz-blanco-cocido')))).toBe(54);
  });

  /* Éste es el que se rompía al rellenar el campo a lo bruto: unos gramos ya
     escritos en crudo son los del paquete y no hay nada que convertir. */
  it('pero 150 g de arroz crudo se compran con 150 g: ya son los del paquete', () => {
    expect(gramosEnCrudo(150, de('a-arroz-blanco-crudo'))).toBe(150);
  });

  it('las lentejas cocidas también: 210 g son 75 g de lenteja seca', () => {
    expect(Math.round(gramosEnCrudo(210, de('a-lentejas-cocidas')))).toBe(75);
  });

  it('lo que no se cuece se compra tal cual', () => {
    expect(gramosEnCrudo(100, de('a-aguacate'))).toBe(100);
    expect(gramosEnCrudo(100, undefined)).toBe(100);
  });

  /* Un factor de 1 o más no es una cocción, es un dedazo al teclear: engordar
     la compra por un error es peor que quedarse como estaba. */
  it('una equivalencia imposible no infla la compra', () => {
    const mal = { ...de('a-arroz-blanco-cocido'), equivalencia_cruda: 80 };
    expect(gramosEnCrudo(150, mal)).toBe(150);
  });
});

describe('Cuando no se sabe, se dice', () => {
  it('un alimento con equivalencia se sabe en crudo', () => {
    expect(seSabeEnCrudo(de('a-arroz-blanco-cocido'), 'Arroz')).toBe(true);
    expect(seSabeEnCrudo(de('a-arroz-blanco-crudo'), 'Arroz')).toBe(true);
  });

  it('uno que se llama «cocido» y no la tiene, no', () => {
    const huerfano = { ...de('a-gnocchi'), nombre: 'Mijo cocido' };
    expect(seSabeEnCrudo(huerfano, 'Mijo cocido')).toBe(false);
  });

  it('y lo que no pasa por el fuego se da por bueno', () => {
    expect(seSabeEnCrudo(de('a-aguacate'), 'Aguacate')).toBe(true);
  });
});

describe('Los dos gramajes, para quien pesa antes y para quien pesa después', () => {
  it('escrito en crudo', () => {
    expect(losDosGramajes(de('a-arroz-blanco-crudo'), 54)).toBe('54 g en crudo · 150 g ya cocido');
  });

  it('escrito en cocido', () => {
    expect(losDosGramajes(de('a-arroz-blanco-cocido'), 150)).toBe(
      '54 g en crudo · 150 g ya cocido',
    );
  });

  it('y si no se sabe, no se inventa nada', () => {
    expect(losDosGramajes(de('a-aguacate'), 70)).toBeUndefined();
  });
});

describe('Tener equivalencia es decir que pasa por el fuego', () => {
  it('el arroz cocido entra en el batch cooking por su equivalencia', () => {
    expect(seCocinaEnTanda(de('a-arroz-blanco-cocido'))).toBe(true);
  });

  it('el crudo también', () => {
    expect(seCocinaEnTanda(de('a-arroz-blanco-crudo'))).toBe(true);
  });
});
