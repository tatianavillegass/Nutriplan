import { describe, it, expect } from 'vitest';
import {
  citasDe,
  proximaCita,
  lunesDe,
  diasDeLaSemana,
  otraSemana,
  citasDelDia,
  cuantasEseDia,
  conLaCita,
  sinLaCita,
  marcarRealizada,
  desmarcar,
  anular,
  cobrarDeLaCita,
  loQueTocaCobrar,
  citasSinMarcar,
  sinProximaCita,
  comoVaLaSemana,
  franjasDeLaSemana,
  duracionPorDefecto,
  huecoOcupado,
  seSolapanCon,
  carrilesDelDia,
  duracionDe,
} from '../citas';
import type { Bono, Cita, Client } from '../../types/client';

/**
 * LA AGENDA
 *
 * Marcar una cita como realizada es lo que consume una sesión del bono: ése es
 * el cambio, y lo que estos tests vigilan es que no mienta el «2 de 3».
 */

const BONO: Bono = {
  id: 'bn_1',
  nombre: 'Bono 6',
  importe: 420,
  inicio: '2026-09-01',
  incluye: [
    { id: 'ln_c', concepto: 'Consultas', cuantas: 3 },
    { id: 'ln_l', concepto: 'Llamadas', cuantas: 3 },
  ],
};

const cita = (p: Partial<Cita> & { fecha: string }): Cita => ({
  modo: 'consulta',
  ...p,
});

const clienta = (p: Partial<Client> = {}): Client =>
  ({
    id: 'c1',
    nombre: 'Ana García',
    bonos: [BONO],
    sesiones: [],
    pagos: [],
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
    ...p,
  }) as unknown as Client;

const HOY = new Date('2026-09-22T10:00:00');

describe('Las citas que ya tenía no se pierden', () => {
  it('la cita suelta de siempre cuenta como una más de la lista', () => {
    const c = clienta({ cita: cita({ fecha: '2026-09-25', hora: '17:00' }) });
    expect(citasDe(c)).toHaveLength(1);
    expect(citasDe(c)[0].fecha).toBe('2026-09-25');
  });

  it('y no se duplica cuando ya está en la lista', () => {
    const suelta = cita({ fecha: '2026-09-25', hora: '17:00' });
    const c = clienta({ cita: suelta, citas: [{ ...suelta, id: 'ci_1' }] });
    expect(citasDe(c)).toHaveLength(1);
  });

  it('salen ordenadas por el día y la hora', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-25', hora: '17:00' }), id: 'b' },
        { ...cita({ fecha: '2026-09-25', hora: '09:00' }), id: 'a' },
        { ...cita({ fecha: '2026-09-23' }), id: 'z' },
      ],
    });
    expect(citasDe(c).map((x) => x.id)).toEqual(['z', 'a', 'b']);
  });
});

describe('La semana', () => {
  it('el lunes de un martes es el día anterior', () => {
    expect(lunesDe('2026-09-22')).toBe('2026-09-21');
  });

  it('y el de un domingo es el lunes de esa misma semana, no el siguiente', () => {
    expect(lunesDe('2026-09-27')).toBe('2026-09-21');
  });

  it('son siete días, de lunes a domingo', () => {
    const dias = diasDeLaSemana('2026-09-21');
    expect(dias).toHaveLength(7);
    expect(dias[0]).toBe('2026-09-21');
    expect(dias[6]).toBe('2026-09-27');
  });

  it('se puede ir a la semana de antes y a la de después', () => {
    expect(otraSemana('2026-09-21', 1)).toBe('2026-09-28');
    expect(otraSemana('2026-09-21', -1)).toBe('2026-09-14');
  });

  it('las de un día salen por hora, y las que no la llevan al final', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-24' }), id: 'sin-hora' },
        { ...cita({ fecha: '2026-09-24', hora: '12:30' }), id: 'tarde' },
        { ...cita({ fecha: '2026-09-24', hora: '09:00' }), id: 'pronto' },
      ],
    });
    expect(citasDelDia([c], '2026-09-24').map((x) => x.id)).toEqual([
      'pronto',
      'tarde',
      'sin-hora',
    ]);
  });

  it('la cuenta del día no incluye las anuladas: ese hueco está libre', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-24', hora: '09:00' }), id: 'a' },
        { ...cita({ fecha: '2026-09-24', hora: '10:00' }), id: 'b', estado: 'anulada' },
      ],
    });
    expect(cuantasEseDia([c], '2026-09-24')).toBe(1);
  });
});

