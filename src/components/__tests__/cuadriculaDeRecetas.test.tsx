// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { RecipeRecommender } from '../phase1/RecipeRecommender';
import type { Receta } from '../../types/recipe';
import type { Client } from '../../types/client';
import type { DayType, Meal } from '../../types/plan';

afterEach(cleanup);

const CENA: Meal = { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 5 };

const DIA = {
  id: 'dt',
  nombre: 'Día base',
  meals: [CENA],
  grid: { cena: { almidones: 2, proteicos_magros: 3, grasas: 1 } },
  notas: {},
} as unknown as DayType;

const CLIENTA = { id: 'c1', nombre: 'Ana García', preferencias: [] } as unknown as Client;

const receta = (
  id: string,
  nombre: string,
  base: Record<string, number>,
  extra: Partial<Receta> = {},
): Receta =>
  ({
    id,
    nombre,
    categorias: ['cena'],
    tags: [],
    base,
    ingredientes: [],
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
    ...extra,
  }) as unknown as Receta;

/** Cubre los tres macros pautados. */
const EXACTA = receta('r1', 'Salmón con patata y aceite', {
  almidones: 2,
  proteicos_magros: 3,
  grasas: 1,
});
/** Le falta la grasa. */
const A_MEDIAS = receta('r2', 'Pollo con arroz', { almidones: 2, proteicos_magros: 3 });

const pintar = (recetas: Receta[], seleccionadas: string[] = [], onToggle = vi.fn()) => {
  const r = render(
    <RecipeRecommender
      dayType={DIA}
      meal={CENA}
      recetas={recetas}
      client={CLIENTA}
      seleccionadas={seleccionadas}
      yaAsignadas={[]}
      onToggle={onToggle}
    />,
  );
  return { ...r, onToggle };
};

/**
 * ELEGIR MIRANDO, NO LEYENDO
 *
 * Antes se enseñaban ocho tarjetas y, si lo que querías no estaba, una lista de
 * nombres sin foto. Con doscientas recetas en el banco eso es casi siempre.
 */
describe('La cuadrícula', () => {
  it('enseña las recetas con su foto', () => {
    const { container } = pintar([receta('r1', 'Bowl', { almidones: 2 }, { foto_url: 'x.jpg' })]);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('x.jpg');
  });

  /** Sin foto, el hueco se queda: si no, las filas bailan y se pierde la pista. */
  it('y las que no tienen foto dejan el hueco igual', () => {
    const { container } = pintar([A_MEDIAS]);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('🍽')).toBeTruthy();
  });

  it('las que mejor cuadran salen primero', () => {
    const { container } = pintar([A_MEDIAS, EXACTA]);
    const nombres = [...container.querySelectorAll('button[aria-pressed]')].map(
      (b) => b.textContent ?? '',
    );
    expect(nombres[0]).toContain('Salmón');
  });

  /**
   * Un porcentaje no dice si lo que falla es la proteína o el hidrato. Con
   * «falta grasa» ya sabes que le pones un yogur al lado.
   */
  it('dice qué cubre y qué le falta, no un porcentaje', () => {
    pintar([A_MEDIAS]);
    expect(screen.getByText(/Cubre 2 de 3/)).toBeTruthy();
    expect(screen.getByText(/falta grasas/)).toBeTruthy();
  });

  it('y marca como exacta la que lo cubre todo', () => {
    pintar([EXACTA]);
    expect(screen.getByText('exacta')).toBeTruthy();
    expect(screen.getByText(/Cubre 3 de 3/)).toBeTruthy();
  });

  it('al pulsarla la asigna', () => {
    const { onToggle } = pintar([EXACTA]);
    fireEvent.click(screen.getByText('Salmón con patata y aceite'));
    expect(onToggle).toHaveBeenCalledWith('r1');
  });
});

describe('Ver todas', () => {
  const muchas = Array.from({ length: 20 }, (_, i) =>
    receta(`r${i}`, `Receta ${i}`, { almidones: 2, proteicos_magros: 3 }),
  );

  it('empieza por un puñado y se van pidiendo más', () => {
    pintar(muchas);
    expect(screen.getAllByText(/^Receta \d+$/).length).toBe(12);
    fireEvent.click(screen.getByText(/Ver más recetas/));
    expect(screen.getAllByText(/^Receta \d+$/).length).toBe(20);
  });

  /** Con todo en pantalla no hay nada más que pedir. */
  it('y el botón desaparece cuando ya están todas', () => {
    pintar(muchas.slice(0, 5));
    expect(screen.queryByText(/Ver más recetas/)).toBeNull();
  });

  /**
   * La comida sigue filtrando —un café de desayuno no es una cena— pero se
   * puede abrir a mano cuando una receta está mal categorizada.
   */
  it('las de otras comidas se abren con un botón', () => {
    const desayuno = receta('d1', 'Porridge', { almidones: 2 }, { categorias: ['desayuno'] });
    pintar([EXACTA, desayuno]);
    expect(screen.queryByText('Porridge')).toBeNull();
    fireEvent.click(screen.getByText(/Ver también las de otras comidas/));
    expect(screen.getByText('Porridge')).toBeTruthy();
  });
});

describe('Buscar', () => {
  const conSalmon = receta('s1', 'Bowl de primavera', { proteicos_magros: 3 }, {
    ingredientes: [{ id: 'i1', nombre: 'Salmón', cantidad_base: 100, unidad: 'g' }],
  } as Partial<Receta>);

  const buscar = (q: string) =>
    fireEvent.change(screen.getByPlaceholderText(/Busca por nombre o por ingrediente/), {
      target: { value: q },
    });

  it('por ingrediente, aunque el nombre no lo diga', () => {
    pintar([EXACTA, conSalmon]);
    buscar('salmon');
    expect(screen.getByText('Bowl de primavera')).toBeTruthy();
  });

  /** Si no, aparece un bizcocho al buscar «huevo» y parece un fallo. */
  it('y dice por qué salió esa receta', () => {
    pintar([conSalmon]);
    buscar('salmon');
    expect(screen.getByText('lleva salmón')).toBeTruthy();
  });

  /** Si escribes el nombre, la quieres: esté en la comida que esté. */
  it('se salta el filtro de comida', () => {
    const desayuno = receta('d1', 'Porridge', { almidones: 2 }, { categorias: ['desayuno'] });
    pintar([EXACTA, desayuno]);
    buscar('porridge');
    expect(screen.getByText('Porridge')).toBeTruthy();
  });

  it('y lo dice cuando no hay nada', () => {
    pintar([EXACTA]);
    buscar('zzz');
    expect(screen.getByText(/Nada en el banco con eso/)).toBeTruthy();
  });
});
