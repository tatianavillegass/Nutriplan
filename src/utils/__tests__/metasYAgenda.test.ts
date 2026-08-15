import { describe, it, expect } from 'vitest';
import { calcularRacha, calcularRachaMetas, diaDeMetasCerrado, diasDelMes } from '../racha';
import { citaComoIcs, citaLegible, citaPasada, momentoDeCita, resumenDePagos } from '../agenda';
import { metasActivas, recursosDeCliente } from '../../types/client';
import { registroVacio } from '../../types/diary';
import type { RegistroDia } from '../../types/diary';
import type { Cita, Client } from '../../types/client';
import type { DayType } from '../../types/plan';

const META = (id: string, activa = true) => ({ id, texto: `Meta ${id}`, activa, createdAt: '' });

const dia = (fecha: string, metas: string[] = [], cumplidas: string[] = []): RegistroDia => ({
  ...registroVacio('cl1', fecha, `rg_${fecha}`),
  dayTypeId: 'dt',
  metas,
  cumplidas,
});

/**
 * LAS METAS HACEN RACHA APARTE
 *
 * Un día de poca agua no puede tirar por tierra veinte días de comer bien, ni
 * al revés. Mezclarlas en un solo número sólo sirve para castigar dos veces
 * por el mismo día flojo.
 */
describe('El día de metas', () => {
  const metas = [META('a'), META('b')];

  it('se cierra cuando están todas marcadas', () => {
    expect(diaDeMetasCerrado(dia('2026-08-14', ['a', 'b']), metas)).toBe(true);
  });

  it('con una a medias, no', () => {
    expect(diaDeMetasCerrado(dia('2026-08-14', ['a']), metas)).toBe(false);
  });

  it('sin metas puestas no hay nada que cerrar', () => {
    expect(diaDeMetasCerrado(dia('2026-08-14'), [])).toBe(false);
  });

  it('una meta pausada deja de pedirse', () => {
    const client = { metas: [META('a'), META('b', false)] } as unknown as Client;
    const activas = metasActivas(client);
    expect(activas).toHaveLength(1);
    expect(diaDeMetasCerrado(dia('2026-08-14', ['a']), activas)).toBe(true);
  });
});

describe('Las dos rachas van por su cuenta', () => {
  const DIA: DayType = {
    id: 'dt',
    nombre: 'Día base',
    proteinaGkg: 2,
    hcGkg: 3,
    meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
    grid: { comida: { proteicos_magros: 4 } },
    notas: {},
  };
  const metas = [META('a')];

  it('fallar las metas no rompe la de comidas', () => {
    const rs = [
      dia('2026-08-12', ['a'], ['comida']),
      dia('2026-08-13', [], ['comida']),
      dia('2026-08-14', [], ['comida']),
    ];
    expect(calcularRacha(rs, [DIA], '2026-08-14').actual).toBe(3);
    expect(calcularRachaMetas(rs, metas, '2026-08-14').actual).toBe(0);
  });

  it('ni al revés', () => {
    const rs = [
      dia('2026-08-13', ['a'], ['comida']),
      dia('2026-08-14', ['a'], []),
    ];
    expect(calcularRachaMetas(rs, metas, '2026-08-14').actual).toBe(2);
    expect(calcularRacha(rs, [DIA], '2026-08-14').actual).toBe(1);
  });

  it('que hoy esté a medias no rompe la de ayer', () => {
    const rs = [dia('2026-08-13', ['a']), dia('2026-08-14', [])];
    const r = calcularRachaMetas(rs, metas, '2026-08-14');
    expect(r.actual).toBe(1);
    expect(r.hoyCerrado).toBe(false);
  });
});

/**
 * Un círculo por día hasta hoy. El resto del mes no se pinta: por delante no
 * ha pasado nada todavía y verlo vacío se lee como deuda.
 */
describe('Los círculos del mes', () => {
  it('llegan hasta hoy y ni un día más', () => {
    const dias = diasDelMes([], '2026-08-14', () => false);
    expect(dias).toHaveLength(14);
    expect(dias[13].fecha).toBe('2026-08-14');
  });

  it('marcan los días cerrados', () => {
    const rs = [dia('2026-08-02', ['a']), dia('2026-08-05', [])];
    const dias = diasDelMes(rs, '2026-08-06', (r) => diaDeMetasCerrado(r, [META('a')]));
    expect(dias.filter((d) => d.cerrado).map((d) => d.fecha)).toEqual(['2026-08-02']);
  });
});

