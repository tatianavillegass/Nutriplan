// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FoodPortionPicker, agrupar } from '../phase3/FoodPortionPicker';
import { MealPantryEditor } from '../planning/MealPantryEditor';
import { NewPlanWizard } from '../client/NewPlanWizard';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Client } from '../../types/client';
import type { DayType, Meal } from '../../types/plan';

afterEach(cleanup);

const DESAYUNO: Meal = { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 };

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [DESAYUNO],
  grid: { desayuno: { proteicos_magros: 2, fruta: 1, almidones: 1, grasas: 1 } },
  notas: {},
};

describe('La fruta se ofrece en general', () => {
  const frutas = FOOD_CATALOG.filter((f) => f.grupo === 'fruta').slice(0, 6);
  const pollo = FOOD_CATALOG.find((f) => f.nombre === 'Pechuga de pollo cruda')!;

  it('agrupa las frutas en una sola entrada y deja el resto suelto', () => {
    const e = agrupar([pollo, ...frutas]);
    expect(e.filter((x) => x.tipo === 'grupo')).toHaveLength(1);
    expect(e.find((x) => x.tipo === 'grupo' && x.grupo === 'fruta')).toBeTruthy();
    expect(e.some((x) => x.tipo === 'alimento' && x.food.id === pollo.id)).toBe(true);
  });

  it('el buscador de fruta recorre todo el catálogo, no sólo la despensa', () => {
    const e = agrupar([frutas[0]], FOOD_CATALOG);
    expect(e).toHaveLength(1);
    expect(e[0].tipo).toBe('grupo');
    const grupo = e[0] as Extract<typeof e[0], { tipo: 'grupo' }>;
    // La que puso la nutricionista sale primero; detrás, el resto de frutas.
    expect(grupo.foods[0].id).toBe(frutas[0].id);
    expect(grupo.foods.length).toBeGreaterThan(30);
    expect(new Set(grupo.foods.map((f) => f.id)).size).toBe(grupo.foods.length);
  });

  it('si el día pauta fruta, se ofrece aunque la despensa no traiga ninguna', () => {
    const e = agrupar([pollo], FOOD_CATALOG, ['fruta']);
    const grupo = e.find((x) => x.tipo === 'grupo');
    expect(grupo).toBeTruthy();
    expect((grupo as Extract<typeof e[0], { tipo: 'grupo' }>).foods.length).toBeGreaterThan(30);
  });

  it('los genéricos salen los primeros de su macro', () => {
    const almidon = FOOD_CATALOG.find((f) => f.grupo === 'almidones')!;
    const e = agrupar([almidon, ...frutas], FOOD_CATALOG);
    expect(e[0].tipo).toBe('grupo');
  });

  it('el cliente ve "Fruta" y al pulsar puede buscar cuál', () => {
    render(
      <FoodPortionPicker
        dayType={DIA}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        porciones={{}}
        onMarcar={() => {}}
      />,
    );
    // "Fruta" también es el nombre del subgrupo en el contador; el genérico
    // es el que anuncia cuántas opciones hay.
    const fruta = screen.getByText(/la que quieras/).closest('button')!;
    expect(fruta.textContent).toMatch(/^Fruta/);
    fireEvent.click(fruta);
    const buscador = screen.getByPlaceholderText(/Buscar fruta/i);
    fireEvent.change(buscador, { target: { value: 'platano' } });
    expect(screen.getByText('Plátano')).toBeTruthy();
    expect(screen.queryByText('Manzana')).toBeNull();
  });

  it('elegir una fruta marca esa, no la genérica', () => {
    const onMarcar = vi.fn();
    render(
      <FoodPortionPicker
        dayType={DIA}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        porciones={{}}
        onMarcar={onMarcar}
      />,
    );
    fireEvent.click(screen.getByText(/la que quieras/).closest('button')!);
    fireEvent.change(screen.getByPlaceholderText(/Buscar fruta/i), {
      target: { value: 'platano' },
    });
    fireEvent.click(screen.getByText('Plátano'));
    expect(onMarcar).toHaveBeenCalledWith('desayuno', 'a-platano', 1);
  });
});

