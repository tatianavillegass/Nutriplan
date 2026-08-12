// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
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
  it('de entrada sólo salen las del tipo de comida que toca', () => {
    pintar();
    expect(screen.getByText('Tostada con huevo')).toBeTruthy();
    expect(screen.getByText('Yogur con avena')).toBeTruthy();
  });

  /**
   * Lo que hacía que el gyro bowl saliera en el desayuno: la categoría sólo
   * sumaba puntos, no filtraba, así que un plato de comida con buen perfil de
   * grupos se colaba por delante de los desayunos.
   */
  it('una receta de otra comida no se cuela aunque encaje de macros', () => {
    const gyro = receta('r4', 'Gyro bowl', ['salado']);
    gyro.categorias = ['comida', 'cena'];
    render(
      <RecipeRecommender
        dayType={DIA}
        meal={DESAYUNO}
        recetas={[...BANCO, gyro]}
        client={CLIENTE}
        seleccionadas={[]}
        yaAsignadas={[]}
        onToggle={() => {}}
        foods={FOOD_CATALOG}
      />,
    );
    expect(screen.queryByText('Gyro bowl')).toBeNull();
    // Y se avisa de que hay más banco detrás del filtro.
    expect(screen.getByText(/Ver la 1 restantes|Ver las 1 restantes/)).toBeTruthy();
  });

  it('poniendo «Todas» vuelve a salir', () => {
    const gyro = receta('r4', 'Gyro bowl', ['salado']);
    gyro.categorias = ['comida', 'cena'];
    render(
      <RecipeRecommender
        dayType={DIA}
        meal={DESAYUNO}
        recetas={[...BANCO, gyro]}
        client={CLIENTE}
        seleccionadas={[]}
        yaAsignadas={[]}
        onToggle={() => {}}
        foods={FOOD_CATALOG}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Tipo de comida/), { target: { value: 'todas' } });
    expect(screen.getByText('Gyro bowl')).toBeTruthy();
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
    expect(screen.getByText(/No hay recetas de cena/)).toBeTruthy();
  });
});

/**
 * El batido de proteína pierde puntos por cada grupo que no cubre y se queda
 * fuera de las ocho sugerencias. Buscándolo por su nombre se salta la
 * puntuación: si no, no habría manera de asignarlo.
 */
describe('Buscar una receta concreta por su nombre', () => {
  const batido = receta('r9', 'Batido de café y proteína', ['dulce']);
  batido.base = { proteicos_magros: 2 };
  batido.categorias = ['desayuno'];

  const conBatido = () =>
    render(
      <RecipeRecommender
        dayType={DIA}
        meal={DESAYUNO}
        // Banco grande: el batido nunca llegaría al top 8.
        recetas={[
          ...BANCO,
          ...Array.from({ length: 10 }, (_, i) => receta(`x${i}`, `Relleno ${i}`, ['salado'])),
          batido,
        ]}
        client={CLIENTE}
        seleccionadas={[]}
        yaAsignadas={[]}
        onToggle={() => {}}
        foods={FOOD_CATALOG}
      />,
    );

  it('no aparece entre las sugerencias, pero sí al buscarlo', () => {
    conBatido();
    expect(screen.queryByText('Batido de café y proteína')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Buscas una receta concreta/), {
      target: { value: 'batido' },
    });
    expect(screen.getByText('Batido de café y proteína')).toBeTruthy();
  });

  it('se puede asignar aunque no cubra todo lo pautado', () => {
    const onToggle = vi.fn();
    render(
      <RecipeRecommender
        dayType={DIA}
        meal={DESAYUNO}
        recetas={[batido]}
        client={CLIENTE}
        seleccionadas={[]}
        yaAsignadas={[]}
        onToggle={onToggle}
        foods={FOOD_CATALOG}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Buscas una receta concreta/), {
      target: { value: 'batido' },
    });
    // El de la lista de búsqueda, no el de las sugerencias.
    fireEvent.click(screen.getAllByText('Batido de café y proteína')[0]);
    expect(onToggle).toHaveBeenCalledWith('r9');
  });

  it('si no existe, lo dice en vez de callarse', () => {
    conBatido();
    fireEvent.change(screen.getByPlaceholderText(/Buscas una receta concreta/), {
      target: { value: 'paella' },
    });
    expect(screen.getByText(/No hay ninguna receta con ese nombre/)).toBeTruthy();
  });
});
