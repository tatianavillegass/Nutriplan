// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { ExchangeGrid } from '../planning/ExchangeGrid';
import { PlanSchemaTable } from '../phase2/PlanSchemaTable';
import { MealOptionsBoard } from '../phase2/MealOptionsBoard';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { SEED_RECIPES } from '../../data/seedRecipes';
import type { DayType } from '../../types/plan';

afterEach(cleanup);

const DAY: DayType = {
  id: 'dt1',
  nombre: 'Día entreno',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
  ],
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 3, grasas: 1 },
    comida: { proteicos_magros: 5, almidones: 3, grasas: 2, verduras: 2 },
  },
  notas: {},
};

describe('Grilla de intercambios', () => {
  it('renderiza los 9 grupos, los totales y el g/kg por comida', () => {
    render(
      <ExchangeGrid
        dayType={DAY}
        peso={69}
        onCell={() => {}}
        onRenameMeal={() => {}}
        onRemoveMeal={() => {}}
      />,
    );
    expect(screen.getByText('Proteicos magros')).toBeTruthy();
    expect(screen.getByText('Azúcares')).toBeTruthy();
    expect(screen.getByText('g/kg por comida')).toBeTruthy();
    expect(screen.getByText('Calorías (kcal)')).toBeTruthy();
  });

  it('el stepper suma y resta medio intercambio', () => {
    const cambios: number[] = [];
    render(
      <ExchangeGrid
        dayType={DAY}
        peso={69}
        onCell={(_m, _g, v) => cambios.push(v)}
        onRenameMeal={() => {}}
        onRemoveMeal={() => {}}
      />,
    );
    const sumar = screen.getAllByLabelText('Sumar medio intercambio');
    fireEvent.click(sumar[0]);
    expect(cambios[0] % 0.5).toBe(0);
  });
});

describe('Esquema del plan (Fase 2)', () => {
  it('agrega los grupos en Proteína / Carbohidrato / Grasa', () => {
    render(<PlanSchemaTable dayType={DAY} />);
    expect(screen.getByText(/Plan Días Día entreno/)).toBeTruthy();
    const fila = screen.getByText('Desayuno').closest('tr')!;
    const celdas = within(fila).getAllByRole('cell');
    expect(celdas[1].textContent).toBe('2'); // proteína
    expect(celdas[2].textContent).toBe('3'); // carbohidrato
    expect(celdas[3].textContent).toBe('1'); // grasa
  });
});

describe('Listas "escoge X" (Fase 2)', () => {
  it('muestra el número de porciones y opciones con medida casera y gramaje', () => {
    render(
      <MealOptionsBoard
        dayType={DAY}
        meal={DAY.meals[0]}
        foods={FOOD_CATALOG}
        mode="documento"
      />,
    );
    expect(screen.getByText(/Escoge 2/)).toBeTruthy(); // proteína
    expect(screen.getByText(/Escoge 3/)).toBeTruthy(); // carbohidrato
    expect(screen.getByText(/1\/4 taza avena \(25 g\)/)).toBeTruthy();
  });
});

describe('Receta escalada y personalización (Fase 1)', () => {
  const wok = SEED_RECIPES.find((r) => r.id === 'rc_wok_pollo')!;

  it('muestra los gramajes ya escalados', () => {
    render(
      <ScaledRecipeView
        receta={wok}
        requeridos={{ proteicos_magros: 5, almidones: 3, grasas: 2 }}
        foods={FOOD_CATALOG}
      />,
    );
    expect(screen.getByText('150 g')).toBeTruthy();
    expect(screen.getByText('60 g crudo')).toBeTruthy();
    expect(screen.getByText('10 g')).toBeTruthy();
  });

  it('el panel de personalización recalcula el gramaje al sustituir', () => {
    render(
      <ScaledRecipeView
        receta={wok}
        requeridos={{ proteicos_magros: 5, almidones: 3, grasas: 2 }}
        foods={FOOD_CATALOG}
      />,
    );
    fireEvent.click(screen.getByText('Personalizar'));
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'Merluza' } });
    expect(screen.getByText('175 g')).toBeTruthy(); // 35 g/intercambio × 5
    expect(screen.getByText(/no alteran el plan/)).toBeTruthy();
  });

  it('en modo sólo lectura no aparecen los controles', () => {
    render(
      <ScaledRecipeView
        receta={wok}
        requeridos={{ proteicos_magros: 5, almidones: 3, grasas: 2 }}
        foods={FOOD_CATALOG}
        soloLectura
      />,
    );
    expect(screen.queryByText('Personalizar')).toBeNull();
  });
});
