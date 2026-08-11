// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { RecipeBankPage } from '../../pages/RecipeBankPage';
import { FoodCatalogPage } from '../../pages/FoodCatalogPage';
import { useAppStore } from '../../store/useAppStore';
import { SEED_RECIPES } from '../../data/seedRecipes';
import { FOOD_CATALOG } from '../../data/foodCatalog';

afterEach(cleanup);

/**
 * El formulario de edición sale arriba del todo, y tanto las recetas como
 * los alimentos se editan desde su fila, que puede estar mucho más abajo.
 * Sin subir hasta el formulario, pulsar "Editar" parecía no hacer nada.
 */

let subidas: number;

beforeEach(() => {
  subidas = 0;
  // jsdom no trae scrollIntoView; se cuenta cuántas veces se pide.
  Element.prototype.scrollIntoView = vi.fn(() => {
    subidas += 1;
  });
});

describe('Editar una receta sube al formulario', () => {
  beforeEach(() => {
    useAppStore.setState({ recipes: SEED_RECIPES.map((r, i) => ({ ...r, id: `rc${i}` })) });
  });

  it('al pulsar Editar se abre el formulario y la página sube hasta él', () => {
    render(<RecipeBankPage />);
    expect(screen.queryByText('Editar receta')).toBeNull();

    fireEvent.click(screen.getAllByText('Editar')[0]);

    expect(screen.getByText('Editar receta')).toBeTruthy();
    expect(subidas).toBeGreaterThan(0);
  });

  it('crear una nueva también sube', () => {
    render(<RecipeBankPage />);
    fireEvent.click(screen.getByText('+ Nueva receta'));
    expect(screen.getByText('Nueva receta')).toBeTruthy();
    expect(subidas).toBeGreaterThan(0);
  });

  it('sin abrir nada no se mueve la página', () => {
    render(<RecipeBankPage />);
    expect(subidas).toBe(0);
  });

  it('cerrar el formulario no vuelve a moverla', () => {
    render(<RecipeBankPage />);
    fireEvent.click(screen.getAllByText('Editar')[0]);
    const tras = subidas;
    fireEvent.click(screen.getByText('Cancelar'));
    expect(subidas).toBe(tras);
  });
});

describe('Editar un alimento sube al formulario', () => {
  beforeEach(() => {
    useAppStore.setState({ foods: FOOD_CATALOG });
  });

  it('añadir un alimento abre el formulario y sube', () => {
    render(<FoodCatalogPage />);
    fireEvent.click(screen.getByText('Añadir alimento'));
    expect(screen.getByText('Nuevo alimento')).toBeTruthy();
    expect(subidas).toBeGreaterThan(0);
  });
});
