import { describe, it, expect } from 'vitest';
import {
  aplicarReparto,
  borrarReparto,
  cobertura,
  desdeDayType,
  guardarReparto,
  repartosQueEncajan,
  type PlantillaReparto,
} from '../repartos';
import type { DayType } from '../../types/plan';

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'm1', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'm2', nombre: 'Comida', slot: 'comida', orden: 2 },
  ],
  grid: {
    m1: { almidones: 2, proteicos_magros: 2, grasas: 0 },
    m2: { proteicos_magros: 4, almidones: 3, grasas: 2 },
  },
  notas: {},
};

/**
 * Dos personas con calorías parecidas y las mismas comidas llevan casi el
 * mismo reparto. Guardarlo una vez es la diferencia entre montar un reto de
 * veinte y montarlo veinte veces.
 */
describe('Guardar un reparto', () => {
  it('se guarda por slot y no por comida', () => {
    const comidas = desdeDayType(DIA);
    expect(Object.keys(comidas).sort()).toEqual(['comida', 'desayuno']);
    // Los ids de comida son de cada plan: guardarlos lo haría inservible.
    expect(Object.keys(comidas)).not.toContain('m1');
  });

  it('las celdas a cero no se guardan', () => {
    expect(desdeDayType(DIA).desayuno).toEqual({ almidones: 2, proteicos_magros: 2 });
  });

  it('se apunta con qué calorías y cuántas comidas se guardó', () => {
    const [p] = guardarReparto([], 'Base 1.800', DIA);
    expect(p.nombre).toBe('Base 1.800');
    expect(p.comidasDia).toBe(2);
    expect(p.kcal).toBeGreaterThan(0);
  });

  it('y se puede borrar', () => {
    const lista = guardarReparto([], 'Base', DIA);
    expect(borrarReparto(lista, lista[0].id)).toEqual([]);
  });
});

describe('Aplicarlo a otra persona', () => {
  const plantilla: PlantillaReparto = {
    id: 'rp1',
    nombre: 'Base',
    comidas: { desayuno: { almidones: 3 } },
    comidasDia: 1,
    kcal: 1800,
    createdAt: '',
  };

  it('cada comida recibe la suya por su slot', () => {
    const grid = aplicarReparto(DIA, plantilla);
    expect(grid.m1).toEqual({ almidones: 3 });
  });

  /** Es un punto de partida, no un borrado: lo que ya estaba puesto se queda. */
  it('lo que la plantilla no cubre se deja como estaba', () => {
    const grid = aplicarReparto(DIA, plantilla);
    expect(grid.m2).toEqual(DIA.grid.m2);
  });

  it('se dice a cuántas comidas ha llegado', () => {
    expect(cobertura(DIA, plantilla)).toBe(1);
  });
});

/**
 * Encaja el que tiene las mismas comidas y no se aleja más de un 10 % de las
 * calorías, que es el mismo margen con el que se juzga un día. Los demás no se
 * esconden: la decisión es de la nutricionista.
 */
describe('Cuál se sugiere', () => {
  const p = (id: string, kcal: number, comidasDia: number): PlantillaReparto => ({
    id,
    nombre: id,
    comidas: {},
    comidasDia,
    kcal,
    createdAt: '',
  });

  it('el de las mismas comidas y calorías cercanas va primero', () => {
    const lista = [p('lejos', 2600, 4), p('encaja', 1850, 4)];
    const orden = repartosQueEncajan(lista, 1800, 4);
    expect(orden[0].plantilla.id).toBe('encaja');
    expect(orden[0].encaja).toBe(true);
  });

  it('con otro número de comidas no encaja, pero se sigue viendo', () => {
    const orden = repartosQueEncajan([p('otro', 1800, 5)], 1800, 4);
    expect(orden).toHaveLength(1);
    expect(orden[0].encaja).toBe(false);
  });

  it('un 20 % de diferencia ya no encaja', () => {
    expect(repartosQueEncajan([p('x', 2200, 4)], 1800, 4)[0].encaja).toBe(false);
  });
});
