import { describe, it, expect } from 'vitest';
import {
  comoVaElDia,
  diaContado,
  estadoDeConteo,
  macrosDeCantidad,
  objetivoDelDia,
  totalContado,
} from '../conteo';
import { diaCerrado } from '../racha';
import type { DayType } from '../../types/plan';
import type { Bocado, RegistroDia } from '../../types/diary';
import type { Alimento } from '../../types/food';

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
  // 4 proteicos magros, 3 almidones y 2 grasas.
  grid: { comida: { proteicos_magros: 4, almidones: 3, grasas: 2 } },
  notas: {},
};

const POLLO = {
  id: 'a-pollo',
  nombre: 'Pechuga de pollo',
  medida_casera: '30 g',
  gramos: 30,
  intercambios: 1,
  nutrientes: { proteina: 23, hc: 0, grasa: 2 },
} as unknown as Alimento;

const CEREAL_KETO = {
  id: 'a-keto',
  nombre: 'Cereal keto',
  medida_casera: '40 g',
  gramos: 40,
  intercambios: 1,
  nutrientes: { proteina: 20, hc: 41, grasa: 15, fibra: 25 },
} as unknown as Alimento;

const bocado = (macros: { proteina: number; hc: number; grasa: number }): Bocado => ({
  id: `b${Math.random()}`,
  nombre: 'Algo',
  cantidad: 100,
  macros,
  kcal: macros.proteina * 4 + macros.hc * 4 + macros.grasa * 9,
});

/**
 * FASE 4 — LOS MISMOS MACROS, EN GRAMOS
 *
 * El objetivo no es un número nuevo que haya que escribir en otro sitio: sale
 * de la misma pauta de intercambios. Así, pasar de fase 3 a fase 4 no cambia
 * lo que tiene que comer, sólo cómo se lo cuenta.
 */
describe('El objetivo del día', () => {
  it('son los intercambios pautados, traducidos a gramos', () => {
    const o = objetivoDelDia(DIA);
    // 4 magros (28 P) + 3 almidones (6 P) = 34 g de proteína.
    expect(o.proteina).toBeCloseTo(34, 5);
    // 3 almidones × 14 g de hidrato.
    expect(o.hc).toBeCloseTo(42, 5);
    // 2 grasas (10) + los 0,5 de cada magro y de cada almidón.
    expect(o.grasa).toBeCloseTo(13.5, 5);
    expect(o.kcal).toBeCloseTo(34 * 4 + 42 * 4 + 13.5 * 9, 5);
  });

  it('sin tipo de día no inventa nada', () => {
    expect(objetivoDelDia(undefined).kcal).toBe(0);
  });
});

describe('Lo que aportan unos gramos', () => {
  it('sale de la etiqueta del alimento', () => {
    const { macros, kcal } = macrosDeCantidad(150, POLLO);
    expect(macros.proteina).toBeCloseTo(34.5, 5);
    expect(macros.grasa).toBeCloseTo(3, 5);
    expect(kcal).toBeCloseTo(34.5 * 4 + 3 * 9, 5);
  });

  /** La fibra alta se descuenta a medias, igual que en todo lo demás. */
  it('la fibra alta no se cuenta entera', () => {
    const { macros } = macrosDeCantidad(100, CEREAL_KETO);
    expect(macros.hc).toBeCloseTo(41 - 25 / 2, 5);
  });

  it('un alimento sin etiqueta no suma calorías de la nada', () => {
    expect(macrosDeCantidad(100, undefined).kcal).toBe(0);
  });
});

describe('Lo que lleva del día', () => {
  it('se suma lo apuntado', () => {
    const t = totalContado([
      bocado({ proteina: 20, hc: 30, grasa: 5 }),
      bocado({ proteina: 10, hc: 12, grasa: 8.5 }),
    ]);
    expect(t.proteina).toBeCloseTo(30, 5);
    expect(t.hc).toBeCloseTo(42, 5);
    expect(t.grasa).toBeCloseTo(13.5, 5);
  });

  it('sin nada apuntado, cero', () => {
    expect(totalContado(undefined).kcal).toBe(0);
  });
});

/**
 * El margen es del 10 %, el mismo con el que ya se juzga un día en el resto de
 * la app. Nadie cuadra un día al gramo, y exigirlo es lo que convierte contar
 * en pelearse.
 */
describe('Cómo se juzga cada macro', () => {
  it('por debajo del margen, falta', () => {
    expect(estadoDeConteo(100, 140)).toBe('falta');
  });

  it('dentro del margen, está en punto', () => {
    expect(estadoDeConteo(140, 140)).toBe('enPunto');
    expect(estadoDeConteo(130, 140)).toBe('enPunto');
    expect(estadoDeConteo(152, 140)).toBe('enPunto');
  });

  it('por encima, se ha pasado', () => {
    expect(estadoDeConteo(170, 140)).toBe('pasado');
  });

  it('sin objetivo no se juzga nada', () => {
    expect(estadoDeConteo(200, 0)).toBe('enPunto');
  });
});

/**
 * NI CUENTA ATRÁS NI NOTA DEL DÍA
 *
 * Lo que se dice es lo que ha pasado, en una frase. Sin porcentajes de
 * adherencia, sin proyecciones de peso y sin decirle que compense mañana.
 */
describe('Lo que se le dice del día', () => {
  const objetivo = objetivoDelDia(DIA);

  it('con el día vacío no se le juzga', () => {
    expect(comoVaElDia(totalContado([]), objetivo, false)).toMatch(/todavía no has apuntado/i);
  });

  it('pasándose, se dice sin dramatizar y sin pedir compensar', () => {
    const total = totalContado([bocado({ proteina: 80, hc: 120, grasa: 40 })]);
    const frase = comoVaElDia(total, objetivo, true);
    expect(frase).toMatch(/por encima/i);
    expect(frase).not.toMatch(/compensar|mañana comes menos|te has pasado de/i);
  });

  it('cuadrando, se dice y ya', () => {
    const total = totalContado([bocado({ proteina: 34, hc: 42, grasa: 13.5 })]);
    expect(comoVaElDia(total, objetivo, true)).toMatch(/cuadrado/i);
  });
});

/**
 * En fase 4 no hay comidas que marcar. Sin esto, quien cuenta macros perdía la
 * racha todos los días haciéndolo bien.
 */
describe('La racha en fase 4', () => {
  const registro = (extra: Partial<RegistroDia>): RegistroDia => ({
    id: 'r1',
    clientId: 'c1',
    fecha: '2026-08-14',
    recetaElegida: {},
    cumplidas: [],
    porciones: {},
    sustituciones: {},
    extras: [],
    ...extra,
  });

  it('apuntar lo que se ha comido cierra el día', () => {
    const r = registro({ bocados: [bocado({ proteina: 20, hc: 20, grasa: 5 })] });
    expect(diaContado(r)).toBe(true);
    expect(diaCerrado(r, DIA)).toBe(true);
  });

  it('un día sin apuntar nada no se cierra solo', () => {
    const r = registro({});
    expect(diaContado(r)).toBe(false);
    expect(diaCerrado(r, DIA)).toBe(false);
  });
});
