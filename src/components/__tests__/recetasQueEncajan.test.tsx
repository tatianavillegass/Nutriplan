// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { RecipeShortcuts } from '../client/RecipeShortcuts';
import type { Receta } from '../../types/recipe';
import type { Client } from '../../types/client';
import type { DayType, Meal } from '../../types/plan';
import { FOOD_CATALOG } from '../../data/foodCatalog';

afterEach(cleanup);

const COMIDA: Meal = { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 3 };

const DIA = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 1.8,
  hcGkg: 3,
  meals: [COMIDA],
  grid: { comida: { almidones: 3, proteicos_magros: 4 } },
  notas: {},
} as unknown as DayType;

const receta = (extra: Partial<Receta> = {}): Receta =>
  ({
    id: 'r1',
    nombre: 'Pollo con arroz',
    categorias: ['comida'],
    tags: [],
    base: { almidones: 3, proteicos_magros: 4 },
    ingredientes: [
      {
        id: 'i1',
        nombre: 'Arroz blanco crudo',
        foodId: 'a-arroz-blanco-crudo',
        cantidad_base: 60,
        unidad: 'g',
        grupo: 'almidones',
        escalable: true,
        opcional: false,
      },
    ],
    preparacion: 'Cuece el arroz 12 minutos.\nHaz el pollo a la plancha.',
    notas: '',
    createdAt: '',
    updatedAt: '',
    ...extra,
  }) as Receta;

const CLIENTA = { id: 'c1', nombre: 'Ana', preferencias: [] } as unknown as Client;

const pintar = (r: Receta) =>
  render(
    <RecipeShortcuts
      dayType={DIA}
      meal={COMIDA}
      recetas={[r]}
      foods={FOOD_CATALOG}
      client={CLIENTA}
      porciones={{}}
      onUsar={vi.fn()}
    />,
  );

const abrir = () => fireEvent.click(screen.getByText(/recetas que encajan/));

/**
 * SE COCINA DE PIE EN LA COCINA
 *
 * Con sólo el nombre hay que leerse las cuatro tarjetas para decidir; un plato
 * se reconoce de un vistazo. Y una vez elegido, lo siguiente es hacerlo.
 */
describe('Las recetas que encajan', () => {
  it('llevan la foto del plato', () => {
    const { container } = pintar(receta({ foto_url: 'https://x/foto.jpg' }));
    abrir();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/foto.jpg');
  });

  /** Sin hueco, las dos tarjetas de una fila se descuadran entre sí. */
  it('y las que no tienen foto dejan el hueco igual', () => {
    const { container } = pintar(receta());
    abrir();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.h-12.w-12')).toBeTruthy();
  });

  it('la preparación se puede leer antes de elegirla', () => {
    pintar(receta());
    abrir();
    expect(screen.queryByText(/Cuece el arroz/)).toBeNull();
    fireEvent.click(screen.getByText('Cómo se hace'));
    expect(screen.getByText(/Cuece el arroz/)).toBeTruthy();
  });

  /**
   * Y se abre sola al elegirla: acabas de decidir qué cenas y lo siguiente es
   * cocinarlo. Antes el panel se cerraba y había que volver a buscarla.
   */
  it('y se abre sola al elegir la receta', () => {
    pintar(receta());
    abrir();
    fireEvent.click(screen.getByText('Pollo con arroz'));
    expect(screen.getByText(/Cuece el arroz/)).toBeTruthy();
  });

  it('si la receta no lleva preparación, no se ofrece nada', () => {
    pintar(receta({ preparacion: '' }));
    abrir();
    expect(screen.queryByText('Cómo se hace')).toBeNull();
  });
});
