import { describe, it, expect } from 'vitest';
import { matchRecipes } from '../recipeMatcher';
import type { Receta } from '../../types/recipe';

/**
 * UN ACOMPAÑAMIENTO NO ES UN PLATO
 *
 * La ensalada de tomate va al lado del salmón, no en su lugar. Si compite por
 * ser «la comida», en la pantalla de la clienta le puede salir media ensalada
 * donde esperaba una cena — y en el banco ensucia todas las carpetas.
 */

const receta = (id: string, extra: Partial<Receta> = {}): Receta => ({
  id,
  nombre: id,
  categorias: ['comida'],
  tags: [],
  base: { verduras: 1 },
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
  ...extra,
});

describe('El recomendador', () => {
  it('no ofrece acompañamientos como opción de comida', () => {
    const plato = receta('salmon', { base: { proteicos_grasos: 3, almidones: 3 } });
    const guarnicion = receta('ensalada', { acompanamiento: true });

    const salen = matchRecipes([plato, guarnicion], { proteicos_grasos: 3, almidones: 3 }, {
      slot: 'comida',
      limite: 10,
      incluirBloqueadas: true,
    }).map((m) => m.receta.id);

    expect(salen).toContain('salmon');
    expect(salen).not.toContain('ensalada');
  });
});
