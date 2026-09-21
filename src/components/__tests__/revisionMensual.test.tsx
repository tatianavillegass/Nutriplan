// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CambiosDesdeLaAnterior } from '../planning/CambiosDesdeLaAnterior';
import { RecipeRecommender } from '../phase1/RecipeRecommender';
import type { Receta } from '../../types/recipe';
import type { Client } from '../../types/client';
import type { DayType, Meal, Plan } from '../../types/plan';

afterEach(cleanup);

/**
 * LA REVISIÓN MENSUAL
 *
 * Cada mes se vuelven a tomar medidas y sale una planificación nueva. Como
 * nace clonada de la anterior, en pantalla son idénticas: lo que hace falta
 * ver es la diferencia —de dónde viene y adónde va— y qué recetas ya tenía,
 * para decidir cuáles le deja, cuáles le cambia y cuántas le suma.
 */

const comida = (id: string, slot: Meal['slot'], nombre: string): Meal =>
  ({ id, slot, nombre, orden: 1 }) as Meal;

const plan = (p: Partial<Plan>): Plan =>
  ({
    id: 'p',
    clientId: 'c1',
    nombre: 'Planificación',
    fase: 1,
    dayTypes: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...p,
  }) as unknown as Plan;

const dia = (meals: Meal[], grid: DayType['grid']): DayType =>
  ({ id: 'dt', nombre: 'Día base', meals, grid, notas: {} }) as unknown as DayType;

/** Agosto: 4 almidones en el desayuno. Tostada y pollo. */
const AGOSTO = plan({
  id: 'p-ago',
  nombre: 'Planificación 1',
  fecha: '2026-08-31',
  dayTypes: [
    dia([comida('v-des', 'desayuno', 'Desayuno'), comida('v-cen', 'cena', 'Cena')], {
      'v-des': { almidones: 4 },
      'v-cen': { proteicos_magros: 4 },
    }),
  ],
  recetasAsignadas: { 'v-des': ['r-tostada'], 'v-cen': ['r-pollo', 'r-salmon'] },
});

/** Septiembre: el desayuno baja a 2 almidones. */
const SEPTIEMBRE = plan({
  id: 'p-sep',
  nombre: 'Planificación 2',
  fecha: '2026-09-30',
  dayTypes: [
    dia([comida('a-des', 'desayuno', 'Desayuno'), comida('a-cen', 'cena', 'Cena')], {
      'a-des': { almidones: 2 },
      'a-cen': { proteicos_magros: 4 },
    }),
  ],
  recetasAsignadas: { 'a-des': ['r-tostada'], 'a-cen': ['r-pollo', 'r-merluza'] },
});

const RECETAS_BANCO = [
  { id: 'r-tostada', nombre: 'Tostada con huevo' },
  { id: 'r-pollo', nombre: 'Pollo a la plancha' },
  { id: 'r-salmon', nombre: 'Salmón al horno' },
  { id: 'r-merluza', nombre: 'Merluza al vapor' },
] as unknown as Receta[];

describe('La barra de cambios desde la planificación anterior', () => {
  it('se calla cuando la nueva es idéntica: recién clonada no hay nada que decir', () => {
    const { container } = render(
      <CambiosDesdeLaAnterior
        plan={plan({ ...AGOSTO, id: 'clon' })}
        anterior={AGOSTO}
        recetas={RECETAS_BANCO}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('sin anterior tampoco dice nada: la primera no viene de ninguna parte', () => {
    const { container } = render(
      <CambiosDesdeLaAnterior plan={SEPTIEMBRE} recetas={RECETAS_BANCO} />,
    );
    expect(container.textContent).toBe('');
  });

  it('dice de dónde viene y adónde va, con las dos planificaciones por su nombre', () => {
    render(
      <CambiosDesdeLaAnterior plan={SEPTIEMBRE} anterior={AGOSTO} recetas={RECETAS_BANCO} />,
    );
    expect(screen.getByText(/Planificación 1.*Planificación 2/)).toBeTruthy();
    /* Quitarle 2 almidones al desayuno baja el día de 404 a 267 kcal. */
    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByText(/267 kcal/)).toBeTruthy();
  });

  it('abre el detalle y dice qué comida se ha movido y qué recetas cambian', () => {
    render(
      <CambiosDesdeLaAnterior plan={SEPTIEMBRE} anterior={AGOSTO} recetas={RECETAS_BANCO} />,
    );
    fireEvent.click(screen.getByText(/ver comida a comida/i));
    expect(screen.getByText('Desayuno')).toBeTruthy();
    expect(screen.getByText(/Le quitas: Salmón al horno/)).toBeTruthy();
    expect(screen.getByText(/Le pones: Merluza al vapor/)).toBeTruthy();
  });
});

// ── Las recetas que ya tenía ────────────────────────────────────────

const CENA: Meal = { id: 'a-cen', nombre: 'Cena', slot: 'cena', orden: 5 };
const DIA_CENA = {
  id: 'dt',
  nombre: 'Día base',
  meals: [CENA],
  grid: { 'a-cen': { proteicos_magros: 4 } },
  notas: {},
} as unknown as DayType;
const CLIENTA = { id: 'c1', nombre: 'Ana García', preferencias: [] } as unknown as Client;

const delBanco = (id: string, nombre: string): Receta =>
  ({
    id,
    nombre,
    categorias: ['cena'],
    tags: [],
    base: { proteicos_magros: 4 },
    ingredientes: [],
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  }) as unknown as Receta;

const pintarCena = (seleccionadas: string[], deLaAnterior?: string[]) =>
  render(
    <RecipeRecommender
      dayType={DIA_CENA}
      meal={CENA}
      recetas={[delBanco('r-pollo', 'Pollo a la plancha'), delBanco('r-merluza', 'Merluza al vapor')]}
      client={CLIENTA}
      seleccionadas={seleccionadas}
      yaAsignadas={[]}
      deLaAnterior={deLaAnterior}
      onToggle={vi.fn()}
    />,
  );

describe('Marcar las recetas que ya tenía', () => {
  it('pone «ya la tenía» sólo en las que venían de la planificación anterior', () => {
    pintarCena(['r-pollo', 'r-merluza'], ['r-pollo']);
    expect(screen.getAllByText('ya la tenía')).toHaveLength(1);
  });

  it('cuenta cuántas siguen y cuántas son nuevas', () => {
    pintarCena(['r-pollo', 'r-merluza'], ['r-pollo']);
    expect(screen.getByText(/1 de antes · 1 nueva/)).toBeTruthy();
  });

  it('avisa por su nombre de la que le estás quitando', () => {
    /* Tenía pollo y merluza; ahora sólo pollo: la merluza desaparece sin que
       nadie lo haya decidido, y eso es lo que hay que poder ver. */
    pintarCena(['r-pollo'], ['r-pollo', 'r-merluza']);
    expect(screen.getByText(/Le quitas de la planificación anterior: Merluza al vapor/)).toBeTruthy();
  });

  it('sin planificación anterior no marca nada ni cuenta nada', () => {
    pintarCena(['r-pollo']);
    expect(screen.queryByText('ya la tenía')).toBeNull();
    expect(screen.queryByText(/de antes/)).toBeNull();
  });
});
