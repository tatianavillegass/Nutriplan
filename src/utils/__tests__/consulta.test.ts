import { describe, it, expect } from 'vitest';
import {
  añoDeConsulta,
  descuentoDelBono,
  descuentos,
  gastosPorCategoria,
  mesDeConsulta,
  sesionesDelMes,
  sumarMeses,
  valorDeSesion,
} from '../consulta';
import type { Bono, Client } from '../../types/client';
import type { Gasto } from '../../types/finanzas';

/**
 * CÓMO VA EL MES
 *
 * La hoja que Tats llevaba a mano. Lo importante no es cada número sino la
 * pareja cobrado / devengado: si alguien paga 270 € en enero y hace sus tres
 * consultas en enero, febrero y marzo, enero cobra 270 pero devenga 90.
 * Enero no fue tan bueno como parece y marzo no fue tan malo.
 */

const BONO: Bono = {
  id: 'b1',
  nombre: 'Trimestral',
  importe: 270,
  inicio: '2026-01-01',
  incluye: [
    { id: 'l1', concepto: 'Consultas', cuantas: 3 },
    { id: 'l2', concepto: 'Llamadas', cuantas: 3 },
  ],
};

const clienta = (id: string, extra: Partial<Client> = {}): Client =>
  ({ id, nombre: id, peso: 60, bonos: [BONO], ...extra }) as unknown as Client;

const sesion = (fecha: string, extra: Record<string, unknown> = {}) => ({
  id: `s-${fecha}-${Math.random()}`,
  fecha,
  bonoId: 'b1',
  lineaId: 'l1',
  ...extra,
});

const gasto = (id: string, importe: number, extra: Partial<Gasto> = {}): Gasto => ({
  id,
  fecha: '2026-01-05',
  concepto: id,
  importe,
  categoria: 'local',
  ...extra,
});

describe('Lo que vale una sesión', () => {
  it('es el precio del bono entre lo que incluye', () => {
    // 270 € entre 3 consultas y 3 llamadas = 45 € cada una.
    expect(valorDeSesion(BONO)).toBe(45);
  });

  it('y sin nada incluido no vale nada, en vez de dividir entre cero', () => {
    expect(valorDeSesion({ ...BONO, incluye: [] })).toBe(0);
  });
});

describe('Cobrado y devengado no son lo mismo', () => {
  const clientes = [
    clienta('ana', {
      pagos: [{ id: 'p1', fecha: '2026-01-10', importe: 270, bonoId: 'b1' }],
      sesiones: [sesion('2026-01-15'), sesion('2026-02-15'), sesion('2026-03-15')],
    }),
  ];

  it('en enero entra todo el dinero pero sólo se trabaja una sesión', () => {
    const enero = mesDeConsulta(clientes, [], '2026-01');
    expect(enero.cobrado).toBe(270);
    expect(enero.devengado).toBe(45);
    expect(enero.diferencia).toBe(225);
  });

  it('y en marzo se trabaja sin que entre nada', () => {
    const marzo = mesDeConsulta(clientes, [], '2026-03');
    expect(marzo.cobrado).toBe(0);
    expect(marzo.devengado).toBe(45);
    expect(marzo.diferencia).toBe(-45);
  });
});

describe('Las consultas del mes', () => {
  it('se cuentan las marcadas como hechas', () => {
    const clientes = [clienta('ana', { sesiones: [sesion('2026-01-05'), sesion('2026-01-20')] })];
    expect(sesionesDelMes(clientes, '2026-01')).toHaveLength(2);
    expect(sesionesDelMes(clientes, '2026-02')).toHaveLength(0);
  });

  /** Casi nadie alterna: lo normal se hereda de la ficha. */
  it('la modalidad sale de la ficha si la sesión no dice otra cosa', () => {
    const clientes = [
      clienta('ana', {
        modalidad: 'online',
        sesiones: [sesion('2026-01-05'), sesion('2026-01-20', { modalidad: 'presencial' })],
      }),
    ];
    const m = mesDeConsulta(clientes, [], '2026-01');
    expect(m.online).toBe(1);
    expect(m.presencial).toBe(1);
  });

  it('y si no se dijo en ningún sitio, se cuenta aparte en vez de inventar', () => {
    const clientes = [clienta('ana', { sesiones: [sesion('2026-01-05')] })];
    const m = mesDeConsulta(clientes, [], '2026-01');
    expect(m.sinModalidad).toBe(1);
    expect(m.online + m.presencial).toBe(0);
  });

  it('las de quien está haciendo un programa se cuentan aparte', () => {
    const clientes = [
      clienta('ana', {
        programa: { nombre: 'RESET 90', inicio: '2026-01-01', dias: 90 },
        sesiones: [sesion('2026-01-05')],
      }),
      clienta('bea', { sesiones: [sesion('2026-01-06')] }),
    ];
    expect(mesDeConsulta(clientes, [], '2026-01').programa).toBe(1);
  });

  /** Una sesión suelta no se puede valorar: se cuenta, pero no devenga. */
  it('una sesión sin bono se cuenta pero no devenga', () => {
    const clientes = [clienta('ana', { sesiones: [sesion('2026-01-05', { bonoId: undefined })] })];
    const m = mesDeConsulta(clientes, [], '2026-01');
    expect(m.consultas).toBe(1);
    expect(m.sinBono).toBe(1);
    expect(m.devengado).toBe(0);
  });
});

