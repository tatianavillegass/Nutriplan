// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  BibliotecaDeRecetas,
  aportesDeLaReceta,
} from '../client/BibliotecaDeRecetas';
import type { Alimento } from '../../types/food';
import type { DayType, Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import { scaleRecipe } from '../../utils/recipeScaling';

afterEach(cleanup);

/**
 * APUNTARSE UNA RECETA EN FASE 3
 *
 * Sus palabras: «cuando una clienta intenta poner alguna de las recetas de la
 * sección recetas, no se están agregando a su plan — no sabe cuántas porciones
 * tiene disponibles después de hacerla. Ella debe dar clic y poner en qué
 * comida la quiere incluir, y si usó tal cual las cantidades.»
 */

const comida = (id: string, nombre: string, grupo: string, gramos: number): Alimento =>
  ({
    id,
    nombre,
    grupo,
    medida_casera: `${gramos} g`,
    gramos,
    intercambios: 1,
    nutrientes: { kcal: 100, hc: 10, proteina: 5, grasa: 2 },
    comidas_sugeridas: [],
    alergenos: [],
    apto: [],
  }) as Alimento;

/* Una porción de avena son 20 g; de pan, 25; de yogur griego, 170. */
const AVENA = comida('a-avena', 'Avena', 'almidones', 20);
const PAN = comida('a-pan', 'Pan', 'almidones', 25);
const YOGUR = comida('a-yogur', 'Yogur griego', 'lacteos_proteicos', 170);
const LECHUGA = comida('a-lechuga', 'Lechuga', 'verduras', 100);
const FOODS = [AVENA, PAN, YOGUR, LECHUGA];

const ing = (id: string, nombre: string, foodId: string, grupo: string, c: number) =>
  ({
    id,
    nombre,
    foodId,
    cantidad_base: c,
    unidad: 'g',
    grupo,
    escalable: true,
    opcional: false,
  }) as Receta['ingredientes'][number];

/* Dos almidones distintos en el mismo plato: es donde se contaba doble. */
const PLATO: Receta = {
  id: 'rc',
  nombre: 'Avena con yogur',
  categorias: ['desayuno'],
  tags: [],
  base: { almidones: 2, lacteos_proteicos: 1 },
  ingredientes: [
    ing('i1', 'Avena', AVENA.id, 'almidones', 20),
    ing('i2', 'Pan', PAN.id, 'almidones', 25),
    ing('i3', 'Yogur', YOGUR.id, 'lacteos_proteicos', 170),
    ing('i4', 'Lechuga', LECHUGA.id, 'verduras', 100),
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
} as Receta;

const porciones = (a: ReturnType<typeof aportesDeLaReceta>, id: string) =>
  a.find((x) => x.foodId === id)?.intercambios;

describe('Qué porciones gasta la receta', () => {
  /*
   * Lo que se pautó en la comida da igual: la receta sabe lo que lleva. Con 20
   * g de avena y 25 de pan son una porción de cada, no las del día entero.
   */
  it('las que de verdad lleva, no las de la casilla', () => {
    const a = aportesDeLaReceta(PLATO, { almidones: 2, lacteos_proteicos: 1 }, FOODS);
    expect(porciones(a, AVENA.id)).toBe(1);
    expect(porciones(a, PAN.id)).toBe(1);
    expect(porciones(a, YOGUR.id)).toBe(1);
  });

  /* El bug nº1: cada almidón se llevaba las porciones del grupo entero. */
  it('dos almidones no cuentan doble', () => {
    const a = aportesDeLaReceta(PLATO, { almidones: 4 }, FOODS);
    const total = (porciones(a, AVENA.id) ?? 0) + (porciones(a, PAN.id) ?? 0);
    expect(total).toBeLessThanOrEqual(4);
  });

  /*
   * EL NÚMERO QUE SE APUNTA ES EL DE LA FICHA QUE ESTÁ LEYENDO
   *
   * Es la invariante que importa: lo apuntado son los gramos que salen en la
   * ficha partidos por lo que pesa una porción. Antes salía de la casilla de la
   * comida, así que lo apuntado y lo que ella leía podían no tener nada que
   * ver.
   */
  it('lo apuntado son los gramos de la ficha, en porciones', () => {
    const pauta = { almidones: 2, lacteos_proteicos: 1 };
    const escalada = scaleRecipe(PLATO, pauta, FOODS);
    const a = aportesDeLaReceta(PLATO, pauta, FOODS);
    for (const ing of escalada.ingredientes) {
      const food = FOODS.find((f) => f.id === ing.foodId);
      if (!food?.gramos || food.grupo === 'verduras') continue;
      const suyas = porciones(a, food.id) ?? 0;
      expect(suyas).toBeCloseTo((ing.cantidad_final ?? 0) / food.gramos, 1);
    }
  });

  /*
   * El nº3, y el que ella veía: lo apuntado salía de `reparto[grupo]`, así que
   * una comida sin nada pautado de lo que lleva la receta daba una lista
   * vacía — se pulsaba «me lo he comido» y no pasaba nada. Ahora lo que manda
   * son los gramos de la ficha, y lo que tenga gramos se apunta.
   */
  it('lo que tiene gramos en la ficha se apunta', () => {
    const pauta = { almidones: 2, lacteos_proteicos: 1 };
    const escalada = scaleRecipe(PLATO, pauta, FOODS);
    const conGramos = escalada.ingredientes.filter(
      (i) => (i.cantidad_final ?? 0) > 0 && i.foodId && i.grupo !== 'verduras',
    );
    expect(aportesDeLaReceta(PLATO, pauta, FOODS)).toHaveLength(conGramos.length);
  });

  /* La verdura no gasta: apuntarla sería ensuciar la cuenta. */
  it('la verdura no se apunta', () => {
    const a = aportesDeLaReceta(PLATO, { almidones: 2, verduras: 1 }, FOODS);
    expect(porciones(a, LECHUGA.id)).toBeUndefined();
  });
});

/* ───────────────────────── Y cómo lo hace ella ──────────────────────────── */

const DIA: DayType = {
  id: 'dt',
  nombre: 'Base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 3 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 5 },
  ],
  grid: {
    desayuno: { almidones: 2, lacteos_proteicos: 1 },
    comida: { almidones: 3, proteicos_magros: 4 },
    cena: { almidones: 1, proteicos_magros: 3 },
  },
  notas: {},
} as DayType;

const PLAN = {
  id: 'p',
  clientId: 'c',
  fase: 3,
  dayTypes: [DIA],
  recetasAsignadas: { desayuno: [PLATO.id] },
} as unknown as Plan;

const pintar = () => {
  const onUsar = vi.fn();
  render(
    <BibliotecaDeRecetas
      plan={PLAN}
      dayType={DIA}
      recipes={[PLATO]}
      foods={FOODS}
      soyElCliente
      onUsar={onUsar}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Avena con yogur/ }));
  return onUsar;
};

