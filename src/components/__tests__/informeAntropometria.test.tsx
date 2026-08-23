// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AnthroReportPDF } from '../export/AnthroReportPDF';
import { calcComposicion, calcularEvolucion } from '../../utils/anthropometry';
import type { Medicion } from '../../types/anthropometry';
import type { Client } from '../../types/client';

afterEach(cleanup);

/**
 * EL INFORME DE ANTROPOMETRÍA
 *
 * Los números de una medición sólo se veían en pantalla y en consulta había
 * que copiarlos a mano. Esto es la hoja que se le puede dar a la clienta.
 */

const CLIENTA = {
  id: 'c1',
  nombre: 'Ana Torres',
  sexo: 'mujer',
  peso: 62,
  altura: 165,
  fechaNacimiento: '1994-05-10',
} as unknown as Client;

const medicion = (fecha: string, peso: number, extra: Partial<Medicion> = {}): Medicion => ({
  id: `m-${fecha}`,
  clientId: 'c1',
  fecha,
  peso,
  talla: 165,
  pliegues: {
    triceps: 18,
    subscapular: 14,
    supraespinal: 10,
    abdominal: 20,
    muslo: 25,
    medial_pierna: 15,
    biceps: 8,
    cresta_iliaca: 16,
  },
  perimetros: { cintura: 74, cadera: 98, brazo_relajado: 27 },
  diametros: { humero: 6.2, femur: 9, biestiloideo: 5.1 },
  ...extra,
});

const pinta = (ms: Medicion[], i = ms.length - 1) => {
  const m = ms[i];
  const composicion = calcComposicion(m, 'mujer', 32);
  return render(
    <AnthroReportPDF
      client={CLIENTA}
      medicion={m}
      composicion={composicion}
      evolucion={calcularEvolucion(ms, 'mujer', 32, 'faulkner')}
      formula="faulkner"
      numeroVisita={i + 1}
    />,
  );
};

describe('La hoja del informe', () => {
  it('lleva el nombre, la fecha y la firma colegiada', () => {
    pinta([medicion('2026-08-23', 62)]);
    expect(screen.getByText('Ana Torres')).toBeTruthy();
    expect(document.body.textContent).toContain('23 de agosto de 2026');
    expect(document.body.textContent).toContain('MAD001160');
  });

  it('trae las medidas y la composición', () => {
    pinta([medicion('2026-08-23', 62)]);
    const texto = document.body.textContent ?? '';
    expect(texto).toContain('Pliegues cutáneos');
    expect(texto).toContain('Perímetros');
    expect(texto).toContain('Tríceps');
    expect(texto).toContain('Cintura');
    expect(texto).toContain('Faulkner');
  });

  /**
   * Una lista de lo que no se midió, en una hoja que se le entrega a la
   * clienta, sólo dice que el trabajo está a medias. Eso se queda en pantalla.
   */
  it('no enseña lo que faltó por medir', () => {
    pinta([medicion('2026-08-23', 62, { pliegues: { triceps: 18 } })]);
    const texto = document.body.textContent ?? '';
    expect(texto.toLowerCase()).not.toContain('faltan');
    expect(texto.toLowerCase()).not.toContain('falta ');
  });

  /** Una tabla llena de rayas no informa y ocupa el mismo papel. */
  it('y tampoco las medidas vacías', () => {
    pinta([medicion('2026-08-23', 62, { perimetros: { cintura: 74 } })]);
    expect(screen.queryByText('Muslo medio')).toBeNull();
    expect(screen.getByText('Cintura (mínimo)')).toBeTruthy();
  });
});

describe('La comparación con visitas anteriores', () => {
  it('con una sola visita no se enseña', () => {
    pinta([medicion('2026-08-23', 62)]);
    expect(screen.queryByText('Cómo va cambiando')).toBeNull();
  });

  it('con dos, sale el cambio con su signo', () => {
    pinta([medicion('2026-06-01', 66), medicion('2026-08-23', 62)]);
    expect(screen.getByText('Cómo va cambiando')).toBeTruthy();
    // 62 kg hoy, cuatro menos que en junio.
    expect(document.body.textContent).toContain('-4.0');
  });
});

/**
 * Cada báscula usa su fórmula: no se mezcla con lo de los pliegues. Es la
 * misma regla que ya rige en pantalla.
 */
describe('La bioimpedancia', () => {
  it('sale aparte y con su aviso', () => {
    pinta([medicion('2026-08-23', 62, { bioimpedancia: { grasaPct: 28, visceral: 5 } })]);
    expect(screen.getByText('Bioimpedancia')).toBeTruthy();
    expect(document.body.textContent).toContain('no se mezclan');
  });

  it('y si no se usó báscula, no ocupa sitio', () => {
    pinta([medicion('2026-08-23', 62)]);
    expect(screen.queryByText('Bioimpedancia')).toBeNull();
  });
});
