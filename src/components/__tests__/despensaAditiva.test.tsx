// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MealPantryEditor } from '../planning/MealPantryEditor';
import { FoodPicker } from '../food/FoodPicker';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { evaluarAlimento } from '../../utils/restrictions';
import { guardarPlantillas } from '../../utils/plantillas';
import type { Alimento } from '../../types/food';
import type { DayType, DespensaComida, Meal } from '../../types/plan';

afterEach(cleanup);

const DESAYUNO: Meal = { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 };

const dia = (seleccion?: string[]): DayType => ({
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [DESAYUNO],
  grid: { desayuno: { proteicos_magros: 2, almidones: 2, grasas: 1 } },
  despensa: seleccion ? { desayuno: { seleccion } } : undefined,
  notas: {},
});

const CON_LACTOSA = { patologias: ['intolerancia_lactosa'], alergias: [], aversiones: [] };
const motivo = (f: Alimento) => {
  const b = evaluarAlimento(f, CON_LACTOSA);
  return b.bloqueado ? b.motivos.join(' · ') : undefined;
};

describe('Un alimento vetado se explica, no desaparece', () => {
  it('el buscador enseña el queso cottage con el motivo en vez de esconderlo', () => {
    render(
      <FoodPicker foods={FOOD_CATALOG} motivoBloqueo={motivo} onSelect={() => {}} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Escribe un alimento/), {
      target: { value: 'cottage' },
    });
    expect(screen.getByText('Queso cottage')).toBeTruthy();
    expect(screen.getAllByText(/lactosa/i).length).toBeGreaterThan(0);
  });

  it('y se puede elegir igualmente: la decisión es de la nutricionista', () => {
    const onSelect = vi.fn();
    render(<FoodPicker foods={FOOD_CATALOG} motivoBloqueo={motivo} onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText(/Escribe un alimento/), {
      target: { value: 'cottage' },
    });
    fireEvent.click(screen.getByText('Queso cottage'));
    expect(onSelect.mock.calls[0][0].id).toBe('a-queso-cottage');
  });

  it('sin restricciones no aparece ningún motivo', () => {
    render(<FoodPicker foods={FOOD_CATALOG} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/Escribe un alimento/), {
      target: { value: 'cottage' },
    });
    expect(screen.queryByText(/Contiene lactosa/i)).toBeNull();
  });
});

describe('Despensa que se construye añadiendo', () => {
  beforeEach(() => {
    localStorage.clear();
    guardarPlantillas([]);
  });

  const pintar = (dt: DayType, onDespensa: (d: Record<string, DespensaComida>) => void = () => {}) =>
    render(
      <MealPantryEditor
        dayType={dt}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        onDespensa={onDespensa}
        onAceite={() => {}}
      />,
    );

  it('una comida vacía arranca sin alimentos y con un buscador por macro', () => {
    pintar(dia([]));
    fireEvent.click(screen.getByText('Desayuno'));
    expect(screen.getByPlaceholderText(/queso batido, huevo, pollo/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/avena, pan, plátano/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/aceite, aguacate, nueces/)).toBeTruthy();
    expect(screen.queryByText('Queso cottage')).toBeNull();
  });

  it('añadir queso cottage lo mete en la lista de proteína', () => {
    const onDespensa = vi.fn();
    pintar(dia([]), onDespensa);
    fireEvent.click(screen.getByText('Desayuno'));
    const picker = screen.getByPlaceholderText(/queso batido, huevo, pollo/);
    fireEvent.change(picker, { target: { value: 'cottage' } });
    fireEvent.click(screen.getByText('Queso cottage'));
    expect(onDespensa.mock.calls[0][0].desayuno.seleccion).toEqual(['a-queso-cottage']);
  });

  it('el yogur proteico también entra por el buscador de proteína', () => {
    const onDespensa = vi.fn();
    pintar(dia([]), onDespensa);
    fireEvent.click(screen.getByText('Desayuno'));
    fireEvent.change(screen.getByPlaceholderText(/queso batido, huevo, pollo/), {
      target: { value: 'yogur proteinas' },
    });
    fireEvent.click(screen.getByText('Yogur proteínas Mercadona'));
    expect(onDespensa.mock.calls[0][0].desayuno.seleccion).toEqual(['a-yogur-proteinas-mercadona']);
  });

  it('añadir uno conserva los que ya estaban', () => {
    const onDespensa = vi.fn();
    pintar(dia(['a-huevo']), onDespensa);
    fireEvent.click(screen.getByText('Desayuno'));
    expect(screen.getByText('Huevo')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/queso batido, huevo, pollo/), {
      target: { value: 'cottage' },
    });
    fireEvent.click(screen.getByText('Queso cottage'));
    expect(onDespensa.mock.calls[0][0].desayuno.seleccion).toEqual(['a-huevo', 'a-queso-cottage']);
  });

  it('pulsar un alimento de la lista lo quita', () => {
    const onDespensa = vi.fn();
    pintar(dia(['a-huevo', 'a-queso-cottage']), onDespensa);
    fireEvent.click(screen.getByText('Desayuno'));
    fireEvent.click(screen.getByText('Huevo'));
    expect(onDespensa.mock.calls[0][0].desayuno.seleccion).toEqual(['a-queso-cottage']);
  });

  it('la comida se guarda como plantilla y se puede aplicar en otra', () => {
    const onDespensa = vi.fn();
    const { unmount } = pintar(dia(['a-huevo', 'a-avena-copos']), onDespensa);
    fireEvent.click(screen.getByText('Desayuno'));
    fireEvent.click(screen.getByText(/Guardar esta comida como plantilla/));
    fireEvent.change(screen.getByPlaceholderText('Desayuno de siempre'), {
      target: { value: 'Mi desayuno' },
    });
    fireEvent.click(screen.getByText('Guardar'));
    expect(screen.getByText('Mi desayuno')).toBeTruthy();
    unmount();

    // En una comida vacía, la plantilla la rellena de golpe.
    pintar(dia([]), onDespensa);
    fireEvent.click(screen.getByText('Desayuno'));
    fireEvent.click(screen.getByText('Mi desayuno'));
    const ultima = onDespensa.mock.calls.at(-1)![0];
    expect(ultima.desayuno.seleccion).toEqual(['a-huevo', 'a-avena-copos']);
  });

  it('de fábrica ya vienen plantillas listas para usar', () => {
    pintar(dia([]));
    fireEvent.click(screen.getByText('Desayuno'));
    expect(screen.getByText('Desayuno dulce')).toBeTruthy();
    expect(screen.getByText('Cena')).toBeTruthy();
  });
});
