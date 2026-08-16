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

/**
 * Comer fuera pasa en todas las fases, no sólo donde se marcan porciones: en
 * la tarjeta de la comida no había forma de decirlo.
 */
describe('Comida libre', () => {
  it('el botón está junto al nombre de la comida', () => {
    const onLibre = vi.fn();
    pintar({ onLibre });
    fireEvent.click(screen.getByText('Libre'));
    expect(onLibre).toHaveBeenCalled();
  });

  it('una comida ya hecha no se marca como libre', () => {
    pintar({ onLibre: vi.fn(), hecha: true });
    expect(screen.queryByText('Libre')).toBeNull();
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

/**
 * ELEGIR ES VER LAS OPCIONES, NO IR PASANDO
 *
 * Antes se cambiaba de plato de uno en uno: para llegar a la tercera había que
 * pasar por la segunda, y no se sabía qué venía. Con las fotos delante se
 * elige lo que apetece, que es como se decide qué comer.
 */
describe('Elegir entre las opciones', () => {
  const abrirOpciones = () =>
    fireEvent.click(screen.getByText(/Cambiar desayuno/i));

  it('con una sola opción no hay nada que elegir', () => {
    pintar();
    expect(screen.queryByText(/Cambiar desayuno/i)).toBeNull();
  });

  it('con varias se dice cuántas hay y por cuál vas', () => {
    pintar({ opciones: [A, B] });
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('se despliegan todas y se elige la que apetezca', () => {
    const onElegir = vi.fn();
    pintar({ opciones: [A, B], onElegir });
    abrirOpciones();

    expect(screen.getByText(/2 opciones/)).toBeTruthy();
    fireEvent.click(screen.getByText(B.nombre));
    expect(onElegir).toHaveBeenCalledWith('r2');
  });

  it('y al elegir se cierra la lista', () => {
    pintar({ opciones: [A, B] });
    abrirOpciones();
    fireEvent.click(screen.getByText(B.nombre));
    expect(screen.queryByText(/2 opciones/)).toBeNull();
  });
});
