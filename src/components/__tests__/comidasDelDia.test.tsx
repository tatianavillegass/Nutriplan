// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DayProgressBar } from '../client/DayProgressBar';
import { comidasConPauta } from '../../types/plan';
import { adherenciaDelDia } from '../../utils/diary';
import type { DayType } from '../../types/plan';
import type { RegistroDia } from '../../types/diary';

afterEach(cleanup);

/** Cinco comidas de plantilla, pero sólo tres con intercambios repartidos. */
const TRES_COMIDAS: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'almuerzo', nombre: 'Almuerzo', slot: 'almuerzo', orden: 2 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 3 },
    { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 4 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 5 },
  ],
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 3, grasas: 1 },
    almuerzo: {},
    comida: { proteicos_magros: 5, almidones: 3, grasas: 2 },
    merienda: { fruta: 0 },
    cena: { proteicos_magros: 4, almidones: 2, grasas: 2 },
  },
  notas: {},
};

const registro = (cumplidas: string[]) => ({ cumplidas, extras: [] }) as unknown as RegistroDia;

describe('Un día tiene las comidas que se le han pautado', () => {
  it('las comidas sin intercambios no cuentan', () => {
    expect(comidasConPauta(TRES_COMIDAS).map((m) => m.id)).toEqual([
      'desayuno',
      'comida',
      'cena',
    ]);
  });

  it('si no hay nada repartido todavía, se enseñan todas', () => {
    const vacio: DayType = { ...TRES_COMIDAS, grid: {} };
    expect(comidasConPauta(vacio)).toHaveLength(5);
  });

  it('marcar las tres comidas del día lo deja al 100 %', () => {
    const a = adherenciaDelDia(registro(['desayuno', 'comida', 'cena']), TRES_COMIDAS);
    expect(a.comidasTotales).toBe(3);
    expect(a.comidasCumplidas).toBe(3);
    expect(a.porcentaje).toBe(100);
  });

  it('una comida marcada que ya no está pautada no infla el anillo', () => {
    const a = adherenciaDelDia(registro(['desayuno', 'merienda']), TRES_COMIDAS);
    expect(a.comidasCumplidas).toBe(1);
    expect(a.porcentaje).toBe(33);
  });

  it('«cómo va tu día» sólo pinta las comidas que hay', () => {
    render(
      <DayProgressBar
        dayType={TRES_COMIDAS}
        porciones={{}}
        cumplidas={['desayuno', 'comida', 'cena']}
      />,
    );
    expect(screen.getByText('3 de 3 comidas hechas')).toBeTruthy();
    expect(screen.getByText('Desayuno')).toBeTruthy();
    expect(screen.queryByText('Almuerzo')).toBeNull();
    expect(screen.queryByText('Merienda')).toBeNull();
  });
});
