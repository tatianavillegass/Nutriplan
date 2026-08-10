// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { ExchangeGrid } from '../planning/ExchangeGrid';
import { PlanSchemaTable } from '../phase2/PlanSchemaTable';
import { MealOptionsBoard } from '../phase2/MealOptionsBoard';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { ScaledOptionsBoard } from '../phase2/ScaledOptionsBoard';
import { FoodPortionPicker } from '../phase3/FoodPortionPicker';
import { WeekStrip } from '../client/WeekStrip';
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
    expect(screen.getByText(/Avena copos — 2 cdas \(25 g\)/)).toBeTruthy();
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
    fireEvent.change(selects[0], { target: { value: 'Merluza cruda' } });
    // Merluza cruda: 18 g de proteína/100 g → 40 g por intercambio × 5
    expect(screen.getByText('200 g')).toBeTruthy();
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

describe('Fase 2 — opciones con las cantidades hechas', () => {
  const DIA2: DayType = {
    ...DAY,
    grid: {
      desayuno: { proteicos_semigrasos: 2, proteicos_magros: 1, almidones: 2, grasas: 1 },
      comida: { proteicos_magros: 5, almidones: 4, grasas: 2, verduras: 2 },
    },
  };

  it('muestra los gramos ya multiplicados en lugar de "escoge X"', () => {
    render(<ScaledOptionsBoard dayType={DIA2} meal={DIA2.meals[0]} foods={FOOD_CATALOG} />);
    expect(screen.getByText(/3 porciones/)).toBeTruthy();
    // Los gramos salen multiplicados, no en porciones sueltas.
    expect(document.body.textContent).toMatch(/\d+ (g|ml)\)/);
    expect(screen.queryByText(/Escoge/)).toBeNull();
  });

  it('la comida escala el pollo a 150 g', () => {
    render(<ScaledOptionsBoard dayType={DIA2} meal={DIA2.meals[1]} foods={FOOD_CATALOG} />);
    expect(screen.getAllByText(/150 g/).length).toBeGreaterThan(0);
  });
});

describe('Fase 3 — marcar porciones alimento a alimento', () => {
  it('pulsar un alimento suma la porción y muestra los gramos acumulados', () => {
    // Igual que hace el store: cada cambio produce un objeto nuevo.
    let porciones: Record<string, Record<string, number>> = {};
    const marcar = (mealId: string, foodId: string, delta: number) => {
      const comida = { ...(porciones[mealId] ?? {}) };
      comida[foodId] = (comida[foodId] ?? 0) + delta;
      porciones = { ...porciones, [mealId]: comida };
    };

    const { rerender } = render(
      <FoodPortionPicker
        dayType={DAY}
        meal={DAY.meals[1]}
        foods={FOOD_CATALOG}
        porciones={porciones}
        onMarcar={marcar}
      />,
    );

    const pollo = screen.getAllByText(/Pechuga de pollo cruda/)[0].closest('button')!;
    fireEvent.click(pollo);
    fireEvent.click(pollo);
    fireEvent.click(pollo);
    expect(porciones.comida['a-pechuga-de-pollo-cruda']).toBe(3);

    rerender(
      <FoodPortionPicker
        dayType={DAY}
        meal={DAY.meals[1]}
        foods={FOOD_CATALOG}
        porciones={porciones}
        onMarcar={marcar}
      />,
    );
    // 3 porciones × 30 g = 90 g, y el contador va a 3/5
    expect(screen.getAllByText(/90 g/).length).toBeGreaterThan(0);
    expect(document.body.textContent?.replace(/\s+/g, '')).toContain('3/5');
  });
});

describe('Calendario del cliente', () => {
  it('pinta los siete días en español', () => {
    render(
      <WeekStrip
        fecha="2026-08-07"
        onFecha={() => {}}
        dayTypes={[DAY]}
        registros={[]}
      />,
    );
    for (const d of ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']) {
      expect(screen.getByText(d)).toBeTruthy();
    }
    expect(screen.getAllByText(/Día entreno/).length).toBe(7);
  });

  it('el día seleccionado cambia al pulsar otro', () => {
    let elegido = '2026-08-07';
    render(
      <WeekStrip
        fecha={elegido}
        onFecha={(f) => (elegido = f)}
        dayTypes={[DAY]}
        registros={[]}
      />,
    );
    fireEvent.click(screen.getByText('LUN').closest('button')!);
    expect(elegido).toBe('2026-08-03');
  });
});

describe('Fase 2 — despensa, combinaciones y aceite', () => {
  const DIA2: DayType = {
    ...DAY,
    meals: [
      { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
      { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
    ],
    grid: {
      desayuno: { proteicos_semigrasos: 2, proteicos_magros: 2, almidones: 2, grasas: 1 },
      comida: { proteicos_magros: 5, almidones: 4, grasas: 3, verduras: 2 },
    },
    despensa: {
      desayuno: {
        seleccion: ['a-huevo', 'a-clara-de-huevo', 'a-jamon-York', 'a-avena-copos', 'a-aceite-de-oliva-virgen-extra'],
      },
    },
  };

  it('sólo ofrece los alimentos que ha elegido la nutricionista', () => {
    render(<ScaledOptionsBoard dayType={DIA2} meal={DIA2.meals[0]} foods={FOOD_CATALOG} />);
    const texto = document.body.textContent ?? '';
    expect(texto).toMatch(/huevo/i);
    expect(texto).toMatch(/clara/i);
    expect(texto).not.toMatch(/cottage/i);
  });

  it('reserva el aceite de cocción en la comida y lo dice', () => {
    render(<ScaledOptionsBoard dayType={DIA2} meal={DIA2.meals[1]} foods={FOOD_CATALOG} />);
    expect(screen.getByText(/Aceite de cocción: 5 g \(1 cdta\)/)).toBeTruthy();
  });

  it('el desayuno no lleva aceite reservado', () => {
    render(<ScaledOptionsBoard dayType={DIA2} meal={DIA2.meals[0]} foods={FOOD_CATALOG} />);
    expect(screen.queryByText(/Aceite de cocción/)).toBeNull();
  });
});

describe('Fase 3 — despensa por comida', () => {
  const DIA3: DayType = {
    ...DAY,
    meals: [
      { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
      { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 2 },
    ],
    grid: {
      desayuno: { proteicos_magros: 2, almidones: 2, grasas: 1 },
      merienda: { proteicos_magros: 1, almidones: 1, grasas: 1 },
    },
    despensa: { merienda: { excluidos: ['a-huevo'] } },
  };

  it('el huevo desaparece de la merienda pero sigue en el desayuno', () => {
    const { unmount } = render(
      <FoodPortionPicker
        dayType={DIA3}
        meal={DIA3.meals[1]}
        foods={FOOD_CATALOG}
        porciones={{}}
        onMarcar={() => {}}
      />,
    );
    expect(screen.queryByText(/^Huevo$/)).toBeNull();
    unmount();

    render(
      <FoodPortionPicker
        dayType={DIA3}
        meal={DIA3.meals[0]}
        foods={FOOD_CATALOG}
        porciones={{}}
        onMarcar={() => {}}
      />,
    );
    expect(screen.getAllByText(/Huevo/).length).toBeGreaterThan(0);
  });
});
