// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NumeroConComa, aNumero } from '../common/NumeroConComa';
import { MisMedidas } from '../client/MisMedidas';

afterEach(cleanup);

/**
 * EN ESPAÑA SE ESCRIBE 59,8
 *
 * Con una casilla de tipo «número», el navegador espera un punto: al teclear la
 * coma tiraba el valor entero y la casilla se quedaba vacía. Parecía que la app
 * no dejaba poner decimales, y lo que pasaba es que no entendía la coma.
 */
describe('Escribir un número con coma', () => {
  it('la coma se admite y se traduce', () => {
    expect(aNumero('59,8')).toBe(59.8);
    expect(aNumero('59.8')).toBe(59.8);
  });

  it('lo vacío o lo ilegible no es un número', () => {
    expect(aNumero('')).toBeUndefined();
    expect(aNumero('   ')).toBeUndefined();
    expect(aNumero('hola')).toBeUndefined();
  });

  it('no se cuela una letra', () => {
    const onChange = vi.fn();
    render(<NumeroConComa value="" onChange={onChange} aria-label="Peso" />);
    fireEvent.change(screen.getByLabelText('Peso'), { target: { value: '59,8kg' } });
    expect(onChange).toHaveBeenCalledWith('59,8');
  });
});

describe('Apuntar el peso con decimales', () => {
  it('59,8 se guarda como 59,8', () => {
    const onGuardar = vi.fn();
    render(
      <MisMedidas registros={[]} preparacion={{ hechos: [] }} onGuardar={onGuardar} />,
    );
    fireEvent.click(screen.getByText('Apuntar'));

    const casillas = document.querySelectorAll('input[inputmode="decimal"]');
    fireEvent.change(casillas[0], { target: { value: '59,8' } });
    fireEvent.click(screen.getByText('Guardar'));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ peso: 59.8 }),
    );
  });
});
