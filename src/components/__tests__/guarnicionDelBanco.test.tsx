// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AjustarCantidades } from '../phase1/AjustarCantidades';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

/**
 * PONER UN ACOMPAÑAMIENTO ENTERO AL LADO DEL PLATO
 *
 * Al salmón se le pone la ensalada de tomate, no sus cuatro alimentos buscados
 * de uno en uno. Entra con los gramos con los que está escrita —un
 * acompañamiento no se escala, es la guarnición de siempre— y cuenta como
 * cualquier otra cosa que se ponga al lado.
 *
 * Lo que no gasta intercambios (la verdura, una gelatina, la bebida de
 * almendras) entra igual y suma cero, que es justo lo que se espera.
 */

const arroz = FOOD_CATALOG.find((f) => f.id === 'a-arroz-blanco-cocido')!;

const PLATO: Receta = {
  id: 'r_plato',
  nombre: 'Salmón a la plancha',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_grasos: 3 },
  ingredientes: [
    {
      id: 'i1',
      nombre: 'Salmón',
      cantidad_base: 90,
      unidad: 'g',
      grupo: 'proteicos_grasos',
      escalable: true,
      opcional: false,
    },
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const GUARNICION: Receta = {
  id: 'r_guar',
  nombre: 'Arroz de acompañar',
  categorias: ['comida'],
  acompanamiento: true,
  tags: [],
  base: { almidones: 2 },
  ingredientes: [
    {
      id: 'g1',
      nombre: 'Arroz cocido',
      foodId: arroz.id,
      cantidad_base: 100,
      unidad: 'g',
      grupo: 'almidones',
      escalable: true,
      opcional: false,
    },
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

describe('Un acompañamiento del banco', () => {
  it('se pone entero desde «Ajustar cantidades»', () => {
    const onGuardar = vi.fn();
    render(
      <AjustarCantidades
        receta={PLATO}
        requeridos={{ proteicos_grasos: 3, almidones: 2 }}
        foods={FOOD_CATALOG}
        ajustes={{}}
        recetas={[PLATO, GUARNICION]}
        onGuardar={onGuardar}
        onCerrar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Arroz de acompañar'));
    fireEvent.click(screen.getByText(/Guardar/i));

    const puestos = onGuardar.mock.calls[0][1];
    // Entra con sus gramos, no escalado.
    expect(puestos).toHaveLength(1);
    expect(puestos[0]).toMatchObject({ foodId: arroz.id, gramos: 100 });
  });
});

/**
 * SE VE QUÉ SE HA PUESTO, NO SÓLO QUE SE HA PUESTO ALGO
 *
 * Un acompañamiento del banco entra con varios ingredientes. En una lista
 * corrida eran cuatro filas de gramos sin nombre encima: la nutricionista
 * sabía que había añadido algo, no qué.
 */
describe('Lo puesto en el panel', () => {
  it('sale agrupado bajo el nombre del acompañamiento', () => {
    render(
      <AjustarCantidades
        receta={PLATO}
        requeridos={{ proteicos_grasos: 3, almidones: 2 }}
        foods={FOOD_CATALOG}
        ajustes={{}}
        recetas={[PLATO, GUARNICION]}
        onGuardar={vi.fn()}
        onCerrar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Arroz de acompañar'));

    // Su nombre encima de sus ingredientes, y sus ingredientes con nombre.
    expect(screen.getAllByText('Arroz de acompañar').length).toBeGreaterThan(1);
    expect(screen.getByText('Arroz cocido')).toBeTruthy();
  });
});
