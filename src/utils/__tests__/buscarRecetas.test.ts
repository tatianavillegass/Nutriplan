import { describe, it, expect } from 'vitest';
import { buscarRecetas, porQueCoincide, recetaCoincide } from '../buscarRecetas';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';

/**
 * BUSCAR POR LO QUE LLEVA, NO SÓLO POR CÓMO SE LLAMA
 *
 * Al pautar la pregunta casi nunca es «¿cómo se llamaba?» sino «¿qué tengo con
 * salmón?». Sin esto había que acordarse del nombre que le pusiste.
 */

const SALMON = {
  id: 'a-salmon',
  nombre: 'Salmón fresco',
} as unknown as Alimento;

const NUECES = { id: 'a-nueces', nombre: 'Nuez' } as unknown as Alimento;

const FOODS = [SALMON, NUECES];

const receta = (
  id: string,
  nombre: string,
  ingredientes: { nombre: string; foodId?: string }[],
  tags: string[] = [],
): Receta =>
  ({ id, nombre, ingredientes, tags, categorias: [], base: {} }) as unknown as Receta;

const BOWL = receta('r1', 'Bowl de primavera', [
  { nombre: 'Salmón', foodId: 'a-salmon' },
  { nombre: 'Arroz' },
]);
const TOSTADA = receta('r2', 'Tostada de aguacate', [{ nombre: 'Pan' }, { nombre: 'Aguacate' }]);
const BIZCOCHO = receta('r3', 'Bizcocho de la abuela', [{ nombre: 'Huevos' }], ['sin gluten']);
const ENSALADA = receta('r4', 'Ensalada templada', [{ nombre: 'Nueces', foodId: 'a-nueces' }]);

const TODAS = [BOWL, TOSTADA, BIZCOCHO, ENSALADA];

describe('Buscar una receta', () => {
  it('por su nombre, como siempre', () => {
    expect(buscarRecetas(TODAS, 'tostada', FOODS).map((r) => r.id)).toEqual(['r2']);
  });

  it('y por un ingrediente que lleva', () => {
    expect(buscarRecetas(TODAS, 'salmon', FOODS).map((r) => r.id)).toEqual(['r1']);
  });

  /** La receta pone «Nueces» y el catálogo «Nuez»: las dos tienen que valer. */
  it('valga el nombre que escribió ella o el del catálogo', () => {
    expect(recetaCoincide(ENSALADA, 'nuez', FOODS)).toBe(true);
    expect(recetaCoincide(ENSALADA, 'nueces', FOODS)).toBe(true);
  });

  /** Un ingrediente suelto —la verdura, lo escrito a mano— cuenta igual. */
  it('aunque el ingrediente no esté enlazado al catálogo', () => {
    expect(buscarRecetas(TODAS, 'aguacate', FOODS).map((r) => r.id)).toEqual(['r2']);
  });

  it('sin tildes', () => {
    expect(recetaCoincide(BOWL, 'salmón', FOODS)).toBe(true);
  });

  it('y por su etiqueta, que es como ella piensa en categorías', () => {
    expect(buscarRecetas(TODAS, 'sin gluten', FOODS).map((r) => r.id)).toEqual(['r3']);
  });

  it('sin escribir nada salen todas', () => {
    expect(buscarRecetas(TODAS, '   ', FOODS).length).toBe(4);
  });
});

/**
 * Buscando «huevo» aparece un bizcocho y parece un fallo del buscador — cuando
 * lo que pasa es que lleva dos huevos. Decirlo es la diferencia.
 */
describe('Por qué salió esa receta', () => {
  it('lo dice cuando no fue por el nombre', () => {
    expect(porQueCoincide(BIZCOCHO, 'huevo', FOODS)).toBe('lleva huevos');
    expect(porQueCoincide(BOWL, 'salmon', FOODS)).toBe('lleva salmón');
  });

  it('y también cuando fue por una etiqueta', () => {
    expect(porQueCoincide(BIZCOCHO, 'sin gluten', FOODS)).toBe('etiqueta «sin gluten»');
  });

  /** Si salió por el nombre no hace falta explicar nada: ya se ve. */
  it('y se calla cuando fue por el nombre', () => {
    expect(porQueCoincide(TOSTADA, 'tostada', FOODS)).toBeUndefined();
  });
});