/**
 * RECURSOS: DE ENTRADA, NINGUNO
 *
 * El error de dar de más no se puede deshacer, porque ya lo ha visto.
 */
describe('Recursos habilitados', () => {
  it('sin lista, no ve ninguno', () => {
    expect(recursosDeCliente({} as Client)).toEqual([]);
  });

  it('sólo los que se le abren', () => {
    expect(recursosDeCliente({ recursos: ['rc1'] } as Client)).toEqual(['rc1']);
  });
});

// ── Citas ──────────────────────────────────────────────

const CITA: Cita = {
  fecha: '2026-08-19',
  hora: '17:30',
  duracionMin: 45,
  modo: 'videollamada',
  donde: 'https://meet.google.com/abc',
  nota: 'Traer la analítica',
};

describe('La próxima cita', () => {
  it('se lee en castellano', () => {
    expect(citaLegible(CITA)).toMatch(/19 de agosto a las 17:30/);
  });

  it('sabe cuándo ya pasó', () => {
    expect(citaPasada(CITA, new Date('2026-08-19T17:00:00'))).toBe(false);
    expect(citaPasada(CITA, new Date('2026-08-19T18:30:00'))).toBe(true);
  });

  it('sin hora se entiende igual', () => {
    expect(momentoDeCita({ fecha: '2026-08-19', modo: 'consulta' })).toBeInstanceOf(Date);
  });

  it('una fecha vacía no revienta nada', () => {
    expect(momentoDeCita({ fecha: '', modo: 'consulta' })).toBeUndefined();
    expect(citaLegible({ fecha: '', modo: 'consulta' })).toBe('');
  });
});

/**
 * El archivo de calendario es .ics porque lo entienden Google, Apple y Outlook
 * por igual. Conectar la cuenta de Google pediría permisos y claves para
 * ahorrar dos clics.
 */
describe('El archivo de calendario', () => {
  const ics = citaComoIcs(CITA, 'Consulta de nutrición · Catalina');

  it('es un calendario con un evento', () => {
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('lleva el título, el sitio y la duración', () => {
    expect(ics).toContain('SUMMARY:Consulta de nutrición · Catalina');
    expect(ics).toContain('meet.google.com/abc');
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics).toMatch(/DTEND:\d{8}T\d{6}Z/);
  });

  it('avisa el día antes, que es cuando aún se puede mover', () => {
    expect(ics).toContain('TRIGGER:-P1D');
  });

  it('escapa las comas, que si no parten el archivo', () => {
    const conComa = citaComoIcs({ ...CITA, donde: 'Calle Mayor 3, 2º B' }, 'Cita');
    expect(conComa).toContain('Calle Mayor 3\\, 2º B');
  });

  it('sin fecha no inventa un archivo', () => {
    expect(citaComoIcs({ fecha: '', modo: 'consulta' }, 'Cita')).toBe('');
  });
});

/**
 * Se suma lo cobrado y se enseña el último, y nada más. La app no sabe cuántos
 * periodos han pasado, así que un «debe X» en rojo sería inventado.
 */
describe('Los pagos', () => {
  const pagos = [
    { id: 'p1', fecha: '2026-06-01', importe: 60 },
    { id: 'p2', fecha: '2026-08-01', importe: 60, concepto: 'Agosto' },
    { id: 'p3', fecha: '2026-07-01', importe: 60 },
  ];

  it('se suman', () => {
    expect(resumenDePagos(pagos).total).toBe(180);
  });

  it('el último es el más reciente por fecha, no el último apuntado', () => {
    expect(resumenDePagos(pagos).ultimo?.id).toBe('p2');
  });

  it('sin pagos, cero y sin romperse', () => {
    expect(resumenDePagos()).toEqual({ total: 0, ultimo: undefined, tarifa: undefined, moneda: '€' });
  });

  it('la moneda es la de la tarifa', () => {
    const t = { nombre: 'Mensual', importe: 60, periodicidad: 'mensual' as const, moneda: 'COP' };
    expect(resumenDePagos(pagos, t).moneda).toBe('COP');
    expect(resumenDePagos(pagos, t).tarifa).toBe(60);
  });
});
