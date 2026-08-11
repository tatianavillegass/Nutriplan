// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

/**
 * Gramos y medidas caseras se mezclaban en la misma lista y confundía.
 * Ahora se elige una de las dos y vale para todos los ingredientes.
 */

const avena = FOOD_CATALOG.find((f) => f.id === 'a-avena-copos')!;

const PORRIDGE: Receta = {
  id: 'r1',
  nombre: 'Porridge de avena',
  categorias: ['desayuno'],
  tags: [],
  base: { almidones: 1 },
  ingredientes: [
    {
      id: 'i1',
      nombre: 'Copos de avena',
      foodId: avena.id,
      cantidad_base: avena.gramos,
      unidad: 'g',
      grupo: 'almidones',
      escalable: true,
      opcional: false,
    },
  ],
  preparacion: 'Calentar.',
  notas: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const pintar = () =>
  render(
    <ScaledRecipeView receta={PORRIDGE} requeridos={{ almidones: 2 }} foods={FOOD_CATALOG} />,
  );

describe('Gramos o medidas caseras, pero no las dos a la vez', () => {
  it('arranca en gramos, que es lo que se pesa', () => {
    pintar();
    expect(screen.getAllByText(/\d+ g/).length).toBeGreaterThan(0);
    expect(screen.getByRole('switch')).toHaveProperty('ariaChecked', 'false');
  });

  it('el interruptor cambia a la medida de casa', () => {
    pintar();
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveProperty('ariaChecked', 'true');
    // La medida casera de la avena habla de tazas, no de gramos.
    expect(document.body.textContent).toMatch(new RegExp(avena.medida_casera.split(' ').pop()!));
  });

  it('y se puede volver a los gramos', () => {
    pintar();
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toHaveProperty('ariaChecked', 'false');
  });

  it('la lista se titula Ingredientes, como en la referencia', () => {
    pintar();
    expect(screen.getByText('Ingredientes')).toBeTruthy();
  });
});
