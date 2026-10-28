// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import type { Receta } from '../../types/recipe';
import { FOOD_CATALOG } from '../../data/foodCatalog';

afterEach(cleanup);

/**
 * Las notas del escalado explican por qué han salido esas cantidades. Sirven
 * para decidir si la receta encaja en el plan — es trabajo de nutricionista.
 * Quien come solo tiene que ver los gramos.
 */

const CON_NUECES: Receta = {
  id: 'r1',
  nombre: 'Avena con nueces',
  categorias: ['desayuno'],
  tags: [],
  base: { frutos_secos: 1, almidones: 1 },
  ingredientes: [
    {
      id: 'i1',
      nombre: 'Nueces',
      cantidad_base: 20,
      unidad: 'g',
      grupo: 'frutos_secos',
      escalable: true,
      opcional: false,
    },
    {
      id: 'i2',
      nombre: 'Avena',
      cantidad_base: 20,
      unidad: 'g',
      grupo: 'almidones',
      escalable: true,
      opcional: false,
    },
  ],
  preparacion: 'Mezclar.',
  notas: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

// El plan pauta aceite, la receta lleva nueces: hay algo que explicar.
const PAUTADO = { grasas: 1, almidones: 2 } as const;

describe('Por qué han salido esas cantidades', () => {
  it('la nutricionista ve que los frutos secos cubren la grasa pautada', () => {
    render(<ScaledRecipeView receta={CON_NUECES} requeridos={PAUTADO} paraNutricionista />);
    expect(screen.getByText(/grasas proteicas/i)).toBeTruthy();
  });

  it('el cliente solo ve su plato', () => {
    render(<ScaledRecipeView receta={CON_NUECES} requeridos={PAUTADO} />);
    expect(document.body.textContent).not.toMatch(/lo cubre con/i);
    expect(document.body.textContent).not.toMatch(/recortado/i);
  });

  it('pero los gramos son los mismos para las dos', () => {
    const { unmount } = render(
      <ScaledRecipeView receta={CON_NUECES} requeridos={PAUTADO} paraNutricionista />,
    );
    const conNotas = screen.getAllByText(/20 g/).length;
    unmount();

    render(<ScaledRecipeView receta={CON_NUECES} requeridos={PAUTADO} />);
    expect(screen.getAllByText(/20 g/).length).toBe(conNotas);
  });

  it('sin nada que explicar no sale la caja', () => {
    render(
      <ScaledRecipeView
        receta={CON_NUECES}
        requeridos={{ frutos_secos: 1, almidones: 1 }}
        paraNutricionista
      />,
    );
    expect(document.body.textContent).not.toMatch(/lo cubre con/i);
  });
});

/**
 * «ESTA RECETA NO CUBRE…» ES COSA DE QUIEN PAUTA
 *
 * A quien se va a comer el plato no le dice qué hacer: le dice que su plan
 * está mal, y la confunde. Completar lo que falte es trabajo de la
 * nutricionista, y lo hace antes de enviarlo.
 */
describe('Lo que no cubre la receta', () => {
  const pollo = FOOD_CATALOG.find((f) => f.nombre === 'Pechuga de pollo cruda')!;

  const SOLO_PROTE: Receta = {
    id: 'rp',
    nombre: 'Pollo a la plancha',
    categorias: ['comida'],
    tags: [],
    base: { proteicos_magros: 1 },
    ingredientes: [
      {
        id: 'i1',
        nombre: 'Pollo',
        foodId: pollo.id,
        cantidad_base: 30,
        unidad: 'g',
        grupo: 'proteicos_magros',
        escalable: true,
        opcional: false,
      },
    ],
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  };

  /* Un plato de pollo en una comida con almidón pautado. */
  const PAUTA = { proteicos_magros: 3, almidones: 2 };

  it('se le dice a la nutricionista', () => {
    render(
      <ScaledRecipeView
        receta={SOLO_PROTE}
        requeridos={PAUTA}
        foods={FOOD_CATALOG}
        paraNutricionista
      />,
    );
    expect(screen.getByText(/no cubre/i)).toBeTruthy();
  });

  it('y a la clienta no', () => {
    render(<ScaledRecipeView receta={SOLO_PROTE} requeridos={PAUTA} foods={FOOD_CATALOG} />);
    expect(screen.queryByText(/no cubre/i)).toBeNull();
  });
});
