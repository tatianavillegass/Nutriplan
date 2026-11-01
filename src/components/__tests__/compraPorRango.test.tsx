// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { OrganizaTuSemana } from '../client/OrganizaTuSemana';
import {
  diasDeLaSemana,
  lunesDe,
  masDias,
  menuDelRango,
  ponerEnDias,
  menuVacio,
} from '../../utils/menuSemana';
import type { Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { RegistroDia } from '../../types/diary';
import type { Alimento } from '../../types/food';

afterEach(cleanup);

/**
 * DE CUÁNDO A CUÁNDO COMPRA
 *
 * «Quiero comprar para 2 semanas, o para 2 días, o elegir la fecha de cuándo a
 * cuándo.» Antes la lista era la de lunes a domingo y punto.
 */

const POLLO: Alimento = {
  id: 'a-pollo',
  nombre: 'Pollo',
  grupo: 'proteicos_magros',
  medida_casera: '30 g',
  gramos: 30,
  intercambios: 1,
  nutrientes: { kcal: 165, hc: 0, proteina: 23, grasa: 2 },
  comidas_sugeridas: [],
  alergenos: [],
  apto: [],
};

const PLATO: Receta = {
  id: 'rc',
  nombre: 'Pollo al horno',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_magros: 1 },
  ingredientes: [
    {
      id: 'i1',
      nombre: 'Pollo',
      foodId: POLLO.id,
      cantidad_base: 30,
      unidad: 'g',
      grupo: 'proteicos_magros',
      escalable: true,
      opcional: false,
    },
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
} as Receta;

const PLAN = {
  id: 'p',
  clientId: 'c',
  fase: 1,
  dayTypes: [
    {
      id: 'dt',
      nombre: 'Base',
      meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
      grid: { comida: { proteicos_magros: 4 } },
      notas: {},
    },
  ],
} as unknown as Plan;

const LUNES = lunesDe('2026-11-04');
const MIERCOLES = diasDeLaSemana(LUNES)[2];

/* Toda la semana con el mismo plato, que es lo que hace la cuenta fácil. */
const MENU = ponerEnDias(menuVacio(LUNES), 'comida', PLATO.id, diasDeLaSemana(LUNES));
const REGISTROS = [
  { id: 'r', clientId: 'c', fecha: LUNES, menuSemana: MENU } as unknown as RegistroDia,
];

const pintar = (hoy = LUNES) =>
  render(
    <OrganizaTuSemana
      solo="compra"
      menu={MENU}
      plan={PLAN}
      comidas={[{ meal: { id: 'comida', nombre: 'Comida' }, opciones: [PLATO] }]}
      recetas={[PLATO]}
      foods={[POLLO]}
      onCambiar={vi.fn()}
      rango={(desde, hasta, repetir) =>
        menuDelRango(undefined, REGISTROS, desde, hasta, repetir)
      }
      hoy={hoy}
    />,
  );

describe('El selector', () => {
  it('sale en la pestaña de la compra', () => {
    pintar();
    expect(screen.getByText('Para cuántos días')).toBeTruthy();
    for (const t of ['2 días', '1 semana', '2 semanas', 'Elegir fechas'])
      expect(screen.getByRole('button', { name: t })).toBeTruthy();
  });

  /* Sin tocar nada, la semana de siempre: nadie pierde lo que ya tenía. */
  it('arranca en la semana entera', () => {
    pintar();
    expect(screen.getByText(/Para las 7 comidas de 7 días/)).toBeTruthy();
  });

  it('«2 días» deja la lista en dos', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: '2 días' }));
    expect(screen.getByText(/Para las 2 comidas de 2 días/)).toBeTruthy();
  });

  /*
   * Lo que se pedía: el doble de días, el doble de pollo. Y la semana que
   * viene no está organizada, así que se repite ésta.
   */
  it('«2 semanas» compra el doble', () => {
    pintar();
    const pollo = () => screen.getByText(/Pollo/).closest('button')!.textContent!;
    const semana = pollo();
    fireEvent.click(screen.getByRole('button', { name: '2 semanas' }));
    expect(screen.getByText(/Para las 14 comidas de 14 días/)).toBeTruthy();
    expect(pollo()).not.toBe(semana);
  });

  /* Y se dice que se ha repetido: rellenar en silencio es inventar la compra. */
  it('y dice cuántos días ha repetido', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: '2 semanas' }));
    expect(screen.getByText(/ahora mismo son 7 días/)).toBeTruthy();
  });

  it('se puede quitar la repetición', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: '2 semanas' }));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText(/Para las 7 comidas de 14 días/)).toBeTruthy();
    expect(screen.getByText(/7 días sin menú/)).toBeTruthy();
  });

  /* Los atajos arrancan hoy: «para dos días» es hoy y mañana. */
  it('los atajos cuentan desde el día que está viendo', () => {
    pintar(MIERCOLES);
    fireEvent.click(screen.getByRole('button', { name: '3 días' }));
    expect(screen.getByText(/del miércoles al viernes/)).toBeTruthy();
  });

  it('y las fechas se pueden poner a mano', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir fechas' }));
    fireEvent.change(screen.getByLabelText('Comprar hasta'), {
      target: { value: masDias(LUNES, 2) },
    });
    expect(screen.getByText(/Para las 3 comidas de 3 días/)).toBeTruthy();
  });
});
