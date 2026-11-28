// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import type { Alimento } from '../../types/food';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

/**
 * 0 g DE AGUACATE Y 70 g DE GUACAMOLE
 *
 * «Alexandra dice que hay un plato que tiene 0 g de aguacate pero cuando le da
 * al botón de cambiar le aparece la opción de guacamole y le da 70 g.»
 *
 * El aguacate se queda en cero porque la grasa que tenía pautada se la llevó
 * el salmón —la regla de compensar la grasa de una proteína grasa bajando la
 * grasa pautada—. Eso es correcto. Lo que estaba mal era el botón: las
 * porciones que ofrecía caían **a lo pautado** en cuanto el plato daba cero, y
 * ese respaldo era para cuando no se puede calcular la porción (un ingrediente
 * sin alimento del catálogo detrás), no para un cero de verdad.
 */

const AGUACATE: Alimento = {
  id: 'a-aguacate',
  nombre: 'Aguacate',
  grupo: 'grasas',
  medida_casera: '70 g',
  gramos: 70,
  intercambios: 1,
  nutrientes: { kcal: 160, hc: 1, proteina: 2, grasa: 15 },
  comidas_sugeridas: [],
  alergenos: [],
  apto: [],
};

const GUACAMOLE: Alimento = { ...AGUACATE, id: 'a-guacamole', nombre: 'Guacamole' };

const LECHUGA: Alimento = {
  ...AGUACATE,
  id: 'a-lechuga',
  nombre: 'Lechuga',
  grupo: 'verduras',
  gramos: 100,
  nutrientes: { kcal: 15, hc: 1, proteina: 1, grasa: 0 },
};

const SALMON: Alimento = {
  ...AGUACATE,
  id: 'a-salmon',
  nombre: 'Salmón',
  grupo: 'proteicos_grasos',
  gramos: 100,
  nutrientes: { kcal: 208, hc: 0, proteina: 20, grasa: 13 },
};

/* Otra proteína grasa, para que el salmón tenga por quién cambiarse. */
const CABALLA: Alimento = { ...SALMON, id: 'a-caballa', nombre: 'Caballa' };

const FOODS = [AGUACATE, GUACAMOLE, SALMON, CABALLA, LECHUGA];

const ing = (id: string, nombre: string, foodId: string, grupo: string, c: number) =>
  ({
    id,
    nombre,
    foodId,
    cantidad_base: c,
    unidad: 'g',
    grupo,
    escalable: true,
    opcional: false,
  }) as Receta['ingredientes'][number];

/** El plato de Alexandra: una proteína grasa que se come la grasa pautada. */
const PLATO: Receta = {
  id: 'r',
  nombre: 'Salmón con aguacate',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_magros: 2, grasas: 1 },
  ingredientes: [
    ing('i1', 'Salmón', SALMON.id, 'proteicos_magros', 100),
    ing('i2', 'Aguacate', AGUACATE.id, 'grasas', 70),
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
} as Receta;

const pintar = () =>
  render(
    <ScaledRecipeView
      receta={PLATO}
      recetas={[PLATO]}
      requeridos={{ proteicos_magros: 4, grasas: 1 }}
      foods={FOODS}
      equivalentes={{}}
      onEquivalente={vi.fn()}
    />,
  );

const lineaDe = (nombre: string) => screen.getByText(nombre).closest('li')!;

describe('Un ingrediente que no entra en lo pautado', () => {
  /* Lo que se pedía arreglar: no puede ofrecer una porción que el plato no tiene. */
  it('no ofrece cambiarlo por nada', () => {
    pintar();
    expect(lineaDe('Aguacate').textContent).not.toContain('Cambiar');
  });

  it('y no sale ningún guacamole de 70 g', () => {
    pintar();
    const cambiar = screen.queryByTitle(/cambiar aguacate/i);
    expect(cambiar).toBeNull();
    expect(screen.queryByText(/Guacamole/)).toBeNull();
  });

  /* «0 g» se lee como «pesa cero gramos», que no significa nada en una cocina. */
  it('se dice con palabras, no con un cero', () => {
    pintar();
    expect(lineaDe('Aguacate').textContent).toContain('no entra en lo pautado');
    expect(lineaDe('Aguacate').textContent).not.toContain('0 g');
  });
});

