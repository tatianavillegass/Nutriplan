import { describe, it, expect } from 'vitest';
import { balanceDelDia } from '../diary';
import { diaCerrado } from '../racha';
import { estaSustituida, loComidoEn } from '../../types/diary';
import type { DayType } from '../../types/plan';
import type { RegistroDia, Bocado } from '../../types/diary';
import type { Alimento } from '../../types/food';

/**
 * COMÍ OTRA COSA
 *
 * Las tres quejas que esto resuelve, y que antes acababan todas igual de mal:
 *
 *   · «no comí tus recetas pero comí sano» → o se marcaba hecha una comida
 *     que no se hizo, o se apuntaba libre, que es otra cosa
 *   · «comí menos de lo que me pusiste» → no había forma de decirlo
 *   · «no merendé, pero comí otra cosa» → se apuntaba como extra y el día
 *     salía PASADO de calorías habiendo comido menos
 *
 * Lo que se comprueba aquí es que sustituye y no suma.
 */

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 2 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 3 },
  ],
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 2 },
    merienda: { fruta: 1, almidones: 1 },
    cena: { proteicos_magros: 3, almidones: 2 },
  },
  notas: {},
};

const dia = (extra: Partial<RegistroDia> = {}): RegistroDia => ({
  id: 'r1',
  clientId: 'c1',
  fecha: '2026-03-10',
  dayTypeId: 'dt',
  recetaElegida: {},
  cumplidas: [],
  porciones: {},
  sustituciones: {},
  extras: [],
  ...extra,
});

/** Un bocado con macros y kcal que se corresponden. */
const bocado = (nombre: string, momento: string, hc: number): Bocado => ({
  id: `b-${nombre}-${momento}`,
  nombre,
  cantidad: 100,
  unidad: 'g',
  macros: { proteina: 0, hc, grasa: 0 },
  kcal: hc * 4,
  momento,
});

const SIN_ALIMENTOS: Alimento[] = [];
/** En fase 1 no se marca nada, así que el plan se da por cumplido. */
const COMO_FASE_1 = { asumirPlanCumplido: true };

describe('Lo pautado de esa comida deja de contar', () => {
  it('sin tocar nada, el día cuenta el plan entero', () => {
    const b = balanceDelDia(DIA, dia(), SIN_ALIMENTOS, COMO_FASE_1);
    expect(b.kcalTotal).toBeCloseTo(b.kcalPautado, 5);
  });

  it('decir «no comí nada en la merienda» baja el día', () => {
    const b = balanceDelDia(DIA, dia({ sustituidas: { merienda: {} } }), SIN_ALIMENTOS, COMO_FASE_1);
    expect(b.kcalTotal).toBeLessThan(b.kcalPautado);
  });

  it('y lo pautado no se toca: es lo que su cuerpo necesitaba', () => {
    const b = balanceDelDia(DIA, dia({ sustituidas: { merienda: {} } }), SIN_ALIMENTOS, COMO_FASE_1);
    const entero = balanceDelDia(DIA, dia(), SIN_ALIMENTOS, COMO_FASE_1);
    expect(b.kcalPautado).toBeCloseTo(entero.kcalPautado, 5);
  });
});

