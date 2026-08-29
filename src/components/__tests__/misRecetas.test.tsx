// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MisRecetas } from '../phase4/MisRecetas';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { RecetaPropia } from '../../types/diary';

afterEach(cleanup);

/**
 * LA RECETA SE ESCRIBE AL COCINAR, NO AL COMER
 *
 * Lo que hay que preguntarle es qué SALE —diez rebanadas, un kilo—, que es lo
 * que tiene delante mientras cocina. Al comer ya sólo se sirve.
 */
describe('Mis recetas', () => {
  it('se guarda con lo que sale de ella', () => {
    const onGuardar = vi.fn();
    render(
      <MisRecetas recetas={[]} foods={FOOD_CATALOG} onGuardar={onGuardar} onBorrar={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('+ Nueva receta'));
    fireEvent.change(screen.getByPlaceholderText(/Cómo se llama/), {
      target: { value: 'Banana bread' },
    });

    // Un ingrediente del catálogo, para que tenga macros que contar.
    const buscador = screen.getByPlaceholderText('Añadir ingrediente…');
    fireEvent.change(buscador, { target: { value: 'Avena' } });
    fireEvent.click(screen.getAllByText(/Avena/i)[1] ?? screen.getAllByText(/Avena/i)[0]);

    fireEvent.change(screen.getByLabelText('Cuántas raciones salen'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Lo que pesa ya hecho'), {
      target: { value: '1000' },
    });

    fireEvent.click(screen.getByText('Guardar receta'));

    const guardada = onGuardar.mock.calls[0]?.[0] as RecetaPropia;
    expect(guardada.nombre).toBe('Banana bread');
    expect(guardada.raciones).toBe(10);
    expect(guardada.gramosFinales).toBe(1000);
    expect(guardada.ingredientes.length).toBeGreaterThan(0);
  });

  it('y en la lista se ve lo que pesa una ración', () => {
    const receta: RecetaPropia = {
      id: 'r1',
      nombre: 'Banana bread',
      ingredientes: [{ id: 'i1', nombre: 'Avena', gramos: 100 }],
      raciones: 10,
      gramosFinales: 1000,
      creada: '2026-08-19T10:00:00.000Z',
    };
    render(
      <MisRecetas
        recetas={[receta]}
        foods={FOOD_CATALOG}
        onGuardar={vi.fn()}
        onBorrar={vi.fn()}
      />,
    );

    // Plegada de entrada: sólo el nombre de la sección y cuántas hay.
    expect(document.body.textContent).not.toContain('100 g cada una');
    expect(screen.getByText('1')).toBeTruthy();

    fireEvent.click(screen.getByText('Mis recetas'));
    expect(document.body.textContent).toContain('100 g cada una');
  });

  /**
   * AL EDITARLA HAY QUE VER DE QUÉ SON ESOS GRAMOS
   *
   * La casilla de los gramos se comía la fila entera y el nombre del
   * ingrediente desaparecía: quedaban dos números sueltos sin saber cuál era
   * la avena y cuál el plátano.
   */
  it('al editarla, cada casilla de gramos dice de qué ingrediente es', () => {
    const receta: RecetaPropia = {
      id: 'r1',
      nombre: 'Banana bread',
      ingredientes: [
        { id: 'i1', nombre: 'Avena', gramos: 240 },
        { id: 'i2', nombre: 'Plátano', gramos: 200 },
      ],
      raciones: 2,
      creada: '2026-08-19T10:00:00.000Z',
    };
    render(
      <MisRecetas
        recetas={[receta]}
        foods={FOOD_CATALOG}
        onGuardar={vi.fn()}
        onBorrar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Mis recetas'));
    fireEvent.click(screen.getByText('Editar'));

    // El nombre, escrito al lado de su casilla.
    expect(screen.getByText('Avena')).toBeTruthy();
    expect(screen.getByText('Plátano')).toBeTruthy();
    expect((screen.getByLabelText('Gramos de Avena') as HTMLInputElement).value).toBe('240');
    expect((screen.getByLabelText('Gramos de Plátano') as HTMLInputElement).value).toBe('200');
  });

  /**
   * Y que la casilla no vuelva a comerse la fila: si se le pone un ancho, ese
   * ancho manda. El `w-full` de la casilla base ganaba siempre porque en la
   * hoja de estilos va después, no por el orden en que se escriben.
   */
  it('y la casilla estrecha se queda estrecha', () => {
    const receta: RecetaPropia = {
      id: 'r1',
      nombre: 'Banana bread',
      ingredientes: [{ id: 'i1', nombre: 'Avena', gramos: 240 }],
      creada: '2026-08-19T10:00:00.000Z',
    };
    render(
      <MisRecetas
        recetas={[receta]}
        foods={FOOD_CATALOG}
        onGuardar={vi.fn()}
        onBorrar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Mis recetas'));
    fireEvent.click(screen.getByText('Editar'));

    const casilla = screen.getByLabelText('Gramos de Avena');
    expect(casilla.className).toContain('w-20');
    expect(casilla.className).not.toContain('w-full');
  });
});
