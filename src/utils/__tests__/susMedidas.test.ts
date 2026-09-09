import { describe, it, expect } from 'vitest';
import {
  CAMPOS,
  evolucionDe,
  fotosDe,
  medidasDe,
  tieneAlgo,
  ultimasMedidas,
} from '../misMedidas';
import { seMide } from '../../types/client';
import type { Client } from '../../types/client';
import type { MedidasDelDia, RegistroDia } from '../../types/diary';

/**
 * LA HOJA DE MEDIDAS DE LAS CLIENTAS ONLINE
 *
 * Son los campos de la planilla que Tats les mandaba por correo. La planilla se
 * rellena una vez y se deja de rellenar: hay que abrir el correo, buscar el
 * archivo, encontrar la columna del mes y acordarse de devolverlo.
 */

const dia = (fecha: string, medidas: MedidasDelDia): RegistroDia =>
  ({ id: `r-${fecha}`, clientId: 'c1', fecha, medidas }) as unknown as RegistroDia;

const clienta = (extra: Partial<Client> = {}) => ({ id: 'c1', ...extra }) as Client;

describe('A quién se le pide', () => {
  it('a nadie por defecto: a las presenciales las mides tú', () => {
    expect(seMide(clienta())).toBe(false);
  });

  it('a quien lo enciendas', () => {
    expect(seMide(clienta({ medidas: true }))).toBe(true);
  });

  /** En un reto online no hay consulta donde medirla. */
  it('y a las de un reto, sin tener que acordarte', () => {
    expect(seMide(clienta({ soloReto: true }))).toBe(true);
    expect(seMide(clienta(), true)).toBe(true);
  });

  /** El interruptor manda: hay a quien medirse le hace daño. */
  it('pero apagarlo a mano gana, aunque esté en un reto', () => {
    expect(seMide(clienta({ medidas: false, soloReto: true }), true)).toBe(false);
  });
});

describe('Los campos son los de su planilla', () => {
  it('con la referencia escrita en el nombre', () => {
    const nombres = CAMPOS.map((c) => c.nombre);
    expect(nombres).toEqual([
      'Peso',
      'Altura',
      'Brazo relajado',
      'Brazo contraído',
      'Cintura (mínimo)',
      'Abdominal (máximo)',
      'Cadera (máximo)',
      'Muslo (medio)',
      'Pierna (máximo)',
    ]);
  });

  /** La altura no cambia de una semana a otra. */
  it('y la altura se marca como de vez en cuando', () => {
    expect(CAMPOS.find((c) => c.id === 'altura')?.deVezEnCuando).toBe(true);
  });
});

describe('Qué cuenta como haber apuntado algo', () => {
  it('un número, una foto o una nota', () => {
    expect(tieneAlgo({ peso: 62 })).toBe(true);
    expect(tieneAlgo({ muslo: 55 })).toBe(true);
    expect(tieneAlgo({ bioimpedancia: { grasaPct: 28 } })).toBe(true);
    expect(tieneAlgo({ fotos: { frente: 'data:x' } })).toBe(true);
    expect(tieneAlgo({ nota: 'semana rara' })).toBe(true);
  });

  it('y nada de eso, no', () => {
    expect(tieneAlgo(undefined)).toBe(false);
    expect(tieneAlgo({})).toBe(false);
    expect(tieneAlgo({ bioimpedancia: {}, fotos: {} })).toBe(false);
  });
});

/**
 * Es la columna «Diferencia» de la planilla, que es lo que de verdad se mira.
 * Dos referencias porque cuentan cosas distintas: un mal día se ve en la
 * primera y no toca la segunda.
 */
describe('Cada medida contra lo anterior y contra el día 1', () => {
  const registros = [
    dia('2026-08-03', { peso: 70, cintura: 82, muslo: 56 }),
    dia('2026-08-10', { peso: 69.2, cintura: 81 }),
    dia('2026-08-17', { peso: 68.5, cintura: 79 }),
  ];
  const medidas = medidasDe(registros);

  it('lo último, lo anterior y lo primero', () => {
    const cintura = evolucionDe(medidas).find((e) => e.campo.id === 'cintura')!;
    expect(cintura.ahora).toBe(79);
    expect(cintura.antes).toBe(81);
    expect(cintura.primero).toBe(82);
  });

  /** Una fila de guiones sólo dice que el trabajo está a medias. */
  it('los campos que nunca ha apuntado no salen', () => {
    const ids = evolucionDe(medidas).map((e) => e.campo.id);
    expect(ids).toContain('peso');
    expect(ids).not.toContain('brazoRelajado');
    expect(ids).not.toContain('altura');
  });

  it('con una sola toma no hay con qué comparar', () => {
    const uno = evolucionDe(medidasDe([dia('2026-08-03', { peso: 70 })]));
    expect(uno[0].ahora).toBe(70);
    expect(uno[0].antes).toBeUndefined();
    expect(uno[0].primero).toBeUndefined();
  });

  /** El muslo lo midió una vez y sigue siendo el último que se sabe. */
  it('lo último de cada cosa, aunque fuera en días distintos', () => {
    const u = ultimasMedidas(medidas);
    expect(u.peso).toBe(68.5);
    expect(u.muslo).toBe(56);
    expect(u.fecha).toBe('2026-08-17');
  });
});

describe('Las fotos', () => {
  it('salen de la más nueva a la más vieja', () => {
    const medidas = medidasDe([
      dia('2026-08-03', { fotos: { frente: 'a' } }),
      dia('2026-08-10', { peso: 69 }),
      dia('2026-08-17', { fotos: { frente: 'b', espalda: 'c' } }),
    ]);
    const con = fotosDe(medidas);
    expect(con.map((m) => m.fecha)).toEqual(['2026-08-17', '2026-08-03']);
  });

  it('y un día sin fotos no aparece', () => {
    expect(fotosDe(medidasDe([dia('2026-08-10', { peso: 69 })]))).toEqual([]);
  });
});
