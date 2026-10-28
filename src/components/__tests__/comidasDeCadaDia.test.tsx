// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RepartirLaSemana } from '../planning/RepartirLaSemana';
import { comidaEsDeEseDia } from '../../types/plan';
import type { DayType, Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

/**
 * EN UN DÍA BASE NO HAY PRE-ENTRENO
 *
 * La semana se reparte con la unión de las comidas de todos los tipos de día
 * —si hay un día de tirada larga, en la semana hay pre-entreno— pero **no
 * todas valen todos los días**. Ofrecer el pre-entreno en un día base es
 * invitar a poner la tostada en una comida que ese día no existe, y de ahí
 * salían los cruces: una receta puesta ahí aparecía luego donde no tocaba.
 */

const DESAYUNO = { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno' as const, orden: 2 };
const PRE = { id: 'm_pre', nombre: 'Pre-entreno', slot: 'extra' as const, orden: 1 };

const BASE: DayType = {
  id: 'dt_base',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [DESAYUNO],
  grid: { desayuno: { almidones: 2 } },
  notas: {},
} as DayType;

const LARGO: DayType = {
  id: 'dt_largo',
  nombre: 'Tirada larga',
  proteinaGkg: 2,
  hcGkg: 6,
  meals: [PRE, DESAYUNO],
  grid: { m_pre: { almidones: 2 }, desayuno: { almidones: 3 } },
  notas: {},
} as DayType;

const TOSTADA: Receta = {
  id: 'rc_tostada',
  nombre: 'Tostada con mermelada',
  categorias: ['desayuno'],
  tags: [],
  base: {},
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
} as Receta;

const PLAN: Plan = {
  id: 'p',
  clientId: 'c',
  nombre: 'Plan',
  fase: 1,
  archivado: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  dayTypes: [BASE, LARGO],
  recetasAsignadas: { m_pre: [TOSTADA.id], desayuno: [TOSTADA.id] },
  menuPropuesto: {
    desde: '2026-01-05',
    semanas: [
      {
        dias: {
          // Lunes de tirada larga; el resto, base.
          0: { dayTypeId: 'dt_largo', comidas: {} },
          1: { dayTypeId: 'dt_base', comidas: {} },
        },
      },
    ],
  },
} as unknown as Plan;

describe('Qué comidas tiene cada día', () => {
  it('el pre-entreno es del día largo', () => {
    expect(comidaEsDeEseDia(PLAN, 'dt_largo', 'm_pre')).toBe(true);
  });

  it('y no del día base', () => {
    expect(comidaEsDeEseDia(PLAN, 'dt_base', 'm_pre')).toBe(false);
  });

  it('el desayuno está en los dos', () => {
    expect(comidaEsDeEseDia(PLAN, 'dt_base', 'desayuno')).toBe(true);
    expect(comidaEsDeEseDia(PLAN, 'dt_largo', 'desayuno')).toBe(true);
  });

  /* Sin decir el tipo manda el primero, que es el día normal. */
  it('sin tipo de día puesto, el primero', () => {
    expect(comidaEsDeEseDia(PLAN, undefined, 'm_pre')).toBe(false);
  });
});

describe('Al repartir la semana', () => {
  const pintar = () =>
    render(<RepartirLaSemana plan={PLAN} recetas={[TOSTADA]} onChange={vi.fn()} />);

  it('el pre-entreno sólo se puede poner el día que lo tiene', () => {
    pintar();
    const lunes = screen.getByLabelText('Tostada con mermelada en pre-entreno el lunes');
    const martes = screen.getByLabelText('Tostada con mermelada en pre-entreno el martes');
    expect(lunes.hasAttribute('disabled')).toBe(false);
    expect(martes.hasAttribute('disabled')).toBe(true);
  });

  /* El desayuno sí existe los siete días: ése no se toca. */
  it('pero el desayuno se puede poner cualquier día', () => {
    pintar();
    expect(
      screen
        .getByLabelText('Tostada con mermelada en desayuno el martes')
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  /*
   * Y los días que no la tienen no cuentan como hueco: no son algo que falte
   * por rellenar.
   */
  it('los días sin esa comida no cuentan como huecos', () => {
    pintar();
    // 2 comidas × 7 días = 14 casillas; el pre-entreno sólo existe 1 día.
    expect(screen.getByText(/huecos sin plato/)).toBeTruthy();
  });
});
