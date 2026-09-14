// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BasarEnOtroPlan } from '../planning/BasarEnOtroPlan';
import type { Client } from '../../types/client';
import type { DayType, Meal, Plan } from '../../types/plan';

afterEach(cleanup);

const comida = (id: string, slot: Meal['slot'], nombre: string): Meal =>
  ({ id, slot, nombre, orden: 1 }) as Meal;

const DE_EL = {
  id: 'dt-el',
  nombre: 'Día base',
  meals: [comida('e-des', 'desayuno', 'Desayuno'), comida('e-cen', 'cena', 'Cena')],
  grid: { 'e-des': { almidones: 4 }, 'e-cen': { almidones: 2, proteicos_magros: 4 } },
  notas: {},
} as unknown as DayType;

const DE_ELLA = {
  id: 'dt-ella',
  nombre: 'Día base',
  meals: [comida('a-des', 'desayuno', 'Desayuno'), comida('a-cen', 'cena', 'Cena')],
  grid: { 'a-des': { almidones: 2 }, 'a-cen': { proteicos_magros: 2 } },
  notas: {},
} as unknown as DayType;

const JUAN = { id: 'c-el', nombre: 'Juan Guillermo Pérez' } as Client;
const MARITZA = { id: 'c-ella', nombre: 'Maritza Gómez' } as Client;

const PLAN_EL = {
  id: 'p-el',
  clientId: 'c-el',
  fase: 1,
  dayTypes: [DE_EL],
  recetasAsignadas: { 'e-des': ['r1'], 'e-cen': ['r2', 'r3'] },
} as unknown as Plan;

const PLAN_ELLA = {
  id: 'p-ella',
  clientId: 'c-ella',
  fase: 1,
  dayTypes: [DE_ELLA],
} as unknown as Plan;

const pintar = (onCopiar = vi.fn(), otros = [{ client: JUAN, plan: PLAN_EL }]) => {
  const r = render(
    <BasarEnOtroPlan
      client={MARITZA}
      plan={PLAN_ELLA}
      dayType={DE_ELLA}
      otros={otros}
      onCopiar={onCopiar}
    />,
  );
  return { ...r, onCopiar };
};

const abrirYElegir = () => {
  fireEvent.click(screen.getByText('Basarme en otro plan'));
  fireEvent.click(screen.getByText(/Juan Guillermo/));
};

/**
 * Muchas parejas comen lo mismo: los mismos platos, la misma compra y la misma
 * nevera, pero no las mismas cantidades.
 */
describe('Basarse en el plan de otra persona', () => {
  it('se ofrece plegado, para no meterse en medio del cálculo', () => {
    pintar();
    expect(screen.getByText('Basarme en otro plan')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/De quién/)).toBeNull();
  });

  /** Sin nadie de quien copiar, no hay nada que ofrecer. */
  it('no aparece si no hay otros planes', () => {
    const { container } = pintar(vi.fn(), []);
    expect(container.textContent).toBe('');
  });

  it('busca por nombre y dice qué trae ese plan', () => {
    pintar();
    fireEvent.click(screen.getByText('Basarme en otro plan'));
    fireEvent.change(screen.getByPlaceholderText(/De quién/), { target: { value: 'juan' } });
    fireEvent.click(screen.getByText(/Juan Guillermo/));
    expect(screen.getByText(/3 recetas/)).toBeTruthy();
  });

  /** Un botón que lo copiara todo pisaría el reparto recién calculado. */
  it('se elige qué copiar', () => {
    pintar();
    abrirYElegir();
    expect(screen.getByText('Las recetas')).toBeTruthy();
    expect(screen.getByText('El reparto de intercambios')).toBeTruthy();
    expect(screen.getByText('La despensa y las combinaciones')).toBeTruthy();
    expect(screen.getByText('La semana organizada')).toBeTruthy();
  });

  /**
   * Copiar el reparto tal cual sería darle a ella el plan de él. Se dice con
   * qué números se escala antes de pulsar.
   */
  it('avisa de a qué calorías se va a ajustar el reparto', () => {
    pintar();
    abrirYElegir();
    expect(screen.getByText(/Su reparto se ajusta de/)).toBeTruthy();
  });

  it('y al copiar devuelve los parches', () => {
    const { onCopiar } = pintar();
    abrirYElegir();
    fireEvent.click(screen.getByText('Traerme lo marcado'));

    const [copiado, de] = onCopiar.mock.calls[0];
    expect(de.id).toBe('c-el');
    /* Las recetas de él, ya en las comidas de ella. */
    expect(copiado.plan.recetasAsignadas['a-des']).toEqual(['r1']);
    expect(copiado.dayType.grid).toBeTruthy();
  });

  it('sin marcar nada no se puede copiar', () => {
    pintar();
    fireEvent.click(screen.getByText('Basarme en otro plan'));
    fireEvent.click(screen.getByText(/Juan Guillermo/));
    for (const t of [
      'Las recetas',
      'El reparto de intercambios',
      'La despensa y las combinaciones',
      'La semana organizada',
    ]) {
      fireEvent.click(screen.getByText(t));
    }
    expect(screen.getByText('Traerme lo marcado').closest('button')!.disabled).toBe(true);
  });
});
