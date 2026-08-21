// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { OrganizaTuSemana } from '../client/OrganizaTuSemana';
import { menuVacio, lunesDe, diasDeLaSemana } from '../../utils/menuSemana';
import type { Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { MenuSemana } from '../../types/diary';

afterEach(cleanup);

const PAN: Receta = {
  id: 'r_pan',
  nombre: 'Pan con huevo',
  categorias: ['desayuno'],
  tags: [],
  base: { almidones: 2, proteicos_grasos: 2 },
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const PLAN = {
  id: 'p1',
  clientId: 'c1',
  fase: 1,
  dayTypes: [
    {
      id: 'descanso',
      nombre: 'Descanso',
      meals: [{ id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 }],
      grid: { desayuno: { almidones: 2, proteicos_grasos: 2 } },
    },
    {
      id: 'entreno',
      nombre: 'Entreno',
      meals: [{ id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 }],
      grid: { desayuno: { almidones: 4, proteicos_grasos: 2 } },
    },
  ],
} as unknown as Plan;

const LUNES = lunesDe('2026-08-19');

const pintar = (menu: MenuSemana = menuVacio(LUNES)) => {
  const onCambiar = vi.fn();
  render(
    <OrganizaTuSemana
      menu={menu}
      plan={PLAN}
      comidas={[{ meal: { id: 'desayuno', nombre: 'Desayuno' }, opciones: [PAN] }]}
      recetas={[PAN]}
      foods={[]}
      onCambiar={onCambiar}
    />,
  );
  return onCambiar;
};

/**
 * Nadie planifica «lunes: pan con huevo; martes: avena». Se piensa «pan con
 * huevo, lunes y miércoles», y por eso se elige la receta y se marcan los días.
 */
describe('Organiza tu semana', () => {
  it('va plegada y se abre cuando ella quiere', () => {
    pintar();
    expect(document.body.textContent).not.toContain('Pan con huevo');
    fireEvent.click(screen.getByText('Organiza tu semana'));
    expect(screen.getByText('Pan con huevo')).toBeTruthy();
  });

  it('pone la receta en el día que marca', () => {
    const onCambiar = pintar();
    fireEvent.click(screen.getByText('Organiza tu semana'));
    fireEvent.click(screen.getByLabelText('Pan con huevo el miércoles'));

    const nuevo = onCambiar.mock.calls[0][0] as MenuSemana;
    const miercoles = diasDeLaSemana(LUNES)[2];
    expect(nuevo.dias[miercoles].comidas.desayuno).toBe(PAN.id);
  });

  /**
   * Es la razón de ser: decir una vez qué días entrena y que las cantidades se
   * ajusten solas, en vez de acordarse cada mañana.
   */
  it('deja decir qué días son de entreno', () => {
    const onCambiar = pintar();
    fireEvent.click(screen.getByText('Organiza tu semana'));
    fireEvent.click(screen.getAllByText('Entreno')[0]);

    const nuevo = onCambiar.mock.calls[0][0] as MenuSemana;
    expect(nuevo.dias[LUNES].dayTypeId).toBe('entreno');
  });

  it('y no riñe a nadie: no hay avisos de semana incompleta', () => {
    pintar();
    fireEvent.click(screen.getByText('Organiza tu semana'));
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/incumpl|obligator|te falta/i);
    expect(texto).toContain('esto es un plan, no una obligación');
  });
});
