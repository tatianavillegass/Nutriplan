import { describe, it, expect } from 'vitest';
import {
  balanceDelDia,
  porcionesDeExtra,
  porcionesSueltas,
  sePuedeContar,
} from '../diary';
import { presupuestoDelDia } from '../dailyBudget';
import type { DayType } from '../../types/plan';
import type { Extra, RegistroDia } from '../../types/diary';
import type { Alimento } from '../../types/food';

/**
 * EL FIN DE SEMANA DE NORMA
 *
 * Hay días en los que no se come por comidas: se pica, se come con amigas, se
 * sale. Eso no es «comerse algo de más sobre el plan» — es la comida de ese
 * día, y la pregunta que se hace al apuntarlo no es cuánto se ha desviado,
 * sino si ha llegado a su proteína.
 *
 * Apuntándolo como extra de siempre, los anillos no se movían: veía 0 de 7
 * proteicos habiendo comido pollo. Ahora puede decir «esto era mi comida» y
 * gasta sus porciones, igual que ya se podía con los postres.
 */

const POLLO: Alimento = {
  id: 'f_pollo',
  nombre: 'Pechuga de pollo',
  grupo: 'proteicos_magros',
  gramos: 30,
  medida_casera: '30 g',
  nutrientes: { hc: 0, proteina: 23, grasa: 1.5, kcal: 110 },
} as unknown as Alimento;

const CERVEZA: Alimento = {
  id: 'f_cerveza',
  nombre: 'Cerveza',
  gramos: 0,
} as unknown as Alimento;

const FOODS = [POLLO, CERVEZA];

const extra = (p: Partial<Extra> = {}): Extra => ({
  id: 'ex_1',
  nombre: 'Pechuga de pollo',
  foodId: 'f_pollo',
  cantidad: 90,
  unidad: 'g',
  macros: { proteina: 20.7, hc: 0, grasa: 1.35 },
  kcal: 94,
  ...p,
});

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
  ],
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 2 },
    comida: { proteicos_magros: 5, almidones: 3 },
  },
  notas: {},
};

describe('Qué se puede contar y qué no', () => {
  it('con alimento del catálogo y gramos, sí', () => {
    expect(sePuedeContar(extra(), FOODS)).toBe(true);
  });

  it('unas calorías escritas a ojo no dicen de qué grupo son', () => {
    const aOjo = extra({ foodId: undefined, cantidad: undefined });
    expect(sePuedeContar(aOjo, FOODS)).toBe(false);
    expect(porcionesDeExtra(aOjo, FOODS)).toEqual({});
  });

  it('tampoco un alimento sin porción de intercambio', () => {
    expect(sePuedeContar(extra({ foodId: 'f_cerveza' }), FOODS)).toBe(false);
  });
});

describe('Los gramos se pasan a porciones', () => {
  it('90 g de pollo con porción de 30 g son 3 proteicos', () => {
    expect(porcionesDeExtra(extra(), FOODS).proteicos_magros).toBeCloseTo(3, 5);
  });

  it('pero sólo cuenta lo que ella mandó contar', () => {
    expect(porcionesSueltas([extra()], FOODS)).toEqual({});
    expect(porcionesSueltas([extra({ enElPlan: true })], FOODS).proteicos_magros).toBeCloseTo(3, 5);
  });

  it('dos cosas del mismo grupo se suman', () => {
    const dos = [
      extra({ enElPlan: true }),
      extra({ id: 'ex_2', cantidad: 60, enElPlan: true }),
    ];
    expect(porcionesSueltas(dos, FOODS).proteicos_magros).toBeCloseTo(5, 5);
  });
});

describe('Entra en el total del día, no en una comida', () => {
  const sueltas = porcionesSueltas([extra({ enElPlan: true })], FOODS);

  it('le baja lo que le queda de proteína', () => {
    const sin = presupuestoDelDia(DIA, {});
    const con = presupuestoDelDia(DIA, {}, sueltas);
    expect(sin.find((m) => m.bucket === 'proteina')!.restante).toBe(7);
    expect(con.find((m) => m.bucket === 'proteina')!.restante).toBeCloseTo(4, 5);
  });

  it('y no toca lo que le queda de hidrato', () => {
    const con = presupuestoDelDia(DIA, {}, sueltas);
    expect(con.find((m) => m.bucket === 'carbohidrato')!.restante).toBe(5);
  });

  it('lo pautado no se mueve: es lo que su cuerpo necesitaba', () => {
    const con = presupuestoDelDia(DIA, {}, sueltas);
    expect(con.find((m) => m.bucket === 'proteina')!.pautado).toBe(7);
  });
});

describe('Y deja de ser un desvío', () => {
  const registro = (extras: Extra[]): RegistroDia =>
    ({ fecha: '2026-09-26', dayTypeId: 'dt', extras }) as unknown as RegistroDia;

  it('apuntado como «de más», pesa sobre lo pautado', () => {
    const b = balanceDelDia(DIA, registro([extra()]), FOODS);
    expect(b.pesoExtras).toBeGreaterThan(0);
    expect(b.deExtras.proteina).toBeCloseTo(20.7, 5);
    expect(b.delPlan.proteina).toBe(0);
  });

  it('apuntado como «mi comida», cuenta del lado del plan y no pesa', () => {
    const b = balanceDelDia(DIA, registro([extra({ enElPlan: true })]), FOODS);
    expect(b.pesoExtras).toBe(0);
    expect(b.deExtras.proteina).toBe(0);
    expect(b.delPlan.proteina).toBeCloseTo(20.7, 5);
  });

  it('y las calorías del día son las mismas se apunte como se apunte', () => {
    const deMas = balanceDelDia(DIA, registro([extra()]), FOODS);
    const enPlan = balanceDelDia(DIA, registro([extra({ enElPlan: true })]), FOODS);
    expect(enPlan.kcalTotal).toBeCloseTo(deMas.kcalTotal, 5);
  });

  it('un día entero comido suelto no sale como un desvío enorme', () => {
    const findeDeNorma = [
      extra({ id: 'e1', cantidad: 150, enElPlan: true }),
      extra({ id: 'e2', cantidad: 120, enElPlan: true }),
      extra({ id: 'e3', cantidad: 90, enElPlan: true }),
    ];
    const b = balanceDelDia(DIA, registro(findeDeNorma), FOODS);
    expect(b.pesoExtras).toBe(0);
    // Y con ello se sabe lo que de verdad quería saber: cuánta proteína lleva.
    expect(porcionesSueltas(findeDeNorma, FOODS).proteicos_magros).toBeCloseTo(12, 5);
  });
});
