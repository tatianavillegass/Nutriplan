import { describe, it, expect } from 'vitest';
import {
  cobrosRepetidos,
  mesesConMovimiento,
  movimientosDelMes,
  totalesDelMes,
} from '../caja';
import { ingresosDelMes, totalGastosDelMes } from '../finanzas';
import type { Client } from '../../types/client';
import type { Gasto } from '../../types/finanzas';

/**
 * DE DÓNDE SALEN LOS 9K
 *
 * «Dice que en noviembre han ingresado 9k pero no me suena que esté bien.
 * Deberíamos tener una hoja donde yo pueda ver quiénes han pagado y cuánto,
 * con fecha. Así veo de dónde vienen esos ingresos.»
 *
 * Un número que no se puede abrir no se puede comprobar: sólo se puede creer
 * o desconfiar. Esto es la lista de la que sale.
 */

const clienta = (
  id: string,
  nombre: string,
  pagos: { id: string; fecha: string; importe: number; metodo?: string }[],
  modalidad?: string,
): Client =>
  ({ id, nombre, pagos, modalidad, createdAt: '', updatedAt: '' }) as unknown as Client;

const CLIENTAS = [
  clienta('c1', 'Isabela Cuevas', [
    { id: 'p1', fecha: '2026-11-05', importe: 60, metodo: 'Bizum' },
    { id: 'p2', fecha: '2026-12-02', importe: 60 },
  ], 'online'),
  clienta('c2', 'Elena García', [
    { id: 'p3', fecha: '2026-11-09', importe: 215, metodo: 'Efectivo' },
  ], 'presencial'),
  clienta('c3', 'Juan José Pérez', [{ id: 'p4', fecha: '2026-11-16', importe: 50 }], 'online'),
];

const GASTOS: Gasto[] = [
  { id: 'g1', fecha: '2026-11-10', concepto: 'Plicómetro', importe: 120, categoria: 'material' },
  /* Fijo: cae todos los meses desde que se apuntó. */
  { id: 'g2', fecha: '2026-01-01', concepto: 'Cuota del gestor', importe: 60, categoria: 'servicios', cada: 'mes' },
] as unknown as Gasto[];

describe('El libro de caja de un mes', () => {
  const movs = movimientosDelMes(CLIENTAS, GASTOS, '2026-11');

  it('trae quién pagó, cuánto y cuándo', () => {
    const isabela = movs.find((m) => m.nombre === 'Isabela Cuevas')!;
    expect(isabela.fecha).toBe('2026-11-05');
    expect(isabela.importe).toBe(60);
    expect(isabela.metodo).toBe('Bizum');
    expect(isabela.categoria).toBe('online');
  });

  it('en orden de fecha, que es como se repasa contra el banco', () => {
    expect(movs.map((m) => m.fecha)).toEqual([...movs.map((m) => m.fecha)].sort());
  });

  it('con los gastos en la misma tabla', () => {
    expect(movs.filter((m) => m.tipo === 'gasto').map((m) => m.nombre).sort()).toEqual([
      'Cuota del gestor',
      'Plicómetro',
    ]);
  });

  /* Lo de otro mes no se cuela: es la pregunta que se vino a contestar. */
  it('y sin lo de los demás meses', () => {
    expect(movs.some((m) => m.fecha.startsWith('2026-12'))).toBe(false);
  });

  /**
   * LO IMPORTANTE: la lista y el total tienen que ser lo mismo. Si se
   * calcularan por separado podrían discrepar, y la pregunta pasaría de «¿de
   * dónde salen los 9k?» a «¿cuál de los dos números vale?».
   */
  it('y la suma cuadra con la cifra del resumen', () => {
    const total = totalesDelMes(movs);
    expect(total.ingresos).toBe(ingresosDelMes(CLIENTAS, '2026-11'));
    expect(total.gastos).toBe(totalGastosDelMes(GASTOS, '2026-11'));
    expect(total.saldo).toBe(total.ingresos - total.gastos);
  });

  it('los meses que se pueden mirar son los que tienen algo', () => {
    expect(mesesConMovimiento(CLIENTAS, GASTOS)).toContain('2026-11');
    /* Del más nuevo al más viejo: se mira el último primero. */
    expect(mesesConMovimiento(CLIENTAS, GASTOS)[0]).toBe('2026-12');
  });
});

/**
 * EL MISMO DINERO, DOS VECES
 *
 * Un pago se puede apuntar desde la cita, desde la ficha y desde el bono. Son
 * tres puertas al mismo sitio, y si se entra por dos el mes sale inflado sin
 * que nada chirríe. Es lo primero que hay que mirar cuando un mes no cuadra.
 */
describe('Cobros que parecen repetidos', () => {
  const dobles = [
    clienta('c1', 'Marines Estrada', [
      { id: 'p1', fecha: '2026-11-19', importe: 140 },
      /* El mismo cobro apuntado dos veces: desde la cita y desde la ficha. */
      { id: 'p2', fecha: '2026-11-19', importe: 140 },
      { id: 'p3', fecha: '2026-11-25', importe: 140 },
    ]),
  ];
  const movs = movimientosDelMes(dobles, [], '2026-11');

  it('se marcan los dos, no uno', () => {
    const marcados = cobrosRepetidos(movs);
    expect(marcados.has('p1')).toBe(true);
    expect(marcados.has('p2')).toBe(true);
  });

  /* El de otro día no: mismo importe, pero es otro cobro. */
  it('y no lo que sólo coincide en el importe', () => {
    expect(cobrosRepetidos(movs).has('p3')).toBe(false);
  });

  /* Dos personas distintas con la misma tarifa el mismo día no son un error. */
  it('ni lo de dos personas distintas', () => {
    const dos = [
      clienta('c1', 'Ana', [{ id: 'p1', fecha: '2026-11-19', importe: 60 }]),
      clienta('c2', 'Eva', [{ id: 'p2', fecha: '2026-11-19', importe: 60 }]),
    ];
    expect(cobrosRepetidos(movimientosDelMes(dos, [], '2026-11')).size).toBe(0);
  });

  /* No se descuenta nada: puede ser real, y decidirlo por ella sería inventar. */
  it('marcarlos no cambia el total', () => {
    expect(totalesDelMes(movs).ingresos).toBe(420);
  });
});
