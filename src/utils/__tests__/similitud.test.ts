import { describe, it, expect } from 'vitest';
import {
  coincide,
  equivalentesOrdenados,
  parecidoMacros,
  parecidoNombre,
  parecidoPorcion,
  similitud,
} from '../similitud';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Alimento } from '../../types/food';

const buscar = (n: string) => FOOD_CATALOG.find((f) => f.nombre === n)!;

describe('Parecido por el nombre', () => {
  it('mismas palabras, parecido máximo', () => {
    expect(parecidoNombre('Pechuga de pollo cruda', 'Pechuga de pollo cruda')).toBe(1);
  });

  it('comparte "pechuga" y "cruda"', () => {
    const p = parecidoNombre('Pechuga de pollo cruda', 'Pechuga de pavo cruda');
    expect(p).toBeGreaterThan(0.4);
  });

  it('nada en común, cero', () => {
    expect(parecidoNombre('Aceite de oliva', 'Lentejas')).toBe(0);
  });

  it('las palabras vacías no cuentan como parecido', () => {
    expect(parecidoNombre('Pan de molde', 'Aceite de coco')).toBe(0);
  });

  it('ignora tildes y mayúsculas', () => {
    expect(parecidoNombre('Salmón crudo', 'salmon ahumado')).toBeGreaterThan(0);
  });
});

describe('Parecido por macros y porción', () => {
  it('dos alimentos con los mismos nutrientes puntúan 1', () => {
    const a = buscar('Pechuga de pollo cruda');
    expect(parecidoMacros(a, a)).toBeCloseTo(1, 6);
    expect(parecidoPorcion(a, a)).toBeCloseTo(1, 6);
  });

  it('porciones parecidas puntúan más que porciones muy distintas', () => {
    const p = (g: number) =>
      ({
        id: String(g),
        nombre: 'x',
        grupo: 'proteicos_magros',
        gramos: g,
        intercambios: 1,
        medida_casera: '',
        comidas_sugeridas: [],
      }) as unknown as Alimento;
    expect(parecidoPorcion(p(30), p(35))).toBeGreaterThan(parecidoPorcion(p(30), p(150)));
    expect(parecidoPorcion(p(30), p(35))).toBeCloseTo(30 / 35, 4);
  });

  it('la puntuación total se queda entre 0 y 1', () => {
    const a = buscar('Pechuga de pollo cruda');
    const b = buscar('Tofu firme');
    const s = similitud(a, b);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe('Equivalentes ordenados por parecido', () => {
  const pollo = buscar('Pechuga de pollo cruda');
  const lista = equivalentesOrdenados(pollo, FOOD_CATALOG);

  it('no se ofrece a sí mismo', () => {
    expect(lista.some((f) => f.id === pollo.id)).toBe(false);
  });

  it('sólo alimentos de su mismo subgrupo', () => {
    expect(lista.every((f) => f.grupo === pollo.grupo)).toBe(true);
    expect(lista.length).toBeGreaterThan(5);
  });

  it('otra carne blanca sale antes que el tofu', () => {
    const pos = (n: string) => lista.findIndex((f) => f.nombre === n);
    const pavo = pos('Pavo pechuga cruda');
    const tofu = pos('Tofu firme');
    if (pavo >= 0 && tofu >= 0) expect(pavo).toBeLessThan(tofu);
    expect(pavo).toBeGreaterThanOrEqual(0);
  });

  it('un alimento sin subgrupo no tiene equivalentes', () => {
    const libre = FOOD_CATALOG.find((f) => !f.grupo)!;
    expect(equivalentesOrdenados(libre, FOOD_CATALOG)).toEqual([]);
  });
});

describe('Filtro de texto de las listas largas', () => {
  it('sin consulta pasa todo', () => {
    expect(coincide('Queso cottage', '')).toBe(true);
    expect(coincide('Queso cottage', '   ')).toBe(true);
  });

  it('encuentra por cualquier palabra del nombre', () => {
    expect(coincide('Queso cottage', 'cottage')).toBe(true);
    expect(coincide('Yogur proteínas Mercadona', 'proteinas')).toBe(true);
  });

  it('funciona sin tildes', () => {
    expect(coincide('Plátano', 'platano')).toBe(true);
    expect(coincide('Salmón crudo', 'SALMON')).toBe(true);
  });

  it('descarta lo que no tiene nada que ver', () => {
    expect(coincide('Queso cottage', 'lentejas')).toBe(false);
  });
});
