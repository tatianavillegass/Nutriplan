// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FoodForm } from '../food/FoodForm';

afterEach(cleanup);

/**
 * DAR DE ALTA UN ALIMENTO QUE GASTA DOS GRUPOS
 *
 * El Catalina Crunch se guardaba sin su equivalencia y al marcarlo sólo
 * descontaba el almidón. El motivo: la fila del grupo se pintaba únicamente
 * si su valor era mayor que cero, así que al borrar el 1 para escribir 0,5 la
 * fila desaparecía a mitad de escribir y no había forma de dejar medio
 * intercambio.
 */
const rellenarNutrientes = () => {
  // Las casillas de la etiqueta admiten coma, así que ya no son «spinbutton».
  const cajas = document.querySelectorAll('input[inputmode="decimal"]');
  // kcal, hc, proteína, grasa, fibra, azúcares
  fireEvent.change(cajas[1], { target: { value: '41,5' } });
  fireEvent.change(cajas[2], { target: { value: '30,6' } });
  fireEvent.change(cajas[3], { target: { value: '16,8' } });
  fireEvent.change(cajas[4], { target: { value: '25' } });
};

describe('El panel de «gasta más de un intercambio»', () => {
  it('la fila se queda aunque se vacíe la casilla para reescribirla', () => {
    render(<FoodForm onGuardar={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Avena en copos'), {
      target: { value: 'Catalina Crunch' },
    });
    rellenarNutrientes();

    fireEvent.change(screen.getAllByRole('combobox').at(-1)!, { target: { value: 'almidones' } });
    // La fila trae su botón de quitar: es lo que identifica a la fila.
    const quitar = () => screen.queryByLabelText('Quitar Almidones');
    expect(quitar()).toBeTruthy();

    // Se borra para escribir 0,5: la fila tiene que seguir ahí.
    const casilla = screen
      .getAllByRole('spinbutton')
      .find((i) => (i as HTMLInputElement).value === '1')!;
    fireEvent.change(casilla, { target: { value: '' } });
    expect(quitar()).toBeTruthy();

    fireEvent.change(casilla, { target: { value: '0.5' } });
    expect((casilla as HTMLInputElement).value).toBe('0.5');

    // Y con la × sí desaparece.
    fireEvent.click(quitar()!);
    expect(quitar()).toBeNull();
  });

  it('guarda la equivalencia de los dos grupos', () => {
    const onGuardar = vi.fn();
    render(<FoodForm onGuardar={onGuardar} />);
    fireEvent.change(screen.getByPlaceholderText('Avena en copos'), {
      target: { value: 'Catalina Crunch' },
    });
    rellenarNutrientes();

    const desplegableEquivale = () => screen.getAllByRole('combobox').at(-1)!;
    fireEvent.change(desplegableEquivale(), { target: { value: 'almidones' } });
    const media = screen.getAllByRole('spinbutton').find((i) => (i as HTMLInputElement).value === '1')!;
    fireEvent.change(media, { target: { value: '0.5' } });
    fireEvent.change(desplegableEquivale(), { target: { value: 'proteicos_grasos' } });

    fireEvent.click(screen.getByText(/Añadir a la base de datos/));

    expect(onGuardar).toHaveBeenCalledTimes(1);
    expect(onGuardar.mock.calls[0][0].equivale).toEqual({
      almidones: 0.5,
      proteicos_grasos: 1,
    });
  });

  it('un alimento normal se guarda sin equivalencia', () => {
    const onGuardar = vi.fn();
    render(<FoodForm onGuardar={onGuardar} />);
    fireEvent.change(screen.getByPlaceholderText('Avena en copos'), {
      target: { value: 'Pechuga de pollo' },
    });
    const cajas = document.querySelectorAll('input[inputmode="decimal"]');
    fireEvent.change(cajas[2], { target: { value: '23' } });
    fireEvent.change(cajas[3], { target: { value: '2' } });

    fireEvent.click(screen.getByText(/Añadir a la base de datos/));
    expect(onGuardar.mock.calls[0][0].equivale).toBeUndefined();
  });
});