describe('Al apuntársela', () => {
  it('primero pregunta en qué comida', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Me lo he comido' }));
    expect(screen.getByText('¿En qué comida?')).toBeTruthy();
    for (const n of ['Desayuno', 'Comida', 'Cena'])
      expect(screen.getByRole('button', { name: n })).toBeTruthy();
  });

  /* Lo más probable es la comida donde está listada: va elegida de entrada. */
  it('y de entrada la que su nutricionista le puso', () => {
    const onUsar = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Me lo he comido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, tal cual' }));
    expect(onUsar.mock.calls[0][0].id).toBe('desayuno');
  });

  /*
   * Pero puede ser otra: su nutricionista le pone la tortilla en la cena y
   * ella la come a mediodía.
   */
  it('puede elegir otra comida', () => {
    const onUsar = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Me lo he comido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cena' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, tal cual' }));
    expect(onUsar.mock.calls[0][0].id).toBe('cena');
  });

  it('pregunta si usó las cantidades tal cual', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Me lo he comido' }));
    expect(screen.getByText(/cantidades tal cual/)).toBeTruthy();
  });

  /* Si las cambió se apunta igual, pero se le dice que lo ajuste. */
  it('si las cambió, se apunta y se le dice que lo ajuste', () => {
    const onUsar = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Me lo he comido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Las cambié un poco' }));
    expect(onUsar).toHaveBeenCalled();
    expect(screen.getByText(/Ajústalas en «Hoy»/)).toBeTruthy();
  });

  it('y se puede cancelar', () => {
    const onUsar = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Me lo he comido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onUsar).not.toHaveBeenCalled();
    expect(screen.queryByText('¿En qué comida?')).toBeNull();
  });

  /* Quien pauta no se come nada: el botón es de quien come. */
  it('a la nutricionista no le sale el botón', () => {
    render(
      <BibliotecaDeRecetas
        plan={PLAN}
        dayType={DIA}
        recipes={[PLATO]}
        foods={FOODS}
        onUsar={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Me lo he comido' })).toBeNull();
  });
});
