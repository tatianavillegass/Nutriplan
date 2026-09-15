// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

const salmon = FOOD_CATALOG.find((f) => f.id === 'a-salmon-crudo')!;
const pollo = FOOD_CATALOG.find((f) => f.id === 'a-pechuga-de-pollo-cruda')!;

const receta = (foodId: string, grupo: string, nombre: string): Receta =>
  ({
    id: 'r1',
    nombre: `Plato de ${nombre}`,
    categorias: ['cena'],
    tags: [],
    base: { [grupo]: 4 },
    ingredientes: [
      {
        id: 'i1',
        nombre,
        foodId,
        cantidad_base: 120,
        unidad: 'g',
        grupo,
        escalable: true,
        opcional: false,
      },
    ],
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  }) as unknown as Receta;

/** El reparto de esa cena: proteína pautada como MAGRA. */
const PAUTA = { proteicos_magros: 4 };

const pintar = (r: Receta) =>
  render(
    <ScaledRecipeView
      receta={r}
      requeridos={PAUTA}
      foods={FOOD_CATALOG}
      equivalentes={{}}
      onEquivalente={vi.fn()}
    />,
  );

/**
 * «A ALGUNAS PERSONAS NO LES DEJA CAMBIAR LA PROTEÍNA»
 *
 * Las porciones de un ingrediente salían del reparto pautado, así que un plato
 * de salmón —proteico graso— en una cena con proteicos magros pautados daba
 * cero: no había nada que cambiar y el botón no salía. Y cubrir un macro con
 * otro subgrupo es la regla de siempre, no una excepción.
 */
describe('Cambiar la proteína en una receta de fase 1', () => {
  it('con el subgrupo que se pautó, se puede cambiar', () => {
    pintar(receta(pollo.id, 'proteicos_magros', 'Pollo'));
    expect(screen.getByTitle(/Cambiar pollo/i)).toBeTruthy();
  });

  /** El caso que fallaba: la receta cubre la proteína con otro subgrupo. */
  it('y con otro subgrupo del mismo macro, también', () => {
    pintar(receta(salmon.id, 'proteicos_grasos', 'Salmón'));
    expect(screen.getByTitle(/Cambiar salmón/i)).toBeTruthy();
  });

  /** Sin alimento del catálogo no hay porción que calcular ni por qué cambiar. */
  it('pero no en un ingrediente suelto sin alimento detrás', () => {
    const r = receta(salmon.id, 'proteicos_grasos', 'Salmón');
    const suelto = {
      ...r,
      ingredientes: [{ ...r.ingredientes[0], foodId: undefined }],
    } as unknown as Receta;
    pintar(suelto);
    expect(screen.queryByTitle(/Cambiar salmón/i)).toBeNull();
  });
});