describe('Lo que sí está en el plato', () => {
  it('se puede cambiar, con los gramos del plato', () => {
    pintar();
    expect(screen.getByTitle(/cambiar salmón/i)).toBeTruthy();
  });

  /*
   * El respaldo sigue donde tenía que estar: un ingrediente sin alimento del
   * catálogo detrás no tiene porción que calcular, y ahí sí manda lo pautado.
   */
  it('y lo que no está enlazado al catálogo usa lo pautado', () => {
    const suelta = {
      ...PLATO,
      ingredientes: [
        ing('i1', 'Salmón', SALMON.id, 'proteicos_magros', 100),
        { ...ing('i2', 'Aguacate', '', 'grasas', 70), foodId: undefined },
      ],
    } as Receta;
    render(
      <ScaledRecipeView
        receta={suelta}
        recetas={[suelta]}
        requeridos={{ proteicos_magros: 4, grasas: 1 }}
        foods={FOODS}
        equivalentes={{}}
        onEquivalente={vi.fn()}
      />,
    );
    expect(screen.getByTitle(/cambiar aguacate/i)).toBeTruthy();
  });
});

describe('Y al cambiar algo que sí tiene gramos', () => {
  /*
   * Las porciones salen del plato y no de la casilla: 400 g de salmón son 4
   * porciones, así que la caballa sale en esa escala y no en la de una.
   */
  it('las porciones son las del plato', () => {
    pintar();
    fireEvent.click(screen.getByTitle(/cambiar salmón/i));
    const caballa = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Caballa'),
    );
    expect(caballa?.textContent).toContain('400');
  });
});

/**
 * «AL GUSTO» NO ES UN CERO
 *
 * Al decir que un ingrediente sin gramos «no entra en lo pautado» se llevó por
 * delante a las verduras, que no llevan cantidad **a propósito**: la verdura es
 * ilimitada y ponerle gramos a la sal sería inventárselos. Decirle a alguien
 * que la lechuga «no entra» es decirle que no se eche lechuga.
 */
describe('Lo que va al gusto', () => {
  const conVerdura = {
    ...PLATO,
    base: { proteicos_magros: 2, grasas: 1, verduras: 'ilimitado' },
    ingredientes: [
      ing('i1', 'Salmón', SALMON.id, 'proteicos_magros', 100),
      ing('i2', 'Aguacate', AGUACATE.id, 'grasas', 70),
      /*
       * Sin cantidad base: es la verdura que sale «al gusto», que es la que
       * ella vio marcada como «no entra».
       */
      { ...ing('i3', 'Lechuga', LECHUGA.id, 'verduras', 0), cantidad_base: null },
      /* Un condimento: tampoco lleva cantidad, y no es un hueco. */
      { ...ing('i4', 'Eneldo', '', 'condimento', 0), foodId: undefined },
    ],
  } as unknown as Receta;

  const pintarConVerdura = () =>
    render(
      <ScaledRecipeView
        receta={conVerdura}
        recetas={[conVerdura]}
        requeridos={{ proteicos_magros: 4, grasas: 1 }}
        foods={FOODS}
        equivalentes={{}}
        onEquivalente={vi.fn()}
      />,
    );

  it('la verdura sigue diciendo «al gusto»', () => {
    pintarConVerdura();
    const linea = screen.getByText('Lechuga').closest('li')!;
    expect(linea.textContent).toContain('al gusto');
    expect(linea.textContent).not.toContain('no entra');
  });

  it('y el condimento tampoco es un hueco', () => {
    pintarConVerdura();
    expect(screen.getByText('Eneldo').closest('li')!.textContent).not.toContain('no entra');
  });

  /* Y el aviso sigue donde tiene que estar: en lo que sí debía traer cantidad. */
  it('pero el aguacate sigue avisando', () => {
    pintarConVerdura();
    expect(screen.getByText('Aguacate').closest('li')!.textContent).toContain(
      'no entra en lo pautado',
    );
  });
});
