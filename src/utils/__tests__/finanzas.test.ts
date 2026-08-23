import { describe, it, expect } from 'vitest';
import {
  caeEn,
  delAño,
  flujoDeCaja,
  gastosDelMes,
  hayVariasMonedas,
  ingresosDelMes,
  mesDe,
  mesesEntre,
  monedaDeLaConsulta,
  porMes,
  sumar,
  sumarMeses,
  totalGastosDelMes,
} from '../finanzas';
import type { Gasto } from '../../types/finanzas';
import type { Client } from '../../types/client';

/**
 * CÓMO VA LA CONSULTA
 *
 * Los ingresos ya estaban —los pagos de cada ficha—; faltaba el otro lado.
 * Sin gastos, «cuánto he facturado» no dice si el mes ha ido bien.
 */

const gasto = (id: string, fecha: string, importe: number, extra: Partial<Gasto> = {}): Gasto => ({
  id,
  fecha,
  concepto: id,
  importe,
  categoria: 'otros',
  ...extra,
});

const clienta = (id: string, pagos: { fecha: string; importe: number }[], moneda?: string): Client =>
  ({
    id,
    nombre: id,
    peso: 60,
    pagos: pagos.map((p, i) => ({ id: `${id}-${i}`, ...p })),
    ...(moneda ? { tarifa: { nombre: 'Plan', importe: 100, periodicidad: 'mensual', moneda } } : {}),
  }) as unknown as Client;

const HOY = new Date(2026, 7, 23); // agosto de 2026

describe('Contar meses', () => {
  it('sabe cuántos van de uno a otro', () => {
    expect(mesesEntre('2026-01', '2026-08')).toBe(7);
    expect(mesesEntre('2025-11', '2026-02')).toBe(3);
    expect(mesesEntre('2026-08', '2026-01')).toBe(-7);
  });

  it('y sabe sumarlos y restarlos sin liarse con el año', () => {
    expect(sumarMeses('2026-08', 5)).toBe('2027-01');
    expect(sumarMeses('2026-01', -1)).toBe('2025-12');
    expect(mesDe('2026-08-23')).toBe('2026-08');
  });
});

/**
 * Los fijos son los que nadie se acuerda de teclear y son los que están todos
 * los meses. Si no se contaran solos, el flujo de caja sería mentira.
 */
describe('Un gasto fijo se cuenta solo', () => {
  const supabase = gasto('supabase', '2026-08-23', 25, { cada: 'mes' });

  it('todos los meses desde que se dio de alta', () => {
    expect(caeEn(supabase, '2026-08')).toBe(true);
    expect(caeEn(supabase, '2026-09')).toBe(true);
    expect(caeEn(supabase, '2026-12')).toBe(true);
  });

  it('pero no antes de existir', () => {
    expect(caeEn(supabase, '2026-07')).toBe(false);
  });

  it('y deja de contar cuando se da de baja', () => {
    const baja = { ...supabase, hasta: '2026-10-01' };
    expect(caeEn(baja, '2026-10')).toBe(true);
    expect(caeEn(baja, '2026-11')).toBe(false);
  });

  /** Un trimestral se paga UNA vez cada tres meses, no los tres. */
  it('un trimestral cae cada tres meses, no todos', () => {
    const g = gasto('gestoria', '2026-01-15', 150, { cada: 'trimestre' });
    expect(caeEn(g, '2026-01')).toBe(true);
    expect(caeEn(g, '2026-02')).toBe(false);
    expect(caeEn(g, '2026-03')).toBe(false);
    expect(caeEn(g, '2026-04')).toBe(true);
  });

  it('y uno anual, una vez al año', () => {
    const dominio = gasto('dominio', '2026-03-10', 12, { cada: 'año' });
    expect(caeEn(dominio, '2026-03')).toBe(true);
    expect(caeEn(dominio, '2026-04')).toBe(false);
    expect(caeEn(dominio, '2027-03')).toBe(true);
  });
});

describe('Un gasto suelto', () => {
  it('cuenta sólo en su mes', () => {
    const bascula = gasto('bascula', '2026-05-04', 300);
    expect(caeEn(bascula, '2026-05')).toBe(true);
    expect(caeEn(bascula, '2026-06')).toBe(false);
  });
});

describe('Lo que pesa cada gasto al mes', () => {
  it('reparte los fijos para poder compararlos', () => {
    expect(porMes(12, 'año')).toBe(1);
    expect(porMes(150, 'trimestre')).toBe(50);
    expect(porMes(25, 'mes')).toBe(25);
    expect(porMes(300)).toBe(300);
  });
});

