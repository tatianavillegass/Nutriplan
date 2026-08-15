// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { MisComidas } from '../client/MisComidas';
import { useAppStore } from '../../store/useAppStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { claveFecha, registroVacio } from '../../types/diary';
import { diaAnterior } from '../../utils/racha';
import type { RegistroDia } from '../../types/diary';

afterEach(cleanup);

const HOY = claveFecha(new Date());
const AYER = diaAnterior(HOY);
const COMIDAS = DEMO_PLAN.dayTypes[0].meals;

const ayerDesayunando = (): RegistroDia => ({
  ...registroVacio(DEMO_CLIENT.id, AYER, 'r-ayer'),
  dayTypeId: DEMO_PLAN.dayTypes[0].id,
  bocados: [
    {
      id: 'b1',
      nombre: 'Copos de avena',
      cantidad: 60,
      unidad: 'g',
      macros: { proteina: 8, hc: 40, grasa: 4 },
      kcal: 228,
      momento: COMIDAS[0].id,
    },
  ],
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore.setState({
    clients: [DEMO_CLIENT],
    plans: [{ ...DEMO_PLAN, fase: 4 }],
    foods: FOOD_CATALOG,
    recipes: [],
    registros: [ayerDesayunando()],
    mediciones: [],
    recursos: [],
  });
});

const abrir = () =>
  render(
    <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}/vista`]}>
      <Routes>
        <Route path="/clientes/:id/vista" element={<ClientView />} />
      </Routes>
    </MemoryRouter>,
  );

const registroDeHoy = () =>
  useAppStore.getState().registros.find((r) => r.fecha === HOY);

/**
 * LO DE SIEMPRE, EN DOS TOQUES
 *
 * Volver a apuntar cinco alimentos con sus gramos cada mañana es el trabajo
 * que hace que la gente abandone los contadores, y no enseña nada: ya sabe lo
 * que desayuna.
 */
describe('Repetir la comida de otro día', () => {
  it('se ofrece en la comida en la que comió eso, diciendo de cuándo es', () => {
    abrir();
    expect(screen.getByText(/Repetir el de ayer/i)).toBeTruthy();
  });

  it('y al pulsarlo entra tal cual en el día de hoy', () => {
    abrir();
    fireEvent.click(screen.getByText(/Repetir el de ayer/i));

    const hoy = registroDeHoy();
    expect(hoy?.bocados).toHaveLength(1);
    expect(hoy?.bocados?.[0].nombre).toBe('Copos de avena');
    expect(hoy?.bocados?.[0].momento).toBe(COMIDAS[0].id);
    // Id nuevo: quitarlo hoy no puede borrar el de ayer.
    expect(hoy?.bocados?.[0].id).not.toBe('b1');
  });

  it('y entonces esa comida ya se puede guardar con nombre', () => {
    abrir();
    fireEvent.click(screen.getByText(/Repetir el de ayer/i));
    fireEvent.click(screen.getAllByText('Guardar esta comida')[0]);
    fireEvent.change(screen.getByPlaceholderText(/de siempre/i), {
      target: { value: 'Pancakes de avena' },
    });
    fireEvent.click(screen.getByText('Guardar'));

    const guardadas = registroDeHoy()?.comidasGuardadas ?? [];
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0].nombre).toBe('Pancakes de avena');
    expect(guardadas[0].mealId).toBe(COMIDAS[0].id);
  });

  /** Sin nada apuntado en esa comida no hay nada que guardar. */
  it('no se puede guardar una comida vacía', () => {
    abrir();
    expect(screen.queryByText('Guardar esta comida')).toBeNull();
  });
});

describe('La barra de atajos', () => {
  it('no ocupa sitio cuando no hay nada que ofrecer', () => {
    const { container } = render(<MisComidas mealNombre="Cena" guardadas={[]} />);
    expect(container.textContent).toBe('');
  });

  it('una comida guardada se usa de un toque y se puede olvidar', () => {
    const onUsar = vi.fn();
    const onBorrar = vi.fn();
    render(
      <MisComidas
        mealNombre="Desayuno"
        guardadas={[{ id: 'c1', nombre: 'Pancakes de avena', onUsar, onBorrar }]}
      />,
    );
    fireEvent.click(screen.getByText('Pancakes de avena'));
    expect(onUsar).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Olvidar Pancakes de avena'));
    expect(onBorrar).toHaveBeenCalled();
  });

  it('sin nombre no se guarda nada', () => {
    const onGuardar = vi.fn();
    render(<MisComidas mealNombre="Cena" guardadas={[]} onGuardar={onGuardar} />);
    fireEvent.click(screen.getByText('Guardar esta comida'));
    fireEvent.click(screen.getByText('Guardar'));
    expect(onGuardar).not.toHaveBeenCalled();
  });
});
