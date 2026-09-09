import { describe, it, expect } from 'vitest';
import {
  costeDeFamilia,
  kcalDeOtroMacro,
  objetivoDeBucket,
  objetivoUnificado,
  proteinaDeLasLegumbres,
  techoDeFamilia,
  topeDeLoPautado,
  validarCombo,
} from '../combos';
import type { ExchangeCounts } from '../exchanges';

/**
 * LAS LENTEJAS COMO OPCIÓN DE CARBOHIDRATO
 *
 * El caso de Tats: una clienta con 3 almidones pautados en la comida a la que
 * le quiere ofrecer lentejas. Se bloqueaba por pasarse de calorías — pero lo
 * que se comía de más era proteína, no hidrato.
 *
 * Una porción de legumbre son 14 g de hidrato Y 7 g de proteína, y así está en
 * la tabla. Al medirla contra el techo del carbohidrato se le cobraban también
 * las 28 calorías de esa proteína, así que tres lentejas donde había tres
 * almidones se pasaban sesenta calorías. Cada macro paga lo suyo.
 */

const PAUTA: ExchangeCounts = { almidones: 3 };

describe('Cada macro paga lo suyo', () => {
  it('la proteína de la legumbre no se le cobra al carbohidrato', () => {
    // 3 legumbres: 42 g de hidrato, 21 de proteína, 1,5 de grasa = 265,5 kcal.
    // Al carbohidrato le tocan 42×4 + 1,5×9 = 181,5.
    expect(kcalDeOtroMacro({ legumbres: 3 })).toBeCloseTo(84, 1);
    expect(costeDeFamilia('legumbres', { legumbres: 3 })).toBeCloseTo(181.5, 1);
  });

  it('y un almidón sigue costando lo que costaba', () => {
    // Sus 2 g de proteína son los macros de regalo que trae cualquier grupo:
    // no declara `bucketExtra`, así que no se descuenta nada.
    expect(kcalDeOtroMacro(PAUTA)).toBe(0);
    expect(costeDeFamilia('almidones', PAUTA)).toBeCloseTo(205.5, 1);
  });

  it('en grasas y proteicos no cambia nada: ahí manda la grasa', () => {
    expect(costeDeFamilia('grasas', { grasas: 2 })).toBeCloseTo(10, 1);
    expect(costeDeFamilia('proteicos', { proteicos_magros: 3 })).toBeCloseTo(1.5, 1);
  });
});

describe('El caso de Tats: 3 almidones y lentejas de opción', () => {
  const objetivo = objetivoDeBucket(PAUTA, 'carbohidrato')!;

  it('tres lentejas ya no se pasan del techo', () => {
    const unificado = objetivoUnificado(objetivo);
    const coste = costeDeFamilia(unificado.familia, { legumbres: 3 });
    expect(coste).toBeLessThanOrEqual(
      techoDeFamilia(unificado.familia, unificado.topeMaximo),
    );
  });

  it('ni dos lentejas y un almidón', () => {
    const unificado = objetivoUnificado(objetivo);
    const coste = costeDeFamilia(unificado.familia, { legumbres: 2, almidones: 1 });
    expect(coste).toBeLessThanOrEqual(
      techoDeFamilia(unificado.familia, unificado.topeMaximo),
    );
  });

  it('la combinación es válida y no avisa de nada', () => {
    const r = validarCombo(objetivo, [{ grupo: 'legumbres', intercambios: 3 }]);
    expect(r.valida).toBe(true);
    expect(r.avisos).toEqual([]);
  });

  /**
   * Pero la proteína está ahí y sale de la misma comida: si no se descuenta se
   * come dos veces. Se dice, como ya se decía del hidrato del lácteo.
   */
  it('pero avisa de la proteína que trae, para descontarla', () => {
    const r = validarCombo(objetivo, [{ grupo: 'legumbres', intercambios: 3 }]);
    expect(r.proteinaDeLegumbres).toBeCloseTo(21, 1);
    expect(r.nota).toContain('21 g de proteína');
    expect(r.nota).toContain('3 porciones');
  });

  it('y no avisa si las legumbres ya estaban pautadas', () => {
    const conLegumbres = objetivoDeBucket({ legumbres: 3 }, 'carbohidrato')!;
    const r = validarCombo(conLegumbres, [{ grupo: 'legumbres', intercambios: 3 }]);
    expect(r.proteinaDeLegumbres).toBeUndefined();
    expect(r.valida).toBe(true);
  });

  /** Lo que sí se sigue vigilando: que no se infle la comida de hidrato. */
  it('cinco lentejas donde había tres almidones sí se pasan', () => {
    const r = validarCombo(objetivo, [{ grupo: 'legumbres', intercambios: 5 }]);
    expect(r.valida).toBe(false);
  });
});

