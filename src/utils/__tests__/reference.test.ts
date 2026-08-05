import { describe, it, expect } from 'vitest';
import { calcBmr } from '../bmr';
import { calcEnergy } from '../energy';
import { planTargets, fatByDifference, kcalFromMacros, roundPortion } from '../macros';
import { exchangesToMacros, bucketExchanges, gridMacros } from '../exchanges';
import { comparePlanned, semaforo } from '../validation';
import { EXCHANGE_GROUP_LIST } from '../../data/exchangeGroups';
import type { BmrInput } from '../../types/calculations';
import type { ExchangeGrid, Meal } from '../../types/plan';

/**
 * CASO DE REFERENCIA (§11.2)
 * Hombre, 27 años, 69 kg, 185 cm, factor 1.5, termogénesis 1.1
 *   → TMB media 1686 · GET 2781 · ganancia ×1.2 → 3337 kcal
 */
const REF: BmrInput = { sexo: 'hombre', peso: 69, altura: 185, edad: 27 };

describe('TMB — fórmulas individuales', () => {
  const r = calcBmr(REF);

  it('Harris-Benedict revisada', () => {
    // 88.362 + 13.397·69 + 4.799·185 − 5.677·27
    expect(r.harris_benedict).toBeCloseTo(1747.29, 1);
  });

  it('Harris-Benedict original (1919)', () => {
    expect(r.harris_benedict_original).toBeCloseTo(1758.56, 1);
  });

  it('Owen', () => {
    // 879 + 10.2·69
    expect(r.owen).toBeCloseTo(1582.8, 2);
  });

  it('Mifflin-St. Jeor', () => {
    // 690 + 1156.25 − 135 + 5
    expect(r.mifflin).toBeCloseTo(1716.25, 2);
  });
});

describe('TMB media — reconciliación con el caso de referencia', () => {
  const r = calcBmr(REF);

  it('media con HB revisada ≈ 1682', () => {
    expect(Math.round(r.media)).toBe(1682);
  });

  it('media con HB original reproduce EXACTAMENTE el 1686 de la hoja original', () => {
    expect(Math.round(r.media_con_hb_original)).toBe(1686);
  });

  it('la diferencia entre ambas variantes es de ~4 kcal', () => {
    expect(r.media_con_hb_original - r.media).toBeCloseTo(3.76, 1);
  });
});

describe('Cadena energética — caso de referencia', () => {
  it('partiendo de TMB 1686 reproduce GET 2781 y objetivo 3337', () => {
    const e = calcEnergy({
      tmb: 1686,
      activityFactor: 1.5,
      thermogenesis: 1.1,
      goalMultiplier: 1.2,
    });
    expect(Math.round(e.subtotal)).toBe(2529);     // 1686 × 1.5
    expect(e.getMostrado).toBe(2781);              // 2529 × 1.1 = 2781.9 → trunca
    expect(Math.round(e.caloriasObjetivo)).toBe(3337); // 2781 × 1.2 = 3337.2
  });

  it('partiendo de la media con HB revisada da 2775 / 3330', () => {
    const r = calcBmr(REF);
    const e = calcEnergy({
      tmb: r.media,
      activityFactor: 1.5,
      thermogenesis: 1.1,
      goalMultiplier: 1.2,
    });
    expect(e.getMostrado).toBe(2775);
    expect(Math.round(e.caloriasObjetivo)).toBe(3330);
  });

  it('sin truncar el GET antes del objetivo, 1686 → 3338', () => {
    const e = calcEnergy({
      tmb: 1686,
      activityFactor: 1.5,
      thermogenesis: 1.1,
      goalMultiplier: 1.2,
      getRounding: 'none',
    });
    expect(Math.round(e.caloriasObjetivo)).toBe(3338);
  });
});

