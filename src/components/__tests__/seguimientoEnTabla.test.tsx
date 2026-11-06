// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { TablaDeSeguimiento } from '../common/TablaDeSeguimiento';
import { tablaDeAntropometria, tablaDeMedidas } from '../../utils/seguimientoEnTabla';
import type { Medicion } from '../../types/anthropometry';
import type { Medida } from '../../utils/misMedidas';

afterEach(cleanup);

/**
 * COMPARAR DOS TOMAS ES RECORRER UNA COLUMNA
 *
 * «Me está quedando difícil comparar las medidas, la manera como se muestra no
 * es muy clara. Que me aparezcan los cm de cada medida con la fecha, alineados
 * por fecha y con la diferencia desde la última consulta.»
 *
 * Es la planilla que ella ya tenía: una fila por medida, una columna por toma
 * y la diferencia detrás de cada una.
 */

const MEDIDAS: Medida[] = [
  { fecha: '2025-03-24', peso: 58.4, altura: 163, cintura: 69, cadera: 98.5, muslo: 55.5 },
  { fecha: '2025-04-21', peso: 58.4, altura: 163, cintura: 68, cadera: 95, muslo: 55.4 },
  { fecha: '2025-05-25', peso: 57.6, altura: 163, cintura: 67, cadera: 94, muslo: 53 },
];

const pintarMedidas = () => {
  const { columnas, grupos } = tablaDeMedidas(MEDIDAS);
  render(<TablaDeSeguimiento columnas={columnas} grupos={grupos} />);
};

/**
 * La fila de una medida, por su nombre exacto. Por nombre parcial no vale:
 * «Cintura» está en «Cintura (mínimo)» y en «Cintura / cadera».
 */
const filaDe = (nombre: string) => {
  const th = screen
    .getAllByRole('rowheader')
    .find((e) => (e.textContent ?? '').trim().startsWith(nombre));
  if (!th) throw new Error(`No hay fila «${nombre}»`);
  return th.closest('tr')!;
};

const hayFila = (nombre: string) =>
  screen.getAllByRole('rowheader').some((e) => (e.textContent ?? '').trim().startsWith(nombre));

describe('Las medidas de quien sólo manda perímetros', () => {
  it('una columna por toma, con su fecha', () => {
    pintarMedidas();
    for (const f of ['24/03/2025', '21/04/2025', '25/05/2025'])
      expect(screen.getByText(f)).toBeTruthy();
  });

  it('y los cm de cada medida en su fila', () => {
    pintarMedidas();
    const cintura = within(filaDe('Cintura'));
    expect(cintura.getByText('69,0')).toBeTruthy();
    expect(cintura.getByText('68,0')).toBeTruthy();
    expect(cintura.getByText('67,0')).toBeTruthy();
  });

  /* Lo que se pedía: la diferencia desde la toma anterior, no desde el día 1. */
  it('con la diferencia desde la anterior', () => {
    pintarMedidas();
    const cadera = within(filaDe('Cadera'));
    expect(cadera.getByText('−3,5')).toBeTruthy();
    expect(cadera.getByText('−1,0')).toBeTruthy();
  });

  /* Un cero en una columna de cambios se lee como un dato: dice «no pasó nada». */
  it('y «igual» cuando no se mueve', () => {
    pintarMedidas();
    expect(within(filaDe('Peso')).getByText('igual')).toBeTruthy();
  });

  /* La talla cambia cada varios años, no cada mes: no se compara consigo misma. */
  it('la talla no lleva diferencia', () => {
    pintarMedidas();
    expect(within(filaDe('Talla')).queryByText('igual')).toBeNull();
  });

  /* Los días entre tomas, que es la otra columna de su planilla. */
  it('y dice cuántos días pasaron', () => {
    pintarMedidas();
    expect(screen.getByText('28 d')).toBeTruthy();
    expect(screen.getByText('34 d')).toBeTruthy();
  });

  it('con una sola toma no hay nada que comparar', () => {
    const { columnas, grupos } = tablaDeMedidas([MEDIDAS[0]]);
    render(<TablaDeSeguimiento columnas={columnas} grupos={grupos} />);
    expect(screen.queryByText('Dif.')).toBeNull();
  });
});

/* ───────────────────────── Antropometría ────────────────────────────────── */

const medicion = (
  fecha: string,
  triceps: number,
  abdominal: number,
  cintura: number,
): Medicion => ({
  id: `m-${fecha}`,
  clientId: 'c',
  fecha,
  peso: 66.3,
  talla: 176,
  pliegues: { triceps, abdominal, subscapular: 9, supraespinal: 8, muslo: 36, medial_pierna: 21.4 },
  perimetros: { cintura, cadera: 101.5, brazo_relajado: 26.5 },
  diametros: {},
});

const MEDICIONES = [
  medicion('2026-05-19', 17, 8.2, 68),
  medicion('2026-07-07', 17, 9.2, 66),
  medicion('2026-09-07', 19.4, 14.2, 69),
];

const pintarAntropo = () => {
  const { columnas, grupos } = tablaDeAntropometria(MEDICIONES, 'hombre', 30, 'yuhasz');
  render(<TablaDeSeguimiento columnas={columnas} grupos={grupos} />);
};

describe('La antropometría', () => {
  /*
   * Lo que faltaba: «me deja ver la suma de pliegues pero no puedo comparar
   * los mm de grasa en cada punto ni las medidas, y eso me interesa».
   */
  it('enseña los milímetros de cada pliegue', () => {
    pintarAntropo();
    const abdominal = within(filaDe('Abdominal'));
    expect(abdominal.getByText('8,2')).toBeTruthy();
    expect(abdominal.getByText('14,2')).toBeTruthy();
    /* Y su cambio: +5,0 de la segunda a la tercera. */
    expect(abdominal.getByText('+5,0')).toBeTruthy();
  });

  it('y los perímetros, uno a uno', () => {
    pintarAntropo();
    const cintura = within(filaDe('Cintura'));
    expect(cintura.getByText('68,0')).toBeTruthy();
    expect(cintura.getByText('+3,0')).toBeTruthy();
  });

  /* Las sumas y la composición siguen estando, al final, como en su Excel. */
  it('sin perder las sumas ni la composición', () => {
    pintarAntropo();
    expect(hayFila('Σ 6 pliegues')).toBe(true);
    expect(screen.getByText('Composición')).toBeTruthy();
    /*
     * La masa muscular necesita los diámetros, y esta toma no los tiene: una
     * fila entera vacía no se enseña.
     */
    expect(hayFila('Masa muscular')).toBe(false);
  });

  /* Lo que no se midió ese día no se inventa. */
  it('lo que no se tomó se queda vacío', () => {
    const { columnas, grupos } = tablaDeAntropometria(
      [MEDICIONES[0], { ...MEDICIONES[1], pliegues: { triceps: 17 } }],
      'hombre',
      30,
      'yuhasz',
    );
    render(<TablaDeSeguimiento columnas={columnas} grupos={grupos} />);
    expect(within(filaDe('Muslo frontal')).getAllByText('·').length).toBeGreaterThan(0);
  });

  /* Una medida que nunca se tomó no ocupa una fila vacía. */
  it('y lo que no se midió nunca no sale', () => {
    pintarAntropo();
    expect(hayFila('Cresta ilíaca')).toBe(false);
  });
});
