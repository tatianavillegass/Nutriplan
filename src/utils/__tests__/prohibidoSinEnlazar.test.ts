import { describe, it, expect } from 'vitest';
import { evaluarReceta } from '../restrictions';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Client } from '../../types/client';
import type { Ingrediente, Receta } from '../../types/recipe';

/**
 * UN ALIMENTO PROHIBIDO NO PUEDE PASAR POR ESTAR SIN ENLAZAR
 *
 * Ana Fernanda no puede comer pimiento, y las recetas que lo llevan salían
 * limpias en el recomendador: se le podían pautar sin un solo aviso. El motivo
 * era que el ingrediente estaba escrito a mano, sin enlazar al catálogo, y lo
 * que no está enlazado no se miraba.
 *
 * Equivocarse avisando de más es mucho mejor que callar un alimento
 * prohibido: un aviso se lee y se descarta en un segundo.
 */

const pimiento = FOOD_CATALOG.find((f) => /pimiento/i.test(f.nombre));

const ing = (nombre: string, foodId?: string): Ingrediente => ({
  id: `i-${nombre}`,
  nombre,
  foodId,
  cantidad_base: 50,
  unidad: 'g',
  grupo: 'verduras',
  escalable: false,
  opcional: false,
});

const receta = (ingredientes: Ingrediente[]): Receta =>
  ({
    id: 'r1',
    nombre: 'Salteado',
    categorias: ['comida'],
    tags: [],
    base: {},
    ingredientes,
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  }) as Receta;

const sinPimiento = (extra: Partial<Client> = {}): Client =>
  ({
    patologias: [],
    alergias: [],
    aversiones: pimiento ? [pimiento.id] : [],
    ...extra,
  }) as unknown as Client;

describe.runIf(pimiento)('Con el pimiento en su lista de lo que no come', () => {
  it('se avisa aunque el ingrediente no esté enlazado', () => {
    const ev = evaluarReceta(receta([ing(pimiento!.nombre)]), sinPimiento(), FOOD_CATALOG);
    expect(ev.bloqueado).toBe(true);
  });

  it('y también enlazado, como siempre', () => {
    const ev = evaluarReceta(
      receta([ing('Pimiento', pimiento!.id)]),
      sinPimiento(),
      FOOD_CATALOG,
    );
    expect(ev.bloqueado).toBe(true);
  });

  it('una receta sin él sigue limpia', () => {
    const ev = evaluarReceta(receta([ing('Calabacín')]), sinPimiento(), FOOD_CATALOG);
    expect(ev.bloqueado).toBe(false);
  });

  /* Lo opcional se quita en vez de descartar la receta entera. */
  it('si es opcional, se marca para quitarlo y la receta se salva', () => {
    const ev = evaluarReceta(
      receta([{ ...ing(pimiento!.nombre), opcional: true }]),
      sinPimiento(),
      FOOD_CATALOG,
    );
    expect(ev.bloqueado).toBe(false);
    expect(ev.ingredientesAQuitar).toHaveLength(1);
  });
});

/**
 * Lo mismo con los alérgenos: una receta con «Queso feta» escrito a mano y una
 * clienta con alergia a la proteína de la leche.
 */
describe('Un alérgeno sin enlazar tampoco se cuela', () => {
  const feta = FOOD_CATALOG.find((f) => f.nombre === 'Queso feta')!;

  it('se reconoce por el nombre', () => {
    const ev = evaluarReceta(
      receta([ing(feta.nombre)]),
      { patologias: [], alergias: ['proteina_leche'], aversiones: [] } as unknown as Client,
      FOOD_CATALOG,
    );
    expect(ev.bloqueado).toBe(true);
  });
});