describe('Tabla de intercambios', () => {
  it('kcal de 1 intercambio de cada grupo = HC·4 + PROT·4 + GRASA·9', () => {
    const esperado: Record<string, number> = {
      verduras: 4 * 4 + 2 * 4 + 0.5 * 9,          // 28.5
      fruta: 15 * 4 + 1 * 4 + 0.25 * 9,           // 66.25
      almidones: 14 * 4 + 2 * 4 + 0.5 * 9,        // 68.5
      legumbres: 14 * 4 + 7 * 4 + 0.5 * 9,        // 88.5
      azucares: 40,
      proteicos_magros: 7 * 4 + 0.5 * 9,          // 32.5
      proteicos_semigrasos: 7 * 4 + 2 * 9,        // 46
      proteicos_grasos: 7 * 4 + 5 * 9,            // 73
      grasas: 45,
    };
    for (const g of EXCHANGE_GROUP_LIST) {
      const kcal = kcalFromMacros({ hc: g.hc, proteina: g.proteina, grasa: g.grasa });
      expect(kcal).toBeCloseTo(esperado[g.id], 4);
    }
  });

  it('acepta medios intercambios', () => {
    const m = exchangesToMacros({ proteicos_magros: 5.5, almidones: 3, grasas: 5 });
    expect(m.proteina).toBeCloseTo(5.5 * 7 + 3 * 2, 4);   // 44.5
    expect(m.hc).toBeCloseTo(3 * 14, 4);                   // 42
    expect(m.grasa).toBeCloseTo(5.5 * 0.5 + 3 * 0.5 + 5 * 5, 4); // 29.25
  });
});

describe('Grasa por diferencia (regla §10.2)', () => {
  it('el residuo calórico cuadra al reconstruir las kcal', () => {
    const kcal = 1796;
    const prot = 145;
    const hc = 160;
    const grasa = fatByDifference(kcal, prot, hc);
    expect(kcalFromMacros({ proteina: prot, hc, grasa })).toBeCloseTo(kcal, 6);
  });

  it('planTargets devuelve g/kg y % coherentes', () => {
    const t = planTargets(1796, 60, 2.4, 2.6);
    expect(t.proteina).toBeCloseTo(144, 6);
    expect(t.hc).toBeCloseTo(156, 6);
    expect(t.gkg.proteina).toBeCloseTo(2.4, 6);
    expect(t.pct.proteina + t.pct.hc + t.pct.grasa).toBeCloseTo(100, 4);
  });
});

describe('Validación planeado vs pautado', () => {
  it('semáforo: ≤5% verde, 5–10% ámbar, >10% rojo', () => {
    expect(semaforo(0.3)).toBe('verde');
    expect(semaforo(-5)).toBe('verde');
    expect(semaforo(7.5)).toBe('ambar');
    expect(semaforo(-10)).toBe('ambar');
    expect(semaforo(12)).toBe('rojo');
  });

  it('reproduce el ejemplo del brief', () => {
    const rows = comparePlanned(
      { proteina: 145, hc: 160, grasa: 64 },
      { proteina: 145.5, hc: 161, grasa: 62.5 },
    );
    expect(rows[0].diferencia).toBeCloseTo(0.5, 4);
    expect(rows[1].diferencia).toBeCloseTo(1, 4);
    expect(rows[2].diferencia).toBeCloseTo(-1.5, 4);
    expect(rows.every((r) => r.semaforo === 'verde')).toBe(true);
  });
});

describe('Agregación para el esquema de Fase 2 (§6.1)', () => {
  const meals: Meal[] = [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
  ];
  const grid: ExchangeGrid = {
    desayuno: { proteicos_magros: 2, almidones: 2, fruta: 1, grasas: 1 },
    comida: { proteicos_magros: 3, proteicos_grasos: 0.5, almidones: 2, legumbres: 1, grasas: 2, verduras: 2 },
  };

  it('proteicos → Proteína · almidones+fruta+legumbres+azúcares → Carbohidrato · grasas → Grasa', () => {
    expect(bucketExchanges(grid.desayuno!)).toEqual({ proteina: 2, carbohidrato: 3, grasa: 1 });
    expect(bucketExchanges(grid.comida!)).toEqual({ proteina: 3.5, carbohidrato: 3, grasa: 2 });
  });

  it('las verduras no entran en el esquema pero sí en los macros pautados', () => {
    const m = gridMacros(grid, meals);
    // verduras: 2 intercambios → 8 g HC, 4 g prot, 1 g grasa
    expect(m.proteina).toBeCloseTo(2 * 7 + 2 * 2 + 1 * 1 + 3 * 7 + 0.5 * 7 + 2 * 2 + 1 * 7 + 2 * 2, 4);
  });
});

describe('Redondeo de gramajes (regla §10.7)', () => {
  it('múltiplos de 5 g desde 20 g; 1 g por debajo', () => {
    expect(roundPortion(150)).toBe(150);
    expect(roundPortion(62.5)).toBe(65); // empate 60/65 → hacia arriba
    expect(roundPortion(22)).toBe(20);
    expect(roundPortion(19.4)).toBe(19);
    expect(roundPortion(5)).toBe(5);
    expect(roundPortion(16.5)).toBe(17);
  });
});
