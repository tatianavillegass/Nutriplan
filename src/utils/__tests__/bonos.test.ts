import { describe, it, expect } from 'vitest';
import {
  bonoVigente,
  comoVaElBono,
  comoVanLasSesiones,
  pagadoDelBono,
  pendienteDeCobro,
  resumenDeSesiones,
  tocaRenovar,
} from '../bonos';
import type { Bono, Client, Pago, Sesion } from '../../types/client';

/**
 * CÓMO VA UN BONO
 *
 * «Contrató 270, ha pagado 180, le faltan 90; lleva 2 de 3 consultas.» De ahí
 * sale la pregunta de la consulta: a quién hay que llamar para renovar.
 */

const BONO: Bono = {
  id: 'b1',
  nombre: 'Online trimestral',
  importe: 270,
  inicio: '2026-06-01',
  incluye: [
    { id: 'l1', concepto: 'Consultas', cuantas: 3 },
    { id: 'l2', concepto: 'Llamadas', cuantas: 3 },
  ],
};

const HOY = new Date('2026-08-23T12:00:00');

const pago = (importe: number, bonoId?: string): Pago => ({
  id: `p${importe}${bonoId ?? ''}`,
  fecha: '2026-06-01',
  importe,
  ...(bonoId ? { bonoId } : {}),
});

const sesion = (n: number, lineaId: string, bonoId = 'b1'): Sesion => ({
  id: `s${n}${lineaId}`,
  fecha: '2026-06-15',
  bonoId,
  lineaId,
});

const clienta = (extra: Partial<Client> = {}): Client =>
  ({ id: 'c1', nombre: 'Ana', peso: 60, bonos: [BONO], ...extra }) as unknown as Client;

describe('Lo pagado de un bono', () => {
  it('sólo cuenta los pagos de ese bono', () => {
    const pagos = [pago(180, 'b1'), pago(50, 'b2'), pago(30)];
    expect(pagadoDelBono(pagos, 'b1')).toBe(180);
  });

  /** La resta que en pagos sueltos sería inventar y aquí no lo es. */
  it('y de ahí sale lo que falta', () => {
    const c = comoVaElBono(BONO, clienta({ pagos: [pago(180, 'b1')] }), HOY);
    expect(c.pagado).toBe(180);
    expect(c.pendiente).toBe(90);
  });

  it('sin pagar nada, falta todo', () => {
    expect(comoVaElBono(BONO, clienta(), HOY).pendiente).toBe(270);
  });

  it('y si pagó de más, no se debe un número negativo', () => {
    const c = comoVaElBono(BONO, clienta({ pagos: [pago(300, 'b1')] }), HOY);
    expect(c.pendiente).toBe(0);
  });
});

describe('Las sesiones', () => {
  it('van por línea: consultas por un lado, llamadas por otro', () => {
    const lineas = comoVanLasSesiones(BONO, [
      sesion(1, 'l1'),
      sesion(2, 'l1'),
      sesion(3, 'l2'),
    ]);
    expect(lineas[0]).toMatchObject({ hechas: 2, quedan: 1 });
    expect(lineas[1]).toMatchObject({ hechas: 1, quedan: 2 });
  });

  it('se leen como «2 de 3 consultas»', () => {
    const c = comoVaElBono(BONO, clienta({ sesiones: [sesion(1, 'l1'), sesion(2, 'l1')] }), HOY);
    expect(resumenDeSesiones(c)).toBe('2 de 3 consultas · 0 de 3 llamadas');
  });

  /** Un «quedan -1» no significa nada; que se pasó se ve en el «4 de 3». */
  it('y si se hicieron de más, no quedan menos de cero', () => {
    const lineas = comoVanLasSesiones(BONO, [
      sesion(1, 'l1'),
      sesion(2, 'l1'),
      sesion(3, 'l1'),
      sesion(4, 'l1'),
    ]);
    expect(lineas[0]).toMatchObject({ hechas: 4, quedan: 0 });
  });
});

