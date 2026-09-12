import { describe, it, expect } from 'vitest';
import { ideasDeLaComida } from '../ideasDeReceta';
import { matchRecipes } from '../recipeMatcher';
import type { Client } from '../../types/client';
import type { Meal, Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';

/**
 * LAS IDEAS DE RECETA DE LA HOJA DE LA NEVERA
 *
 * Dos fallos a la vez. La categoría de comida sólo sumaba veinticinco puntos en
 * vez de filtrar, así que un café proteico de desayuno se colaba en la cena si
 * cubría bien los macros. Y no había forma de quitarlo: las ideas las elegía el
 * recomendador por su cuenta.
 */

const receta = (id: string, nombre: string, categorias: string[]): Receta =>
  ({
    id,
    nombre,
    categorias,
    tags: [],
    base: { proteicos_magros: 4, almidones: 3 },
    ingredientes: [],
    porciones: 1,
  }) as unknown as Receta;

const CAFE = receta('r-cafe', 'Protein coffee latte', ['desayuno']);
const SALMON = receta('r-salmon', 'Salmón con quinoa', ['cena']);
const SIN_DECIR = receta('r-tortilla', 'Tortilla', []);
const BANCO = [CAFE, SALMON, SIN_DECIR];

const CENA = { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 1 } as Meal;
const CLIENTA = {
  id: 'c1',
  nombre: 'Ana',
  patologias: [],
  alergias: [],
  aversiones: [],
  preferidos: [],
  preferencias: [],
} as unknown as Client;
const plan = (recetasAsignadas?: Record<string, string[]>): Plan =>
  ({ id: 'p1', fase: 2, dayTypes: [], recetasAsignadas }) as unknown as Plan;

const REPARTO = { proteicos_magros: 4, almidones: 3 };

describe('La comida filtra, no puntúa', () => {
  /** El caso de Tats: un latte de desayuno saliendo en la cena. */
  it('un desayuno no se cuela en la cena', () => {
    const nombres = matchRecipes(BANCO, REPARTO, { slot: 'cena', limite: 10 }).map(
      (m) => m.receta.nombre,
    );
    expect(nombres).not.toContain('Protein coffee latte');
    expect(nombres).toContain('Salmón con quinoa');
  });

  /**
   * Esconder una receta que no dice de qué comida es sería borrarle recetas del
   * banco sin avisar. Lo que se filtra es lo que sí declaró.
   */
  it('pero una receta sin categorías entra en todas', () => {
    const nombres = matchRecipes(BANCO, REPARTO, { slot: 'cena', limite: 10 }).map(
      (m) => m.receta.nombre,
    );
    expect(nombres).toContain('Tortilla');
  });

  it('y con «todas» no se filtra nada', () => {
    const nombres = matchRecipes(BANCO, REPARTO, { slot: 'todas', limite: 10 }).map(
      (m) => m.receta.nombre,
    );
    expect(nombres).toContain('Protein coffee latte');
  });
});

describe('Manda lo que ella elija', () => {
  it('si ha asignado recetas a esa comida, son ésas y en su orden', () => {
    const ideas = ideasDeLaComida(
      plan({ cena: ['r-tortilla', 'r-salmon'] }),
      CENA,
      REPARTO,
      BANCO,
      [],
      CLIENTA,
    );
    expect(ideas.map((i) => i.receta.id)).toEqual(['r-tortilla', 'r-salmon']);
  });

  /** Si ella la ha puesto ahí, es que va ahí. */
  it('y valen aunque sean de otra comida: lo ha decidido ella', () => {
    const ideas = ideasDeLaComida(
      plan({ cena: ['r-cafe'] }),
      CENA,
      REPARTO,
      BANCO,
      [],
      CLIENTA,
    );
    expect(ideas.map((i) => i.receta.id)).toEqual(['r-cafe']);
  });

  /**
   * Una hoja sin ideas es peor que unas ideas mejorables, y a quien acaba de
   * montar su primer plan no se le puede pedir que además elija recetas.
   */
  it('sin elegir ninguna, se siguen proponiendo las que encajan', () => {
    const ideas = ideasDeLaComida(plan(), CENA, REPARTO, BANCO, [], CLIENTA);
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.map((i) => i.receta.nombre)).not.toContain('Protein coffee latte');
  });

  it('una receta borrada del banco no deja un hueco', () => {
    const ideas = ideasDeLaComida(
      plan({ cena: ['r-que-ya-no-existe', 'r-salmon'] }),
      CENA,
      REPARTO,
      BANCO,
      [],
      CLIENTA,
    );
    expect(ideas.map((i) => i.receta.id)).toEqual(['r-salmon']);
  });

  it('y no se enseñan más de las que caben', () => {
    const ideas = ideasDeLaComida(
      plan({ cena: ['r-cafe', 'r-salmon', 'r-tortilla'] }),
      CENA,
      REPARTO,
      BANCO,
      [],
      CLIENTA,
      2,
    );
    expect(ideas.length).toBe(2);
  });
});
