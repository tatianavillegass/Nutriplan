import { describe, it, expect } from 'vitest';
import { calcularPorcion, hcNeto, fibraDescontable } from '../portions';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { exchangesToMacros } from '../exchanges';
import { kcalFromMacros } from '../macros';
import type { Nutrientes100 } from '../../types/food';

/**
 * LA FIBRA DE LOS PROCESADOS
 *
 * Salió metiendo un cereal keto en el catálogo. Trae 41,5 g de carbohidrato
 * por 100 g, pero 25 de esos gramos son fibra. La app se los cobraba a 4 kcal
 * el gramo, así que una porción salía a 110 kcal en vez de 97, y encima
 * tapaba que el alimento es un compuesto de verdad.
 *
 * Regla clásica: se descuenta la mitad de la fibra, y sólo cuando la ración
 * pasa de 5 g. Por debajo de ahí no se toca nada.
 */

/** Catalina Crunch, tal como viene en la caja. */
const CEREAL: Nutrientes100 = { hc: 41.5, proteina: 30.6, grasa: 16.8, fibra: 25 };

describe('Sólo se descuenta cuando la fibra es alta de verdad', () => {
  it('por debajo de 5 g no se descuenta nada', () => {
    expect(fibraDescontable(4.9)).toBe(0);
    expect(fibraDescontable(undefined)).toBe(0);
  });

  it('por encima, se descuenta la mitad', () => {
    expect(fibraDescontable(9)).toBe(4.5);
  });

  it('un alimento normal no se mueve', () => {
    // Brócoli: 2,6 g de fibra, muy por debajo del umbral.
    const brocoli: Nutrientes100 = { hc: 7, proteina: 2.8, grasa: 0.4, fibra: 2.6 };
    expect(hcNeto(brocoli)).toBe(7);
  });

  it('el cereal keto sí', () => {
    expect(hcNeto(CEREAL)).toBe(41.5 - 12.5);
  });
});

describe('El cereal keto, con la fibra ya descontada', () => {
  const p = calcularPorcion(CEREAL, 'proteicos_grasos')!;

  it('la porción sale de la proteína, que es el ancla de los proteicos', () => {
    // 100 g × 7 g de proteína ÷ 30,6 = 22,9 → 25 g
    expect(p.gramos).toBe(25);
  });

  it('descontar la fibra le quita 12 kcal a la porción', () => {
    // Con el carbohidrato total eran 110 kcal; con el neto, 97.
    expect(p.aporta.kcal).toBeGreaterThan(90);
    expect(p.aporta.kcal).toBeLessThan(102);
  });

  /**
   * Pero sigue sin caber en un solo subgrupo, y ésa es la respuesta: la fibra
   * explicaba parte del desfase, no todo. Al cereal le quedan 7,25 g de
   * carbohidrato de verdad por porción, que son media porción de almidón: pasa
   * el listón de la media porción, así que cuenta y hay que declararlo.
   */
  it('aun así se pasa de las calorías del subgrupo: es un compuesto', () => {
    const nominal = EXCHANGE_GROUPS.proteicos_grasos;
    const kcalNominal = nominal.hc * 4 + nominal.proteina * 4 + nominal.grasa * 9;
    expect(p.aporta.kcal / kcalNominal).toBeGreaterThan(1.2);
  });

  it('el carbohidrato que le queda llega a media porción de almidón', () => {
    expect(p.aporta.hc / EXCHANGE_GROUPS.almidones.hc).toBeGreaterThan(0.5);
  });

  it('le dice a la nutricionista qué ha hecho con la fibra', () => {
    expect(p.avisos.join(' ')).toMatch(/fibra por porción/i);
  });
});

describe('En los grupos anclados al carbohidrato la porción se rehace', () => {
  /**
   * Aquí está la pescadilla: la ración depende del carbohidrato y el descuento
   * depende de la ración. Se calcula una vez con el bruto y, si la fibra que
   * cae dentro pasa del umbral, se rehace con el neto.
   */
  it('una pasta de legumbre pide más gramos al descontar la fibra', () => {
    const pasta: Nutrientes100 = { hc: 50, proteina: 25, grasa: 3, fibra: 20 };
    const p = calcularPorcion(pasta, 'almidones')!;
    // Con el bruto serían 28 g; con el neto (40 g/100 g), 35.
    expect(p.gramos).toBeGreaterThan(30);
  });

  it('un almidón sin fibra no se toca', () => {
    const arroz: Nutrientes100 = { hc: 78, proteina: 7, grasa: 0.6, fibra: 1.3 };
    const p = calcularPorcion(arroz, 'almidones')!;
    // 100 × 14 / 78 = 17,9 → 18 g, los mismos de siempre.
    expect(p.gramos).toBe(18);
    expect(p.avisos.join(' ')).not.toMatch(/fibra/i);
  });
});

/**
 * EL REPARTO QUE LE TOCA AL CEREAL
 *
 * Con la fibra descontada, una porción de 25 g son 7,25 g de carbohidrato,
 * 7,65 de proteína y 4,2 de grasa. Eso es media porción de almidón y una de
 * proteico graso, y se comprueba por calorías como todos los compuestos.
 */
describe('Catalina Crunch declarado como compuesto', () => {
  it('medio almidón y un proteico graso cuadran en calorías', () => {
    const p = calcularPorcion(CEREAL, 'proteicos_grasos')!;
    const declarado = exchangesToMacros({ almidones: 0.5, proteicos_grasos: 1 });
    const kcalDeclarado = kcalFromMacros(declarado);
    expect(Math.abs(kcalDeclarado - p.aporta.kcal) / p.aporta.kcal).toBeLessThan(0.12);
  });
});
