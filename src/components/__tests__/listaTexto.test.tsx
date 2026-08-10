// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ListaTexto, partirLista } from '../common/ListaTexto';

afterEach(cleanup);

/**
 * El fallo que arregla esto: al teclear la coma, la coma desaparecía sola y
 * era imposible escribir un segundo tag. Estos tests escriben letra a letra,
 * que es como se destapa.
 */

/** Un padre de verdad: guarda la lista y se la devuelve al recuadro. */
function Prueba({ inicial = [] as string[], alCambiar = (_: string[]) => {} }) {
  const [valor, setValor] = useState(inicial);
  return (
    <ListaTexto
      valor={valor}
      onChange={(v) => {
        setValor(v);
        alCambiar(v);
      }}
      placeholder="tags"
    />
  );
}

const escribir = (texto: string) => {
  const campo = screen.getByPlaceholderText('tags') as HTMLInputElement;
  for (let i = 1; i <= texto.length; i++) {
    fireEvent.change(campo, { target: { value: texto.slice(0, i) } });
  }
  return campo;
};

describe('Separar por comas', () => {
  it('quita espacios sobrantes y partes vacías', () => {
    expect(partirLista(' pollo ,  rápido , ')).toEqual(['pollo', 'rápido']);
  });

  it('un texto vacío es una lista vacía', () => {
    expect(partirLista('   ')).toEqual([]);
  });
});

describe('Escribir varios tags seguidos', () => {
  it('la coma no se borra sola al teclearla', () => {
    render(<Prueba />);
    const campo = escribir('pollo,');
    expect(campo.value).toBe('pollo,');
  });

  it('se pueden poner tres, que era lo que no dejaba', () => {
    const alCambiar = vi.fn();
    render(<Prueba alCambiar={alCambiar} />);
    escribir('pollo, rápido, sin lactosa');
    expect(alCambiar).toHaveBeenLastCalledWith(['pollo', 'rápido', 'sin lactosa']);
  });

  it('el espacio después de la coma tampoco se pierde', () => {
    render(<Prueba />);
    const campo = escribir('pollo, ');
    expect(campo.value).toBe('pollo, ');
  });

  it('lo que ya estaba guardado se ve al abrir', () => {
    render(<Prueba inicial={['pollo', 'rápido']} />);
    expect((screen.getByPlaceholderText('tags') as HTMLInputElement).value).toBe('pollo, rápido');
  });

  it('borrarlo todo deja la lista vacía', () => {
    const alCambiar = vi.fn();
    render(<Prueba inicial={['pollo']} alCambiar={alCambiar} />);
    fireEvent.change(screen.getByPlaceholderText('tags'), { target: { value: '' } });
    expect(alCambiar).toHaveBeenLastCalledWith([]);
  });
});
