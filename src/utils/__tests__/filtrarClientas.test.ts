import { describe, it, expect } from 'vitest';
import {
  FILTRO_VACIO,
  filtrarClientas,
  hayFiltro,
  type Filtro,
} from '../filtrarClientas';
import type { Client } from '../../types/client';

/**
 * ENCONTRAR A UNA CLIENTA
 *
 * La lista salía entera y en el orden de alta. Con cuarenta hay que ir leyendo
 * nombre a nombre, y las que ya no vienen ocupan el mismo sitio que las de
 * esta semana.
 */

const clienta = (id: string, nombre: string, extra: Partial<Client> = {}): Client =>
  ({ id, nombre, peso: 60, ...extra }) as Client;

const HOY = new Date('2026-08-23T12:00:00');

const CLIENTAS = [
  clienta('1', 'María Camila Vélez', {
    email: 'mcv@ejemplo.com',
    fechaAlta: '2026-08-23',
  }),
  clienta('2', 'Ana Torres', {
    email: 'ana@ejemplo.com',
    fechaAlta: '2026-01-10',
    accesoHasta: '2026-08-26', // le quedan 3 días
  }),
  clienta('3', 'Bea Ruiz', {
    email: 'bea@ejemplo.com',
    fechaAlta: '2026-05-01',
    accesoHasta: '2026-07-01', // caducada
  }),
];

const con = (p: Partial<Filtro>): Filtro => ({ ...FILTRO_VACIO, ...p });
const nombres = (cs: Client[]) => cs.map((c) => c.nombre);

describe('El buscador', () => {
  it('encuentra por nombre', () => {
    expect(nombres(filtrarClientas(CLIENTAS, con({ texto: 'torres' })))).toEqual([
      'Ana Torres',
    ]);
  });

  it('y por correo, que a veces es lo único que recuerdas', () => {
    expect(nombres(filtrarClientas(CLIENTAS, con({ texto: 'mcv@' })))).toEqual([
      'María Camila Vélez',
    ]);
  });

  /**
   * Quien escribe deprisa pone «maria». Que no la encuentre por una tilde
   * sería absurdo.
   */
  it('sin que importen las tildes', () => {
    expect(nombres(filtrarClientas(CLIENTAS, con({ texto: 'maria camila' })))).toEqual([
      'María Camila Vélez',
    ]);
    expect(nombres(filtrarClientas(CLIENTAS, con({ texto: 'VÉLEZ' })))).toEqual([
      'María Camila Vélez',
    ]);
  });
});

describe('El filtro de acceso', () => {
  it('separa activas, las que terminan pronto y las caducadas', () => {
    const de = (acceso: Filtro['acceso']) =>
      nombres(filtrarClientas(CLIENTAS, con({ acceso }), undefined, HOY));

    expect(de('activo')).toEqual(['María Camila Vélez']);
    expect(de('termina_pronto')).toEqual(['Ana Torres']);
    expect(de('caducado')).toEqual(['Bea Ruiz']);
  });

  it('y sin filtro salen todas', () => {
    expect(filtrarClientas(CLIENTAS, FILTRO_VACIO, undefined, HOY)).toHaveLength(3);
  });
});

/** «¿A quién se me ha quedado un plan sin mandar?» */
describe('El filtro de planes sin enviar', () => {
  it('deja sólo a las que tienen algo pendiente', () => {
    const sinEnviar = (c: Client) => c.id === '2';
    expect(
      nombres(filtrarClientas(CLIENTAS, con({ soloSinEnviar: true }), sinEnviar)),
    ).toEqual(['Ana Torres']);
  });

  it('y sin saber nada de los planes, no esconde a nadie por su cuenta', () => {
    expect(filtrarClientas(CLIENTAS, FILTRO_VACIO)).toHaveLength(3);
  });
});

describe('El orden', () => {
  /** A quien acabas de dar de alta es a quien vas a abrir ahora. */
  it('por defecto, las últimas de alta arriba', () => {
    expect(nombres(filtrarClientas(CLIENTAS, FILTRO_VACIO))[0]).toBe(
      'María Camila Vélez',
    );
  });

  it('y por nombre cuando buscas a alguien concreto', () => {
    expect(nombres(filtrarClientas(CLIENTAS, con({ orden: 'nombre' })))).toEqual([
      'Ana Torres',
      'Bea Ruiz',
      'María Camila Vélez',
    ]);
  });

  it('no toca la lista original', () => {
    const antes = [...CLIENTAS];
    filtrarClientas(CLIENTAS, con({ orden: 'nombre' }));
    expect(CLIENTAS).toEqual(antes);
  });
});

describe('Saber si hay algo puesto', () => {
  it('para no enseñar el «quitar filtros» de adorno', () => {
    expect(hayFiltro(FILTRO_VACIO)).toBe(false);
    expect(hayFiltro(con({ texto: '  ' }))).toBe(false);
    expect(hayFiltro(con({ texto: 'ana' }))).toBe(true);
    expect(hayFiltro(con({ acceso: 'caducado' }))).toBe(true);
    expect(hayFiltro(con({ soloSinEnviar: true }))).toBe(true);
    expect(hayFiltro(con({ orden: 'nombre' }))).toBe(true);
  });
});

/**
 * A QUIÉN HAY QUE LLAMAR PARA RENOVAR
 *
 * Antes había que abrir ficha por ficha para saberlo, y es justo la pregunta
 * que se hace mirando esta lista.
 */
describe('El filtro de «toca renovar»', () => {
  const conBono = (id: string, extra: Record<string, unknown>): Client =>
    ({
      id,
      nombre: id,
      peso: 60,
      bonos: [
        {
          id: `${id}-b`,
          nombre: 'Trimestral',
          importe: 270,
          inicio: '2026-06-01',
          incluye: [{ id: 'l1', concepto: 'Consultas', cuantas: 3 }],
          ...extra,
        },
      ],
    }) as unknown as Client;

  it('deja sólo a las que se les acaba o se les acabó', () => {
    const vencida = conBono('vencida', { vence: '2026-07-01' });
    const reciente = conBono('reciente', {});
    const lista = filtrarClientas(
      [vencida, reciente],
      con({ soloRenovar: true }),
      undefined,
      HOY,
    );
    expect(nombres(lista)).toEqual(['vencida']);
  });

  it('y sin el filtro no esconde a nadie', () => {
    const vencida = conBono('vencida', { vence: '2026-07-01' });
    expect(filtrarClientas([vencida], FILTRO_VACIO, undefined, HOY)).toHaveLength(1);
  });
});
