// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FoodPicker } from '../food/FoodPicker';
import type { Alimento } from '../../types/food';

afterEach(cleanup);

const a = (id: string, nombre: string): Alimento =>
  ({
    id,
    nombre,
    grupo: 'lacteos_enteros',
    medida_casera: '1 bote',
    gramos: 125,
    intercambios: 1,
    nutrientes: { kcal: 100, hc: 5, proteina: 4, grasa: 5 },
    comidas_sugeridas: [],
    alergenos: [],
    apto: [],
  }) as unknown as Alimento;

/**
 * «HAY ALIMENTOS QUE SALEN DOBLE»
 *
 * Al aceptar un alimento de una clienta nace una copia en el catálogo, y el de
 * la clienta sigue vivo en su registro — no se puede borrar, el registro del
 * día es suyo. Así que el mismo yogur aparecía dos veces en el buscador.
 */
describe('El buscador de alimentos', () => {
  const pintar = (foods: Alimento[]) => {
    const onSelect = vi.fn();
    render(<FoodPicker foods={foods} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'yogur' } });
    return onSelect;
  };

  it('enseña una sola vez el que está repetido', () => {
    pintar([a('f_1', 'Yogur griego'), a('mio_9', 'Yogur griego')]);
    expect(screen.getAllByText('Yogur griego')).toHaveLength(1);
  });

  /** El del catálogo, que es el revisado. */
  it('y se queda con el del catálogo', () => {
    const onSelect = pintar([a('f_1', 'Yogur griego'), a('mio_9', 'Yogur griego')]);
    fireEvent.click(screen.getByText('Yogur griego'));
    expect(onSelect.mock.calls[0][0].id).toBe('f_1');
  });

  it('pero no esconde dos que sólo se parecen', () => {
    pintar([a('f_1', 'Yogur griego'), a('f_2', 'Yogur griego light')]);
    expect(screen.getByText('Yogur griego')).toBeTruthy();
    expect(screen.getByText('Yogur griego light')).toBeTruthy();
  });
});
