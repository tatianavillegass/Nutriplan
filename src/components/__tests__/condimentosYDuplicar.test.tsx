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

  /**
   * EL CASO QUE LA BLOQUEABA
   *
   * «Tengo problemas agregando algunos alimentos porque realmente son libres y
   * no caben dentro de ningún grupo.» Una bebida de almendras tiene hidrato y
   * proteína suficientes para que la sugerencia por nutrientes la dé por
   * lácteo, y dejar el desplegable en blanco no servía: la sugerencia volvía a
   * ponerlo. Hacía falta poder decir «libre» y que eso mandara.
   */
  it('se puede marcar libre aunque los nutrientes sugieran un subgrupo', () => {
    const onGuardar = vi.fn();
    render(<FoodForm onGuardar={onGuardar} />);

    fireEvent.change(screen.getByPlaceholderText('Avena en copos'), {
      target: { value: 'Bebida de almendras' },
    });
    /* Unos nutrientes que la app leería como lácteo. */
    for (const [etiqueta, valor] of [
      ['Hidratos', '5'],
      ['Proteína', '4'],
      ['Grasa', '1'],
    ] as const) {
      const campo = screen.queryByLabelText(new RegExp(etiqueta, 'i'));
      if (campo) fireEvent.change(campo, { target: { value: valor } });
    }

    /* El desplegable de subgrupo es el que ofrece «Libre». */
    const select = [...document.querySelectorAll('select')].find((s) =>
      [...s.options].some((o) => o.value === 'libre'),
    )!;
    fireEvent.change(select, { target: { value: 'libre' } });

    fireEvent.click(screen.getByText(/Añadir a la base de datos/i));
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

/**
 * LA ETIQUETA PONE «14,4»
 *
 * Con type="number" el navegador tira el valor al teclear la coma: la casilla
 * se quedaba vacía y parecía que la app no dejaba poner decimales. Le pasaba a
 * la clienta al copiar la etiqueta de su yogur, que es justo cuando no tiene a
 * nadie al lado para explicárselo.
 */
describe('Los números de la etiqueta', () => {
  it('se pueden escribir con coma', () => {
    const onGuardar = vi.fn();
    render(<FoodForm onGuardar={onGuardar} />);

    fireEvent.change(screen.getByPlaceholderText('Avena en copos'), {
      target: { value: 'Yogur de marca' },
    });

    const casillas = document.querySelectorAll('input[inputmode="decimal"]');
    expect(casillas.length).toBeGreaterThan(0);
    fireEvent.change(casillas[0], { target: { value: '14,4' } });
    expect((casillas[0] as HTMLInputElement).value).toBe('14,4');
  });
});
