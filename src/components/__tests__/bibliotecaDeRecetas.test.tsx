// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BibliotecaDeRecetas, aportesDeLaReceta } from '../client/BibliotecaDeRecetas';
import type { Alimento } from '../../types/food';
import type { DayType, Meal, Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

/**
 * SU BIBLIOTECA DE RECETAS
 *
 * Hay quien quiere la autonomía de la fase 3 —componerse la comida con sus
 * porciones— y a la vez las ideas de la fase 1: saber que le tocan dos
 * almidones y un proteico no contesta «¿pero qué cocino?».
 */

const COMIDA: Meal = { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 3 };
const CENA: Meal = { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 5 };

const DIA = {
  id: 'dt',
  nombre: 'Día base',
  meals: [COMIDA, CENA],
  grid: { comida: { proteicos_magros: 4, almidones: 3 }, cena: {} },
  notas: {},
} as unknown as DayType;

const POLLO: Alimento = {
  id: 'a-pollo',
  nombre: 'Pollo',
  grupo: 'proteicos_magros',
  medida_casera: '30 g',
  gramos: 30,
  intercambios: 1,
  nutrientes: { kcal: 165, hc: 0, proteina: 23, grasa: 3.6 },
  comidas_sugeridas: ['comida'],
  alergenos: [],
  apto: [],
} as unknown as Alimento;

const WOK: Receta = {
  id: 'rc1',
  nombre: 'Wok de pollo',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_magros: 4, almidones: 3 },
  ingredientes: [
    {
      id: 'i1',
      nombre: 'Pollo',
      foodId: 'a-pollo',
      cantidad_base: 120,
      unidad: 'g',
      grupo: 'proteicos_magros',
      escalable: true,
      opcional: false,
    },
  ],
  preparacion: 'Saltear',
  notas: '',
  createdAt: '',
  updatedAt: '',
} as unknown as Receta;

const plan = (recetasAsignadas?: Record<string, string[]>, fase = 3): Plan =>
  ({ id: 'p1', clientId: 'c1', fase, dayTypes: [DIA], recetasAsignadas }) as unknown as Plan;

const pintar = (p: Plan, extra: Record<string, unknown> = {}) =>
  render(
    <BibliotecaDeRecetas
      plan={p}
      dayType={DIA}
      recipes={[WOK]}
      foods={[POLLO]}
      {...extra}
    />,
  );

describe('La biblioteca enseña lo que ella le eligió, por comida', () => {
  it('agrupa las recetas bajo su comida', () => {
    pintar(plan({ comida: ['rc1'] }));
    expect(screen.getByText('Comida')).toBeTruthy();
    expect(screen.getByText('Wok de pollo')).toBeTruthy();
  });

  it('y al pulsarla salen sus gramos, escalados a lo que le toca hoy', () => {
    pintar(plan({ comida: ['rc1'] }));
    fireEvent.click(screen.getByText('Wok de pollo'));
    expect(screen.getByText('Saltear')).toBeTruthy();
  });

  it('sin recetas elegidas no promete una pestaña vacía: lo dice', () => {
    pintar(plan());
    expect(screen.getByText(/Aún no tienes recetas aquí/)).toBeTruthy();
  });

  /* Lo que se pautó cuando las recetas vivían en el tipo de día sigue saliendo. */
  it('las del formato viejo también salen', () => {
    const viejo = { ...DIA, recetasAsignadas: { comida: ['rc1'] } } as DayType;
    render(
      <BibliotecaDeRecetas
        plan={{ id: 'p1', fase: 3, dayTypes: [viejo] } as unknown as Plan}
        dayType={viejo}
        recipes={[WOK]}
        foods={[POLLO]}
      />,
    );
    expect(screen.getByText('Wok de pollo')).toBeTruthy();
  });
});

describe('«Me lo he comido»', () => {
  it('sólo lo ve quien come, no quien está mirando su ficha', () => {
    pintar(plan({ comida: ['rc1'] }), { onUsar: vi.fn() });
    fireEvent.click(screen.getByText('Wok de pollo'));
    expect(screen.queryByText('Me lo he comido')).toBeNull();
  });

  it('y al pulsarlo dice qué receta y de qué comida', () => {
    const onUsar = vi.fn();
    pintar(plan({ comida: ['rc1'] }), { onUsar, soyElCliente: true });
    fireEvent.click(screen.getByText('Wok de pollo'));
    fireEvent.click(screen.getByText('Me lo he comido'));

    expect(onUsar).toHaveBeenCalledTimes(1);
    expect(onUsar.mock.calls[0][0].id).toBe('comida');
    expect(onUsar.mock.calls[0][1].id).toBe('rc1');
  });

  it('marca cada alimento con las porciones que esa comida tiene pautadas', () => {
    /* La receta hace el trabajo que ella haría a mano, alimento por alimento. */
    const aportes = aportesDeLaReceta(WOK, { proteicos_magros: 4, almidones: 3 }, [POLLO]);
    expect(aportes).toEqual([{ foodId: 'a-pollo', intercambios: 4 }]);
  });

  it('y lo que no está enlazado al catálogo se queda fuera: no hay qué marcar', () => {
    const suelta = {
      ...WOK,
      ingredientes: [{ ...WOK.ingredientes[0], foodId: undefined }],
    } as Receta;
    expect(aportesDeLaReceta(suelta, { proteicos_magros: 4 }, [POLLO])).toEqual([]);
  });
});
