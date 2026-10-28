import { describe, it, expect } from 'vitest';
import {
  comidaCompartida,
  separarComida,
  separarComidasRenombradas,
} from '../separarComida';
import type { DayType, Plan } from '../../types/plan';

/**
 * UNA COMIDA RENOMBRADA ES OTRA COMIDA
 *
 * Todos los tipos de día nacen con las mismas ids de comida, y eso hace que el
 * desayuno del día base y el del día de tirada compartan platos — lo que se
 * quiere mientras sean la misma comida.
 *
 * Deja de valer al montar un día largo: ahí se renombra una comida que ya
 * estaba («Merienda» pasa a «Pre-entreno») y la id no cambiaba. El
 * pre-entreno se quedaba con las recetas de la merienda del otro día, y al
 * repartir la semana salía rotulado con el nombre del otro.
 */

const comidas = [
  { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno' as const, orden: 1 },
  { id: 'merienda', nombre: 'Merienda', slot: 'merienda' as const, orden: 4 },
];

const dia = (id: string, nombre: string, extra: Partial<DayType> = {}): DayType =>
  ({
    id,
    nombre,
    proteinaGkg: 2,
    hcGkg: 3,
    meals: comidas.map((m) => ({ ...m })),
    grid: { desayuno: { almidones: 2 }, merienda: { fruta: 1 } },
    notas: { merienda: 'la de antes de salir' },
    ...extra,
  }) as DayType;

const PLAN: Plan = {
  id: 'p1',
  clientId: 'c1',
  nombre: 'Plan',
  fase: 1,
  archivado: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  dayTypes: [dia('base', 'Día base'), dia('largo', 'Tirada larga')],
  recetasAsignadas: { merienda: ['rc_yogur'], desayuno: ['rc_avena'] },
} as unknown as Plan;

describe('Cuándo hace falta separar', () => {
  it('si esa comida vive en otro tipo de día, sí', () => {
    expect(comidaCompartida(PLAN, 'largo', 'merienda')).toBe(true);
  });

  /* Con un solo tipo de día, renombrar es sólo cambiar el nombre. */
  it('con un solo día, no', () => {
    const solo = { ...PLAN, dayTypes: [PLAN.dayTypes[0]] };
    expect(comidaCompartida(solo, 'base', 'merienda')).toBe(false);
    expect(separarComida(solo, 'base', 'merienda').plan).toBe(solo);
  });
});

describe('Al separarla', () => {
  const { plan, mealId } = separarComida(PLAN, 'largo', 'merienda');
  const largo = plan.dayTypes.find((d) => d.id === 'largo')!;
  const base = plan.dayTypes.find((d) => d.id === 'base')!;

  it('la del día largo tiene id propia', () => {
    expect(mealId).not.toBe('merienda');
    expect(largo.meals.some((m) => m.id === mealId)).toBe(true);
    expect(largo.meals.some((m) => m.id === 'merienda')).toBe(false);
  });

  it('y el día base se queda con la suya, intacta', () => {
    expect(base.meals.some((m) => m.id === 'merienda')).toBe(true);
    expect(base.grid.merienda).toEqual({ fruta: 1 });
  });

  /* Renombrar no es empezar de cero: se lleva lo que tenía. */
  it('se lleva su reparto y su nota', () => {
    expect(largo.grid[mealId]).toEqual({ fruta: 1 });
    expect(largo.notas[mealId]).toBe('la de antes de salir');
    expect(largo.grid.merienda).toBeUndefined();
  });

  it('y una copia de sus recetas', () => {
    expect(plan.recetasAsignadas?.[mealId]).toEqual(['rc_yogur']);
    // El día base sigue con las suyas: no se las lleva.
    expect(plan.recetasAsignadas?.merienda).toEqual(['rc_yogur']);
  });

  /*
   * Y desde aquí van por su lado: es lo que arregla que lo del pre-entreno
   * aparezca en la merienda del otro día.
   */
  it('a partir de ahí ya no comparten nada', () => {
    expect(mealId in (plan.recetasAsignadas ?? {})).toBe(true);
    expect(base.meals.map((m) => m.id)).not.toContain(mealId);
  });

  it('lo que no era suyo se queda donde estaba', () => {
    expect(largo.grid.desayuno).toEqual({ almidones: 2 });
  });
});

/**
 * LAS QUE YA ESTABAN MAL SE SEPARAN SOLAS
 *
 * Pedirle que entre a renombrar una por una para que se separen es pedirle que
 * arregle a mano algo que no rompió ella.
 */
describe('Al cargar un plan de antes', () => {
  const roto: Plan = {
    ...PLAN,
    dayTypes: [
      dia('base', 'Día base'),
      {
        ...dia('largo', 'Tirada larga'),
        /* Aquí la merienda se llamó «Pre-entreno» y se quedó con la misma id. */
        meals: [
          { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
          { id: 'merienda', nombre: 'Pre-entreno', slot: 'merienda', orden: 0 },
        ],
      } as DayType,
    ],
  };

  const arreglado = separarComidasRenombradas(roto);
  const largo = arreglado.dayTypes.find((d) => d.id === 'largo')!;
  const base = arreglado.dayTypes.find((d) => d.id === 'base')!;

  it('el pre-entreno pasa a ser suyo', () => {
    const pre = largo.meals.find((m) => m.nombre === 'Pre-entreno')!;
    expect(pre.id).not.toBe('merienda');
  });

  it('y la merienda del día base no se toca', () => {
    expect(base.meals.find((m) => m.nombre === 'Merienda')!.id).toBe('merienda');
  });

  /* Dos días que la llaman igual son la misma comida: siguen compartiendo. */
  it('las que se llaman igual se quedan como estaban', () => {
    expect(largo.meals.find((m) => m.nombre === 'Desayuno')!.id).toBe('desayuno');
  });

  it('y pasarlo dos veces no cambia nada', () => {
    const otra = separarComidasRenombradas(arreglado);
    expect(otra.dayTypes.map((d) => d.meals.map((m) => m.id))).toEqual(
      arreglado.dayTypes.map((d) => d.meals.map((m) => m.id)),
    );
  });
});