describe('En qué estado está', () => {
  const estado = (extra: Partial<Client>, bono = BONO) =>
    comoVaElBono(bono, clienta(extra), HOY).estado;

  it('recién empezado, al día', () => {
    expect(estado({})).toBe('al-dia');
  });

  it('a falta de una sesión, ya avisa', () => {
    const casi = [sesion(1, 'l1'), sesion(2, 'l1'), sesion(3, 'l1'), sesion(4, 'l2'), sesion(5, 'l2')];
    expect(estado({ sesiones: casi })).toBe('por-terminar');
  });

  it('con todas hechas, terminado', () => {
    const todas = [
      sesion(1, 'l1'), sesion(2, 'l1'), sesion(3, 'l1'),
      sesion(4, 'l2'), sesion(5, 'l2'), sesion(6, 'l2'),
    ];
    expect(estado({ sesiones: todas })).toBe('terminado');
  });

  /** Un bono de tres meses caduca aunque queden sesiones. */
  it('pasado el plazo, vencido aunque sobren sesiones', () => {
    expect(estado({}, { ...BONO, vence: '2026-07-01' })).toBe('vencido');
  });

  it('y a quince días de vencer, avisa', () => {
    expect(estado({}, { ...BONO, vence: '2026-09-01' })).toBe('por-terminar');
  });

  /** Si ella lo dio por cerrado, no hay nada más que decir. */
  it('cerrarlo a mano manda sobre todo lo demás', () => {
    expect(estado({}, { ...BONO, cerrado: true, vence: '2026-01-01' })).toBe('cerrado');
  });
});

describe('A quién hay que llamar', () => {
  it('a la que se le acabó', () => {
    const todas = [
      sesion(1, 'l1'), sesion(2, 'l1'), sesion(3, 'l1'),
      sesion(4, 'l2'), sesion(5, 'l2'), sesion(6, 'l2'),
    ];
    expect(tocaRenovar(clienta({ sesiones: todas }), HOY)).toBe(true);
  });

  it('y a la que está a punto', () => {
    expect(tocaRenovar(clienta({ bonos: [{ ...BONO, vence: '2026-09-01' }] }), HOY)).toBe(true);
  });

  it('pero no a la que acaba de empezar', () => {
    expect(tocaRenovar(clienta(), HOY)).toBe(false);
  });

  it('ni a la que no tiene bono ninguno', () => {
    expect(tocaRenovar(clienta({ bonos: [] }), HOY)).toBe(false);
  });

  it('ni a la que ya cerraste', () => {
    expect(tocaRenovar(clienta({ bonos: [{ ...BONO, cerrado: true }] }), HOY)).toBe(false);
  });
});

describe('El bono que está en marcha', () => {
  it('es el más reciente que sigue vivo', () => {
    const viejo: Bono = { ...BONO, id: 'b0', inicio: '2026-01-01', cerrado: true };
    const c = bonoVigente(clienta({ bonos: [viejo, BONO] }), HOY);
    expect(c?.bono.id).toBe('b1');
  });

  /** «Se le acabó el bono» es justo lo que hace falta ver. */
  it('y si están todos vencidos, se enseña el último igualmente', () => {
    const vencido: Bono = { ...BONO, vence: '2026-01-01' };
    const c = bonoVigente(clienta({ bonos: [vencido] }), HOY);
    expect(c?.estado).toBe('vencido');
  });

  it('sin bonos, no hay nada que enseñar', () => {
    expect(bonoVigente(clienta({ bonos: [] }), HOY)).toBeUndefined();
  });
});

describe('Lo que se le debe en total', () => {
  it('suma lo que falta de todos los bonos abiertos', () => {
    const otro: Bono = { ...BONO, id: 'b2', importe: 110, incluye: [] };
    const c = clienta({ bonos: [BONO, otro], pagos: [pago(180, 'b1')] });
    expect(pendienteDeCobro(c)).toBe(90 + 110);
  });

  it('y no cuenta los cerrados', () => {
    const c = clienta({ bonos: [{ ...BONO, cerrado: true }] });
    expect(pendienteDeCobro(c)).toBe(0);
  });
});
