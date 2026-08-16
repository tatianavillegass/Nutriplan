// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { CalorieCalculator } from '../common/CalorieCalculator';
import { useAppStore } from '../../store/useAppStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { claveFecha } from '../../types/diary';
import type { Client } from '../../types/client';
import type { Receta } from '../../types/recipe';
import type { Reto } from '../../types/reto';

afterEach(cleanup);

const HOY = claveFecha(new Date());
const COMIDAS = DEMO_PLAN.dayTypes[0].meals;

const RECETA_DEL_RETO: Receta = {
  id: 'rc-reto',
  nombre: 'Tortitas del reto',
  categorias: [COMIDAS[0].slot],
  tags: [],
  base: { almidones: 2, proteicos_magros: 2 },
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const RETO: Reto = {
  id: 'rt1',
  nombre: 'UPGRADE 1.0',
  fechaInicio: HOY,
  dias: 30,
  participantes: [DEMO_CLIENT.id],
  recursos: [],
  recetas: [{ recetaId: 'rc-reto', slot: COMIDAS[0].slot, desdeDia: 1 }],
  createdAt: '2026-08-01',
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore.setState({
    clients: [DEMO_CLIENT],
    plans: [{ ...DEMO_PLAN, fase: 1 }],
    foods: FOOD_CATALOG,
    recipes: [RECETA_DEL_RETO],
    registros: [],
    mediciones: [],
    recursos: [],
    retos: [RETO],
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

/**
 * EN UN RETO LAS RECETAS SON DEL GRUPO
 *
 * Se eligen una vez en la pantalla del reto y se abren solas en la comida que
 * les toca. Hacerlas asignar además en cada ficha sería repetir veinte veces
 * el mismo trabajo, que es justo lo que un reto viene a evitar.
 */
describe('Las recetas del reto llegan solas a su día', () => {
  it('sin haberlas asignado en su ficha', () => {
    // Se le quitan las que tuviera puestas a mano: sólo quedan las del reto.
    const dia = { ...DEMO_PLAN.dayTypes[0], recetasAsignadas: {} };
    useAppStore.setState({
      plans: [{ ...DEMO_PLAN, fase: 1, dayTypes: [dia] }],
    });
    abrir();
    expect(screen.getAllByText(/Tortitas del reto/).length).toBeGreaterThan(0);
  });

  it('y las de un reto que aún no ha empezado, no', () => {
    useAppStore.setState({ retos: [{ ...RETO, fechaInicio: '2099-01-01' }] });
    abrir();
    expect(screen.queryByText(/Tortitas del reto/)).toBeNull();
  });
});

/**
 * El cálculo ya usaba la edad de verdad, pero la casilla enseñaba el número
 * suelto de la ficha: en quien se apuntó por el enlace —que da su fecha de
 * nacimiento y no su edad— ponía 0 y parecía que el GET estaba mal.
 */
describe('La edad del cálculo GET', () => {
  const conFecha = (fechaNacimiento?: string): Client =>
    ({ ...DEMO_CLIENT, edad: 0, fechaNacimiento }) as Client;

  it('sale de su fecha de nacimiento y no se puede escribir', () => {
    render(<CalorieCalculator client={conFecha('1992-03-15')} onChange={vi.fn()} />);
    const edad = screen.getByLabelText(/Edad/) as HTMLInputElement;
    expect(Number(edad.value)).toBeGreaterThan(30);
    expect(edad.disabled).toBe(true);
  });

  it('y sin fecha se sigue escribiendo a mano', () => {
    render(<CalorieCalculator client={{ ...conFecha(), edad: 41 }} onChange={vi.fn()} />);
    const edad = screen.getByLabelText(/Edad/) as HTMLInputElement;
    expect(edad.value).toBe('41');
    expect(edad.disabled).toBe(false);
  });
});
