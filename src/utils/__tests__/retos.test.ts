import { describe, it, expect } from 'vitest';
import {
  diaDelReto,
  diasEntre,
  diasQueQuedan,
  estadoDelReto,
  fechaFinal,
  proximaApertura,
  recetasAbiertas,
  recetasAbiertasDe,
  retoDe,
  textoDelDia,
} from '../retos';
import type { Reto } from '../../types/reto';

const RETO: Reto = {
  id: 'rt1',
  nombre: 'UPGRADE 1.0',
  fechaInicio: '2026-09-01',
  dias: 30,
  participantes: ['cl1', 'cl2'],
  recursos: ['rc1'],
  recetas: [
    { recetaId: 'r1', slot: 'desayuno', desdeDia: 1 },
    { recetaId: 'r2', slot: 'comida', desdeDia: 1 },
    { recetaId: 'r3', slot: 'desayuno', desdeDia: 8 },
    { recetaId: 'r4', slot: 'cena', desdeDia: 8 },
    { recetaId: 'r5', slot: 'comida', desdeDia: 15 },
  ],
  createdAt: '2026-08-01',
};

/**
 * EL CALENDARIO ES LO QUE HACE QUE SEA UN RETO
 *
 * Todas empiezan el mismo día. De esa cuenta salen las recetas que están
 * abiertas, lo que queda y lo que se le dice a la participante.
 */
describe('En qué día vamos', () => {
  it('el primer día es el 1, no el 0', () => {
    expect(diaDelReto(RETO, '2026-09-01')).toBe(1);
  });

  it('y va subiendo de uno en uno', () => {
    expect(diaDelReto(RETO, '2026-09-10')).toBe(10);
    expect(diaDelReto(RETO, '2026-09-30')).toBe(30);
  });

  it('antes de empezar da cero o menos', () => {
    expect(diaDelReto(RETO, '2026-08-30')).toBeLessThan(1);
  });

  it('cambiar de mes no lo despista', () => {
    expect(diasEntre('2026-09-28', '2026-10-02')).toBe(4);
    expect(diasEntre('2025-12-30', '2026-01-02')).toBe(3);
  });

  it('el último día sale de la duración', () => {
    expect(fechaFinal(RETO)).toBe('2026-09-30');
    expect(fechaFinal({ ...RETO, dias: 90 })).toBe('2026-11-29');
  });
});

describe('Por empezar, en marcha o terminado', () => {
  it('cada uno en su momento', () => {
    expect(estadoDelReto(RETO, '2026-08-20')).toBe('proximo');
    expect(estadoDelReto(RETO, '2026-09-01')).toBe('en-marcha');
    expect(estadoDelReto(RETO, '2026-09-30')).toBe('en-marcha');
    expect(estadoDelReto(RETO, '2026-10-01')).toBe('terminado');
  });

  it('los días que quedan cuentan el de hoy', () => {
    expect(diasQueQuedan(RETO, '2026-09-01')).toBe(30);
    expect(diasQueQuedan(RETO, '2026-09-30')).toBe(1);
    expect(diasQueQuedan(RETO, '2026-10-05')).toBe(0);
  });

  it('y se dice en castellano', () => {
    expect(textoDelDia(RETO, '2026-09-05')).toBe('Día 5 de 30');
    expect(textoDelDia(RETO, '2026-08-31')).toBe('Empieza mañana');
    expect(textoDelDia(RETO, '2026-08-25')).toMatch(/Empieza en 7 días/);
    expect(textoDelDia(RETO, '2026-10-10')).toMatch(/Terminado/);
  });
});

/**
 * El reto se va abriendo, no se entrega entero el primer día: diez recetas de
 * golpe se leen como un PDF y se cierran, tres cada semana se cocinan.
 */
describe('Las recetas se abren por días', () => {
  it('el primer día sólo están las del día 1', () => {
    expect(recetasAbiertas(RETO, '2026-09-01').map((r) => r.recetaId)).toEqual(['r1', 'r2']);
  });

  it('lo que se abrió sigue abierto: el reto suma, no rota', () => {
    const ids = recetasAbiertas(RETO, '2026-09-20').map((r) => r.recetaId);
    expect(ids).toContain('r1');
    expect(ids).toHaveLength(5);
  });

  it('antes de empezar no hay ninguna', () => {
    expect(recetasAbiertas(RETO, '2026-08-25')).toEqual([]);
  });

  it('se piden por comida, que es como se usan', () => {
    expect(recetasAbiertasDe(RETO, '2026-09-10', 'desayuno').map((r) => r.recetaId)).toEqual([
      'r1',
      'r3',
    ]);
  });

  it('se sabe cuándo se abren las siguientes, para poder anunciarlo', () => {
    expect(proximaApertura(RETO, '2026-09-02')).toEqual({ dia: 8, cuantas: 2 });
    expect(proximaApertura(RETO, '2026-09-10')).toEqual({ dia: 15, cuantas: 1 });
  });

  it('y cuándo ya no queda nada por abrir', () => {
    expect(proximaApertura(RETO, '2026-09-20')).toBeUndefined();
  });
});

/**
 * Una participante es una clienta más: puede estar en un reto sin dejar de
 * tener su plan. Lo que se busca aquí es en cuál está ahora.
 */
describe('En qué reto está cada persona', () => {
  const terminado: Reto = { ...RETO, id: 'rt0', fechaInicio: '2026-01-01' };
  const proximo: Reto = { ...RETO, id: 'rt2', fechaInicio: '2026-12-01' };

  it('el que está en marcha manda sobre el que viene', () => {
    expect(retoDe([proximo, RETO], 'cl1', '2026-09-05')?.id).toBe('rt1');
  });

  it('si no hay ninguno en marcha, se enseña el próximo', () => {
    expect(retoDe([terminado, proximo], 'cl1', '2026-09-05')?.id).toBe('rt2');
  });

  it('quien no está apuntada no ve ninguno', () => {
    expect(retoDe([RETO], 'cl9', '2026-09-05')).toBeUndefined();
  });

  it('sin retos, tampoco', () => {
    expect(retoDe([], 'cl1', '2026-09-05')).toBeUndefined();
  });
});