/**
 * EL CASO CONTRARIO: LA MITAD Y LA MITAD
 *
 * Pautando 1,5 almidones y 1,5 legumbres, el descuento se le estaba aplicando
 * también al techo —193,5 kcal en vez de 235,5— mientras que ofrecer 3
 * almidones costaba 205,5. Los mismos 42 g de hidrato en las dos opciones, y la
 * app bloqueaba la que NO traía legumbre.
 *
 * El techo es lo que ella pautó; el descuento es de las opciones.
 */
describe('Mitad almidón y mitad legumbre', () => {
  const MIXTA: ExchangeCounts = { almidones: 1.5, legumbres: 1.5 };
  const objetivo = objetivoDeBucket(MIXTA, 'carbohidrato')!;
  const unificado = objetivoUnificado(objetivo);

  it('el techo son las calorías de lo pautado, sin descuentos', () => {
    // 42 g de hidrato, 13,5 de proteína, 1,5 de grasa.
    expect(topeDeLoPautado('almidones', MIXTA)).toBeCloseTo(235.5, 1);
  });

  it('tres almidones cubren los mismos 42 g y ya no se bloquean', () => {
    const r = validarCombo(objetivo, [{ grupo: 'almidones', intercambios: 3 }]);
    expect(r.valida).toBe(true);
  });

  it('y tres legumbres tampoco', () => {
    const r = validarCombo(objetivo, [{ grupo: 'legumbres', intercambios: 3 }]);
    expect(r.valida).toBe(true);
  });

  /** La fruta trae un gramo más de hidrato por porción y sigue entrando. */
  it('ni tres frutas', () => {
    const r = validarCombo(objetivo, [{ grupo: 'fruta', intercambios: 3 }]);
    expect(r.valida).toBe(true);
  });

  /** Lo que sigue vigilado: que no se infle la comida. */
  it('pero cinco legumbres se siguen pasando', () => {
    const r = validarCombo(objetivo, [{ grupo: 'legumbres', intercambios: 5 }]);
    expect(r.valida).toBe(false);
  });

  it('en proteicos el techo sigue siendo la grasa', () => {
    expect(topeDeLoPautado('proteicos', { proteicos_magros: 3 })).toBeCloseTo(1.5, 1);
    expect(unificado.familia).toBe('almidones');
  });
});

describe('El aviso sólo va en el carbohidrato', () => {
  it('en la columna de proteína no se dice nada de legumbres', () => {
    const objetivo = objetivoDeBucket(
      { proteicos_magros: 3, almidones: 2 },
      'proteina',
    )!;
    const r = validarCombo(objetivo, [{ grupo: 'proteicos_magros', intercambios: 3 }]);
    expect(r.proteinaDeLegumbres).toBeUndefined();
  });

  it('y la proteína de una legumbre se cuenta bien', () => {
    expect(proteinaDeLasLegumbres({ legumbres: 2 })).toBeCloseTo(14, 1);
    expect(proteinaDeLasLegumbres({ almidones: 3 })).toBe(0);
  });
});
