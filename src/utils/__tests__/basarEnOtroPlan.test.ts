import { describe, it, expect } from 'vitest';
import {
  TODO,
  basarEn,
  factorDeEscala,
  kcalDelDia,
  loQueNoCuadra,
  recetasPorSlot,
  repartoEscalado,
} from '../basarEnOtroPlan';
import type { DayType, Meal, Plan } from '../../types/plan';

/**
 * BASAR EL PLAN DE UNA EN EL DE OTRA
 *
 * Muchas parejas comen lo mismo: los mismos platos, la misma compra y la misma
 * nevera, pero no las mismas cantidades. Los platos se copian; las cantidades
 * salen del reparto de cada persona, que es la regla de siempre.
 */

const comida = (id: string, slot: Meal['slot'], nombre: string): Meal =>
  ({ id, slot, nombre, orden: 1 }) as Meal;

/** Juan: desayuno, comida y cena. Cena con almidón. */
const DE_EL = {
  id: 'dt-el',
  nombre: 'Día base',
  meals: [
    comida('e-des', 'desayuno', 'Desayuno'),
    comida('e-com', 'comida', 'Comida'),
    comida('e-cen', 'cena', 'Cena'),
  ],
  grid: {
    'e-des': { almidones: 4, proteicos_magros: 2 },
    'e-com': { almidones: 4, proteicos_magros: 4 },
    'e-cen': { almidones: 2, proteicos_magros: 4 },
  },
  notas: {},
} as unknown as DayType;

/** Maritza: las mismas comidas, pero cena sin almidón y come menos. */
const DE_ELLA = {
  id: 'dt-ella',
  nombre: 'Día base',
  meals: [
    comida('a-des', 'desayuno', 'Desayuno'),
    comida('a-com', 'comida', 'Comida'),
    comida('a-cen', 'cena', 'Cena'),
  ],
  grid: {
    'a-des': { almidones: 2, proteicos_magros: 1 },
    'a-com': { almidones: 2, proteicos_magros: 2 },
    'a-cen': { proteicos_magros: 2 },
  },
  notas: {},
} as unknown as DayType;

const PLAN_EL = {
  id: 'p-el',
  clientId: 'c-el',
  fase: 1,
  dayTypes: [DE_EL],
  recetasAsignadas: {
    'e-des': ['r-tostada'],
    'e-com': ['r-pollo'],
    'e-cen': ['r-arroz'],
  },
} as unknown as Plan;

const PLAN_ELLA = {
  id: 'p-ella',
  clientId: 'c-ella',
  fase: 1,
  dayTypes: [DE_ELLA],
} as unknown as Plan;

describe('El reparto se copia en forma, no en porciones', () => {
  /** Copiarlo tal cual sería darle a ella el plan de él. */
  it('se escala a las calorías de ella', () => {
    const factor = factorDeEscala(DE_ELLA, DE_EL);
    expect(factor).toBeLessThan(1);

    const grid = repartoEscalado(DE_ELLA, DE_EL, factor);
    /* Él desayuna el doble que come de proteína; ella conserva la proporción. */
    expect(grid['a-des']!.almidones!).toBeLessThan(DE_EL.grid['e-des']!.almidones!);
    expect(grid['a-des']!.almidones!).toBeGreaterThan(0);
  });

  /** Los ids de comida son de cada plan: se traduce por slot o no cuadra ni una. */
  it('empareja las comidas por su tipo, no por su id', () => {
    const grid = repartoEscalado(DE_ELLA, DE_EL, 1);
    expect(grid['a-cen']).toEqual(DE_EL.grid['e-cen']);
  });

  /** Es un punto de partida, no un borrado. */
  it('una comida que él no tiene se queda como estaba', () => {
    const conMerienda = {
      ...DE_ELLA,
      meals: [...DE_ELLA.meals, comida('a-mer', 'merienda', 'Merienda')],
      grid: { ...DE_ELLA.grid, 'a-mer': { fruta: 1 } },
    } as unknown as DayType;

    const grid = repartoEscalado(conMerienda, DE_EL, 1);
    expect(grid['a-mer']).toEqual({ fruta: 1 });
  });

  /** Sin nada repartido no hay con qué comparar: se copia tal cual. */
  it('sin reparto de ella, el factor es 1', () => {
    const vacia = { ...DE_ELLA, grid: {} } as unknown as DayType;
    expect(factorDeEscala(vacia, DE_EL)).toBe(1);
  });

  it('las calorías del día salen de su reparto', () => {
    expect(kcalDelDia(DE_EL)).toBeGreaterThan(kcalDelDia(DE_ELLA));
  });
});

