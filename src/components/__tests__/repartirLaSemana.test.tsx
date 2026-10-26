// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { RepartirLaSemana } from '../planning/RepartirLaSemana';
import type { Plan } from '../../types/plan';
import type { Ingrediente, Receta } from '../../types/recipe';

afterEach(cleanup);

/**
 * LA TABLA DE «CÓMO VA QUEDANDO» DICE LAS FUENTES
 *
 * Lo que se decide repartiendo la semana no es qué plato toca el martes: es
 * no ponerle pollo cuatro días seguidos y que el hidrato no sea siempre
 * arroz. Con el nombre del plato solo no se ve — «Bowl mediterráneo» no dice
 * si lleva pollo o atún.
 */

const ing = (
  nombre: string,
  grupo: Ingrediente['grupo'],
  cantidad: number,
): Ingrediente => ({
  id: `i-${nombre}`,
  nombre,
  cantidad_base: cantidad,
  unidad: 'g',
  grupo,
  escalable: true,
  opcional: false,
});

const receta = (id: string, nombre: string, ingredientes: Ingrediente[]): Receta =>
  ({
    id,
    nombre,
    categorias: ['comida'],
    tags: [],
    base: {},
    ingredientes,
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  }) as Receta;

const BOWL = receta('rc_bowl', 'Bowl mediterráneo', [
  ing('Pollo', 'proteicos_magros', 120),
  ing('Arroz', 'almidones', 60),
  ing('Pepino', 'verduras', 80),
]);

const PLAN: Plan = {
  id: 'pl1',
  clientId: 'c1',
  nombre: 'Plan',
  fase: 1,
  archivado: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  menuPropuesto: {
    desde: '2026-01-05',
    semanas: [{ dias: { 0: { comidas: { comida: 'rc_bowl' } } } }],
  },
  dayTypes: [
    {
      id: 'dt1',
      nombre: 'Día base',
      proteinaGkg: 2,
      hcGkg: 3,
      meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
      grid: { comida: { proteicos_magros: 4, almidones: 3 } },
      notas: {},
      recetas: { comida: ['rc_bowl'] },
    },
  ],
} as unknown as Plan;

const pintar = () =>
  render(<RepartirLaSemana plan={PLAN} recetas={[BOWL]} onChange={vi.fn()} />);

describe('La tabla de cómo va quedando', () => {
  it('dice qué pone la proteína y qué el hidrato', () => {
    pintar();
    const tabla = screen.getByRole('table');
    expect(within(tabla).getByText('Pollo')).toBeTruthy();
    expect(within(tabla).getByText('Arroz')).toBeTruthy();
  });

  /* Está en todos los platos: escribirla siete veces taparía lo que sí cambia. */
  it('y no repite la verdura, que está en todos', () => {
    pintar();
    expect(within(screen.getByRole('table')).queryByText('Pepino')).toBeNull();
  });

  /*
   * Con las fuentes la tabla crece al triple de alto: para mirar de un vistazo
   * si quedan huecos, estorban.
   */
  it('se pueden apagar', () => {
    pintar();
    fireEvent.click(screen.getByText('Ver proteína e hidrato'));
    const tabla = screen.getByRole('table');
    expect(within(tabla).queryByText('Pollo')).toBeNull();
    // Y el plato sigue ahí, que es lo que no puede desaparecer.
    expect(within(tabla).getByText('Bowl')).toBeTruthy();
  });

  it('los huecos siguen siendo huecos', () => {
    pintar();
    expect(screen.getByText(/6 huecos sin plato/)).toBeTruthy();
  });
});
