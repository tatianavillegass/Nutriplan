// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LoFijoDeLaComida } from '../client/LoFijoDeLaComida';
import type { Alimento } from '../../types/food';
import type { Fijo } from '../../types/plan';

afterEach(cleanup);

/**
 * EL POSTRE SE ELIGE
 *
 * Lo que ve Luis: «Después — Manzana 130 g» y un botón para cambiarla. La
 * manzana era un reflejo de que de postre tiene una porción de fruta, así que
 * si hoy hay peras, hay peras.
 */

const fruta = (id: string, nombre: string, gramos: number): Alimento => ({
  id,
  nombre,
  grupo: 'fruta',
  medida_casera: '1 pieza',
  gramos,
  intercambios: 1,
  nutrientes: { kcal: 52, hc: 14, proteina: 0.3, grasa: 0.2 },
  comidas_sugeridas: [],
  alergenos: [],
  apto: [],
});

const MANZANA = fruta('a-manzana', 'Manzana', 130);
const PERA = fruta('a-pera', 'Pera', 120);
const KIWI = fruta('a-kiwi', 'Kiwi', 110);
const LECHE: Alimento = { ...MANZANA, id: 'a-leche', nombre: 'Leche semi', grupo: 'lacteos_semi', gramos: 200 };
const FOODS = [MANZANA, PERA, KIWI, LECHE];

const POSTRE: Fijo = {
  id: 'fj1',
  foodId: MANZANA.id,
  nombre: 'Manzana',
  gramos: 130,
  unidad: 'g',
  tipo: 'postre',
};

const pintar = (props: Partial<Parameters<typeof LoFijoDeLaComida>[0]> = {}) =>
  render(
    <LoFijoDeLaComida
      fijos={[POSTRE]}
      mealNombre="Cena"
      foods={FOODS}
      onCambiar={vi.fn()}
      {...props}
    />,
  );

describe('Lo que ve', () => {
  it('su postre, con la cantidad', () => {
    pintar();
    expect(screen.getByText('Manzana')).toBeTruthy();
    expect(screen.getByText(/130/)).toBeTruthy();
  });

  it('y un botón para cambiarlo', () => {
    pintar();
    expect(screen.getByTitle(/cambiar manzana/i)).toBeTruthy();
  });

  /* Lo que ella cerró, no se toca: ahí esa fruta es la pauta. */
  it('no sale si ella lo ha cerrado', () => {
    pintar({ fijos: [{ ...POSTRE, abierto: false }] });
    expect(screen.queryByTitle(/cambiar/i)).toBeNull();
  });

  /* Y «un café» a secas no tiene nada que cambiar. */
  it('ni en lo que no es un alimento', () => {
    pintar({ fijos: [{ ...POSTRE, foodId: undefined }] });
    expect(screen.queryByTitle(/cambiar/i)).toBeNull();
  });

  /* Sin la lista de alimentos el bloque sigue leyéndose: sólo no se cambia. */
  it('sin catálogo, se lee pero no se cambia', () => {
    pintar({ foods: undefined });
    expect(screen.getByText('Manzana')).toBeTruthy();
    expect(screen.queryByTitle(/cambiar/i)).toBeNull();
  });
});

describe('Al cambiarlo', () => {
  it('salen las otras frutas con sus gramos', () => {
    pintar();
    fireEvent.click(screen.getByTitle(/cambiar manzana/i));
    expect(screen.getByRole('button', { name: /Pera/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Kiwi/ })).toBeTruthy();
  });

  /* Fruta por fruta: la leche no es un postre equivalente. */
  it('y nada de otro grupo', () => {
    pintar();
    fireEvent.click(screen.getByTitle(/cambiar manzana/i));
    expect(screen.queryByRole('button', { name: /Leche/ })).toBeNull();
  });

  it('elegir una lo avisa hacia arriba, para guardarlo en su día', () => {
    const onCambiar = vi.fn();
    pintar({ onCambiar });
    fireEvent.click(screen.getByTitle(/cambiar manzana/i));
    fireEvent.click(screen.getByRole('button', { name: /Pera/ }));
    expect(onCambiar).toHaveBeenCalledWith('fj1', PERA.id);
  });

  /*
   * Lo que no se le puede ofrecer no se le ofrece: el catálogo que lee su app
   * es el de la nutricionista tal cual, sin filtrar por sus alergias.
   */
  it('lo que tiene vetado no aparece', () => {
    pintar({ permitido: (f: Alimento) => f.id !== KIWI.id });
    fireEvent.click(screen.getByTitle(/cambiar manzana/i));
    expect(screen.getByRole('button', { name: /Pera/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Kiwi/ })).toBeNull();
  });

  /* Y se puede volver atrás: hoy pera no es para siempre. */
  it('se puede volver a la suya', () => {
    const onCambiar = vi.fn();
    pintar({
      fijos: [{ ...POSTRE, foodId: PERA.id, nombre: 'Pera', gramos: 120 }],
      cambios: { fj1: PERA.id },
      onCambiar,
    });
    fireEvent.click(screen.getByTitle(/cambiar pera/i));
    fireEvent.click(screen.getByRole('button', { name: /volver a/i }));
    expect(onCambiar).toHaveBeenCalledWith('fj1', undefined);
  });
});
