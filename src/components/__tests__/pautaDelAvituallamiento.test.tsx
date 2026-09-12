// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PautaDelAvituallamiento } from '../planning/PautaDelAvituallamiento';
import { AvituallamientoDelDia } from '../client/AvituallamientoDelDia';
import type { Alimento } from '../../types/food';
import type { Avituallamiento, Meal } from '../../types/plan';

afterEach(cleanup);

const fuente = (id: string, nombre: string, hc: number): Alimento =>
  ({
    id,
    nombre,
    grupo: 'azucares',
    medida_casera: '1 unidad',
    gramos: 100,
    intercambios: hc / 10,
    nutrientes: { kcal: hc * 4, hc, proteina: 0, grasa: 0 },
    comidas_sugeridas: [],
    alergenos: [],
    apto: [],
  }) as unknown as Alimento;

const GEL = fuente('gel', 'Energy gel 100', 25);
const DATIL = fuente('datil', 'Dátil', 15);
const FUENTES = [GEL, DATIL];

const NOVENTA: Avituallamiento = { modo: 'hora', porHora: 60, horas: 1.5 };
const COMIDA = { id: 'intra', nombre: 'Intra-entreno', slot: 'extra', orden: 1 } as Meal;

/**
 * EL RELOJ DEL AVITUALLAMIENTO
 *
 * En bici se elige sobre la marcha. Corriendo hace falta pautar el cuándo: sin
 * eso, o se toman los tres geles en la última media hora o no se toma ninguno.
 */
describe('Pautarlo', () => {
  it('lo reparte solo y se puede rehacer', () => {
    const onChange = vi.fn();
    render(
      <PautaDelAvituallamiento
        avituallamiento={NOVENTA}
        fuentes={FUENTES}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Repartir'));
    const pauta = onChange.mock.calls[0][0].pauta;
    expect(pauta.length).toBe(4);
    expect(pauta[0].foodId).toBe('gel');
  });

  /** Sin duración no hay dónde repartirlas: se dice en vez de inventarlo. */
  it('sin duración lo dice y no reparte', () => {
    render(
      <PautaDelAvituallamiento
        avituallamiento={{ modo: 'total', gramos: 90 }}
        fuentes={FUENTES}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Pon antes la duración/)).toBeTruthy();
    expect(screen.queryByText('Repartir')).toBeNull();
  });

  it('y sin fuentes en la despensa, tampoco', () => {
    render(
      <PautaDelAvituallamiento avituallamiento={NOVENTA} fuentes={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByText(/hacen falta fuentes en la despensa/)).toBeTruthy();
  });

  it('una toma se puede quitar', () => {
    const onChange = vi.fn();
    const con = {
      ...NOVENTA,
      pauta: [
        { minuto: 20, foodId: 'gel', unidades: 1 },
        { minuto: 40, foodId: 'gel', unidades: 1 },
      ],
    };
    render(
      <PautaDelAvituallamiento avituallamiento={con} fuentes={FUENTES} onChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText('Quitar la toma del minuto 20'));
    expect(onChange.mock.calls[0][0].pauta).toEqual([
      { minuto: 40, foodId: 'gel', unidades: 1 },
    ]);
  });

  /** «Sin pauta» y «pauta de cero tomas» tienen que ser lo mismo. */
  it('y al quitar la última, la pauta desaparece', () => {
    const onChange = vi.fn();
    render(
      <PautaDelAvituallamiento
        avituallamiento={{ ...NOVENTA, pauta: [{ minuto: 20, foodId: 'gel', unidades: 1 }] }}
        fuentes={FUENTES}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Quitar la toma del minuto 20'));
    expect(onChange.mock.calls[0][0].pauta).toBeUndefined();
  });
});

describe('Lo que ve la clienta', () => {
  const conPauta: Avituallamiento = {
    ...NOVENTA,
    pauta: [
      { minuto: 20, foodId: 'gel', unidades: 1 },
      { minuto: 40, foodId: 'gel', unidades: 1 },
    ],
  };

  const pintar = (avit: Avituallamiento, marcado: Record<string, number> = {}) =>
    render(
      <AvituallamientoDelDia
        meal={COMIDA}
        avituallamiento={avit}
        fuentes={FUENTES}
        marcado={marcado}
        onMarcar={vi.fn()}
      />,
    );

  it('ve la hora de cada toma', () => {
    pintar(conPauta);
    expect(screen.getByText('Tu pauta')).toBeTruthy();
    expect(screen.getByText('0:20')).toBeTruthy();
    expect(screen.getByText('0:40')).toBeTruthy();
  });

  /** Se marcan solas con lo que suma abajo: no hay dos sitios que cuadrar. */
  it('y se van tachando según lo que suma', () => {
    const { container } = pintar(conPauta, { gel: 2.5 });
    expect(container.querySelectorAll('.line-through').length).toBe(1);
  });

  /** En bici no se pauta el cuándo, y ahí no tiene que salir nada. */
  it('sin pauta no aparece ningún reloj', () => {
    pintar(NOVENTA);
    expect(screen.queryByText('Tu pauta')).toBeNull();
  });

  /**
   * Si ese día se le acabaron los geles y tiró de dátiles, la pauta no se da
   * por hecha —no se tomó eso— pero los gramos sí cuentan.
   */
  it('puede cambiarlo por otra fuente y los gramos cuentan igual', () => {
    const { container } = pintar(conPauta, { datil: 3 });
    expect(container.querySelectorAll('.line-through').length).toBe(0);
    expect(screen.getByText(/30 de 90 g de hidrato/)).toBeTruthy();
  });
});