describe('El mes', () => {
  const GASTOS = [
    gasto('supabase', '2026-06-01', 25, { cada: 'mes' }),
    gasto('bascula', '2026-08-04', 300),
  ];
  const CLIENTAS = [
    clienta('ana', [
      { fecha: '2026-08-02', importe: 110 },
      { fecha: '2026-07-02', importe: 110 },
    ]),
    clienta('bea', [{ fecha: '2026-08-15', importe: 270 }]),
  ];

  it('suma lo que entró', () => {
    expect(ingresosDelMes(CLIENTAS, '2026-08')).toBe(380);
    expect(ingresosDelMes(CLIENTAS, '2026-07')).toBe(110);
  });

  it('y lo que salió, con los fijos incluidos', () => {
    expect(gastosDelMes(GASTOS, '2026-08')).toHaveLength(2);
    expect(totalGastosDelMes(GASTOS, '2026-08')).toBe(325);
    expect(totalGastosDelMes(GASTOS, '2026-07')).toBe(25);
  });
});

describe('El flujo de caja', () => {
  const GASTOS = [gasto('supabase', '2026-06-01', 25, { cada: 'mes' })];
  const CLIENTAS = [
    clienta('ana', [
      { fecha: '2026-08-02', importe: 110 },
      { fecha: '2026-06-02', importe: 110 },
    ]),
  ];

  it('va del mes de hoy hacia atrás', () => {
    const meses = flujoDeCaja(CLIENTAS, GASTOS, HOY);
    expect(meses.map((m) => m.mes)).toEqual(['2026-08', '2026-07', '2026-06']);
  });

  it('con lo que entró, lo que salió y lo que quedó', () => {
    const [agosto, julio] = flujoDeCaja(CLIENTAS, GASTOS, HOY);
    expect(agosto).toMatchObject({ ingresos: 110, gastos: 25, saldo: 85 });
    // Un mes sin ingresos y con el fijo: el saldo sale negativo, y eso es
    // información, no un error que haya que esconder.
    expect(julio).toMatchObject({ ingresos: 0, gastos: 25, saldo: -25 });
  });

  /**
   * Se podría proyectar: los fijos están comprometidos. Pero los ingresos de
   * noviembre no se saben, así que un mes futuro saldría con todos los gastos
   * y ningún ingreso: un agujero inventado.
   */
  it('y no se mete en el futuro', () => {
    const meses = flujoDeCaja(CLIENTAS, GASTOS, HOY);
    expect(meses.every((m) => m.mes <= '2026-08')).toBe(true);
  });

  it('sin ningún movimiento, no hay tabla que enseñar', () => {
    expect(flujoDeCaja([], [], HOY)).toEqual([]);
  });

  it('no crece sin fin', () => {
    const viejo = [clienta('vieja', [{ fecha: '2015-01-02', importe: 50 }])];
    expect(flujoDeCaja(viejo, [], HOY, 12)).toHaveLength(12);
  });
});

describe('Los totales de arriba', () => {
  it('suman los meses que se les den', () => {
    const meses = [
      { mes: '2026-08', ingresos: 380, gastos: 325, saldo: 55 },
      { mes: '2026-07', ingresos: 110, gastos: 25, saldo: 85 },
    ];
    expect(sumar(meses)).toEqual({ ingresos: 490, gastos: 350, saldo: 140 });
    expect(sumar([])).toEqual({ ingresos: 0, gastos: 0, saldo: 0 });
  });

  it('y se pueden recortar a un año', () => {
    const meses = [
      { mes: '2026-01', ingresos: 100, gastos: 0, saldo: 100 },
      { mes: '2025-12', ingresos: 200, gastos: 0, saldo: 200 },
    ];
    expect(delAño(meses, 2026)).toHaveLength(1);
  });
});

/** Sumar euros con pesos daría un número sin sentido. */
describe('La moneda', () => {
  it('es la que más se repite', () => {
    expect(monedaDeLaConsulta([clienta('a', [], '€'), clienta('b', [], '€')])).toBe('€');
    expect(
      monedaDeLaConsulta([clienta('a', [], 'COP'), clienta('b', [], 'COP'), clienta('c', [], '€')]),
    ).toBe('COP');
  });

  it('sin tarifas puestas, euros', () => {
    expect(monedaDeLaConsulta([clienta('a', [])])).toBe('€');
  });

  it('y si hay más de una, se avisa en vez de callarse', () => {
    expect(hayVariasMonedas([clienta('a', [], '€'), clienta('b', [], 'COP')])).toBe(true);
    expect(hayVariasMonedas([clienta('a', [], '€'), clienta('b', [], '€')])).toBe(false);
  });
});
