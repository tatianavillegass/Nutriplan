// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AvituallamientoDeComida } from '../planning/AvituallamientoDeComida';
import { PautaDelAvituallamiento } from '../planning/PautaDelAvituallamiento';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Meal } from '../../types/plan';

afterEach(cleanup);

/**
 * DE QUÉ PUEDE ECHAR MANO
 *
 * Las fuentes de un avituallamiento se elegían en el editor de despensa, que
 * **sólo sale en fase 1 y 2**: a un corredor en fase 3 no había forma de
 * decirle de qué geles tirar, y el desplegable de «qué y cuándo» se llenaba
 * con lo primero que el catálogo tuviera marcado — de ahí el queso fresco
 * batido que no se podía quitar.
 */

const SALIDA: Meal = { id: 'm-salida', nombre: 'Tirada larga', slot: 'extra', orden: 1 };

const DIA = (extra: Partial<DayType> = {}): DayType =>
  ({
    id: 'dt',
    nombre: 'Día de tirada',
    proteinaGkg: 2,
    hcGkg: 6,
    meals: [SALIDA],
    grid: { [SALIDA.id]: { azucares: 4 } },
    notas: {},
    avituallamientos: { [SALIDA.id]: { modo: 'hora', porHora: 60, horas: 2 } },
    ...extra,
  }) as unknown as DayType;

const pintar = (dayType = DIA(), onChange = vi.fn()) => {
  render(
    <AvituallamientoDeComida
      dayType={dayType}
      meal={SALIDA}
      foods={FOOD_CATALOG}
      onChange={onChange}
    />,
  );
  return onChange;
};

describe('Elegir las fuentes, en cualquier fase', () => {
  it('hay un buscador para ponerlas', () => {
    pintar();
    expect(screen.getByPlaceholderText(/Buscar un gel/i)).toBeTruthy();
  });

  it('salen las que puede llevar encima', () => {
    pintar();
    expect(screen.getByText('De qué puede echar mano')).toBeTruthy();
    // Del catálogo, las marcadas para llevar encima.
    expect(screen.getByText('Bebida isotónica')).toBeTruthy();
  });

  /* Lo que ella no quiera, fuera: era justo lo que no se podía hacer. */
  it('y se le puede quitar una', () => {
    const onChange = pintar();
    fireEvent.click(screen.getByText('Bebida isotónica').closest('button')!);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toHaveProperty('despensa');
  });

  it('sin ninguna puesta, se dice en vez de dejar el hueco', () => {
    const sinNada = DIA({ despensa: { [SALIDA.id]: { seleccion: [] } } });
    pintar(sinNada);
    expect(screen.getByText(/Todavía no le has puesto ninguna/i)).toBeTruthy();
  });
});

/**
 * Se rellena por error —se pulsa «Repartir» y salen seis tomas— y deshacerlo
 * era borrarlas una a una.
 */
describe('Quitar la pauta entera', () => {
  const isotonica = FOOD_CATALOG.find((f) => f.nombre === 'Bebida isotónica')!;

  const conPauta = (onChange = vi.fn()) => {
    render(
      <PautaDelAvituallamiento
        avituallamiento={{
          modo: 'hora',
          porHora: 60,
          horas: 2,
          pauta: [
            { minuto: 20, foodId: isotonica.id, unidades: 1 },
            { minuto: 40, foodId: isotonica.id, unidades: 1 },
          ],
        }}
        fuentes={[isotonica]}
        onChange={onChange}
      />,
    );
    return onChange;
  };

  it('se puede de un clic', () => {
    const onChange = conPauta();
    fireEvent.click(screen.getByText('Quitar la pauta'));
    expect(onChange.mock.calls[0][0].pauta).toBeUndefined();
  });

  it('y sin pauta no se ofrece quitar nada', () => {
    render(
      <PautaDelAvituallamiento
        avituallamiento={{ modo: 'hora', porHora: 60, horas: 2 }}
        fuentes={[isotonica]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Quitar la pauta')).toBeNull();
  });
});

/**
 * EMPEZAR DE CERO ES MÁS RÁPIDO QUE IR QUITANDO
 *
 * Si el catálogo trae quince cosas marcadas «se lleva encima» —basta con que
 * se importaran así— dejar la lista en cuatro geles son doce clics en la ×.
 */
describe('Vaciar la lista', () => {
  it('la deja vacía para elegir de nuevo', () => {
    const onChange = pintar();
    fireEvent.click(screen.getByText('Vaciar y elegir yo'));
    expect(onChange.mock.calls[0][0].despensa[SALIDA.id].seleccion).toEqual([]);
  });

  /* Y entonces la lista es suya: ya no la rellena el catálogo. */
  it('y con la lista vacía no se ofrece vaciar otra vez', () => {
    pintar(DIA({ despensa: { [SALIDA.id]: { seleccion: [] } } }));
    expect(screen.queryByText('Vaciar y elegir yo')).toBeNull();
  });

  it('se dice de dónde salen cuando no se ha tocado', () => {
    pintar();
    expect(screen.getByText(/se lleva encima para comer durante el entreno/i)).toBeTruthy();
  });
});
