import { describe, it, expect } from 'vitest';
import type { Pausa, RegistroDia } from '../../types/diary';
import {
  EMOCIONES,
  SENALES,
  familiaDe,
  franjaDe,
  patronesDe,
  pausasDe,
  queEjercicio,
  siguientePregunta,
  tresActividades,
} from '../hambreEmocional';

/**
 * EL ÁRBOL DE LA GUÍA, VIVO
 *
 * En papel hay que buscar qué ejercicio toca; aquí se llega en dos o tres
 * toques. Es la diferencia entre hacerlo y no hacerlo cuando son las once de la
 * noche y estás delante de la nevera.
 */
describe('Qué ejercicio toca', () => {
  it('si no sabe qué siente, el de conectar con la emoción', () => {
    expect(queEjercicio({ sabeQueSiente: false })).toBe('emocion');
  });

  it('si es una emoción fuerte, pausa y pregunta', () => {
    expect(queEjercicio({ sabeQueSiente: true, esIntensa: true })).toBe('pausa');
  });

  it('si duda si es hambre de verdad, el escaneo del cuerpo', () => {
    expect(
      queEjercicio({ sabeQueSiente: true, esIntensa: false, dudaSiEsHambre: true }),
    ).toBe('cuerpo');
  });

  it('si está a punto de comer, los cinco minutos', () => {
    expect(
      queEjercicio({
        sabeQueSiente: true,
        esIntensa: false,
        dudaSiEsHambre: false,
        aPuntoDeComer: true,
      }),
    ).toBe('cinco');
  });

  it('y si no es nada de eso, el diario', () => {
    expect(
      queEjercicio({
        sabeQueSiente: true,
        esIntensa: false,
        dudaSiEsHambre: false,
        aPuntoDeComer: false,
      }),
    ).toBe('diario');
  });

  /**
   * Si ya ha comido no hay nada que interrumpir: se anota y ya está. Sin esto,
   * quien abre la app después se encontraría una pausa que llega tarde, que es
   * exactamente la sensación que hay que evitar.
   */
  it('si ya ha comido no se le interrumpe: se anota', () => {
    expect(queEjercicio({ yaComio: true })).toBe('diario');
    expect(siguientePregunta({ yaComio: true })).toBeUndefined();
  });

  it('mientras falte por preguntar, no se decide nada', () => {
    expect(queEjercicio({})).toBeUndefined();
    expect(siguientePregunta({})?.campo).toBe('sabeQueSiente');
    expect(siguientePregunta({ sabeQueSiente: true })?.campo).toBe('esIntensa');
  });

  /** Cuatro preguntas como mucho, y casi siempre una o dos. */
  it('nunca hacen falta más de cuatro preguntas', () => {
    let r: Record<string, boolean> = { sabeQueSiente: true };
    let pasos = 1;
    while (siguientePregunta(r) && pasos < 10) {
      r = { ...r, [siguientePregunta(r)!.campo]: false };
      pasos++;
    }
    expect(pasos).toBeLessThanOrEqual(4);
    expect(queEjercicio(r)).toBe('diario');
  });
});

/**
 * La alegría está en la rueda a propósito: comer para celebrar es normal y
 * sano, y una lista sólo de emociones feas enseñaría que cualquier comida con
 * emoción detrás es un problema.
 */
describe('La rueda de emociones', () => {
  it('incluye la alegría, no sólo lo que duele', () => {
    expect(EMOCIONES.map((f) => f.id)).toContain('alegria');
  });

  it('cada emoción sabe de qué familia es', () => {
    expect(familiaDe('Aburrimiento')).toBe('Aburrimiento');
    expect(familiaDe('frustración')).toBe('Rabia');
    expect(familiaDe('lo que sea')).toBeUndefined();
    expect(familiaDe(undefined)).toBeUndefined();
  });
});

describe('La franja del día', () => {
  /** Va en la hora de su reloj, no en UTC: la noche es su noche. */
  const aLas = (h: number) => new Date(2026, 7, 31, h, 0).toISOString();

  it('es la mitad del patrón, así que se calcula', () => {
    expect(franjaDe(aLas(9))).toBe('Por la mañana');
    expect(franjaDe(aLas(15))).toBe('Por la tarde');
    expect(franjaDe(aLas(19))).toBe('A media tarde');
    expect(franjaDe(aLas(22))).toBe('Por la noche');
    expect(franjaDe(undefined)).toBeUndefined();
  });
});

