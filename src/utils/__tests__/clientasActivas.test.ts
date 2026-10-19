import { describe, it, expect } from 'vitest';
import { activas, inactivas, porClientaDelMes, mesDeHoy } from '../clientasActivas';
import type { Client } from '../../types/client';

/**
 * CUÁNTAS ESTÁN ACTIVAS, Y CUÁNTO DEJA CADA UNA
 *
 * «24 clientes» no sirve para decidir nada: dentro están las de esta semana y
 * las que se fueron en marzo. Lo que se comprueba aquí es que el recuento dice
 * la verdad y que la media no se inventa un número cuando no hay de qué.
 */

const HOY = new Date('2026-10-19T12:00:00');

const clienta = (id: string, extra: Partial<Client> = {}): Client =>
  ({
    id,
    nombre: id,
    edad: 30,
    peso: 60,
    altura: 165,
    sexo: 'mujer',
    activityFactorId: 'sedentario',
    objetivo: 'mantenimiento',
    goalMultiplier: 1,
    bmrFormula: 'media',
    alergias: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...extra,
  }) as Client;

const pago = (fecha: string, importe: number) => ({ id: `p-${fecha}-${importe}`, fecha, importe });

describe('Quién está activa', () => {
  it('sin fecha de fin, el acceso es abierto y cuenta', () => {
    expect(activas([clienta('a')], HOY)).toHaveLength(1);
  });

  it('con el acceso por delante, cuenta', () => {
    expect(activas([clienta('a', { accesoHasta: '2026-12-31' })], HOY)).toHaveLength(1);
  });

  /** Y la que se fue en marzo deja de inflar el número. */
  it('con el acceso pasado, no', () => {
    expect(activas([clienta('a', { accesoHasta: '2026-03-01' })], HOY)).toHaveLength(0);
  });

  /** Se le acaba esta semana: sigue siendo clienta, y hay que llamarla. */
  it('a punto de acabarse sigue contando', () => {
    expect(activas([clienta('a', { accesoHasta: '2026-10-21' })], HOY)).toHaveLength(1);
  });

  it('el resto del total son las inactivas', () => {
    const lista = [
      clienta('a'),
      clienta('b', { accesoHasta: '2026-03-01' }),
      clienta('c', { accesoHasta: '2026-03-02' }),
    ];
    expect(activas(lista, HOY)).toHaveLength(1);
    expect(inactivas(lista, HOY)).toBe(2);
  });
});

describe('Cuánto deja cada clienta activa', () => {
  const lista = [
    clienta('a', { pagos: [pago('2026-10-03', 120)] }),
    clienta('b', { pagos: [pago('2026-10-14', 80)] }),
    // Se fue, pero pagó en septiembre: no cuenta como activa.
    clienta('c', { accesoHasta: '2026-09-30', pagos: [pago('2026-09-02', 200)] }),
  ];

  it('lo cobrado del mes entre las que están', () => {
    const r = porClientaDelMes(lista, '2026-10', HOY);
    expect(r.activas).toBe(2);
    expect(r.cobrado).toBe(200);
    expect(r.porClienta).toBe(100);
  });

  /*
   * Lo cobrado es de todas, también de las que ya se fueron: ese dinero entró.
   * Lo que no se hace es contarlas como activas.
   */
  it('el cobro de una que ya se fue sigue siendo un cobro', () => {
    const r = porClientaDelMes(lista, '2026-09', HOY);
    expect(r.cobrado).toBe(200);
    expect(r.activas).toBe(2);
  });

  /** Sin nadie a quien atender no hay media: cero, no infinito. */
  it('sin activas, cero', () => {
    const r = porClientaDelMes([clienta('a', { accesoHasta: '2026-01-01' })], '2026-10', HOY);
    expect(r.activas).toBe(0);
    expect(r.porClienta).toBe(0);
  });

  it('y sin cobros del mes, también cero', () => {
    const r = porClientaDelMes([clienta('a')], '2026-10', HOY);
    expect(r.cobrado).toBe(0);
    expect(r.porClienta).toBe(0);
  });
});

describe('El mes del que habla la lista', () => {
  it('es el de hoy', () => {
    expect(mesDeHoy(new Date('2026-10-19T12:00:00Z'))).toBe('2026-10');
  });
});
