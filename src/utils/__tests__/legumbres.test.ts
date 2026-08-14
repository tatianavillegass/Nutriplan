import { describe, it, expect } from 'vitest';
import { bucketExchanges, exchangesToMacros, exchangesToKcal } from '../exchanges';
import { estadoComida } from '../completitud';
import { presupuestoDelDia } from '../dailyBudget';
import { bucketsDeGrupo } from '../../data/exchangeGroups';
import type { DayType } from '../../types/plan';

/**
 * UNA PORCIÓN DE LEGUMBRE ES CARBOHIDRATO Y PROTEÍNA
 *
 * Un intercambio de legumbre trae 14 g de hidrato y 7 g de proteína: una
 * porción entera de cada macro. Contarla sólo como carbohidrato hacía que un
 * plato de lentejas dejara la proteína del día pidiendo un pollo que ya no
 * hacía falta, y que la app avisara de que «faltaba proteína» cuando estaba
 * en el plato.
 *
 * Lo que NO cambia son los gramos: la porción sigue siendo la misma comida.
 * Cada macro lee lo suyo de ella, así que no se cuenta nada dos veces.
 */
describe('Los dos macros de una legumbre', () => {
  it('gasta carbohidrato y proteína', () => {
    expect(bucketsDeGrupo('legumbres')).toEqual(['carbohidrato', 'proteina']);
    expect(bucketExchanges({ legumbres: 2 })).toEqual({
      carbohidrato: 2,
      proteina: 2,
      grasa: 0,
    });
  });

  it('los demás grupos siguen gastando uno solo', () => {
    expect(bucketsDeGrupo('almidones')).toEqual(['carbohidrato']);
    expect(bucketExchanges({ almidones: 2 })).toEqual({
      carbohidrato: 2,
      proteina: 0,
      grasa: 0,
    });
  });

  it('los gramos y las calorías no se duplican', () => {
    expect(exchangesToMacros({ legumbres: 1 })).toEqual({ hc: 14, proteina: 7, grasa: 0.5 });
    // 14×4 + 7×4 + 0,5×9 = 88,5 kcal, las de una porción, no las de dos.
    expect(exchangesToKcal({ legumbres: 1 })).toBeCloseTo(88.5, 4);
  });
});

/**
 * La nutricionista casi nunca pauta legumbres: pone almidón y proteína. Si la
 * clienta resuelve la comida con lentejas, la comida está bien y no hay nada
 * que avisar.
 */
describe('Un plato de lentejas donde se pautó almidón y proteína', () => {
  const pautado = { almidones: 2, proteicos_magros: 2 };

  it('dos porciones de legumbre cuadran la comida entera', () => {
    const r = estadoComida(pautado, { legumbres: 2 });
    expect(r.estado).toBe('completa');
  });

  it('con una sola falta la mitad de las dos cosas, no una sola', () => {
    const r = estadoComida(pautado, { legumbres: 1 });
    const carb = r.filas.find((f) => f.bucket === 'carbohidrato')!;
    const prot = r.filas.find((f) => f.bucket === 'proteina')!;
    expect(carb.estado).toBe('falta');
    expect(prot.estado).toBe('falta');
    expect(prot.cubierto).toBe(1);
  });

  it('no aparece como un macro que no estaba pautado', () => {
    const r = estadoComida(pautado, { legumbres: 2 });
    expect(r.filas.every((f) => f.pautado > 0)).toBe(true);
  });
});

describe('Y en el presupuesto del día', () => {
  const DIA: DayType = {
    id: 'dt',
    nombre: 'Día base',
    proteinaGkg: 2,
    hcGkg: 3,
    meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
    grid: { comida: { almidones: 3, proteicos_magros: 3 } },
    notas: {},
  };

  it('elegir legumbre descuenta de los dos macros', () => {
    const con = presupuestoDelDia(DIA, { comida: { legumbres: 2 } });
    const carb = con.find((m) => m.bucket === 'carbohidrato')!;
    const prot = con.find((m) => m.bucket === 'proteina')!;
    expect(carb.elegido).toBe(2);
    expect(prot.elegido).toBe(2);
    expect(prot.restante).toBe(1);
  });

  it('y sale en las dos listas, para que se entienda por qué', () => {
    const con = presupuestoDelDia(DIA, { comida: { legumbres: 2 } });
    for (const bucket of ['carbohidrato', 'proteina'] as const) {
      const m = con.find((x) => x.bucket === bucket)!;
      expect(m.grupos.some((g) => g.grupo === 'legumbres')).toBe(true);
    }
  });
});
