import { describe, it, expect } from 'vitest';
import {
  checkInPendiente,
  checkInsDe,
  comoVaCambiando,
  etiquetaDeCheckIn,
  lunesDe,
  nombreDeLaSemana,
  semanaQueToca,
} from '../checkin';
import type { CheckIn, RegistroDia } from '../../types/diary';

/**
 * LA ENCUESTA SEMANAL
 *
 * Iba cada catorce días contados desde el inicio de un programa, así que a una
 * clienta de consulta normal —que es la mayoría— no le salía nunca. Ahora es de
 * la SEMANA y de todas: se abre el domingo, pregunta por la semana que acaba y
 * se queda hasta la siguiente.
 *
 * Septiembre de 2026: el 6 es domingo, el 7 lunes y el 13 el domingo siguiente.
 */

const respuestas = { energia: 3, digestion: 3, sueno: 3, hambre: 3, antojos: 3 };

const respondido = (semana: string, fecha: string, extra: Partial<CheckIn> = {}): RegistroDia =>
  ({
    id: `r-${fecha}`,
    clientId: 'c1',
    fecha,
    checkins: [{ semana, fecha, respuestas, ...extra }],
  }) as unknown as RegistroDia;

describe('Las semanas empiezan en lunes', () => {
  it('y el domingo cierra la suya, no abre la siguiente', () => {
    expect(lunesDe('2026-09-07')).toBe('2026-09-07'); // lunes
    expect(lunesDe('2026-09-09')).toBe('2026-09-07'); // miércoles
    expect(lunesDe('2026-09-13')).toBe('2026-09-07'); // domingo
    expect(lunesDe('2026-09-14')).toBe('2026-09-14'); // lunes siguiente
  });
});

describe('Por qué semana se pregunta', () => {
  /** Una semana a medias se contesta peor: el miércoles no se sabe aún. */
  it('el domingo, por la semana que se cierra ese día', () => {
    expect(semanaQueToca('2026-09-13')).toBe('2026-09-07');
  });

  it('y de lunes a sábado, por esa misma: la que acaba de terminar', () => {
    expect(semanaQueToca('2026-09-14')).toBe('2026-09-07');
    expect(semanaQueToca('2026-09-19')).toBe('2026-09-07');
  });

  it('hasta que llega el domingo siguiente', () => {
    expect(semanaQueToca('2026-09-20')).toBe('2026-09-14');
  });
});

describe('Cuándo se le enseña', () => {
  it('a cualquiera con plan enviado, sin necesitar programa', () => {
    expect(checkInPendiente('2026-09-13', [], '2026-08-31')).toBe('2026-09-07');
  });

  /**
   * Preguntarle qué tal la semana en la que todavía no tenía plan no informa
   * de nada: la semana entera tiene que haber ido por detrás del envío.
   */
  it('pero no por una semana anterior a su plan', () => {
    expect(checkInPendiente('2026-09-13', [], '2026-09-10')).toBeUndefined();
  });

  it('sin fecha de envío no se estorba', () => {
    expect(checkInPendiente('2026-09-13', [])).toBe('2026-09-07');
  });

  it('y deja de salir en cuanto la contesta', () => {
    const registros = [respondido('2026-09-07', '2026-09-13')];
    expect(checkInPendiente('2026-09-13', registros, '2026-08-31')).toBeUndefined();
    // El domingo siguiente vuelve, con la semana nueva.
    expect(checkInPendiente('2026-09-20', registros, '2026-08-31')).toBe('2026-09-14');
  });

  /** Perseguir con una encuesta no funciona; hacerla desaparecer tampoco. */
  it('si no contesta el domingo, sigue disponible toda la semana', () => {
    expect(checkInPendiente('2026-09-17', [], '2026-08-31')).toBe('2026-09-07');
  });
});

describe('Lo ya contestado no se pierde', () => {
  const viejo = {
    id: 'r0',
    clientId: 'c1',
    fecha: '2026-08-14',
    checkins: [{ numero: 1, fecha: '2026-08-14', respuestas }],
  } as unknown as RegistroDia;

  it('los de las quincenas del programa se siguen leyendo', () => {
    const todos = checkInsDe([viejo, respondido('2026-09-07', '2026-09-13')]);
    expect(todos.length).toBe(2);
    expect(todos[0].numero).toBe(1);
    expect(todos[1].semana).toBe('2026-09-07');
  });

  it('y se enseñan por su quincena, que es lo que eran', () => {
    expect(etiquetaDeCheckIn(viejo.checkins![0])).toBe('Quincena 1');
    expect(etiquetaDeCheckIn({ semana: '2026-09-07', fecha: '2026-09-13', respuestas })).toBe(
      nombreDeLaSemana('2026-09-07'),
    );
  });
});

describe('Lo que importa es hacia dónde va', () => {
  it('compara el último con el anterior', () => {
    const registros = [
      respondido('2026-09-07', '2026-09-13'),
      respondido('2026-09-14', '2026-09-20', {
        respuestas: { ...respuestas, sueno: 5, hambre: 1 },
      }),
    ];
    const t = comoVaCambiando(registros);
    expect(t.find((x) => x.id === 'sueno')?.cambio).toBe('sube');
    expect(t.find((x) => x.id === 'hambre')?.cambio).toBe('baja');
    expect(t.find((x) => x.id === 'energia')?.cambio).toBe('igual');
  });

  it('y sin ninguno no dice nada', () => {
    expect(comoVaCambiando([])).toEqual([]);
  });
});
