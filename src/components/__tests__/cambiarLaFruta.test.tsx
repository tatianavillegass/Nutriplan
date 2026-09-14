// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ScaledOptionsBoard } from '../phase2/ScaledOptionsBoard';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Meal } from '../../types/plan';
import type { PorcionesMarcadas } from '../../types/diary';

afterEach(cleanup);

const DESAYUNO = { id: 'd', nombre: 'Desayuno', slot: 'desayuno', orden: 1 } as Meal;

/** Su despensa: tres frutas y la avena. */
const DESPENSA = ['a-platano', 'a-manzana', 'a-arandanos', 'a-avena-copos'];

const DIA = {
  id: 'dt',
  nombre: 'Día base',
  meals: [DESAYUNO],
  grid: { d: { almidones: 1, fruta: 1 } },
  notas: {},
  despensa: { d: { seleccion: DESPENSA } },
} as unknown as DayType;

const pintar = (porciones: PorcionesMarcadas = {}, onElegir = vi.fn()) => {
  const r = render(
    <ScaledOptionsBoard
      dayType={DIA}
      meal={DESAYUNO}
      foods={FOOD_CATALOG}
      porciones={porciones}
      onElegir={onElegir}
    />,
  );
  return { ...r, onElegir };
};

/** Elegir la primera opción de carbohidrato, que es la que trae fruta. */
const elegirPrimera = () => {
  const { onElegir } = pintar();
  const botones = screen.getAllByRole('button', { pressed: false });
  fireEvent.click(botones[0]);
  return onElegir.mock.calls[0][0];
};

describe('Cambiar un alimento de la opción elegida', () => {
  it('bajo la opción marcada salen sus alimentos para cambiarlos', () => {
    const opcion = elegirPrimera();
    cleanup();
    /* Se vuelve a pintar con esa opción ya marcada. */
    const marcadas: PorcionesMarcadas = {
      d: Object.fromEntries(opcion.items.map((i: { foodId: string; intercambios: number }) => [
        i.foodId,
        i.intercambios,
      ])),
    };
    pintar(marcadas);
    expect(screen.getByText('Cambiar:')).toBeTruthy();
  });

  /**
   * Con cinco opciones de dos alimentos, diez botones de cambiar convierten la
   * comida en un formulario.
   */
  it('y no salen bajo las que no ha elegido', () => {
    pintar();
    expect(screen.queryByText('Cambiar:')).toBeNull();
  });

  it('al pulsar la fruta salen las otras frutas de su despensa', () => {
    const opcion = elegirPrimera();
    cleanup();
    const marcadas: PorcionesMarcadas = {
      d: Object.fromEntries(opcion.items.map((i: { foodId: string; intercambios: number }) => [
        i.foodId,
        i.intercambios,
      ])),
    };
    pintar(marcadas);

    const fruta = opcion.items.find((i: { grupo: string }) => i.grupo === 'fruta');
    fireEvent.click(screen.getByText(`${fruta.nombre} ⇄`));

    /* Las otras dos frutas de la despensa, con sus gramos. */
    const otras = ['Plátano', 'Manzana', 'Arándanos'].filter((n) => n !== fruta.nombre);
    for (const n of otras) {
      expect(screen.getAllByText(new RegExp(n, 'i')).length).toBeGreaterThan(0);
    }
  });

  /** La avena se queda: sólo cambia lo que se pulsó. */
  it('y al elegir una, la nueva opción conserva el otro alimento', () => {
    const opcion = elegirPrimera();
    cleanup();
    const marcadas: PorcionesMarcadas = {
      d: Object.fromEntries(opcion.items.map((i: { foodId: string; intercambios: number }) => [
        i.foodId,
        i.intercambios,
      ])),
    };
    const { onElegir } = pintar(marcadas);

    const fruta = opcion.items.find((i: { grupo: string }) => i.grupo === 'fruta');
    const almidon = opcion.items.find((i: { grupo: string }) => i.grupo === 'almidones');
    fireEvent.click(screen.getByText(`${fruta.nombre} ⇄`));

    /* La primera alternativa de la lista que se acaba de abrir. */
    const lista = document.querySelector('ul.bg-brand-50\\/40');
    const primera = lista?.querySelector('button');
    fireEvent.click(primera!);

    const nueva = onElegir.mock.calls.at(-1)![0];
    expect(nueva.items.some((i: { foodId: string }) => i.foodId === almidon.foodId)).toBe(true);
    expect(nueva.items.some((i: { foodId: string }) => i.foodId === fruta.foodId)).toBe(false);
    /* Y cubre lo mismo: mismas porciones del mismo subgrupo. */
    expect(nueva.cubre).toEqual(opcion.cubre);
  });
});

