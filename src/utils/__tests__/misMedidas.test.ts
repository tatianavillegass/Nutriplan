import { describe, it, expect } from 'vitest';
import {
  lunesDe,
  medidasDe,
  semanasDePeso,
  tendenciaDePeso,
  ultimasMedidas,
} from '../misMedidas';
import type { RegistroDia } from '../../types/diary';

const dia = (fecha: string, medidas?: RegistroDia['medidas']): RegistroDia => ({
  id: `r-${fecha}`,
  clientId: 'c1',
  fecha,
  recetaElegida: {},
  cumplidas: [],
  porciones: {},
  sustituciones: {},
  extras: [],
  medidas,
});

/**
 * EL PESO DE UN DÍA NO DICE NADA
 *
 * Son dos kilos de agua, sal y lo que quedó de la cena. Lo que orienta es la
 * media de la semana comparada con la anterior, y por eso hasta que no hay dos
 * semanas no se dice nada: un número sacado de tres días no es una tendencia.
 */
describe('Lo que se mide ella', () => {
  it('sólo cuenta lo que tiene algo apuntado', () => {
    const m = medidasDe([dia('2026-08-10'), dia('2026-08-11', { peso: 68 })]);
    expect(m).toHaveLength(1);
    expect(m[0].peso).toBe(68);
  });

  it('lo último de cada cosa, aunque sean días distintos', () => {
    const m = medidasDe([
      dia('2026-08-10', { cintura: 80 }),
      dia('2026-08-12', { peso: 67.5 }),
    ]);
    const u = ultimasMedidas(m);
    expect(u.peso).toBe(67.5);
    expect(u.cintura).toBe(80);
    // La fecha es la del último peso: es lo que se enseña al lado del número.
    expect(u.fecha).toBe('2026-08-12');
  });
});

describe('Las semanas', () => {
  it('empiezan en lunes', () => {
    // El 12 de agosto de 2026 es miércoles.
    expect(lunesDe('2026-08-12')).toBe('2026-08-10');
    expect(lunesDe('2026-08-10')).toBe('2026-08-10');
    // Y un domingo cae en la semana que empezó el lunes anterior.
    expect(lunesDe('2026-08-16')).toBe('2026-08-10');
  });

  it('se promedia lo apuntado en cada una', () => {
    const semanas = semanasDePeso(
      medidasDe([
        dia('2026-08-10', { peso: 70 }),
        dia('2026-08-12', { peso: 69 }),
        dia('2026-08-17', { peso: 68.5 }),
      ]),
    );
    expect(semanas).toHaveLength(2);
    expect(semanas[0].media).toBeCloseTo(69.5, 5);
    expect(semanas[0].dias).toBe(2);
  });
});

describe('La tendencia', () => {
  it('con una sola semana no se dice nada', () => {
    const m = medidasDe([dia('2026-08-10', { peso: 70 }), dia('2026-08-12', { peso: 69 })]);
    expect(tendenciaDePeso(m)).toBeUndefined();
  });

  it('con dos, se compara media contra media', () => {
    const m = medidasDe([
      dia('2026-08-10', { peso: 70 }),
      dia('2026-08-12', { peso: 69 }),
      dia('2026-08-17', { peso: 69 }),
      dia('2026-08-19', { peso: 68 }),
    ]);
    // 69,5 la primera semana y 68,5 la segunda.
    expect(tendenciaDePeso(m)?.porSemana).toBeCloseTo(-1, 5);
    expect(tendenciaDePeso(m)?.semanas).toBe(2);
  });

  /** Sin peso no hay tendencia, aunque se haya medido la cintura. */
  it('la cintura sola no hace tendencia de peso', () => {
    const m = medidasDe([
      dia('2026-08-10', { cintura: 80 }),
      dia('2026-08-17', { cintura: 78 }),
    ]);
    expect(tendenciaDePeso(m)).toBeUndefined();
  });
});
