// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { pautaDeComida } from '../../utils/fijos';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Fijo } from '../../types/plan';
import type { Ingrediente, Receta } from '../../types/recipe';

afterEach(cleanup);

/**
 * LO QUE VA SIEMPRE, DENTRO DE LA RECETA
 *
 * «Todos los desayunos deben incluir ese café con leche como acompañamiento, y
 * se debe restar esa porción de la receta: si tenía 3 porciones de grasa,
 * ahora el aceite debe poner 10 g y no 15.»
 *
 * Lo segundo ya pasaba —la pauta se descuenta antes de escalar— pero sin ver
 * el fijo en la receta, ese aceite recortado parece un error.
 */

const aceite = FOOD_CATALOG.find((f) => f.nombre === 'Aceite de oliva virgen extra')!;
const pollo = FOOD_CATALOG.find((f) => f.nombre === 'Pechuga de pollo cruda')!;
const chocolate = FOOD_CATALOG.find((f) => f.nombre === 'Chocolate 85% cacao')!;

const ing = (nombre: string, food: { id: string; grupo?: string }, c: number): Ingrediente =>
  ({
    id: `i-${nombre}`,
    nombre,
    foodId: food.id,
    cantidad_base: c,
    unidad: 'g',
    grupo: food.grupo,
    escalable: true,
    opcional: false,
  }) as Ingrediente;

const PLATO: Receta = {
  id: 'r',
  nombre: 'Pollo al horno',
  categorias: ['cena'],
  tags: [],
  base: {},
  ingredientes: [ing('Pollo', pollo, 30), ing('Aceite', aceite, 5)],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
} as Receta;

const POSTRE: Fijo = {
  id: 'f1',
  foodId: chocolate.id,
  nombre: 'Cuadrito de chocolate',
  gramos: 11,
  tipo: 'postre',
};

const dia = (fijos?: Record<string, Fijo[]>): DayType =>
  ({
    id: 'dt',
    nombre: 'Día base',
    proteinaGkg: 2,
    hcGkg: 3,
    meals: [{ id: 'cena', nombre: 'Cena', slot: 'cena', orden: 1 }],
    grid: { cena: { proteicos_magros: 4, grasas: 3 } },
    notas: {},
    fijos,
  }) as unknown as DayType;

const pintar = (dayType: DayType) => {
  const p = pautaDeComida(dayType, 'cena', FOOD_CATALOG);
  render(
    <ScaledRecipeView
      receta={PLATO}
      requeridos={p.pauta}
      foods={FOOD_CATALOG}
      fijos={p.fijos}
    />,
  );
};

describe('El postre fijo le quita su grasa a la receta', () => {
  it('sin postre, el aceite es el pautado', () => {
    pintar(dia());
    expect(screen.getByText('15 ml')).toBeTruthy();
  });

  /* Su ejemplo, literal: 3 porciones de grasa menos el chocolate → 10 g. */
  it('con el cuadrito de chocolate, el aceite baja', () => {
    pintar(dia({ cena: [POSTRE] }));
    expect(screen.getByText('10 ml')).toBeTruthy();
    expect(screen.queryByText('15 ml')).toBeNull();
  });
});

describe('Y se ve en la receta', () => {
  it('con su nombre y sus gramos', () => {
    pintar(dia({ cena: [POSTRE] }));
    expect(screen.getByText('Siempre con esta comida')).toBeTruthy();
    expect(screen.getByText(/Cuadrito de chocolate/)).toBeTruthy();
    expect(screen.getByText(/11 g/)).toBeTruthy();
  });

  /*
   * Sin esta línea, el aceite recortado parece que la receta se quedó corta.
   */
  it('y se dice que ya está descontado', () => {
    pintar(dia({ cena: [POSTRE] }));
    expect(screen.getByText(/Ya está descontado/i)).toBeTruthy();
  });

  it('un postre se lee como «después»', () => {
    pintar(dia({ cena: [POSTRE] }));
    expect(screen.getByText('después')).toBeTruthy();
  });

  it('sin fijos no aparece el bloque', () => {
    pintar(dia());
    expect(screen.queryByText('Siempre con esta comida')).toBeNull();
  });
});
