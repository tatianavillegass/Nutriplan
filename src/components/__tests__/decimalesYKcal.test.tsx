// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { NumeroConComa, aNumero } from '../common/NumeroConComa';

afterEach(cleanup);

/**
 * LA COMA SE BORRABA SOLA
 *
 * El padre guardaba el número y pintaba `String(numero)`: al teclear «1,» se
 * guardaba 1 y volvía «1», así que la coma desaparecía en el mismo gesto y el
 * decimal no se podía llegar a escribir. Es el mismo fallo que tenían los tags
 * de las recetas.
 */

/** Un padre como los de verdad: guarda el número, no el texto. */
function Prueba({
  inicial,
  alCambiar = (_: number | undefined) => {},
  cero = false,
}: {
  inicial?: number;
  alCambiar?: (n: number | undefined) => void;
  cero?: boolean;
}) {
  const [n, setN] = useState<number | undefined>(inicial);
  return (
    <NumeroConComa
      numero={n}
      cero={cero}
      onNumero={(v) => {
        setN(v);
        alCambiar(v);
      }}
      aria-label="Proteína"
    />
  );
}

const campo = () => screen.getByLabelText('Proteína') as HTMLInputElement;

const escribir = (texto: string) => {
  for (let i = 1; i <= texto.length; i++) {
    fireEvent.change(campo(), { target: { value: texto.slice(0, i) } });
  }
};

describe('Escribir un decimal con coma', () => {
  it('la coma no se borra al teclearla', () => {
    render(<Prueba />);
    escribir('14,');
    expect(campo().value).toBe('14,');
  });

  it('y se llega a escribir el decimal entero', () => {
    const alCambiar = vi.fn();
    render(<Prueba alCambiar={alCambiar} />);
    escribir('14,4');
    expect(campo().value).toBe('14,4');
    expect(alCambiar).toHaveBeenLastCalledWith(14.4);
  });

  it('con punto también, que hay quien lo escribe así', () => {
    const alCambiar = vi.fn();
    render(<Prueba alCambiar={alCambiar} />);
    escribir('0.5');
    expect(alCambiar).toHaveBeenLastCalledWith(0.5);
  });

  it('las letras siguen sin entrar', () => {
    render(<Prueba />);
    fireEvent.change(campo(), { target: { value: '12abc' } });
    expect(campo().value).toBe('12');
  });

  it('lo que ya estaba guardado se ve con coma', () => {
    render(<Prueba inicial={59.8} />);
    expect(campo().value).toBe('59,8');
  });

  it('borrarlo todo deja la casilla vacía, no un cero', () => {
    const alCambiar = vi.fn();
    render(<Prueba inicial={10} alCambiar={alCambiar} />);
    fireEvent.change(campo(), { target: { value: '' } });
    expect(alCambiar).toHaveBeenLastCalledWith(undefined);
  });
});

describe('El cero es un dato en una etiqueta', () => {
  it('sin permitirlo, un 0 cuenta como no puesto', () => {
    expect(aNumero('0')).toBeUndefined();
  });

  it('permitiéndolo, 0 g de grasa se guarda como 0', () => {
    expect(aNumero('0', true)).toBe(0);
    const alCambiar = vi.fn();
    render(<Prueba cero alCambiar={alCambiar} />);
    escribir('0');
    expect(alCambiar).toHaveBeenLastCalledWith(0);
  });

  it('un negativo no es un dato ni con cero permitido', () => {
    expect(aNumero('-3', true)).toBeUndefined();
  });
});