describe('Poner y quitar una cita', () => {
  it('al guardarla, la clienta ve la próxima sin tocar nada', () => {
    const c = clienta();
    const patch = conLaCita(c, cita({ fecha: '2026-10-05', hora: '16:00' }), HOY);
    expect(patch.citas).toHaveLength(1);
    expect(patch.cita?.fecha).toBe('2026-10-05');
  });

  it('la próxima es la primera que no ha pasado, no la más nueva', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-10' }), id: 'vieja' },
        { ...cita({ fecha: '2026-11-02' }), id: 'lejos' },
        { ...cita({ fecha: '2026-09-25' }), id: 'cerca' },
      ],
    });
    expect(proximaCita(c, HOY)?.id).toBe('cerca');
  });

  it('una anulada no es la próxima aunque sea la primera', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-25' }), id: 'anulada', estado: 'anulada' },
        { ...cita({ fecha: '2026-09-28' }), id: 'buena' },
      ],
    });
    expect(proximaCita(c, HOY)?.id).toBe('buena');
  });

  it('quitarla la borra y deja la próxima al día', () => {
    const c = clienta({ citas: [{ ...cita({ fecha: '2026-09-25' }), id: 'ci_1' }] });
    const patch = sinLaCita(c, 'ci_1', HOY);
    expect(patch.citas).toHaveLength(0);
    expect(patch.cita).toBeUndefined();
  });
});

describe('Marcarla como realizada descuenta del bono', () => {
  const conUna = clienta({
    citas: [{ ...cita({ fecha: '2026-09-21', hora: '10:00' }), id: 'ci_1' }],
  });

  it('crea la sesión, con el bono y la línea de consultas', () => {
    const patch = marcarRealizada(conUna, 'ci_1', HOY);
    expect(patch.sesiones).toHaveLength(1);
    expect(patch.sesiones![0].bonoId).toBe('bn_1');
    expect(patch.sesiones![0].lineaId).toBe('ln_c');
  });

  it('la sesión lleva la fecha de la cita, no la de hoy', () => {
    /* Las del lunes se marcan el miércoles: el mes en que se dio manda. */
    const patch = marcarRealizada(conUna, 'ci_1', HOY);
    expect(patch.sesiones![0].fecha).toBe('2026-09-21');
  });

  it('una llamada gasta una llamada, no una consulta', () => {
    const c = clienta({
      citas: [{ ...cita({ fecha: '2026-09-21', modo: 'llamada' }), id: 'ci_1' }],
    });
    expect(marcarRealizada(c, 'ci_1', HOY).sesiones![0].lineaId).toBe('ln_l');
  });

  it('marcarla dos veces no descuenta dos sesiones', () => {
    const uno = marcarRealizada(conUna, 'ci_1', HOY);
    const despues = { ...conUna, ...uno } as Client;
    expect(marcarRealizada(despues, 'ci_1', HOY)).toEqual({});
  });

  it('desmarcarla quita SU sesión, no la última apuntada a mano', () => {
    const aMano = { id: 'se_mano', fecha: '2026-09-15', bonoId: 'bn_1', lineaId: 'ln_c' };
    const c = { ...conUna, sesiones: [aMano] } as Client;
    const marcada = { ...c, ...marcarRealizada(c, 'ci_1', HOY) } as Client;
    const vuelta = desmarcar(marcada, 'ci_1', HOY);
    expect(vuelta.sesiones).toHaveLength(1);
    expect(vuelta.sesiones![0].id).toBe('se_mano');
  });

  it('anularla no gasta sesión, y si estaba marcada se la quita', () => {
    const marcada = { ...conUna, ...marcarRealizada(conUna, 'ci_1', HOY) } as Client;
    const patch = anular(marcada, 'ci_1', HOY);
    expect(patch.sesiones).toHaveLength(0);
    expect(patch.citas!.find((x) => x.id === 'ci_1')!.estado).toBe('anulada');
  });

  it('sin bono vigente se apunta igual: es una sesión suelta', () => {
    const c = clienta({
      bonos: [],
      tarifa: { nombre: 'Suelta', importe: 40, periodicidad: 'sesion' },
      citas: [{ ...cita({ fecha: '2026-09-21' }), id: 'ci_1' }],
    });
    const s = marcarRealizada(c, 'ci_1', HOY).sesiones![0];
    expect(s.bonoId).toBeUndefined();
    expect(s.importe).toBe(40);
  });
});

