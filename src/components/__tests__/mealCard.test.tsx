// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MealCard } from '../client/MealCard';
import type { Receta } from '../../types/recipe';
import type { Meal } from '../../types/plan';

afterEach(cleanup);

/**
 * El día entero cabe en una pantalla: cada comida es una tarjeta con su
 * nombre y el plato que toca, y la receta sale al pulsarla. De paso, el
 * título deja de pelearse con los botones.
 */

const DESAYUNO: Meal = { id: 'm1', nombre: 'Desayuno', slot: 'desayuno', orden: 1 };

const plato = (id: string, nombre: string): Receta => ({
  id,
  nombre,
  categorias: ['desayuno'],
  tags: [],
  base: {},
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const A = plato('r1', 'Queso batido con copos de avena, nueces, almendras y miel');
const B = plato('r2', 'Tostada de aguacate');

const pintar = (props: Partial<Parameters<typeof MealCard>[0]> = {}) =>
  render(
    <MealCard
      meal={DESAYUNO}
      receta={A}
      opciones={[A]}
      hecha={false}
      onElegir={() => {}}
      onAlternarHecha={() => {}}
      {...props}
    >
      <p>Ingredientes de la receta</p>
    </MealCard>,
  );

describe('La comida se ve plegada', () => {
  it('enseña la comida y el plato sin abrir nada', () => {
    pintar();
    expect(screen.getByText('Desayuno')).toBeTruthy();
    expect(screen.getByText(A.nombre)).toBeTruthy();
  });

  it('la receta no está hasta que se pulsa', () => {
    pintar();
    expect(screen.queryByText('Ingredientes de la receta')).toBeNull();
    fireEvent.click(screen.getByText(A.nombre));
    expect(screen.getByText('Ingredientes de la receta')).toBeTruthy();
  });

  it('y se vuelve a cerrar', () => {
    pintar();
    fireEvent.click(screen.getByText(A.nombre));
    fireEvent.click(screen.getByLabelText('Cerrar la receta'));
    expect(screen.queryByText('Ingredientes de la receta')).toBeNull();
  });

  it('al imprimir sale abierta sin tener que pulsar', () => {
    pintar({ siempreAbierta: true });
    expect(screen.getByText('Ingredientes de la receta')).toBeTruthy();
  });
});

describe('Marcar como hecha', () => {
  it('el botón está sin abrir la receta', () => {
    const onAlternarHecha = vi.fn();
    pintar({ onAlternarHecha });
    fireEvent.click(screen.getByLabelText('Marcar como hecha'));
    expect(onAlternarHecha).toHaveBeenCalled();
  });

  it('una vez hecha se ve de un vistazo', () => {
    pintar({ hecha: true });
    expect(screen.getByText('✓ hecha')).toBeTruthy();
    expect(screen.getByLabelText('Desmarcar como hecha')).toBeTruthy();
  });
});

describe('Cambiar de plato', () => {
  it('con una sola opción no hay nada que cambiar', () => {
    pintar();
    expect(screen.queryByLabelText('Cambiar de plato')).toBeNull();
  });

  it('con dos, el botón pasa a la otra y dice por dónde vas', () => {
    const onElegir = vi.fn();
    pintar({ opciones: [A, B], onElegir });
    expect(screen.getByText('1/2')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Cambiar de plato'));
    expect(onElegir).toHaveBeenCalledWith('r2');
  });

  it('y desde la última vuelve a la primera', () => {
    const onElegir = vi.fn();
    pintar({ opciones: [A, B], receta: B, onElegir });
    fireEvent.click(screen.getByLabelText('Cambiar de plato'));
    expect(onElegir).toHaveBeenCalledWith('r1');
  });
});
