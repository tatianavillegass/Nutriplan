import { describe, it, expect } from 'vitest';
import {
  camposConHistorial,
  deLaMedicion,
  evolucionDe,
  historialDeMedidas,
  serieDe,
  tomasConFoto,
} from '../misMedidas';
import { medicionVacia, type Medicion } from '../../types/anthropometry';
import type { MedidasDelDia, RegistroDia } from '../../types/diary';

/**
 * LAS PRIMERAS MEDIDAS LAS PONE ELLA
 *
 * A las pacientes online les pide medidas y fotos antes de la primera consulta
 * y se las mandan por correo, así que esa primera toma —la única contra la que
 * se compara todo lo demás— la escribe la nutricionista. A partir de ahí las
 * mete la paciente desde su app.
 *
 * Las dos van en la MISMA línea del tiempo, y no es hacer trampa: mide la misma
 * persona con la misma cinta en las dos. Lo que sigue sin mezclarse son los
 * pliegues, que esos sí los toma la nutricionista en consulta.
 */

const dia = (fecha: string, medidas: MedidasDelDia): RegistroDia =>
  ({ id: `r-${fecha}`, clientId: 'c1', fecha, medidas }) as unknown as RegistroDia;

const toma = (fecha: string, extra: Partial<Medicion> = {}): Medicion => ({
  ...medicionVacia('c1', `me-${fecha}`, fecha),
  ...extra,
});

describe('Una medición se traduce a los nombres de su planilla', () => {
  it('los perímetros del perfil ISAK pasan a los de la clienta', () => {
    const m = toma('2026-06-01', {
      peso: 70,
      talla: 165,
      perimetros: {
        brazo_relajado: 28,
        cintura: 82,
        abdominal: 90,
        cadera: 100,
        muslo_medio: 56,
        pierna_maximo: 35,
      },
    });
    const t = deLaMedicion(m);
    expect(t.peso).toBe(70);
    expect(t.altura).toBe(165);
    expect(t.cintura).toBe(82);
    expect(t.abdominal).toBe(90);
    expect(t.muslo).toBe(56);
    expect(t.pierna).toBe(35);
    expect(t.origen).toBe('nutricionista');
  });

  /** La foto suelta de la cuenta atrás de un reto no se pierde. */
  it('la foto de antes se lee como la de frente', () => {
    expect(deLaMedicion(toma('2026-06-01', { foto: 'data:vieja' })).fotos?.frente).toBe(
      'data:vieja',
    );
  });
});

describe('Las dos fuentes en una sola línea del tiempo', () => {
  const mediciones = [toma('2026-06-01', { peso: 70, perimetros: { cintura: 82 } })];
  const registros = [
    dia('2026-07-01', { peso: 68.5, cintura: 80 }),
    dia('2026-08-01', { peso: 67, cintura: 78 }),
  ];

  it('van en orden y se sabe quién apuntó cada una', () => {
    const h = historialDeMedidas(mediciones, registros);
    expect(h.map((t) => t.fecha)).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
    expect(h.map((t) => t.origen)).toEqual(['nutricionista', 'clienta', 'clienta']);
  });

  /** Sin esto el «desde el día 1» empezaba a contar desde la segunda toma. */
  it('el día 1 es el suyo, no la primera que apuntó la clienta', () => {
    const cintura = evolucionDe(historialDeMedidas(mediciones, registros)).find(
      (e) => e.campo.id === 'cintura',
    )!;
    expect(cintura.primero).toBe(82);
    expect(cintura.ahora).toBe(78);
  });

  /** Si ha apuntado algo hoy es porque acaba de medirse. */
  it('si caen el mismo día, manda lo que apuntó la clienta', () => {
    const h = historialDeMedidas(mediciones, [dia('2026-06-01', { peso: 69 })]);
    expect(h.length).toBe(1);
    expect(h[0].origen).toBe('clienta');
    expect(h[0].peso).toBe(69);
  });

  it('una medición vacía no inventa una toma', () => {
    expect(historialDeMedidas([toma('2026-06-01')], [])).toEqual([]);
  });
});

/**
 * Uniendo un punto de enero con otro de marzo porque en febrero no se midió la
 * cintura, la línea diría que bajó en línea recta durante dos meses. Y eso no
 * se sabe.
 */
describe('El gráfico sólo une lo que se midió', () => {
  const medidas = historialDeMedidas(
    [],
    [
      dia('2026-06-01', { peso: 70, cintura: 82 }),
      dia('2026-07-01', { peso: 69 }),
      dia('2026-08-01', { peso: 68, cintura: 78 }),
    ],
  );

  it('el peso tiene tres puntos y la cintura dos', () => {
    expect(serieDe(medidas, 'peso').length).toBe(3);
    expect(serieDe(medidas, 'cintura')).toEqual([
      { fecha: '2026-06-01', valor: 82 },
      { fecha: '2026-08-01', valor: 78 },
    ]);
  });

  /** Con un solo punto no hay evolución que enseñar. */
  it('sólo se ofrecen las medidas con dos tomas o más', () => {
    const ids = camposConHistorial(medidas).map((c) => c.id);
    expect(ids).toContain('peso');
    expect(ids).toContain('cintura');
    expect(ids).not.toContain('cadera');
  });
});

describe('Las fotos que se pueden comparar', () => {
  it('salen en orden, de la más vieja a la más nueva', () => {
    const h = historialDeMedidas(
      [toma('2026-06-01', { fotos: { frente: 'a' } })],
      [dia('2026-07-01', { peso: 69 }), dia('2026-08-01', { fotos: { frente: 'b' } })],
    );
    expect(tomasConFoto(h).map((t) => t.fecha)).toEqual(['2026-06-01', '2026-08-01']);
  });
});
