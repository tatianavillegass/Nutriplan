// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FoodPortionPicker } from '../phase3/FoodPortionPicker';
import { avisoGrasaExtra, grasaExtra } from '../../utils/similitud';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Meal } from '../../types/plan';

afterEach(cleanup);

const DESAYUNO: Meal = { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 };
const CENA: Meal = { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 2 };

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [DESAYUNO, CENA],
  grid: {
    desayuno: { proteicos_magros: 2, fruta: 1, almidones: 1, grasas: 1 },
    cena: { proteicos_grasos: 2, almidones: 2, grasas: 1 },
  },
  despensa: {
    desayuno: {
      seleccion: [
        'a-huevo',
        'a-queso-cottage',
        'a-yogur-proteinas-mercadona',
        'a-avena-copos',
        'a-platano',
        'a-aceite-de-oliva-virgen-extra',
      ],
    },
  },
  notas: {},
};

const pintar = (porciones = {}) =>
  render(
    <FoodPortionPicker
      dayType={DIA}
      meal={DESAYUNO}
      foods={FOOD_CATALOG}
      porciones={porciones}
      onMarcar={() => {}}
    />,
  );

describe('El cliente ve en qué grupo está cada alimento', () => {
  it('los alimentos van bajo la cabecera de su subgrupo', () => {
    pintar();
    expect(screen.getAllByText('Proteicos magros').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Proteicos grasos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lácteos proteicos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Almidones').length).toBeGreaterThan(0);
  });

  it('y se marcan ahí mismo, sin salir de la lista', () => {
    pintar();
    const cottage = screen.getByText(/Queso cottage/).closest('button')!;
    expect(cottage).toBeTruthy();
    expect(cottage.tagName).toBe('BUTTON');
  });

  it('la fruta sigue siendo un genérico con buscador', () => {
    pintar();
    expect(screen.getByText(/la que quieras/)).toBeTruthy();
  });
});

describe('Pasarse de proteína magra no genera aviso', () => {
  it('marcar 5 magros donde había 2 no dice nada', () => {
    pintar({ desayuno: { 'a-queso-cottage': 5 } });
    expect(screen.queryByText(/Te has pasado/)).toBeNull();
    expect(screen.queryByText(/te quedan/i)).toBeNull();
    expect(screen.queryByText(/g de grasa de proteicos/)).toBeNull();
  });

  it('el contador sí refleja lo que lleva', () => {
    pintar({ desayuno: { 'a-queso-cottage': 5 } });
    expect(document.body.textContent?.replace(/\s+/g, '')).toContain('5/2');
  });

  it('pero pasarse de grasos sí avisa, porque son las kcal', () => {
    // El día pauta 0.5 + 0.5 + 5 + 5 = 11 g de grasa de proteicos.
    pintar({ desayuno: { 'a-huevo': 4 }, cena: { 'a-huevo': 2 } });
    expect(screen.getByText(/g de grasa de proteicos/)).toBeTruthy();
  });
});

describe('Quesos con más grasa de la que dice su grupo', () => {
  const buscar = (n: string) => FOOD_CATALOG.find((f) => f.nombre === n)!;

  it('el parmesano encaja en proteicos grasos y no se marca', () => {
    // 6.2 g de grasa por cada 7 g de proteína, frente a los 5 del grupo.
    expect(avisoGrasaExtra(buscar('Queso parmesano'))).toBeUndefined();
  });

  it('el feta y el cheddar traen casi el doble y se avisa', () => {
    for (const n of ['Queso feta', 'Queso cheddar', 'Queso curado 40% MG']) {
      const extra = grasaExtra(buscar(n));
      expect(extra, n).toBeGreaterThan(3);
      expect(avisoGrasaExtra(buscar(n)), n).toMatch(/g de grasa/);
    }
  });

  it('el pollo y la clara no llevan ningún aviso', () => {
    expect(avisoGrasaExtra(buscar('Pechuga de pollo cruda'))).toBeUndefined();
    expect(avisoGrasaExtra(buscar('Clara de huevo'))).toBeUndefined();
  });

  it('el aceite tampoco: es exactamente lo que dice su grupo', () => {
    expect(avisoGrasaExtra(buscar('Aceite de oliva virgen extra'))).toBeUndefined();
  });
});
