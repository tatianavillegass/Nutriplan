// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RecipeRecommender } from '../phase1/RecipeRecommender';
import { catalogoPermitido } from '../../utils/restrictions';
import type { Alimento } from '../../types/food';
import type { Receta } from '../../types/recipe';
import type { DayType, Meal } from '../../types/plan';
import type { Client } from '../../types/client';

afterEach(cleanup);

/**
 * «QUE ME APAREZCAN BLOQUEADAS, PARA ACORDARME»
 *
 * Sus palabras: «si digo que no come salmón me deben aparecer todas las
 * recetas que tienen salmón bloqueadas. Pueden haber excepciones, pero yo
 * tengo que saber que hay un ingrediente de esa receta que no quiere comer: y
 * puedo cambiarle el ingrediente u omitir la receta.»
 *
 * No pasaba, y el motivo era que a esta pantalla le llegaba el catálogo **ya
 * filtrado**: `evaluarReceta` busca el salmón de la receta en esa lista para
 * saber que está vetado, y sin salmón en la lista no lo encontraba. Filtrar el
 * catálogo era justo lo que apagaba el aviso.
 */

const SALMON: Alimento = {
  id: 'a-salmon',
  nombre: 'Salmón',
  grupo: 'proteicos_grasos',
  medida_casera: '100 g',
  gramos: 100,
  intercambios: 1,
  nutrientes: { kcal: 208, hc: 0, proteina: 20, grasa: 13 },
  comidas_sugeridas: ['cena'],
  alergenos: [],
  apto: [],
};

const POLLO: Alimento = {
  ...SALMON,
  id: 'a-pollo',
  nombre: 'Pollo',
  grupo: 'proteicos_magros',
  gramos: 30,
  nutrientes: { kcal: 165, hc: 0, proteina: 23, grasa: 2 },
};

const FOODS = [SALMON, POLLO];

const CENA: Meal = { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 5 };

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [CENA],
  grid: { cena: { proteicos_grasos: 2 } },
  notas: {},
};

const conSalmon: Receta = {
  id: 'rc_salmon',
  nombre: 'Salmón al horno',
  categorias: ['cena'],
  tags: [],
  base: { proteicos_grasos: 2 },
  ingredientes: [
    {
      id: 'i1',
      nombre: 'Salmón',
      foodId: SALMON.id,
      cantidad_base: 100,
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
} as Receta;

/** No quiere salmón. Las aversiones se guardan por id del alimento. */
const LUIS = {
  id: 'c',
  nombre: 'Luis',
  patologias: [],
  alergias: [],
  aversiones: [SALMON.id],
  preferidos: [],
  preferencias: [],
} as unknown as Client;

const pintar = (foods: Alimento[]) =>
  render(
    <RecipeRecommender
      dayType={DIA}
      meal={CENA}
      recetas={[conSalmon]}
      client={LUIS}
      seleccionadas={[]}
      yaAsignadas={[]}
      onToggle={() => {}}
      foods={foods}
    />,
  );

describe('Con el catálogo completo', () => {
  it('la receta sale marcada como descartada', () => {
    pintar(FOODS);
    expect(screen.getByText(/descartada/i)).toBeTruthy();
  });

  /* El motivo, para saber qué ingrediente es y poder cambiarlo. */
  it('y dice qué ingrediente es', () => {
    pintar(FOODS);
    expect(document.body.textContent?.toLowerCase()).toContain('salmón');
  });

  /* Bloqueada no es escondida: puede haber excepciones y ella decide. */
  it('pero sigue estando ahí para poder elegirla', () => {
    pintar(FOODS);
    expect(screen.getByText('Salmón al horno')).toBeTruthy();
  });
});

/**
 * EL BUG, PARA QUE NO VUELVA
 *
 * Con el catálogo filtrado la receta sale limpia: nadie puede saber que lleva
 * salmón si el salmón no está en la lista que se mira.
 */
describe('Con el catálogo ya filtrado', () => {
  it('no avisaba de nada', () => {
    pintar(catalogoPermitido(FOODS, LUIS));
    expect(screen.queryByText(/descartada/i)).toBeNull();
  });
});
