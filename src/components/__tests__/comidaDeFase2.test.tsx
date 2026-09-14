// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ComidaDeFase2 } from '../phase2/ComidaDeFase2';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Meal } from '../../types/plan';

afterEach(cleanup);

const DESAYUNO = { id: 'd', nombre: 'Desayuno', slot: 'desayuno', orden: 1 } as Meal;

const DIA = {
  id: 'dt',
  nombre: 'Día base',
  meals: [DESAYUNO],
  grid: { d: { almidones: 1, fruta: 1 } },
  notas: {},
  despensa: { d: { seleccion: ['a-avena-copos', 'a-platano', 'a-manzana'] } },
} as unknown as DayType;

const pintar = (dayType: DayType = DIA) =>
  render(
    <ComidaDeFase2
      dayType={dayType}
      meal={DESAYUNO}
      foods={FOOD_CATALOG}
      onDespensa={vi.fn()}
      onCombinaciones={vi.fn()}
      onAceite={vi.fn()}
      onNota={vi.fn()}
    />,
  );

/**
 * UNA SOLA FILA POR COMIDA
 *
 * Eran dos tarjetas —la despensa y las combinaciones—, o sea dos listas de las
 * mismas comidas en las que había que abrir el desayuno dos veces en dos sitios
 * distintos, y sin que nada dijera que la primera alimenta a la segunda.
 */
describe('La comida de fase 2', () => {
  it('empieza plegada y dice cómo está sin abrirla', () => {
    pintar();
    expect(screen.getByText('Desayuno')).toBeTruthy();
    expect(screen.getByText(/3 alimentos/)).toBeTruthy();
    expect(screen.getByText(/combinaciones automáticas/)).toBeTruthy();
    /* Lo pautado, que es el contexto de todo lo de dentro. */
    expect(screen.getByText(/1 almidones · 1 fruta/)).toBeTruthy();
  });

  it('y al abrirla salen los dos pasos, en orden', () => {
    pintar();
    fireEvent.click(screen.getByText('Desayuno'));
    expect(screen.getByText(/1 · Qué alimentos tiene/)).toBeTruthy();
    expect(screen.getByText(/2 · Qué combinaciones le propones/)).toBeTruthy();
  });

  /** El orden importa: lo de arriba es lo que hace posible lo de abajo. */
  it('el primer paso explica que alimenta al segundo', () => {
    pintar();
    fireEvent.click(screen.getByText('Desayuno'));
    expect(screen.getByText(/salen las combinaciones de abajo/)).toBeTruthy();
  });

  /** Sin abrirla hay que poder ver si esa comida la compusiste tú. */
  it('avisa cuando las combinaciones son suyas', () => {
    const conPropias = {
      ...DIA,
      combinaciones: {
        d: [
          {
            id: 'c1',
            bucket: 'carbohidrato',
            items: [{ foodId: 'a-avena-copos', porciones: 1 }],
          },
        ],
      },
    } as unknown as DayType;
    pintar(conPropias);
    expect(screen.getByText(/1 combinación tuya/)).toBeTruthy();
  });

  /** Los dos editores viven dentro, sin su propia fila plegable. */
  it('no hay dos cabeceras de «Desayuno» dentro', () => {
    pintar();
    fireEvent.click(screen.getByText('Desayuno'));
    expect(screen.getAllByText('Desayuno').length).toBe(1);
  });
});
