import { describe, it, expect } from 'vitest';
import {
  baseSugerida,
  masaLibreDeGrasa,
  pesoAjustado,
  pesoDeReferencia,
  pesoIdeal,
  pesosPosibles,
} from '../pesoReferencia';
import { planTargets } from '../macros';
import type { Client } from '../../types/client';
import type { Medicion } from '../../types/anthropometry';

const CLIENTE = (patch: Partial<Client> = {}): Client =>
  ({
    id: 'cl1',
    nombre: 'Prueba',
    edad: 35,
    peso: 70,
    altura: 165,
    sexo: 'mujer',
    formulaGrasa: 'faulkner',
    ...patch,
  }) as Client;

/** Pliegues suficientes para que Faulkner dé un número. */
const MEDICION = (fecha: string, peso: number, patch: Partial<Medicion> = {}): Medicion => ({
  id: `m_${fecha}`,
  clientId: 'cl1',
  fecha,
  peso,
  talla: 165,
  pliegues: { triceps: 20, subscapular: 18, supraespinal: 15, abdominal: 25 },
  perimetros: {},
  diametros: {},
  ...patch,
});

/**
 * POR QUÉ EXISTE ESTO
 *
 * Pautar 2 g/kg sobre el peso total sobreestima en cuanto hay mucha grasa: el
 * tejido graso pesa pero casi no pide proteína. A alguien de 110 kg le salen
 * 220 g de proteína al día, que no necesita nadie.
 */
describe('El peso ideal y el ajustado', () => {
  it('el ideal sale de un IMC de 22,5', () => {
    // 1,65 m → 22,5 × 1,65² = 61,3 kg
    expect(pesoIdeal(165)).toBeCloseTo(61.3, 1);
  });

  it('el ajustado suma una cuarta parte de lo que sobra', () => {
    // Ideal 61,3; sobran 48,7 de 110 → 61,3 + 12,2 = 73,4
    expect(pesoAjustado(110, 165)).toBeCloseTo(73.4, 1);
  });

  /** A quien está por debajo de su peso no se le recorta la proteína. */
  it('por debajo del ideal no se toca nada', () => {
    expect(pesoAjustado(52, 165)).toBe(52);
  });

  it('sin altura no se inventa un ideal', () => {
    expect(pesoIdeal(undefined)).toBeUndefined();
    expect(pesoAjustado(80, undefined)).toBeUndefined();
  });
});

describe('La masa libre de grasa', () => {
  it('sale de los pliegues y de la fórmula elegida', () => {
    const magra = masaLibreDeGrasa(CLIENTE(), [MEDICION('2026-08-01', 70)]);
    expect(magra?.de).toBe('pliegues');
    expect(magra!.kg).toBeGreaterThan(30);
    expect(magra!.kg).toBeLessThan(70);
  });

  it('se coge la medición más reciente', () => {
    const magra = masaLibreDeGrasa(CLIENTE(), [
      MEDICION('2026-01-01', 80),
      MEDICION('2026-08-01', 70),
    ]);
    expect(magra?.fecha).toBe('2026-08-01');
  });

  /**
   * La báscula es el segundo plato: su número sale de una fórmula que no
   * conocemos, así que sólo entra cuando no hay pliegues.
   */
  it('si no hay pliegues, vale la báscula', () => {
    const sinPliegues = MEDICION('2026-08-01', 80, {
      pliegues: {},
      bioimpedancia: { grasaPct: 30 },
    });
    const magra = masaLibreDeGrasa(CLIENTE(), [sinPliegues]);
    expect(magra?.de).toBe('bascula');
    expect(magra?.kg).toBeCloseTo(56, 1);
  });

  it('sin mediciones no hay nada que devolver', () => {
    expect(masaLibreDeGrasa(CLIENTE(), [])).toBeUndefined();
  });
});

describe('Qué peso se usa al final', () => {
  it('por defecto, el suyo de hoy', () => {
    expect(pesoDeReferencia(CLIENTE(), []).kg).toBe(70);
  });

  it('pedido el ajustado, se ajusta', () => {
    const r = pesoDeReferencia(CLIENTE({ peso: 110 }), [], 'ajustado');
    expect(r.base).toBe('ajustado');
    expect(r.kg).toBeCloseTo(73.4, 1);
    expect(r.explicacion).toMatch(/110 → 73 kg/);
  });

  /** Si lo pedido no se puede calcular, se cae al peso total y se dice. */
  it('pedida la masa magra sin mediciones, se usa el total y se explica', () => {
    const r = pesoDeReferencia(CLIENTE(), [], 'magra');
    expect(r.base).toBe('total');
    expect(r.explicacion).toMatch(/Sin mediciones/i);
  });

  it('con el peso en su sitio, ajustar no cambia nada', () => {
    const r = pesoDeReferencia(CLIENTE({ peso: 58 }), [], 'ajustado');
    expect(r.kg).toBe(58);
    expect(r.explicacion).toMatch(/en su sitio/i);
  });
});

/**
 * Se sugiere, no se impone: el número lo decide ella. Pero un plan calculado
 * sobre 110 kg no debería salir nunca por descuido.
 */
describe('Qué conviene con lo que hay medido', () => {
  it('con antropometría, la masa libre de grasa', () => {
    expect(baseSugerida(CLIENTE({ peso: 110 }), [MEDICION('2026-08-01', 110)])).toBe('magra');
  });

  it('sin mediciones y con peso alto, el ajustado', () => {
    expect(baseSugerida(CLIENTE({ peso: 110 }), [])).toBe('ajustado');
  });

  it('sin mediciones y con peso normal, el total', () => {
    expect(baseSugerida(CLIENTE({ peso: 62 }), [])).toBe('total');
  });

  it('los tres se enseñan juntos, y el que no se pueda va sin número', () => {
    const p = pesosPosibles(CLIENTE({ peso: 110 }), []);
    expect(p.find((x) => x.base === 'total')?.kg).toBe(110);
    expect(p.find((x) => x.base === 'ajustado')?.kg).toBeCloseTo(73.4, 1);
    expect(p.find((x) => x.base === 'magra')?.kg).toBeUndefined();
  });
});

/**
 * EL CASO QUE MOTIVÓ TODO
 *
 * La vez pasada llegó gente muy pesada y los macros salían disparados.
 */
describe('Una persona de 110 kg, con 2 g/kg', () => {
  it('sobre el peso total pide una proteína que no necesita nadie', () => {
    const t = planTargets(2200, 110, 2, 2);
    expect(t.proteina).toBe(220);
    // 220 g son el 40 % de las calorías del día en proteína: no es un plan,
    // es un batido. Y sólo queda un 20 % para la grasa.
    expect(t.pct.proteina).toBeCloseTo(40, 0);
    expect(t.pct.grasa).toBeLessThan(21);
  });

  it('sobre el peso ajustado sale un plan que se puede comer', () => {
    const peso = pesoDeReferencia(CLIENTE({ peso: 110 }), [], 'ajustado').kg;
    const t = planTargets(2200, peso, 2, 2);
    expect(t.proteina).toBeCloseTo(147, 0);
    expect(t.grasa).toBeGreaterThan(0);
  });
});