const pausa = (extra: Partial<Pausa> = {}): Pausa => ({
  id: `p-${Math.random()}`,
  hora: '2026-08-31T22:00:00.000Z',
  momento: 'antes',
  ...extra,
});

const registros = (pausas: Pausa[]): RegistroDia[] =>
  [{ id: 'r1', clientId: 'c', fecha: '2026-08-31', pausas }] as unknown as RegistroDia[];

describe('Los patrones, que son para la consulta', () => {
  const lista = [
    pausa({ emocion: 'Aburrimiento', contexto: 'Sola en casa', queHizo: 'otra-cosa', actividad: 'Salir a andar' }),
    pausa({ emocion: 'Aburrimiento', contexto: 'Sola en casa', queHizo: 'se-paso', actividad: 'Salir a andar' }),
    pausa({ emocion: 'Estrés', contexto: 'Trabajo', queHizo: 'comi' }),
  ];

  it('dicen qué se repite, de más a menos', () => {
    const p = patronesDe(lista);
    expect(p.total).toBe(3);
    expect(p.emociones[0]).toEqual({ que: 'Aburrimiento', veces: 2 });
    expect(p.situaciones[0].que).toBe('Sola en casa');
  });

  /**
   * Lo más útil del panel: se le puede devolver en consulta y suena a algo que
   * funcionó, no a algo que salió mal.
   */
  it('y sobre todo qué le funcionó cuando no comió', () => {
    const p = patronesDe(lista);
    expect(p.loQueFunciono).toEqual([{ que: 'Salir a andar', veces: 2 }]);
  });

  it('lo que hizo se cuenta sin aprobado ni suspenso', () => {
    // «Comí» no resta en ningún sitio: no hay puntuación que bajar.
    const p = patronesDe(lista);
    expect(p).not.toHaveProperty('aciertos');
    expect(p).not.toHaveProperty('racha');
  });
});

/**
 * LAS SEÑALES SON PARA ELLA, Y SÓLO PARA ELLA
 *
 * Se preguntan en primera persona y sin juicio, y en la pantalla de la clienta
 * no vuelven a aparecer: devolvérselas marcadas sería convertir una confidencia
 * en un diagnóstico.
 */
describe('Las señales de alarma', () => {
  it('se cuentan para la nutricionista, con lo que significan', () => {
    const p = patronesDe([
      pausa({ senales: ['sin-control', 'culpa-alta'] }),
      pausa({ senales: ['sin-control'] }),
    ]);
    const sinControl = p.senales.find((s) => s.id === 'sin-control')!;
    expect(sinControl.veces).toBe(2);
    expect(sinControl.paraTats).toContain('atracón');
  });

  it('y si no marcó ninguna, no se enseña nada', () => {
    expect(patronesDe([pausa()]).senales).toEqual([]);
  });

  it('están las cuatro que importa ver pronto', () => {
    expect(SENALES.map((s) => s.id)).toEqual([
      'sin-control',
      'a-solas',
      'culpa-alta',
      'compense',
    ]);
  });
});

describe('Las actividades', () => {
  it('se ofrecen tres, no la lista entera', () => {
    const suyas = ['a', 'b', 'c', 'd', 'e'];
    expect(tresActividades(suyas, 0)).toEqual(['a', 'b', 'c']);
    expect(tresActividades(suyas, 3)).toEqual(['d', 'e', 'a']);
  });

  it('sin lista propia se usan las de partida', () => {
    expect(tresActividades(undefined)).toHaveLength(3);
    expect(tresActividades([])).toHaveLength(3);
  });

  it('con menos de tres se dan las que haya', () => {
    expect(tresActividades(['sólo una'])).toEqual(['sólo una']);
  });
});

describe('El historial', () => {
  it('junta las de todos los días, de la más reciente a la más antigua', () => {
    const r = [
      { id: 'r1', clientId: 'c', fecha: '2026-08-30', pausas: [pausa({ hora: '2026-08-30T10:00:00.000Z' })] },
      { id: 'r2', clientId: 'c', fecha: '2026-08-31', pausas: [pausa({ hora: '2026-08-31T10:00:00.000Z' })] },
    ] as unknown as RegistroDia[];
    expect(pausasDe(r).map((p) => p.hora)).toEqual([
      '2026-08-31T10:00:00.000Z',
      '2026-08-30T10:00:00.000Z',
    ]);
  });

  it('y un día sin pausas no rompe nada', () => {
    expect(pausasDe(registros([]))).toEqual([]);
    expect(pausasDe([{ id: 'r', clientId: 'c', fecha: 'x' } as RegistroDia])).toEqual([]);
  });
});
