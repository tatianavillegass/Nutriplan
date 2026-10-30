import { describe, it, expect } from 'vitest';
import {
  comidasQueSeLlamanIgual,
  recetasDeLaComida,
  recetasDelPlan,
} from '../../types/plan';
import type { DayType, Plan } from '../../types/plan';

/**
 * DESAYUNO CON DESAYUNO
 *
 * Su regla, literal: «las porciones se leen desde cálculo plan dependiendo del
 * NOMBRE: desayuno con desayuno, comida con comida, pre-entreno con
 * pre-entreno.»
 *
 * Hasta ahora los platos se emparejaban por la identidad interna de la comida,
 * que es lo mismo mientras los tipos de día nazcan iguales. Deja de serlo en
 * cuanto añade una comida a mano en el día de tirada: ese «Desayuno» nacía con
 * identidad propia y había que elegirle las recetas otra vez, aunque sea el
 * mismo desayuno. Y el pre-entreno, que se llama distinto, sigue yendo solo.
 */

const comida = (id: string, nombre: string) =>
  ({ id, nombre, slot: 'desayuno' as const, orden: 1 }) as DayType['meals'][number];

const dia = (id: string, meals: DayType['meals']): DayType =>
  ({ id, nombre: id, proteinaGkg: 2, hcGkg: 3, meals, grid: {}, notas: {} }) as DayType;

/* El día de tirada tiene su propio «Desayuno», con id distinta, y un pre-entreno. */
const PLAN: Plan = {
  id: 'p',
  clientId: 'c',
  nombre: 'Plan',
  fase: 1,
  archivado: false,
  createdAt: '',
  updatedAt: '',
  dayTypes: [
    dia('base', [comida('desayuno', 'Desayuno')]),
    dia('largo', [comida('m_otro', 'Desayuno'), comida('m_pre', 'Pre-entreno')]),
  ],
  recetasAsignadas: { desayuno: ['rc_avena'], m_pre: ['rc_tostada'] },
} as unknown as Plan;

describe('Las comidas que se llaman igual', () => {
  it('se reconocen entre tipos de día', () => {
    expect(comidasQueSeLlamanIgual(PLAN, 'desayuno').sort()).toEqual([
      'desayuno',
      'm_otro',
    ]);
  });

  /* Mayúsculas y tildes no hacen de dos comidas distintas. */
  it('sin que importen tildes ni mayúsculas', () => {
    const p = {
      ...PLAN,
      dayTypes: [PLAN.dayTypes[0], dia('largo', [comida('m_otro', 'DESAYÚNO ')])],
    };
    expect(comidasQueSeLlamanIgual(p, 'desayuno')).toContain('m_otro');
  });

  it('y el pre-entreno va solo', () => {
    expect(comidasQueSeLlamanIgual(PLAN, 'm_pre')).toEqual(['m_pre']);
  });
});

describe('Los platos', () => {
  it('el desayuno del día largo ofrece los del día base', () => {
    expect(recetasDeLaComida(PLAN, 'm_otro')).toEqual(['rc_avena']);
  });

  it('y lo que se eligió en uno u otro se junta, sin repetir', () => {
    const p = {
      ...PLAN,
      recetasAsignadas: { desayuno: ['rc_avena'], m_otro: ['rc_avena', 'rc_huevos'] },
    };
    expect(recetasDeLaComida(p, 'desayuno')).toEqual(['rc_avena', 'rc_huevos']);
  });

  /* Lo que no se quiere: que la tostada del pre-entreno salga en el desayuno. */
  it('el pre-entreno no contagia al desayuno', () => {
    expect(recetasDeLaComida(PLAN, 'desayuno')).not.toContain('rc_tostada');
  });

  it('una comida sin nombre no se empareja con nada', () => {
    const p = {
      ...PLAN,
      dayTypes: [PLAN.dayTypes[0], dia('largo', [comida('m_otro', '  ')])],
      recetasAsignadas: { desayuno: ['rc_avena'] },
    };
    expect(recetasDelPlan(p).m_otro ?? []).toEqual([]);
  });
});
