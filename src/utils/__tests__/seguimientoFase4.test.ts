import { describe, it, expect } from 'vitest';
import { resumenAdherencia, usoDeAlimentos, fechaMenos } from '../seguimiento';
import { objetivoDelDia } from '../conteo';
import type { Plan, DayType } from '../../types/plan';
import type { RegistroDia, Bocado } from '../../types/diary';
import type { Alimento } from '../../types/food';

/**
 * LO QUE REGISTRAN EN FASE 4 TIENE QUE VERSE
 *
 * El seguimiento contaba comidas marcadas y porciones, y quien cuenta gramos
 * no marca ninguna de las dos cosas: la pestaña decía «0 días apuntados» y
 * «todavía no ha marcado nada» por mucho que llevara el mes entero apuntando.
 */

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  // 4 magros + 3 almidones + 2 grasas ≈ 460 kcal.
  meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
  grid: { comida: { proteicos_magros: 4, almidones: 3, grasas: 2 } },
  notas: {},
};

const plan = (fase: 1 | 4): Plan => ({
  id: 'p1',
  clientId: 'c1',
  nombre: 'Plan',
  fase,
  dayTypes: [DIA],
  fecha: '2026-01-01',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

/** Las kcal se reparten en hidrato, para que macros y kcal digan lo mismo. */
const bocado = (nombre: string, kcal: number, foodId?: string, cantidad = 100): Bocado => ({
  id: `b-${nombre}-${kcal}`,
  nombre,
  foodId,
  cantidad,
  unidad: 'g',
  macros: { proteina: 0, hc: kcal / 4, grasa: 0 },
  kcal,
  momento: 'comida',
});

const dia = (fecha: string, bocados: Bocado[]): RegistroDia => ({
  id: `r-${fecha}`,
  clientId: 'c1',
  fecha,
  dayTypeId: 'dt',
  recetaElegida: {},
  cumplidas: [],
  porciones: {},
  sustituciones: {},
  extras: [],
  bocados,
});

/**
 * Lo que pauta el día, leído de la misma función que usa la app: escribir el
 * número a mano aquí sería comprobar mi resta, no la suya.
 */
const OBJETIVO = objetivoDelDia(DIA).kcal;

describe('Los días apuntados se cuentan', () => {
  const hoy = new Date('2026-03-10T12:00:00');
  const ayer = fechaMenos(1, hoy);

  it('un día con bocados cuenta como apuntado', () => {
    const r = resumenAdherencia(plan(4), [dia(ayer, [bocado('Pollo', 200)])], 30, hoy);
    expect(r.registrados).toBe(1);
  });

  it('un día sin nada apuntado se queda en blanco, no en cero', () => {
    // No es lo mismo no cumplir que no apuntar.
    const r = resumenAdherencia(plan(4), [dia(ayer, [])], 30, hoy);
    expect(r.registrados).toBe(0);
    expect(r.dias.find((d) => d.fecha === ayer)?.porcentaje).toBeUndefined();
  });

  it('cuadrar con lo pautado es el día completo', () => {
    const r = resumenAdherencia(plan(4), [dia(ayer, [bocado('Comida', OBJETIVO)])], 30, hoy);
    expect(r.completos).toBe(1);
    expect(r.media).toBeCloseTo(100, 0);
  });

  it('quedarse corto baja el porcentaje pero sigue contando como apuntado', () => {
    const r = resumenAdherencia(plan(4), [dia(ayer, [bocado('Poco', OBJETIVO / 2)])], 30, hoy);
    expect(r.registrados).toBe(1);
    expect(r.completos).toBe(0);
    expect(r.media).toBeCloseTo(50, 0);
  });

  it('pasarse también baja, no premia', () => {
    const r = resumenAdherencia(plan(4), [dia(ayer, [bocado('Mucho', OBJETIVO * 1.5)])], 30, hoy);
    expect(r.media).toBeCloseTo(50, 0);
    expect(r.completos).toBe(0);
  });

  it('un 5 % arriba sigue siendo un día cuadrado', () => {
    const r = resumenAdherencia(plan(4), [dia(ayer, [bocado('Casi', OBJETIVO * 1.05)])], 30, hoy);
    expect(r.completos).toBe(1);
  });

  it('en las demás fases no cambia nada: se siguen contando comidas', () => {
    const r = resumenAdherencia(plan(1), [dia(ayer, [bocado('Da igual', 500)])], 30, hoy);
    expect(r.registrados).toBe(1);
    expect(r.completos).toBe(0);
  });
});

describe('Lo que más repite, contando gramos', () => {
  const POLLO = { id: 'a-pollo', nombre: 'Pechuga de pollo' } as Alimento;

  it('los bocados cuentan aunque no haya ni una porción marcada', () => {
    const uso = usoDeAlimentos(
      [
        dia('2026-03-08', [bocado('Pechuga de pollo', 200, 'a-pollo', 150)]),
        dia('2026-03-09', [bocado('Pechuga de pollo', 200, 'a-pollo', 100)]),
      ],
      [DIA],
      [POLLO],
    );
    const pollo = uso.elegidos.find((u) => u.foodId === 'a-pollo')!;
    expect(pollo.veces).toBe(2);
    expect(pollo.gramos).toBe(250);
    expect(pollo.dias).toBe(2);
    expect(pollo.porciones).toBe(0);
  });

  it('lo apuntado de una etiqueta también sale, con su nombre', () => {
    const uso = usoDeAlimentos([dia('2026-03-08', [bocado('Barrita de la marca', 180)])], [DIA], []);
    expect(uso.elegidos.some((u) => u.nombre === 'Barrita de la marca')).toBe(true);
  });

  it('dos cosas distintas no se mezclan en una', () => {
    const uso = usoDeAlimentos(
      [dia('2026-03-08', [bocado('Pan', 100), bocado('Queso', 120)])],
      [DIA],
      [],
    );
    expect(uso.elegidos).toHaveLength(2);
  });
});
