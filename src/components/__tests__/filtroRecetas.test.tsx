// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { RecipeRecommender } from '../phase1/RecipeRecommender';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Receta } from '../../types/recipe';
import type { DayType, Meal } from '../../types/plan';
import type { Client } from '../../types/client';

afterEach(cleanup);

const DESAYUNO: Meal = { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 };

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [DESAYUNO],
  grid: { desayuno: { proteicos_magros: 2, almidones: 2, grasas: 1 } },
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

const receta = (id: string, nombre: string, tags: string[]): Receta => ({
  id,
  nombre,
  categorias: ['desayuno'],
  tags,
  base: { proteicos_magros: 2, almidones: 2, grasas: 1 },
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const BANCO = [
  receta('r1', 'Tostada con huevo', ['salado', 'huevos']),
  receta('r2', 'Yogur con avena', ['dulce', 'lacteo']),
  receta('r3', 'Tortilla francesa', ['salado', 'huevos']),
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

describe('Filtrar las recetas al pautar', () => {
  it('sin filtros salen todas las que encajan', () => {
    pintar();
    expect(screen.getByText('Tostada con huevo')).toBeTruthy();
    expect(screen.getByText('Yogur con avena')).toBeTruthy();
  });

  it('al pulsar un tag deja sólo las que lo llevan', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: 'dulce' }));
    expect(screen.getByText('Yogur con avena')).toBeTruthy();
    expect(screen.queryByText('Tostada con huevo')).toBeNull();
  });

  it('dos tags son un Y: las que llevan los dos', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: 'salado' }));
    fireEvent.click(screen.getByRole('button', { name: 'huevos' }));
    expect(screen.getByText('Tostada con huevo')).toBeTruthy();
    expect(screen.getByText('Tortilla francesa')).toBeTruthy();
    expect(screen.queryByText('Yogur con avena')).toBeNull();
  });

  it('«quitar filtros» las devuelve todas', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: 'dulce' }));
    fireEvent.click(screen.getByText('Quitar filtros'));
    expect(screen.getByText('Tostada con huevo')).toBeTruthy();
    expect(screen.getByText('Yogur con avena')).toBeTruthy();
  });

  it('se puede mirar el banco de otro tipo de comida', () => {
    pintar();
    const selector = screen.getByLabelText(/Tipo de comida/);
    fireEvent.change(selector, { target: { value: 'cena' } });
    // Ninguna receta del banco es de cena: el aviso lo explica.
    expect(screen.getByText(/Con estos filtros no queda ninguna/)).toBeTruthy();
  });
});
