import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { exchangesToMacros } from '../exchanges';
import type { Receta } from '../../types/recipe';

/**
 * LOS GRAMOS ESCRITOS A MANO TAMBIÉN CAMBIAN LOS MACROS
 *
 * Salió con un salmón: el cálculo lo recortaba para no pasarse de la grasa
 * pautada, Tats abría «Ajustar cantidades» y ponía 150 g, y la pantalla seguía
 * diciendo «falta proteína · 11 g». Los gramos se guardaban bien —en la lista
 * de ingredientes ponía 150 g— pero lo que la receta cubría se calculaba con
 * el factor del cálculo, no con lo que había en el plato.
 *
 * Es la app contradiciendo lo que tiene delante, y encima empuja a seguir
 * ajustando algo que ya estaba bien.
 */

const SALMON: Receta = {
  id: 'r_salmon',
  nombre: 'Salmón con batata',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_grasos: 3, almidones: 3 },
  ingredientes: [
    {
      id: 'i1',
      nombre: 'Salmón crudo',
      cantidad_base: 90,
      unidad: 'g',
      grupo: 'proteicos_grasos',
      escalable: true,
      opcional: false,
    },
    {
      id: 'i2',
      nombre: 'Batata',
      cantidad_base: 180,
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

/** Pautado en magros: el cálculo recortará el salmón por la grasa que trae. */
const PAUTADO = { proteicos_magros: 3, almidones: 3 };

describe('Un gramaje escrito a mano', () => {
  it('manda sobre el cálculo también en lo que la receta cubre', () => {
    const solo = scaleRecipe(SALMON, PAUTADO, []);
    const recortado = solo.cubiertos.proteicos_grasos ?? 0;

    const aMano = scaleRecipe(SALMON, PAUTADO, [], { i1: 150 });
    const conSus150 = aMano.cubiertos.proteicos_grasos ?? 0;

    // 150 g de salmón son más porciones que las que el cálculo había dejado.
    expect(conSus150).toBeGreaterThan(recortado);
    // Y salen de los gramos: 150 sobre los 90 de la receta.
    expect(conSus150).toBeCloseTo(3 * (150 / 90), 2);
  });

  it('y la proteína que se ve es la del plato', () => {
    const aMano = scaleRecipe(SALMON, PAUTADO, [], { i1: 150 });
    const proteina = exchangesToMacros({
      proteicos_grasos: aMano.cubiertos.proteicos_grasos ?? 0,
    }).proteina;

    // Cinco porciones de proteico graso: 35 g, no los 11 que se veían.
    expect(proteina).toBeGreaterThan(30);
  });

  it('lo que ella no toca se sigue calculando igual', () => {
    const solo = scaleRecipe(SALMON, PAUTADO, []);
    const aMano = scaleRecipe(SALMON, PAUTADO, [], { i1: 150 });

    expect(aMano.cubiertos.almidones).toBeCloseTo(solo.cubiertos.almidones ?? 0, 3);
  });
});
