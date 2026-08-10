// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MealPantryEditor } from '../planning/MealPantryEditor';
import { IngredientSwap } from '../phase1/IngredientSwap';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Meal } from '../../types/plan';
import type { IngredienteEscalado } from '../../types/recipe';

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

const abrirDespensa = () => {
  fireEvent.click(screen.getByText('Desayuno'));
};

describe('Despensa de la comida (Fase 3)', () => {
  const pintar = (onDespensa = () => {}) =>
    render(
      <MealPantryEditor
        dayType={DIA}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        onDespensa={onDespensa}
        onAceite={() => {}}
      />,
    );

  it('el queso cottage y el yogur proteico están en la columna de proteína', () => {
    pintar();
    abrirDespensa();
    expect(screen.getByText('Queso cottage')).toBeTruthy();
    expect(screen.getByText('Yogur proteínas Mercadona')).toBeTruthy();
  });

  it('cada macro tiene su propio buscador para añadir', () => {
    pintar();
    abrirDespensa();
    expect(screen.getByPlaceholderText(/queso batido, huevo, pollo/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/avena, pan, plátano/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/aceite, aguacate, nueces/)).toBeTruthy();
  });

  it('los alimentos van agrupados por subgrupo', () => {
    pintar();
    abrirDespensa();
    expect(screen.getAllByText('Proteicos magros').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lácteos/).length).toBeGreaterThan(0);
  });

  it('pulsar un alimento lo quita de esta comida', () => {
    const onDespensa = vi.fn();
    pintar(onDespensa);
    abrirDespensa();
    fireEvent.click(screen.getByText('Queso cottage'));
    expect(onDespensa).toHaveBeenCalled();
    const despensa = onDespensa.mock.calls[0][0] as Record<string, { excluidos?: string[] }>;
    expect(despensa.desayuno.excluidos).toContain('a-queso-cottage');
  });
});

describe('Cambiar un ingrediente (Fase 1)', () => {
  const ingrediente = {
    id: 'i1',
    nombre: 'Pechuga de pollo cruda',
    foodId: 'a-pechuga-de-pollo-cruda',
    cantidad_base: 30,
    unidad: 'g',
    grupo: 'proteicos_magros',
    escalable: true,
    opcional: false,
    cantidad_final: 150,
    display: '150 g',
    factor: 5,
  } as IngredienteEscalado;

  const pintar = (onCambiar = () => {}) =>
    render(
      <IngredientSwap
        ingrediente={ingrediente}
        intercambios={5}
        foods={FOOD_CATALOG}
        onCambiar={onCambiar}
      />,
    );

  it('el desplegable trae buscador', () => {
    pintar();
    fireEvent.click(screen.getByText('Cambiar'));
    expect(screen.getByPlaceholderText(/Buscar en proteicos magros/i)).toBeTruthy();
    expect(screen.getByText(/Ordenados por parecido/)).toBeTruthy();
  });

  it('lo más parecido sale antes que lo que menos', () => {
    pintar();
    fireEvent.click(screen.getByText('Cambiar'));
    const texto = document.body.textContent ?? '';
    // El pavo comparte "pechuga" y "cruda" con el pollo; la whey no.
    expect(texto.indexOf('Pavo pechuga cruda')).toBeGreaterThanOrEqual(0);
    expect(texto.indexOf('Pavo pechuga cruda')).toBeLessThan(
      texto.indexOf('Proteína whey aislada'),
    );
  });

  it('buscar filtra la lista', () => {
    pintar();
    fireEvent.click(screen.getByText('Cambiar'));
    fireEvent.change(screen.getByPlaceholderText(/Buscar en proteicos magros/i), {
      target: { value: 'merluza' },
    });
    expect(screen.getByText('Merluza cruda')).toBeTruthy();
    expect(screen.queryByText('Pavo pechuga cruda')).toBeNull();
  });

  it('si no hay nada con ese texto lo dice', () => {
    pintar();
    fireEvent.click(screen.getByText('Cambiar'));
    fireEvent.change(screen.getByPlaceholderText(/Buscar en proteicos magros/i), {
      target: { value: 'zzzz' },
    });
    expect(screen.getByText(/Nada con «zzzz»/)).toBeTruthy();
  });

  it('elegir uno devuelve su id y cierra', () => {
    const onCambiar = vi.fn();
    pintar(onCambiar);
    fireEvent.click(screen.getByText('Cambiar'));
    fireEvent.change(screen.getByPlaceholderText(/Buscar en proteicos magros/i), {
      target: { value: 'merluza' },
    });
    fireEvent.click(screen.getByText('Merluza cruda'));
    expect(onCambiar).toHaveBeenCalledWith('a-merluza-cruda');
    expect(screen.queryByPlaceholderText(/Buscar en/i)).toBeNull();
  });

  it('los gramos salen ya escalados a los intercambios de la comida', () => {
    pintar();
    fireEvent.click(screen.getByText('Cambiar'));
    // Merluza: 18 g de proteína/100 g → 40 g por intercambio × 5
    const fila = screen.getByText('Merluza cruda').closest('button')!;
    expect(within(fila).getAllByText(/200 g/).length).toBeGreaterThan(0);
  });
});
