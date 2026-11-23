// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RecipeRecommender } from '../phase1/RecipeRecommender';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Receta } from '../../types/recipe';
import type { DayType, Meal } from '../../types/plan';
import type { Client } from '../../types/client';

afterEach(cleanup);

/**
 * POR QUÉ SALE UNA CENA EN EL DESAYUNO
 *
 * «Hay veces que cuando voy a poner recetas en desayuno me aparecen recetas de
 * comidas, me distrae un poco.»
 *
 * Sin buscar, aquí sólo entran las recetas marcadas para esta comida. Así que
 * si sale una cena es porque esa receta está marcada **también** como
 * desayuno en el banco — y eso no se veía por ningún lado: había que abrir la
 * receta para averiguarlo, que es justo el trabajo que esta pantalla ahorra.
 */

const DESAYUNO: Meal = { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 };

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [DESAYUNO],
  grid: { desayuno: { proteicos_magros: 2, almidones: 2 } },
  notas: {},
};

const CLIENTE = {
  id: 'c1',
  nombre: 'Ana',
  patologias: [],
  alergias: [],
  aversiones: [],
  preferidos: [],
  preferencias: [],
} as unknown as Client;

const receta = (id: string, nombre: string, categorias: string[]): Receta =>
  ({
    id,
    nombre,
    categorias,
    tags: [],
    base: { proteicos_magros: 2, almidones: 2 },
    ingredientes: [],
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  }) as Receta;

const BANCO = [
  receta('r1', 'Tostada con huevo', ['desayuno']),
  receta('r2', 'Pollo con arroz', ['desayuno', 'comida', 'cena']),
];

const pintar = () =>
  render(
    <RecipeRecommender
      dayType={DIA}
      meal={DESAYUNO}
      recetas={BANCO}
      client={CLIENTE}
      seleccionadas={[]}
      yaAsignadas={[]}
      onToggle={() => {}}
      foods={FOOD_CATALOG}
    />,
  );

describe('De qué comida dice ser cada receta', () => {
  it('la que es sólo de desayuno no lleva nada', () => {
    pintar();
    const tarjeta = screen.getByText('Tostada con huevo').closest('button')!;
    expect(tarjeta.textContent).not.toContain('también en');
  });

  /* La que distrae: sale porque está marcada como desayuno, y ahora se dice. */
  it('la que está en varias lo dice, y dice en cuáles', () => {
    pintar();
    const tarjeta = screen.getByText('Pollo con arroz').closest('button')!;
    expect(tarjeta.textContent).toContain('también en');
    expect(tarjeta.textContent).toContain('comida');
    expect(tarjeta.textContent).toContain('cena');
  });

  /* Y lo que no está marcado para el desayuno sigue sin salir. */
  it('una cena que no es desayuno no aparece', () => {
    render(
      <RecipeRecommender
        dayType={DIA}
        meal={DESAYUNO}
        recetas={[receta('r3', 'Merluza al horno', ['cena'])]}
        client={CLIENTE}
        seleccionadas={[]}
        yaAsignadas={[]}
        onToggle={() => {}}
        foods={FOOD_CATALOG}
      />,
    );
    expect(screen.queryByText('Merluza al horno')).toBeNull();
  });
});
