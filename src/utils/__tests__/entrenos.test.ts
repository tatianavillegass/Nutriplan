import { describe, it, expect } from 'vitest';
import {
  cuantosEstaSemana,
  duracionLegible,
  entrenosDe,
  mediaPorSemana,
  nombreDelEntreno,
  porSemana,
  porTipo,
  semanaDeEntrenos,
} from '../entrenos';
import type { Actividad, RegistroDia, TipoDeEntreno } from '../../types/diary';

/**
 * LOS ENTRENOS SE CUENTAN, NO SE APRUEBAN
 *
 * Aquí no hay nada que cumplir: ni objetivo, ni racha, ni días en rojo. Lo que
 * hay que poder contestar es «cuántos por semana, de qué y cómo se sintió»,
 * que es lo que se pregunta en consulta.
 */

let n = 0;
const act = (tipo: TipoDeEntreno, extra: Partial<Actividad> = {}): Actividad => ({
  id: `e${n++}`,
  tipo,
  createdAt: '2026-09-01T10:00:00.000Z',
  ...extra,
});

const dia = (fecha: string, actividad: Actividad[]): RegistroDia =>
  ({ id: `r-${fecha}`, clientId: 'c1', fecha, actividad }) as unknown as RegistroDia;

/* Semana del lunes 7 al domingo 13 de septiembre de 2026. */
const MIERCOLES = '2026-09-09';

const REGISTROS = [
  dia('2026-09-07', [act('fuerza', { minutos: 50 })]),
  dia('2026-09-09', [act('correr', { minutos: 40, comoFue: 'fuerte' }), act('yoga')]),
  /* La semana anterior, una sola. */
  dia('2026-09-02', [act('fuerza', { minutos: 60 })]),
  /* Y la de antes, ninguna: el hueco también es información. */
  dia('2026-08-20', [act('otro', { otro: 'Padel' })]),
];

describe('La semana', () => {
  it('son siete días de lunes a domingo', () => {
    const s = semanaDeEntrenos(REGISTROS, MIERCOLES);
    expect(s.length).toBe(7);
    expect(s[0].fecha).toBe('2026-09-07');
    expect(s[6].fecha).toBe('2026-09-13');
  });

  it('cuenta todos los del día, que hay quien corre y va a pilates', () => {
    expect(cuantosEstaSemana(REGISTROS, MIERCOLES)).toBe(3);
  });

  /**
   * El lunes, seis días sin marcar no son seis fallos: no han llegado. Sin esto
   * la semana se ve como un boletín de notas a medias.
   */
  it('los días que no han llegado se marcan como futuros', () => {
    const s = semanaDeEntrenos(REGISTROS, MIERCOLES);
    expect(s.filter((d) => d.futuro).map((d) => d.fecha)).toEqual([
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
  });
});

describe('Mirar hacia atrás', () => {
  it('las semanas salen de la más reciente, y las vacías también', () => {
    const s = porSemana(REGISTROS, MIERCOLES, 4);
    expect(s[0]).toEqual({ lunes: '2026-09-07', veces: 3, minutos: 90 });
    expect(s[1]).toEqual({ lunes: '2026-08-31', veces: 1, minutos: 60 });
    /* Sin nada apuntado, pero sale igual. */
    expect(s[2]).toEqual({ lunes: '2026-08-24', veces: 0, minutos: 0 });
  });

  /** La de esta semana iría siempre baja: es miércoles. */
  it('la media es de semanas cerradas, sin contar la de ahora', () => {
    expect(mediaPorSemana(REGISTROS, MIERCOLES, 4)).toBe(0.5); // 1+0+0+1 entre 4
  });

  it('el tipo manda sobre el total, y ordena por lo que más repite', () => {
    const t = porTipo(REGISTROS);
    expect(t[0]).toMatchObject({ tipo: 'fuerza', veces: 2, minutos: 110 });
    expect(t.map((x) => x.nombre)).toContain('Padel');
  });

  /** «Otro: padel» y «Otro: escalada» no son lo mismo y no se suman. */
  it('cada «otro» cuenta por su nombre', () => {
    const t = porTipo([
      dia('2026-09-01', [act('otro', { otro: 'Padel' }), act('otro', { otro: 'Escalada' })]),
    ]);
    expect(t.length).toBe(2);
  });

  it('los últimos salen del más nuevo al más viejo', () => {
    const ultimos = entrenosDe(REGISTROS);
    expect(ultimos[0].fecha).toBe('2026-09-09');
    expect(ultimos[ultimos.length - 1].fecha).toBe('2026-08-20');
  });
});

describe('Cómo se lee', () => {
  it('el nombre sale del tipo, o de lo que escribió', () => {
    expect(nombreDelEntreno(act('pilates'))).toBe('Pilates');
    expect(nombreDelEntreno(act('otro', { otro: 'Escalada' }))).toBe('Escalada');
    /* Marcó «otro» y no escribió nada: sigue contando como entreno. */
    expect(nombreDelEntreno(act('otro'))).toBe('Otro');
  });

  it('la duración en horas cuando pasa de una', () => {
    expect(duracionLegible(45)).toBe('45 min');
    expect(duracionLegible(90)).toBe('1 h 30');
    expect(duracionLegible(120)).toBe('2 h');
    /* Apuntarlo es opcional: sin minutos no se inventa un cero. */
    expect(duracionLegible(undefined)).toBeUndefined();
  });
});

/**
 * Los entrenos del reto (`RegistroDia.entrenos`, ids de vídeos marcados) son
 * otra cosa y no pueden colarse aquí: si se contaran, a una participante de un
 * reto le saldrían entrenos que no ha hecho ella.
 */
describe('No se mezcla con los entrenos de un reto', () => {
  it('los vídeos marcados de un reto no cuentan', () => {
    const conReto = [
      { id: 'r', clientId: 'c1', fecha: MIERCOLES, entrenos: ['ent1', 'ent2'] },
    ] as unknown as RegistroDia[];
    expect(cuantosEstaSemana(conReto, MIERCOLES)).toBe(0);
    expect(entrenosDe(conReto)).toEqual([]);
  });
});
