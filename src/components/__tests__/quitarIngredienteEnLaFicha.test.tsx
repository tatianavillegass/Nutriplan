// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AjustarCantidades } from '../phase1/AjustarCantidades';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

const pollo = FOOD_CATALOG.find((f) => f.nombre === 'Pechuga de pollo cruda')!;
const arroz = FOOD_CATALOG.find((f) => f.nombre === 'Arroz blanco crudo')!;

const RECETA: Receta = {
  id: 'r1',
  nombre: 'Pollo con arroz y pimentón',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_magros: 1, almidones: 1 },
  ingredientes: [
    { id: 'i-pollo', nombre: 'Pollo', foodId: pollo.id, cantidad_base: 30, unidad: 'g', grupo: 'proteicos_magros', escalable: true, opcional: false },
    { id: 'i-arroz', nombre: 'Arroz', foodId: arroz.id, cantidad_base: 18, unidad: 'g', grupo: 'almidones', escalable: true, opcional: false },
    { id: 'i-pimenton', nombre: 'Pimentón', cantidad_base: null, unidad: 'al gusto', grupo: 'condimento', escalable: false, opcional: false },
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const PAUTA = { proteicos_magros: 4, almidones: 3 };

const pintar = (quitados: string[] = [], onGuardar = vi.fn()) => {
  render(
    <AjustarCantidades
      receta={RECETA}
      requeridos={PAUTA}
      foods={FOOD_CATALOG}
      ajustes={{}}
      quitados={quitados}
      onGuardar={onGuardar}
      onCerrar={() => {}}
    />,
  );
  return onGuardar;
};

/**
 * «ME CUADRA TODO MENOS EL PIMENTÓN»
 *
 * La receta del banco es la misma para las treinta clientas y el plato de ésta
 * no. Se le quita aquí, en su plan, y el banco no se entera.
 */
describe('Quitarle un ingrediente a esta clienta', () => {
  it('cada ingrediente se puede quitar', () => {
    pintar();
    expect(screen.getByLabelText('Quitar Pimentón')).toBeTruthy();
  });

  it('al quitarlo se va de la lista', () => {
    pintar();
    fireEvent.click(screen.getByLabelText('Quitar Pimentón'));
    expect(screen.queryByLabelText('Quitar Pimentón')).toBeNull();
  });

  /** Un cambio que no se puede deshacer da miedo de hacer. */
  it('y se puede devolver', () => {
    pintar();
    fireEvent.click(screen.getByLabelText('Quitar Pimentón'));
    expect(screen.getByText(/No se lo pones/i)).toBeTruthy();

    fireEvent.click(screen.getByText(/Pimentón/));
    expect(screen.getByLabelText('Quitar Pimentón')).toBeTruthy();
    expect(screen.queryByText(/No se lo pones/i)).toBeNull();
  });

  it('se guarda con el resto de los retoques de esa clienta', () => {
    const onGuardar = pintar();
    fireEvent.click(screen.getByLabelText('Quitar Pimentón'));
    fireEvent.click(screen.getByText('Guardar cantidades'));

    const [, , quitados] = onGuardar.mock.calls[0];
    expect(quitados).toEqual(['i-pimenton']);
  });

  /**
   * Y LO QUE PONE EN SU LUGAR VA EN LA RECETA
   *
   * «Quito pimentón y pongo zanahoria»: la zanahoria es parte del plato, no un
   * yogur que se come al lado. Por eso el buscador está pegado a la lista de
   * ingredientes y no dentro de «Acompañamientos».
   */
  it('se busca un alimento y entra en la lista', () => {
    const onGuardar = pintar();
    fireEvent.change(screen.getByPlaceholderText(/Añadir un ingrediente a la receta/i), {
      target: { value: 'zanahoria' },
    });
    fireEvent.click(screen.getAllByText(/Zanahoria/i)[0]);

    /* Ya se puede quitar como cualquier otro ingrediente de la lista. */
    expect(screen.getAllByLabelText(/^Quitar Zanahoria/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Guardar cantidades'));
    const [, , , anadidos] = onGuardar.mock.calls[0];
    expect(anadidos).toHaveLength(1);
    expect(anadidos[0].nombre).toMatch(/Zanahoria/i);
    expect(anadidos[0].gramos).toBeGreaterThan(0);
  });

  /** Lo ya quitado se abre quitado: es lo que tiene guardado. */
  it('lo quitado de antes sale al abrir', () => {
    pintar(['i-pimenton']);
    expect(screen.queryByLabelText('Quitar Pimentón')).toBeNull();
    expect(screen.getByText(/No se lo pones/i)).toBeTruthy();
  });
});