describe('Añadir alimentos a la despensa', () => {
  it('añadir uno no hace desaparecer los demás de la lista', () => {
    const despensas: Record<string, unknown>[] = [];
    render(
      <MealPantryEditor
        dayType={DIA}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        onDespensa={(d) => despensas.push(d)}
        onAceite={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Desayuno'));

    // Antes de añadir, la lista ya tiene cottage y avena.
    expect(screen.getByText('Queso cottage')).toBeTruthy();
    expect(screen.getByText('Avena copos')).toBeTruthy();

    const picker = screen.getByPlaceholderText(/queso batido, huevo, pollo/);
    fireEvent.change(picker, { target: { value: 'kefir' } });

    // Y siguen ahí: añadir no filtra ni oculta nada.
    expect(screen.getByText('Queso cottage')).toBeTruthy();
    expect(screen.getByText('Avena copos')).toBeTruthy();
  });

  it('la nota de la comida se escribe aquí mismo', () => {
    const notas: string[] = [];
    render(
      <MealPantryEditor
        dayType={DIA}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        onDespensa={() => {}}
        onAceite={() => {}}
        onNota={(t) => notas.push(t)}
      />,
    );
    fireEvent.click(screen.getByText('Desayuno'));
    fireEvent.change(screen.getByPlaceholderText(/Verdura libre/), {
      target: { value: 'Café sin azúcar' },
    });
    expect(notas).toContain('Café sin azúcar');
  });
});

describe('Nueva planificación con medidas nuevas', () => {
  const CLIENTE: Client = {
    id: 'c1',
    nombre: 'Marines',
    edad: 35,
    peso: 68,
    altura: 170,
    sexo: 'mujer',
    activityFactorId: 'sed_5',
    objetivo: 'mantenimiento',
    goalMultiplier: 1,
    bmrFormula: 'media',
    alergias: [],
    preferencias: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('arranca con los datos de la ficha y calcula el objetivo', () => {
    render(<NewPlanWizard client={CLIENTE} onCancelar={() => {}} onCrear={() => {}} />);
    expect((screen.getByLabelText(/Peso/) as HTMLInputElement).value).toBe('68');
    expect(screen.getByText(/kcal/)).toBeTruthy();
  });

  it('cambiar el peso recalcula el objetivo y enseña la diferencia', () => {
    render(<NewPlanWizard client={CLIENTE} onCancelar={() => {}} onCrear={() => {}} />);
    const antes = document.body.textContent ?? '';
    fireEvent.change(screen.getByLabelText(/Peso/), { target: { value: '64' } });
    const despues = document.body.textContent ?? '';
    expect(despues).not.toBe(antes);
    expect(despues).toMatch(/-4[.,]0 kg desde la última/);
  });

  it('sólo el peso es obligatorio: sin cintura ni cadera se puede crear', () => {
    const onCrear = vi.fn();
    render(<NewPlanWizard client={CLIENTE} onCancelar={() => {}} onCrear={onCrear} />);
    fireEvent.click(screen.getByText(/Crear planificación/));
    expect(onCrear).toHaveBeenCalled();
    const [medidas, kcal] = onCrear.mock.calls[0];
    expect(medidas.peso).toBe(68);
    expect(medidas.cintura).toBeUndefined();
    expect(kcal).toBeGreaterThan(1000);
  });

  it('recoge los perímetros cuando sí se toman', () => {
    const onCrear = vi.fn();
    render(<NewPlanWizard client={CLIENTE} onCancelar={() => {}} onCrear={onCrear} />);
    fireEvent.change(screen.getByLabelText(/Cintura/), { target: { value: '74' } });
    fireEvent.change(screen.getByLabelText(/Cadera/), { target: { value: '98' } });
    fireEvent.click(screen.getByText(/Crear planificación/));
    expect(onCrear.mock.calls[0][0].cintura).toBe(74);
    expect(onCrear.mock.calls[0][0].cadera).toBe(98);
  });

  it('un peso imposible no deja crear nada', () => {
    const onCrear = vi.fn();
    render(<NewPlanWizard client={CLIENTE} onCancelar={() => {}} onCrear={onCrear} />);
    fireEvent.change(screen.getByLabelText(/Peso/), { target: { value: '' } });
    expect(screen.getByText(/Escribe un peso/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Crear planificación/));
    expect(onCrear).not.toHaveBeenCalled();
  });
});