/**
 * EL CASO DE VERDAD: UNA COMBINACIÓN COMPUESTA A MANO
 *
 * En cuanto la nutricionista guarda «avena con arándanos», `columnasDeComida`
 * deja de proponer y ésa es la única que ve la clienta. Es justo el caso para
 * el que se hizo el cambio, así que tiene que funcionar igual con las suyas.
 */
describe('Con una combinación guardada por la nutricionista', () => {
  const CON_PROPIA = {
    ...DIA,
    combinaciones: {
      d: [
        {
          id: 'cb_1',
          bucket: 'carbohidrato',
          items: [
            { foodId: 'a-avena-copos', porciones: 1 },
            { foodId: 'a-arandanos', porciones: 1 },
          ],
        },
      ],
    },
  } as unknown as DayType;

  const pintarPropia = (porciones: PorcionesMarcadas = {}, onElegir = vi.fn()) => {
    const r = render(
      <ScaledOptionsBoard
        dayType={CON_PROPIA}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        porciones={porciones}
        onElegir={onElegir}
      />,
    );
    return { ...r, onElegir };
  };

  it('sale sólo la suya', () => {
    pintarPropia();
    /* Una única opción en la columna de carbohidrato. */
    expect(screen.getAllByRole('button', { pressed: false }).length).toBe(1);
  });

  it('y al elegirla se le puede cambiar la fruta', () => {
    const marcadas: PorcionesMarcadas = {
      d: { 'a-avena-copos': 1, 'a-arandanos': 1 },
    };
    const { onElegir } = pintarPropia(marcadas);

    expect(screen.getByText('Cambiar:')).toBeTruthy();
    fireEvent.click(screen.getByText('Arándanos ⇄'));

    const lista = document.querySelector('ul.bg-brand-50\\/40');
    fireEvent.click(lista!.querySelector('button')!);

    const nueva = onElegir.mock.calls.at(-1)![0];
    /* La avena de ella se queda; la fruta cambia. */
    expect(nueva.items.some((i: { foodId: string }) => i.foodId === 'a-avena-copos')).toBe(true);
    expect(nueva.items.some((i: { foodId: string }) => i.foodId === 'a-arandanos')).toBe(false);
  });
});

/**
 * La vista previa de la nutricionista no es pulsable, así que ninguna opción
 * llega a estar elegida y el botón de cambiar no aparecía nunca: desde la ficha
 * parecía que la función no existía.
 */
describe('La vista previa de la nutricionista', () => {
  it('dice lo que la clienta podrá cambiar, sin poder tocarlo', () => {
    render(
      <ScaledOptionsBoard dayType={DIA} meal={DESAYUNO} foods={FOOD_CATALOG} modo="editor" />,
    );
    expect(screen.getAllByText(/puede cambiar/).length).toBeGreaterThan(0);
  });

  /** En el PDF no: ahí las cantidades ya vienen hechas y esto sería ruido. */
  it('y en el documento no sale', () => {
    render(<ScaledOptionsBoard dayType={DIA} meal={DESAYUNO} foods={FOOD_CATALOG} />);
    expect(screen.queryByText(/puede cambiar/)).toBeNull();
  });
});