describe('Lo que comió de verdad entra en su lugar', () => {
  const registro = dia({
    sustituidas: { merienda: {} },
    bocados: [bocado('Tostada', 'merienda', 20)],
  });

  it('suma lo apuntado, no lo pautado de esa comida', () => {
    const b = balanceDelDia(DIA, registro, SIN_ALIMENTOS, COMO_FASE_1);
    const sinMerienda = balanceDelDia(
      DIA,
      dia({ sustituidas: { merienda: {} } }),
      SIN_ALIMENTOS,
      COMO_FASE_1,
    );
    expect(b.kcalTotal).toBeCloseTo(sinMerienda.kcalTotal + 80, 5);
  });

  it('comer MENOS deja el día por debajo de lo pautado', () => {
    // La merienda pautada son 1 fruta + 1 almidón; esto es una tostada sola.
    const b = balanceDelDia(DIA, registro, SIN_ALIMENTOS, COMO_FASE_1);
    expect(b.kcalTotal).toBeLessThan(b.kcalPautado);
  });

  it('NO cuenta como desvío: no se ha pasado, ha comido otra cosa', () => {
    const b = balanceDelDia(DIA, registro, SIN_ALIMENTOS, COMO_FASE_1);
    expect(b.pesoExtras).toBe(0);
    expect(b.deExtras).toEqual({ proteina: 0, hc: 0, grasa: 0 });
  });

  it('comer MÁS de lo pautado sí pasa el día, que es la verdad', () => {
    const mucho = dia({
      sustituidas: { merienda: {} },
      bocados: [bocado('Bocadillo', 'merienda', 200)],
    });
    const b = balanceDelDia(DIA, mucho, SIN_ALIMENTOS, COMO_FASE_1);
    expect(b.kcalTotal).toBeGreaterThan(b.kcalPautado);
  });

  it('lo apuntado en una comida que NO sustituyó no se cuela', () => {
    // Un bocado suelto de fase 4 en un registro de fase 1: sin `sustituidas`
    // esa comida sigue siendo la pautada y no hay nada que reemplazar.
    const raro = dia({ bocados: [bocado('Algo', 'merienda', 50)] });
    const b = balanceDelDia(DIA, raro, SIN_ALIMENTOS, COMO_FASE_1);
    expect(b.kcalTotal).toBeCloseTo(b.kcalPautado, 5);
  });
});

describe('Las calorías de una etiqueta también cuentan', () => {
  it('si el bote dice más que los macros, manda el bote', () => {
    const conEtiqueta: Bocado = {
      ...bocado('Barrita', 'merienda', 10),
      kcal: 200, // la etiqueta, por encima de los 40 que salen de los macros
    };
    const b = balanceDelDia(
      DIA,
      dia({ sustituidas: { merienda: {} }, bocados: [conEtiqueta] }),
      SIN_ALIMENTOS,
      COMO_FASE_1,
    );
    const sinNada = balanceDelDia(
      DIA,
      dia({ sustituidas: { merienda: {} } }),
      SIN_ALIMENTOS,
      COMO_FASE_1,
    );
    expect(b.kcalTotal).toBeCloseTo(sinNada.kcalTotal + 200, 5);
  });
});

describe('El día se puede cerrar', () => {
  const hechas = { cumplidas: ['desayuno', 'cena'] };

  it('una comida sustituida cuenta como contestada', () => {
    expect(diaCerrado(dia({ ...hechas, sustituidas: { merienda: {} } }), DIA)).toBe(true);
  });

  it('«no comí nada» también la cierra: es una respuesta', () => {
    expect(diaCerrado(dia({ ...hechas, sustituidas: { merienda: { nota: 'sin hambre' } } }), DIA)).toBe(
      true,
    );
  });

  it('pero no regala el día: la cena sigue sin contestar', () => {
    const soloMerienda = dia({
      cumplidas: ['desayuno'],
      sustituidas: { merienda: {} },
      bocados: [bocado('Tostada', 'merienda', 20)],
    });
    expect(diaCerrado(soloMerienda, DIA)).toBe(false);
  });

  it('y en fase 4 sigue cerrándose con apuntar algo, como siempre', () => {
    // Ahí no hay comidas sustituidas: los bocados son todo lo que hay.
    expect(diaCerrado(dia({ bocados: [bocado('Pollo', 'cena', 0)] }), DIA)).toBe(true);
  });
});

describe('Preguntas sueltas del registro', () => {
  it('se sabe si una comida está sustituida', () => {
    const r = dia({ sustituidas: { merienda: {} } });
    expect(estaSustituida(r, 'merienda')).toBe(true);
    expect(estaSustituida(r, 'cena')).toBe(false);
    expect(estaSustituida(undefined, 'merienda')).toBe(false);
  });

  it('y qué comió en ella', () => {
    const r = dia({
      sustituidas: { merienda: {} },
      bocados: [bocado('Tostada', 'merienda', 20), bocado('Pollo', 'cena', 0)],
    });
    expect(loComidoEn(r, 'merienda').map((b) => b.nombre)).toEqual(['Tostada']);
    expect(loComidoEn(r, 'desayuno')).toEqual([]);
  });
});
