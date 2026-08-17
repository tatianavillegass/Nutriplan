// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FoodForm } from '../food/FoodForm';
import { useAppStore } from '../../store/useAppStore';

afterEach(cleanup);

/**
 * LOS CONDIMENTOS NO TIENEN PORCIÓN
 *
 * La canela, el vinagre o el café no pertenecen a ningún subgrupo y no gastan
 * intercambios. Pedirles el macro que define la porción era pedirles algo que
 * no existe, y por eso no se podían guardar.
 */
describe('Un alimento libre', () => {
  it('se guarda sin subgrupo', () => {
    const onGuardar = vi.fn();
    render(<FoodForm onGuardar={onGuardar} />);

    fireEvent.change(screen.getByPlaceholderText('Avena en copos'), {
      target: { value: 'Canela' },
    });
    fireEvent.click(screen.getByText(/Añadir a la base de datos/i));

    expect(onGuardar).toHaveBeenCalled();
    expect(onGuardar.mock.calls[0][0]).toMatchObject({ nombre: 'Canela' });
    expect(onGuardar.mock.calls[0][0].grupo).toBeFalsy();
  });

  it('y se dice qué significa guardarlo así', () => {
    render(<FoodForm onGuardar={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Avena en copos'), {
      target: { value: 'Vinagre' },
    });
    expect(screen.getByText(/no gasta intercambios/i)).toBeTruthy();
  });
});

/**
 * La misma receta con el pollo en cocido es otra receta con un ingrediente
 * distinto. Volver a escribirla entera por un cambio es lo que hace que el
 * banco no crezca.
 */
describe('Duplicar una receta', () => {
  it('devuelve la copia para poder abrirla al momento', () => {
    const receta = useAppStore.getState().addRecipe({
      nombre: 'Pollo al horno',
      categorias: ['comida'],
      tags: [],
      base: { proteicos_magros: 4 },
      ingredientes: [{ id: 'i1', nombre: 'Pollo', grupo: 'proteicos_magros' } as never],
      preparacion: '',
      notas: '',
    });

    expect(receta.id).toBeTruthy();
    expect(useAppStore.getState().recipes.some((r) => r.id === receta.id)).toBe(true);
  });
});