describe('Cobrar desde la cita', () => {
  const c = clienta({ citas: [{ ...cita({ fecha: '2026-09-21' }), id: 'ci_1' }] });

  it('el pago se cuelga del bono, que es lo que hace que el «faltan» se entere', () => {
    const patch = cobrarDeLaCita(c, 'ci_1', 210, {}, HOY);
    expect(patch.pagos).toHaveLength(1);
    expect(patch.pagos![0].bonoId).toBe('bn_1');
    expect(patch.pagos![0].importe).toBe(210);
  });

  it('propone lo que falta del bono', () => {
    expect(loQueTocaCobrar(c, HOY)).toBe(420);
    const conMitad = { ...c, pagos: [{ id: 'p1', fecha: '2026-09-01', importe: 210, bonoId: 'bn_1' }] } as Client;
    expect(loQueTocaCobrar(conMitad, HOY)).toBe(210);
  });

  it('cero no es un cobro', () => {
    expect(cobrarDeLaCita(c, 'ci_1', 0, {}, HOY)).toEqual({});
  });
});

describe('Lo que hay que recordarle', () => {
  it('las que pasaron y siguen sin marcar', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-17' }), id: 'olvidada' },
        { ...cita({ fecha: '2026-09-18' }), id: 'hecha', estado: 'realizada' },
        { ...cita({ fecha: '2026-09-30' }), id: 'futura' },
      ],
    });
    expect(citasSinMarcar([c], HOY).map((x) => x.id)).toEqual(['olvidada']);
  });

  it('la de hoy no se reclama todavía: aún se está trabajando', () => {
    const c = clienta({ citas: [{ ...cita({ fecha: '2026-09-22', hora: '09:00' }), id: 'hoy' }] });
    expect(citasSinMarcar([c], HOY)).toHaveLength(0);
  });

  it('quien tiene bono con sesiones por gastar y no tiene la siguiente puesta', () => {
    const sinCita = clienta({ id: 'c2', nombre: 'Marta' });
    const conCita = clienta({ citas: [{ ...cita({ fecha: '2026-09-30' }), id: 'x' }] });
    expect(sinProximaCita([sinCita, conCita], HOY).map((c) => c.id)).toEqual(['c2']);
  });

  it('a quien se le acabó el bono no le falta cita: le toca renovar', () => {
    const gastado = clienta({
      sesiones: [
        { id: 's1', fecha: '2026-09-01', bonoId: 'bn_1', lineaId: 'ln_c' },
        { id: 's2', fecha: '2026-09-08', bonoId: 'bn_1', lineaId: 'ln_c' },
        { id: 's3', fecha: '2026-09-15', bonoId: 'bn_1', lineaId: 'ln_c' },
        { id: 's4', fecha: '2026-09-02', bonoId: 'bn_1', lineaId: 'ln_l' },
        { id: 's5', fecha: '2026-09-09', bonoId: 'bn_1', lineaId: 'ln_l' },
        { id: 's6', fecha: '2026-09-16', bonoId: 'bn_1', lineaId: 'ln_l' },
      ],
    });
    expect(sinProximaCita([gastado], HOY)).toHaveLength(0);
  });

  it('cómo va la semana: cuántas, cuántas hechas y cuántas por marcar', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-21' }), id: 'a', estado: 'realizada' },
        { ...cita({ fecha: '2026-09-21' }), id: 'b' },
        { ...cita({ fecha: '2026-09-24' }), id: 'c' },
        { ...cita({ fecha: '2026-09-24' }), id: 'd', estado: 'anulada' },
      ],
    });
    expect(comoVaLaSemana([c], '2026-09-21', HOY)).toEqual({
      citas: 3,
      realizadas: 1,
      sinMarcar: 1,
    });
  });
});

