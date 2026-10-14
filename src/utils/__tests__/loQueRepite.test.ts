import { describe, it, expect } from 'vitest';
import { loQueRepitePorComida, cuantoRepite } from '../loQueRepite';
import type { Plan, DayType } from '../../types/plan';
import type { RegistroDia, Bocado } from '../../types/diary';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';

/**
 * «¿Qué desayuna normalmente?» es la pregunta de consulta, y hasta ahora
 * había que deducirla de una lista de alimentos sueltos donde la avena y el
 * plátano estaban cada uno por su lado.
 */

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 2 },
  ],
  grid: {},
  notas: {},
};

const plan = (fase: 1 | 2 | 3 | 4, dayTypes: DayType[] = [DIA]): Plan => ({
  id: 'p1',
  clientId: 'c1',
  nombre: 'Plan',
  fase,
  dayTypes,
  fecha: '2026-01-01',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const receta = (id: string, nombre: string): Receta => ({
  id,
  nombre,
  categorias: ['desayuno'],
  tags: [],
  base: {},
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const RECETAS = [receta('r1', 'Porridge de avena'), receta('r2', 'Tostada de aguacate')];
const ALIMENTOS = [
  { id: 'a-avena', nombre: 'Avena' },
  { id: 'a-platano', nombre: 'Plátano' },
  { id: 'a-pollo', nombre: 'Pollo' },
] as Alimento[];

const dia = (fecha: string, extra: Partial<RegistroDia> = {}): RegistroDia => ({
  id: `r-${fecha}`,
  clientId: 'c1',
  fecha,
  dayTypeId: 'dt',
  recetaElegida: {},
  cumplidas: [],
  porciones: {},
  sustituciones: {},
  extras: [],
  ...extra,
});

const bocado = (nombre: string, momento: string): Bocado => ({
  id: `b-${nombre}-${momento}`,
  nombre,
  cantidad: 100,
  unidad: 'g',
  macros: { proteina: 0, hc: 10, grasa: 0 },
  kcal: 40,
  momento,
});

const desayuno = (c: ReturnType<typeof loQueRepitePorComida>) =>
  c.find((x) => x.mealId === 'desayuno')!;

describe('Fase 1: las recetas que elige', () => {
  const registros = [
    dia('2026-03-01', { recetaElegida: { desayuno: 'r1' } }),
    dia('2026-03-02', { recetaElegida: { desayuno: 'r1' } }),
    dia('2026-03-03', { recetaElegida: { desayuno: 'r2' } }),
  ];

  it('cuenta cada receta por su nombre', () => {
    const d = desayuno(loQueRepitePorComida(plan(1), registros, RECETAS, ALIMENTOS));
    expect(d.lista[0]).toMatchObject({ nombre: 'Porridge de avena', veces: 2, dias: 2 });
    expect(d.lista[1]).toMatchObject({ nombre: 'Tostada de aguacate', veces: 1 });
  });

  it('y dice en cuántos días apuntó algo en esa comida', () => {
    const d = desayuno(loQueRepitePorComida(plan(1), registros, RECETAS, ALIMENTOS));
    expect(d.diasConAlgo).toBe(3);
  });

  it('una receta que ya no está en el banco no se inventa', () => {
    const r = [dia('2026-03-01', { recetaElegida: { desayuno: 'borrada' } })];
    expect(loQueRepitePorComida(plan(1), r, RECETAS, ALIMENTOS)).toEqual([]);
  });
});

describe('Fase 2: la combinación entera', () => {
  it('los alimentos van juntos, que la comida es la combinación', () => {
    const registros = [
      dia('2026-03-01', { porciones: { desayuno: { 'a-avena': 2, 'a-platano': 1 } } }),
      dia('2026-03-02', { porciones: { desayuno: { 'a-avena': 2, 'a-platano': 1 } } }),
    ];
    const d = desayuno(loQueRepitePorComida(plan(2), registros, RECETAS, ALIMENTOS));
    expect(d.lista).toHaveLength(1);
    expect(d.lista[0]).toMatchObject({ nombre: 'Avena + Plátano', veces: 2 });
  });

  it('el orden en que los marcó no hace dos combinaciones de una', () => {
    const registros = [
      dia('2026-03-01', { porciones: { desayuno: { 'a-platano': 1, 'a-avena': 2 } } }),
      dia('2026-03-02', { porciones: { desayuno: { 'a-avena': 2, 'a-platano': 1 } } }),
    ];
    expect(desayuno(loQueRepitePorComida(plan(2), registros, RECETAS, ALIMENTOS)).lista).toHaveLength(
      1,
    );
  });
});

describe('Fase 3: los alimentos, cada uno por su lado', () => {
  it('ahí cada alimento es una elección suya', () => {
    const registros = [
      dia('2026-03-01', { porciones: { desayuno: { 'a-avena': 2, 'a-platano': 1 } } }),
      dia('2026-03-02', { porciones: { desayuno: { 'a-avena': 2 } } }),
    ];
    const d = desayuno(loQueRepitePorComida(plan(3), registros, RECETAS, ALIMENTOS));
    expect(d.lista[0]).toMatchObject({ nombre: 'Avena', veces: 2 });
    expect(d.lista[1]).toMatchObject({ nombre: 'Plátano', veces: 1 });
  });

  it('lo marcado a cero no cuenta', () => {
    const registros = [dia('2026-03-01', { porciones: { desayuno: { 'a-avena': 0 } } })];
    expect(loQueRepitePorComida(plan(3), registros, RECETAS, ALIMENTOS)).toEqual([]);
  });
});

describe('Fase 4: los bocados, en la comida donde los apuntó', () => {
  const registros = [
    dia('2026-03-01', { bocados: [bocado('Avena', 'desayuno'), bocado('Pollo', 'cena')] }),
    dia('2026-03-02', { bocados: [bocado('Avena', 'desayuno')] }),
  ];

  it('cada comida cuenta lo suyo', () => {
    const c = loQueRepitePorComida(plan(4), registros, RECETAS, ALIMENTOS);
    expect(desayuno(c).lista[0]).toMatchObject({ nombre: 'Avena', veces: 2 });
    expect(c.find((x) => x.mealId === 'cena')!.lista[0]).toMatchObject({ nombre: 'Pollo' });
  });

  it('lo apuntado sin comida no se cuela en ninguna', () => {
    const r = [dia('2026-03-01', { bocados: [bocado('Café', '')] })];
    expect(loQueRepitePorComida(plan(4), r, RECETAS, ALIMENTOS)).toEqual([]);
  });
});

describe('Las comidas salen del plan, no de lo apuntado', () => {
  it('lo comido en una comida que ya no existe no cuenta', () => {
    const r = [dia('2026-03-01', { recetaElegida: { merienda: 'r1' } })];
    expect(loQueRepitePorComida(plan(1), r, RECETAS, ALIMENTOS)).toEqual([]);
  });

  it('pero la merienda que sólo existe el día de entreno sí', () => {
    const entreno: DayType = {
      ...DIA,
      id: 'dt2',
      nombre: 'Entreno',
      meals: [...DIA.meals, { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 3 }],
    };
    const r = [dia('2026-03-01', { recetaElegida: { merienda: 'r1' } })];
    const c = loQueRepitePorComida(plan(1, [DIA, entreno]), r, RECETAS, ALIMENTOS);
    expect(c.map((x) => x.mealId)).toEqual(['merienda']);
  });

  it('salen en el orden del día, no por cuánto se repiten', () => {
    const r = [
      dia('2026-03-01', { recetaElegida: { cena: 'r1', desayuno: 'r2' } }),
      dia('2026-03-02', { recetaElegida: { cena: 'r1' } }),
    ];
    const c = loQueRepitePorComida(plan(1), r, RECETAS, ALIMENTOS);
    expect(c.map((x) => x.mealId)).toEqual(['desayuno', 'cena']);
  });

  it('sin plan no hay nada que contar', () => {
    expect(loQueRepitePorComida(undefined, [], RECETAS, ALIMENTOS)).toEqual([]);
  });
});

describe('Cuánto repite', () => {
  it('todo lo mismo es uno', () => {
    const r = [
      dia('2026-03-01', { recetaElegida: { desayuno: 'r1' } }),
      dia('2026-03-02', { recetaElegida: { desayuno: 'r1' } }),
    ];
    expect(cuantoRepite(desayuno(loQueRepitePorComida(plan(1), r, RECETAS, ALIMENTOS)))).toBe(1);
  });

  it('mitad y mitad es un medio', () => {
    const r = [
      dia('2026-03-01', { recetaElegida: { desayuno: 'r1' } }),
      dia('2026-03-02', { recetaElegida: { desayuno: 'r2' } }),
    ];
    expect(cuantoRepite(desayuno(loQueRepitePorComida(plan(1), r, RECETAS, ALIMENTOS)))).toBe(0.5);
  });
});
