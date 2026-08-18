// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Receta } from '../../types/recipe';
import type { Acompanamiento } from '../../types/plan';

afterEach(cleanup);

/**
 * EL ACOMPAÑAMIENTO SE VE COMO UNA RECETA, NO COMO UNA LISTA DE ALIMENTOS
 *
 * A la clienta le salía «Arroz cocido 100 g» suelto bajo «Además»: ni la foto
 * ni los pasos, así que no sabía que aquello era una receta que había que
 * hacer. Ahora va en pequeño —nombre y foto— y se abre para ver qué lleva y
 * cómo se prepara, que es justo cuando hace falta: al ponerse a cocinarla.
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
  preparacion: 'A la plancha 4 minutos por lado.',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const GUARNICION: Receta = {
  id: 'r_guar',
  nombre: 'Arroz al vapor',
  categorias: ['comida'],
  acompanamiento: true,
  foto_url: 'data:image/png;base64,AAA',
  tags: [],
  base: { almidones: 2 },
  ingredientes: [],
  preparacion: 'Hervir el arroz 12 minutos y escurrir.',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const PUESTO: Acompanamiento[] = [
  {
    id: 'ac1',
    foodId: arroz.id,
    nombre: 'Arroz cocido',
    gramos: 100,
    unidad: 'g',
    tipo: 'acompanamiento',
    deReceta: GUARNICION.id,
  },
];

const pintar = () =>
  render(
    <ScaledRecipeView
      receta={PLATO}
      requeridos={{ proteicos_grasos: 3, almidones: 2 }}
      foods={FOOD_CATALOG}
      acompanamientos={PUESTO}
      recetas={[PLATO, GUARNICION]}
    />,
  );

describe('Un acompañamiento en la ficha de la clienta', () => {
  it('se ve con su nombre y su foto, en pequeño', () => {
    const { container } = pintar();

    expect(screen.getByText('Arroz al vapor')).toBeTruthy();
    const fotos = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(fotos).toContain(GUARNICION.foto_url);
    // Cerrado no enseña ni ingredientes ni pasos: es una línea más del plato.
    expect(screen.queryByText(/Hervir el arroz/)).toBeNull();
  });

  it('y al pulsarlo salen sus ingredientes y su preparación', () => {
    pintar();
    fireEvent.click(screen.getByText('Arroz al vapor'));

    expect(screen.getByText('Arroz cocido')).toBeTruthy();
    expect(screen.getByText(/Hervir el arroz/)).toBeTruthy();
  });
});