describe('Las recetas', () => {
  it('se traducen a las comidas de ella', () => {
    const r = recetasPorSlot(PLAN_EL, DE_EL, DE_ELLA);
    expect(r).toEqual({
      'a-des': ['r-tostada'],
      'a-com': ['r-pollo'],
      'a-cen': ['r-arroz'],
    });
  });

  /** Si ella no tiene esa comida no hay dónde ponerla, y eso es correcto. */
  it('las de una comida que ella no hace se quedan fuera', () => {
    const sinCena = {
      ...DE_ELLA,
      meals: DE_ELLA.meals.filter((m) => m.slot !== 'cena'),
    } as unknown as DayType;
    expect(recetasPorSlot(PLAN_EL, DE_EL, sinCena)['a-cen']).toBeUndefined();
  });

  /** Si le habías puesto un desayuno suyo, no se pierde al traerse el de él. */
  it('se suman a las que ella ya tenía', () => {
    const conLoSuyo = {
      ...PLAN_ELLA,
      recetasAsignadas: { 'a-des': ['r-suyo'] },
    } as unknown as Plan;

    const { plan } = basarEn(
      { plan: conLoSuyo, dayType: DE_ELLA },
      { plan: PLAN_EL, dayType: DE_EL },
      TODO,
    );
    expect(plan.recetasAsignadas!['a-des']).toEqual(['r-suyo', 'r-tostada']);
  });
});

describe('Se elige qué se copia', () => {
  it('sólo las recetas deja el reparto de ella intacto', () => {
    const { plan, dayType } = basarEn(
      { plan: PLAN_ELLA, dayType: DE_ELLA },
      { plan: PLAN_EL, dayType: DE_EL },
      { recetas: true, reparto: false, despensa: false, menu: false },
    );
    expect(plan.recetasAsignadas).toBeTruthy();
    expect(dayType.grid).toBeUndefined();
  });

  it('y sólo el reparto no toca las recetas', () => {
    const { plan, dayType } = basarEn(
      { plan: PLAN_ELLA, dayType: DE_ELLA },
      { plan: PLAN_EL, dayType: DE_EL },
      { recetas: false, reparto: true, despensa: false, menu: false },
    );
    expect(plan.recetasAsignadas).toBeUndefined();
    expect(dayType.grid).toBeTruthy();
  });

  it('la despensa y las combinaciones se traducen por slot', () => {
    const conDespensa = {
      ...DE_EL,
      despensa: { 'e-des': { seleccion: ['a-avena'] } },
    } as unknown as DayType;

    const { dayType } = basarEn(
      { plan: PLAN_ELLA, dayType: DE_ELLA },
      { plan: PLAN_EL, dayType: conDespensa },
      TODO,
    );
    expect(dayType.despensa!['a-des']).toEqual({ seleccion: ['a-avena'] });
  });
});

/**
 * Él lleva almidón en la cena y ella no: sus recetas de cena siguen ahí pero
 * traen un arroz que a ella no se le ha pautado. Se dice con nombres, que «la
 * cena no cuadra» obliga a abrirlas todas para ver cuál.
 */
describe('Lo que hay que revisar después', () => {
  const RECETAS = [
    { id: 'r-arroz', nombre: 'Arroz con pollo', base: {} },
    { id: 'r-pollo', nombre: 'Pollo a la plancha', base: {} },
  ];

  const plan = {
    ...PLAN_ELLA,
    recetasAsignadas: { 'a-cen': ['r-arroz'], 'a-com': ['r-pollo'] },
  } as unknown as Plan;

  it('dice la comida, las recetas y qué les falta', () => {
    const avisos = loQueNoCuadra(plan, DE_ELLA, RECETAS, (id) =>
      id === 'r-arroz' ? ['almidones'] : [],
    );
    expect(avisos.length).toBe(1);
    expect(avisos[0]).toMatchObject({
      comida: 'Cena',
      recetas: ['Arroz con pollo'],
      faltan: ['almidones'],
    });
  });

  it('y se calla cuando todo cuadra', () => {
    expect(loQueNoCuadra(plan, DE_ELLA, RECETAS, () => [])).toEqual([]);
  });

  /** Un avituallamiento no lleva recetas: ahí no hay nada que cuadrar. */
  it('no mira las comidas que son un avituallamiento', () => {
    const conAvit = {
      ...DE_ELLA,
      avituallamientos: { 'a-cen': { modo: 'total', gramos: 60 } },
    } as unknown as DayType;
    const avisos = loQueNoCuadra(plan, conAvit, RECETAS, () => ['almidones']);
    /* Sólo la comida: la cena es un avituallamiento y se salta. */
    expect(avisos.map((a) => a.comida)).toEqual(['Comida']);
  });
});
