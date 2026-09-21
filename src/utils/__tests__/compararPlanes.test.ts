import { describe, it, expect } from 'vitest';
import {
  compararPlanes,
  anteriorA,
  hayCambios,
  recetasDeUnPlan,
  recetasPorSlot,
} from '../compararPlanes';
import type { DayType, Meal, Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';

/**
 * LA REVISIÓN MENSUAL
 *
 * Cada mes se vuelven a tomar medidas, se recalcula el gasto y sale una
 * planificación nueva con otras calorías. La nueva nace clonada de la anterior,
 * así que en pantalla son idénticas hasta que se toca algo: lo que hace falta
 * ver no es el plan, es la diferencia.
 */

const comida = (id: string, slot: Meal['slot'], nombre: string): Meal =>
  ({ id, slot, nombre, orden: 1 }) as Meal;

const dia = (meals: Meal[], grid: DayType['grid']): DayType =>
  ({ id: 'dt', nombre: 'Día base', meals, grid, notas: {} }) as unknown as DayType;

const plan = (p: Partial<Plan>): Plan =>
  ({
    id: 'p1',
    clientId: 'c1',
    nombre: 'Planificación',
    fase: 1,
    dayTypes: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...p,
  }) as unknown as Plan;

const DESAYUNO = comida('a-des', 'desayuno', 'Desayuno');
const CENA = comida('a-cen', 'cena', 'Cena');

/** La de agosto: 2 almidones en el desayuno, 4 proteicos en la cena. */
const AGOSTO = plan({
  id: 'p-ago',
  fecha: '2026-08-31',
  dayTypes: [
    dia(
      [comida('v-des', 'desayuno', 'Desayuno'), comida('v-cen', 'cena', 'Cena')],
      { 'v-des': { almidones: 4 }, 'v-cen': { proteicos_magros: 4 } },
    ),
  ],
  recetasAsignadas: { 'v-des': ['r-tostada'], 'v-cen': ['r-pollo', 'r-salmon'] },
});

/** La de septiembre: menos almidón en el desayuno, la misma cena. */
const SEPTIEMBRE = plan({
  id: 'p-sep',
  fecha: '2026-09-30',
  dayTypes: [dia([DESAYUNO, CENA], { 'a-des': { almidones: 2 }, 'a-cen': { proteicos_magros: 4 } })],
  recetasAsignadas: { 'a-des': ['r-tostada'], 'a-cen': ['r-pollo', 'r-merluza'] },
});

const RECETAS = [
  { id: 'r-tostada', nombre: 'Tostada con huevo' },
  { id: 'r-pollo', nombre: 'Pollo a la plancha' },
  { id: 'r-salmon', nombre: 'Salmón al horno' },
  { id: 'r-merluza', nombre: 'Merluza al vapor' },
] as unknown as Receta[];

describe('Comparar dos planificaciones', () => {
  const c = compararPlanes(AGOSTO, SEPTIEMBRE, RECETAS);

  it('dice de cuántas kcal viene y a cuántas va', () => {
    expect(c.kcal.antes).toBeGreaterThan(c.kcal.ahora);
    expect(c.kcal.delta).toBeLessThan(0);
    expect(c.kcal.ahora).toBe(c.kcal.antes + c.kcal.delta);
  });

  it('y cuánto cambia cada macro', () => {
    /* Dos almidones menos son 28 g de hidrato menos. */
    expect(c.macros.hc.delta).toBe(-28);
    expect(c.macros.proteina.delta).toBeLessThan(0);
  });

  /**
   * Los ids de comida son de cada plan, así que el desayuno de agosto y el de
   * septiembre no se llaman igual aunque sean el mismo desayuno.
   */
  it('empareja las comidas por su tipo, no por su id', () => {
    const des = c.comidas.find((m) => m.slot === 'desayuno')!;
    expect(des.antes).toBeGreaterThan(des.ahora);

    const cena = c.comidas.find((m) => m.slot === 'cena')!;
    expect(cena.delta).toBe(0);
  });

  it('y dice qué recetas siguen, cuáles se van y cuáles entran', () => {
    expect(c.recetas.siguen).toEqual(['Pollo a la plancha', 'Tostada con huevo']);
    expect(c.recetas.fuera).toEqual(['Salmón al horno']);
    expect(c.recetas.nuevas).toEqual(['Merluza al vapor']);
  });

  /** La fase sólo sale si cambia: decir «sigue en la 1» es ruido. */
  it('la fase sólo sale cuando cambia', () => {
    expect(c.fase).toBeUndefined();
    const otra = compararPlanes(AGOSTO, plan({ ...SEPTIEMBRE, fase: 2 }), RECETAS);
    expect(otra.fase).toEqual({ antes: 1, ahora: 2 });
  });
});

describe('Una comida que ya no existe', () => {
  it('sale con cero, que es lo que come ahora', () => {
    const sinCena = plan({
      ...SEPTIEMBRE,
      dayTypes: [dia([DESAYUNO], { 'a-des': { almidones: 2 } })],
    });
    const cena = compararPlanes(AGOSTO, sinCena, RECETAS).comidas.find((m) => m.slot === 'cena')!;
    expect(cena.ahora).toBe(0);
    expect(cena.delta).toBeLessThan(0);
  });
});

describe('Cuál es la anterior', () => {
  const planes = [AGOSTO, SEPTIEMBRE, plan({ id: 'p-jul', fecha: '2026-07-27' })];

  it('es la más reciente de las de antes', () => {
    expect(anteriorA(SEPTIEMBRE, planes)?.id).toBe('p-ago');
  });

  /** La primera de una clienta no tiene con qué compararse. */
  it('y la primera no tiene anterior', () => {
    expect(anteriorA(plan({ id: 'p-jul', fecha: '2026-07-27' }), [planes[2]])).toBeUndefined();
  });

  it('no se mezcla con las de otra clienta', () => {
    const deOtra = plan({ id: 'p-otra', clientId: 'c2', fecha: '2026-08-31' });
    expect(anteriorA(SEPTIEMBRE, [deOtra])).toBeUndefined();
  });
});

/** Recién clonada, la nueva es idéntica: no hay nada que contar todavía. */
describe('Cuando no ha cambiado nada', () => {
  it('se calla', () => {
    const clon = plan({ ...AGOSTO, id: 'p-clon', fecha: '2026-09-30' });
    expect(hayCambios(compararPlanes(AGOSTO, clon, RECETAS))).toBe(false);
  });

  it('pero habla en cuanto se toca el reparto', () => {
    expect(hayCambios(compararPlanes(AGOSTO, SEPTIEMBRE, RECETAS))).toBe(true);
  });
});

describe('Las recetas de un plan', () => {
  it('se juntan de todas las comidas, sin repetir', () => {
    expect([...recetasDeUnPlan(AGOSTO)].sort()).toEqual(['r-pollo', 'r-salmon', 'r-tostada']);
  });
});

describe('las recetas de un plan, puestas por slot', () => {
  it('las agrupa por slot y no por id de comida', () => {
    expect(recetasPorSlot(AGOSTO)).toEqual({
      desayuno: ['r-tostada'],
      cena: ['r-pollo', 'r-salmon'],
    });
  });

  it('sirve para decir cuál ya tenía aunque el id de comida haya cambiado', () => {
    /* El desayuno de agosto es `v-des` y el de septiembre `a-des`: por id no
       se encontrarían nunca, y ésa es justo la trampa. */
    const antes = recetasPorSlot(AGOSTO);
    expect(antes.cena).toContain('r-pollo');
    expect(antes.cena).not.toContain('r-merluza');
  });
});