describe('Las horas de la semana', () => {
  it('van de cuarto en cuarto, de seis de la mañana a diez de la noche', () => {
    /* Una llamada dura quince minutos: después de la de y media entra otra a
       menos cuarto, y ese hueco tiene que poder pulsarse. */
    const franjas = franjasDeLaSemana([clienta()], diasDeLaSemana('2026-09-21'));
    expect(franjas[0]).toBe('06:00');
    expect(franjas[1]).toBe('06:15');
    expect(franjas).toContain('17:45');
    expect(franjas[franjas.length - 1]).toBe('21:45');
  });

  it('una duración disparatada NO estira la agenda hasta las 78:00', () => {
    /* Un 600 donde iba un 60: la semana crecía para que cupiera esa cita y
       la columna de horas seguía bajando sin fin. */
    const c = clienta({
      citas: [{ ...cita({ fecha: '2026-09-23', hora: '18:00', duracionMin: 3600 }), id: 'x' }],
    });
    const franjas = franjasDeLaSemana([c], diasDeLaSemana('2026-09-21'));
    expect(franjas[franjas.length - 1]).toBe('21:45');
    expect(duracionDe({ duracionMin: 3600 })).toBe(240);
  });

  it('y ni con las 24 horas se pasa de medianoche', () => {
    const c = clienta({
      citas: [{ ...cita({ fecha: '2026-09-23', hora: '23:30', duracionMin: 240 }), id: 'x' }],
    });
    const franjas = franjasDeLaSemana([c], diasDeLaSemana('2026-09-21'), true);
    expect(franjas[franjas.length - 1]).toBe('23:45');
  });

  it('se estiran para que quepa una cita fuera de horario', () => {
    /* Una llamada a las siete de la mañana no puede quedarse fuera de la
       rejilla, que es donde se mira la semana. */
    const c = clienta({
      citas: [{ ...cita({ fecha: '2026-09-23', hora: '05:00' }), id: 'pronto' }],
    });
    expect(franjasDeLaSemana([c], diasDeLaSemana('2026-09-21'))[0]).toBe('05:00');
  });

  it('una llamada dura 15 minutos y una consulta 30, sin escribirlo', () => {
    expect(duracionPorDefecto('llamada')).toBe(15);
    expect(duracionPorDefecto('consulta')).toBe(30);
    expect(duracionPorDefecto('videollamada')).toBe(30);
  });

  it('un hueco con una cita encima está ocupado, y el de después no', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-25', hora: '11:00', duracionMin: 60 }), id: 'ci_1' },
      ],
    });
    expect(huecoOcupado([c], '2026-09-25', '11:00')).toBe(true);
    expect(huecoOcupado([c], '2026-09-25', '11:45')).toBe(true);
    expect(huecoOcupado([c], '2026-09-25', '12:00')).toBe(false);
  });

  it('una anulada libera su hueco: ese rato vuelve a estar libre', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-25', hora: '11:00' }), id: 'ci_1', estado: 'anulada' },
      ],
    });
    expect(huecoOcupado([c], '2026-09-25', '11:00')).toBe(false);
  });
});

describe('Dos a la vez se puede, pero se avisa', () => {
  const nicolas = clienta({
    id: 'c1',
    nombre: 'Nicolás',
    citas: [{ ...cita({ fecha: '2026-09-25', hora: '15:00', duracionMin: 45 }), id: 'ci_n' }],
  });

  it('dice con quién choca una cita a esa hora', () => {
    const chocan = seSolapanCon([nicolas], '2026-09-25', '15:30', 30);
    expect(chocan.map((x) => x.client.nombre)).toEqual(['Nicolás']);
  });

  it('y no dice nada cuando entra justo después', () => {
    /* Nicolás acaba a y tres cuartos: Norma entra ahí sin pisarle. */
    expect(seSolapanCon([nicolas], '2026-09-25', '15:45', 30)).toHaveLength(0);
  });

  it('una cita no choca consigo misma al moverla', () => {
    expect(seSolapanCon([nicolas], '2026-09-25', '15:00', 45, 'ci_n')).toHaveLength(0);
  });

  it('las 24 horas se piden aparte, que la jornada normal es de ocho a nueve', () => {
    const franjas = franjasDeLaSemana([clienta()], diasDeLaSemana('2026-09-21'), true);
    expect(franjas[0]).toBe('00:00');
    expect(franjas[franjas.length - 1]).toBe('23:45');
    expect(franjas).toHaveLength(96);
  });
});

describe('Las que caen a la vez se reparten el ancho', () => {
  it('dos que se pisan van en dos carriles', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-25', hora: '15:00', duracionMin: 60 }), id: 'a' },
        { ...cita({ fecha: '2026-09-25', hora: '15:30', duracionMin: 30 }), id: 'b' },
      ],
    });
    const carriles = carrilesDelDia(citasDelDia([c], '2026-09-25'));
    expect(carriles.get('a')).toEqual({ carril: 0, de: 2 });
    expect(carriles.get('b')).toEqual({ carril: 1, de: 2 });
  });

  it('y las que no se pisan ocupan el día entero cada una', () => {
    const c = clienta({
      citas: [
        { ...cita({ fecha: '2026-09-25', hora: '15:00', duracionMin: 30 }), id: 'a' },
        { ...cita({ fecha: '2026-09-25', hora: '16:00', duracionMin: 30 }), id: 'b' },
      ],
    });
    const carriles = carrilesDelDia(citasDelDia([c], '2026-09-25'));
    expect(carriles.get('a')).toEqual({ carril: 0, de: 1 });
    expect(carriles.get('b')).toEqual({ carril: 0, de: 1 });
  });
});
