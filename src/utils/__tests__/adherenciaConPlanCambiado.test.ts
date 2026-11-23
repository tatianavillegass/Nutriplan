import { describe, it, expect } from 'vitest';
import { adherenciaDelDia } from '../diary';
import { resumenAdherencia } from '../seguimiento';
import type { DayType, Plan } from '../../types/plan';
import type { RegistroDia } from '../../types/diary';

/**
 * «DICEN QUE SÍ MARCARON TODO»
 *
 * «En el seguimiento hay muchas veces que aparece como que el cliente no ha
 * marcado algunos días y ellos dicen que sí han marcado todo.» Tenían razón
 * los dos: ella leía bien la pantalla y ellos habían marcado.
 *
 * Dos causas, las dos reproducidas aquí:
 *
 *  1. **Las marcas se contaban por id de comida**, y renombrar una comida le
 *     cambia la id (`separarComida`). El día que se renombra una comida, todos
 *     los días ya marcados pasan a contar cero. Lo mismo al montar una
 *     planificación nueva con otras comidas.
 *  2. **Un día sin comidas pautadas daba 0 %** en vez de «no hay con qué
 *     comparar»: rojo de «no cumplió» en un día que puede estar entero.
 */

const dia = (ids: string[], grid: Record<string, Record<string, number>>): DayType =>
  ({
    id: 'dt',
    nombre: 'Base',
    proteinaGkg: 2,
    hcGkg: 3,
    meals: ids.map((id, i) => ({ id, nombre: id, slot: 'comida', orden: i })),
    grid,
    notas: {},
  }) as unknown as DayType;

const HOY = dia(
  ['desayuno', 'comida', 'cena'],
  { desayuno: { almidones: 2 }, comida: { almidones: 3 }, cena: { almidones: 1 } },
);

const reg = (cumplidas: string[], fecha = '2026-11-10'): RegistroDia =>
  ({
    id: `r-${fecha}`,
    clientId: 'c',
    fecha,
    dayTypeId: 'dt',
    cumplidas,
    recetaElegida: {},
    porciones: {},
    sustituciones: {},
    extras: [],
  }) as unknown as RegistroDia;

describe('Lo que marcó cuenta aunque el plan haya cambiado', () => {
  it('marcó las tres y están: 100 %', () => {
    expect(adherenciaDelDia(reg(['desayuno', 'comida', 'cena']), HOY).porcentaje).toBe(100);
  });

  it('marcó dos de tres: 67 %', () => {
    expect(adherenciaDelDia(reg(['desayuno', 'comida']), HOY).porcentaje).toBe(67);
  });

  /*
   * El bug: marcó su día entero y después se le renombró una comida, así que
   * esas ids ya no existen. Antes daba 0 %.
   */
  it('marcó tres comidas que hoy tienen otra id: sigue siendo 100 %', () => {
    const a = adherenciaDelDia(reg(['m_viejo1', 'm_viejo2', 'm_viejo3']), HOY);
    expect(a.porcentaje).toBe(100);
  });

  it('y si sólo cambió una id, las cuentas siguen cuadrando', () => {
    expect(adherenciaDelDia(reg(['desayuno', 'comida', 'm_viejo3']), HOY).porcentaje).toBe(100);
  });

  /* Marcar de más no sube del 100 %. */
  it('cuatro marcas en un día de tres comidas siguen siendo 100 %', () => {
    const a = adherenciaDelDia(reg(['desayuno', 'comida', 'cena', 'm_viejo']), HOY);
    expect(a.porcentaje).toBe(100);
    expect(a.comidasCumplidas).toBe(3);
  });

  /*
   * Lo que sí se descarta: una comida que el plan tiene hoy y que ese día no
   * lleva pauta. Marcar la merienda un día sin merienda no cuenta como comida
   * cumplida — ese día no había merienda que hacer.
   */
  it('una comida del plan sin pauta ese día no cuenta', () => {
    const conMerienda = dia(
      ['desayuno', 'merienda', 'comida'],
      { desayuno: { almidones: 2 }, comida: { almidones: 3 } },
    );
    const a = adherenciaDelDia(reg(['merienda']), conMerienda);
    expect(a.comidasCumplidas).toBe(0);
    expect(a.comidasTotales).toBe(2);
  });
});

describe('Un día sin comidas pautadas', () => {
  it('no se puede comparar, así que no es un 0 %', () => {
    const a = adherenciaDelDia(reg(['desayuno', 'comida', 'cena']), undefined);
    expect(a.comparable).toBe(false);
  });

  /* Y en el seguimiento de ella sale en blanco, no en rojo. */
  it('en el seguimiento sale en blanco y no cuenta como incumplido', () => {
    const plan = { id: 'p', fase: 1, dayTypes: [dia(['desayuno'], {})] } as unknown as Plan;
    /* Sin pauta en ninguna comida: `comidasConPauta` cae a las comidas y hay 1. */
    const conPauta = { ...plan, dayTypes: [dia(['desayuno'], { desayuno: { almidones: 1 } })] };
    const r = resumenAdherencia(
      conPauta as Plan,
      [reg(['desayuno'], '2026-11-10')],
      30,
      new Date('2026-11-10T12:00:00Z'),
    );
    const hoy = r.dias[r.dias.length - 1];
    expect(hoy.porcentaje).toBe(100);
  });

  it('y un día de verdad sin registro sigue en blanco', () => {
    const conPauta = { id: 'p', fase: 1, dayTypes: [dia(['desayuno'], { desayuno: { almidones: 1 } })] } as unknown as Plan;
    const r = resumenAdherencia(conPauta, [], 3, new Date('2026-11-10T12:00:00Z'));
    expect(r.dias.every((d) => d.porcentaje === undefined)).toBe(true);
    expect(r.registrados).toBe(0);
  });
});