describe('El ticket medio', () => {
  it('es lo cobrado entre las consultas', () => {
    const clientes = [
      clienta('ana', {
        pagos: [{ id: 'p1', fecha: '2026-01-10', importe: 200 }],
        sesiones: [sesion('2026-01-05'), sesion('2026-01-20')],
      }),
    ];
    expect(mesDeConsulta(clientes, [], '2026-01').ticket).toBe(100);
  });

  it('y sin consultas es cero, no una división rota', () => {
    expect(mesDeConsulta([], [], '2026-01').ticket).toBe(0);
  });
});

describe('El año', () => {
  const clientes = [
    clienta('ana', {
      pagos: [{ id: 'p1', fecha: '2026-01-10', importe: 270, bonoId: 'b1' }],
      sesiones: [sesion('2026-01-15'), sesion('2026-02-15')],
    }),
  ];
  const HOY = new Date(2026, 2, 15); // marzo

  it('llega hasta el mes de hoy y no se mete en el futuro', () => {
    const meses = añoDeConsulta(clientes, [], 2026, HOY);
    expect(meses.map((m) => m.mes)).toEqual(['2026-03', '2026-02', '2026-01']);
  });

  it('y el total recalcula el ticket en vez de sumarlo', () => {
    const t = sumarMeses(añoDeConsulta(clientes, [], 2026, HOY));
    expect(t.consultas).toBe(2);
    expect(t.cobrado).toBe(270);
    expect(t.devengado).toBe(90);
    expect(t.ticket).toBe(135);
  });
});

/** Lo que hace falta es ver que el consultorio sube cuando suben las clientas. */
describe('Los gastos por categoría', () => {
  it('se ponen en columnas, un mes al lado del otro', () => {
    const gastos = [
      gasto('Consultorio', 300, { fecha: '2026-01-01', cada: 'mes' }),
      gasto('Indya', 40, { fecha: '2026-01-01', cada: 'mes', categoria: 'herramientas' }),
      gasto('Curso', 200, { fecha: '2026-02-10', categoria: 'formacion' }),
    ];
    const filas = gastosPorCategoria(gastos, ['2026-01', '2026-02']);
    const local = filas.find((f) => f.categoria === 'local')!;
    expect(local.porMes).toEqual([300, 300]);
    expect(local.total).toBe(600);

    const formacion = filas.find((f) => f.categoria === 'formacion')!;
    expect(formacion.porMes).toEqual([0, 200]);
  });

  it('y las que más pesan salen arriba', () => {
    const gastos = [
      gasto('Poco', 10, { categoria: 'material' }),
      gasto('Mucho', 500, { categoria: 'local' }),
    ];
    expect(gastosPorCategoria(gastos, ['2026-01'])[0].categoria).toBe('local');
  });
});

/**
 * El número de descuentos solo no dice gran cosa: lo que decide si compensa
 * seguir haciéndolos es cuánto has dejado de cobrar.
 */
describe('Los descuentos', () => {
  const conDescuento: Bono = {
    ...BONO,
    id: 'b2',
    importe: 230,
    precioBase: 270,
    motivoDescuento: 'Derivación de Marta',
  };

  it('cuentan bonos, clientas y lo que has dejado de cobrar', () => {
    const d = descuentos([
      clienta('ana', { bonos: [conDescuento] }),
      clienta('bea', { bonos: [conDescuento, { ...conDescuento, id: 'b3' }] }),
      clienta('cris'),
    ]);
    expect(d.bonos).toBe(3);
    expect(d.clientas).toBe(2);
    expect(d.dejadoDeCobrar).toBe(120);
    expect(d.motivos).toEqual(['Derivación de Marta']);
  });

  it('un bono a precio de lista no es un descuento', () => {
    expect(descuentoDelBono(BONO)).toBe(0);
    expect(descuentoDelBono({ ...BONO, precioBase: 270 })).toBe(0);
    expect(descuentos([clienta('ana')]).bonos).toBe(0);
  });
});
