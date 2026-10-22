// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MisPliegues } from '../client/MisPliegues';
import type { Medicion } from '../../types/anthropometry';
import type { Client } from '../../types/client';
import { DEMO_CLIENT } from '../../data/demoSeed';

afterEach(cleanup);

/**
 * SUS PLIEGUES SON SUYOS
 *
 * A las presenciales las mide la nutricionista con el plicómetro, y esos
 * números se quedaban en la consulta: la clienta veía su % de grasa —que SALE
 * de los pliegues— pero no los pliegues. Cuando en consulta se dice «te ha
 * bajado el abdominal», quien lo escucha no tenía dónde mirarlo después.
 */

const CLIENTA: Client = { ...DEMO_CLIENT, sexo: 'mujer', edad: 34 };

const medicion = (
  id: string,
  fecha: string,
  pliegues: Record<string, number>,
  peso = 62,
): Medicion => ({
  id,
  clientId: CLIENTA.id,
  fecha,
  peso,
  talla: 165,
  pliegues,
  perimetros: { cintura: 72, cadera: 96 },
  diametros: {},
});

const ENERO = medicion('m1', '2026-01-15', {
  triceps: 20,
  abdominal: 24,
  muslo: 30,
});
const JUNIO = medicion('m2', '2026-06-15', {
  triceps: 18,
  abdominal: 21,
  muslo: 29,
}, 60);
const OCTUBRE = medicion('m3', '2026-10-15', {
  triceps: 17,
  abdominal: 19,
  muslo: 28,
}, 59);

const abrir = (mediciones: Medicion[], client: Client = CLIENTA) => {
  render(<MisPliegues client={client} mediciones={mediciones} />);
  const ver = screen.queryByText('Ver');
  if (ver) fireEvent.click(ver);
};

describe('Empieza cerrado', () => {
  it('quien entra a ver su racha no se encuentra ocho medidas de su cuerpo', () => {
    render(<MisPliegues client={CLIENTA} mediciones={[ENERO, OCTUBRE]} />);
    expect(screen.getByText('Tus pliegues')).toBeTruthy();
    expect(screen.queryByText('Tríceps')).toBeNull();
  });

  it('y quien viene a mirarlas, las abre', () => {
    abrir([ENERO, OCTUBRE]);
    expect(screen.getByText('Tríceps')).toBeTruthy();
  });
});

describe('Lo que enseña', () => {
  it('cada pliegue medido, con sus milímetros', () => {
    abrir([OCTUBRE]);
    expect(screen.getByText('Tríceps')).toBeTruthy();
    expect(screen.getByText('Abdominal')).toBeTruthy();
    expect(screen.getByText('Muslo frontal')).toBeTruthy();
    expect(screen.getByText('17')).toBeTruthy();
  });

  /** Los que no se midieron ese día no salen inventados en cero. */
  it('y sólo los que se midieron', () => {
    abrir([OCTUBRE]);
    expect(screen.queryByText('Subescapular')).toBeNull();
  });

  /*
   * Un pliegue suelto no dice nada: 18 mm no es bueno ni malo. Lo que informa
   * es que vaya a algún sitio.
   */
  it('cuánto ha cambiado desde la anterior y desde la primera', () => {
    abrir([ENERO, JUNIO, OCTUBRE]);
    // Las dos tablas llevan las mismas columnas.
    expect(screen.getAllByText('vs anterior').length).toBeGreaterThan(0);
    expect(screen.getAllByText('vs primera').length).toBeGreaterThan(0);
    // Abdominal: 21 → 19 desde junio, 24 → 19 desde enero. La fila del
    // abdominal lleva las dos restas, cada una en su columna.
    const abdominal = screen.getByText('Abdominal').closest('tr')!;
    const celdas = Array.from(abdominal.querySelectorAll('td')).map((c) => c.textContent);
    expect(celdas).toEqual(['Abdominal', '19', '−2', '−5']);
  });

  it('con una sola medición no hay con qué comparar, y no se finge', () => {
    abrir([OCTUBRE]);
    expect(screen.queryAllByText('vs anterior')).toHaveLength(0);
    expect(screen.queryAllByText('vs primera')).toHaveLength(0);
  });

  /** El mismo comparativo que ve ella en la ficha: una sola forma de comparar. */
  it('y debajo, el comparativo de siempre', () => {
    abrir([ENERO, OCTUBRE]);
    expect(screen.getByText('Cómo has ido')).toBeTruthy();
    expect(screen.getByText('Peso')).toBeTruthy();
    expect(screen.getByText('Cintura')).toBeTruthy();
  });

  it('se dice de qué día son', () => {
    abrir([OCTUBRE]);
    expect(screen.getByText(/15 de octubre/)).toBeTruthy();
  });

  /*
   * Un rango de referencia al lado de un número del propio cuerpo convierte
   * una medida en un aprobado o un suspenso.
   */
  it('sin valores de referencia ni semáforos', () => {
    abrir([ENERO, OCTUBRE]);
    expect(screen.queryByText(/normal|elevado|ideal|objetivo/i)).toBeNull();
  });
});

describe('Sin plicómetro no hay tarjeta', () => {
  it('sin mediciones, nada', () => {
    const { container } = render(<MisPliegues client={CLIENTA} mediciones={[]} />);
    expect(container.firstChild).toBeNull();
  });

  /** Las online no tienen pliegues: el dato decide, no hace falta preguntar. */
  it('con mediciones pero sin pliegues, tampoco', () => {
    const sinPliegues: Medicion = { ...OCTUBRE, pliegues: {} };
    const { container } = render(<MisPliegues client={CLIENTA} mediciones={[sinPliegues]} />);
    expect(container.firstChild).toBeNull();
  });
});
