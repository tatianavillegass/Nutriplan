// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoQueVaSiempre } from '../planning/LoQueVaSiempre';
import { ClientView } from '../../pages/ClientView';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Fijo, Plan } from '../../types/plan';

afterEach(cleanup);

/**
 * LO QUE VA SIEMPRE, Y EL POSTRE
 *
 * El café con leche del desayuno y el cuadrito de chocolate de después de
 * cenar había que meterlos opción por opción: cinco desayunos, cinco cafés.
 * Ahora se ponen una vez en la comida, van con todas sus opciones y gastan de
 * lo pautado.
 */

const leche = FOOD_CATALOG.find((f) => f.nombre === 'Leche semidesnatada')!;

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 2 },
  ],
  grid: {
    desayuno: { lacteos_semi: 1, almidones: 2 },
    cena: { proteicos_magros: 3, grasas: 2 },
  },
  notas: {},
};

describe('Ponerlo, en la pantalla de la nutricionista', () => {
  it('se añade a una comida desde el buscador', () => {
    const onChange = vi.fn();
    render(<LoQueVaSiempre dayType={DIA} foods={FOOD_CATALOG} onChange={onChange} />);
    expect(screen.getByPlaceholderText(/Añadir algo fijo a desayuno/i)).toBeTruthy();
  });

  it('dice lo que se lleva de lo pautado', () => {
    const cafe: Fijo = {
      id: 'f1',
      foodId: leche.id,
      nombre: 'Café con leche',
      // Media porción de leche.
      gramos: Math.round(leche.gramos / 2),
      unidad: 'ml',
    };
    render(
      <LoQueVaSiempre
        dayType={{ ...DIA, fijos: { desayuno: [cafe] } }}
        foods={FOOD_CATALOG}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/se lleva/)).toBeTruthy();
    expect(screen.getByText(/lácteos semi/i)).toBeTruthy();
  });

  /*
   * Quitárselo a otra comida sería mover su pauta sin que lo vea: se avisa y
   * ella decide.
   */
  it('y avisa de lo que no está pautado ahí', () => {
    const cafe: Fijo = {
      id: 'f1',
      foodId: leche.id,
      nombre: 'Café con leche',
      gramos: leche.gramos,
      unidad: 'ml',
    };
    render(
      <LoQueVaSiempre
        dayType={{ ...DIA, fijos: { cena: [cafe] } }}
        foods={FOOD_CATALOG}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/no tienes pautado/i)).toBeTruthy();
  });

  /** Sin días marcados va siempre; marcar dos lo convierte en el postre. */
  it('los días se marcan, y sin marcar ninguno va todos', () => {
    const onChange = vi.fn();
    const cafe: Fijo = { id: 'f1', foodId: leche.id, nombre: 'Café', gramos: 100 };
    render(
      <LoQueVaSiempre
        dayType={{ ...DIA, fijos: { desayuno: [cafe] } }}
        foods={FOOD_CATALOG}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('todos los días')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Café el lunes'));
    // Al quitar el lunes de «todos», quedan los otros seis.
    expect(onChange.mock.calls[0][0].desayuno[0].dias).toEqual([0]);
  });
});

/**
 * Y lo que importa: que llegue a su pantalla y que las opciones se escalen
 * con lo que queda.
 */
describe('En la app de la clienta', () => {
  const cafe: Fijo = {
    id: 'f1',
    foodId: leche.id,
    nombre: 'Café con leche',
    gramos: Math.round(leche.gramos / 2),
    unidad: 'ml',
  };

  const conFijo = (fijos: Record<string, Fijo[]>): Plan =>
    ({
      ...DEMO_PLAN,
      dayTypes: DEMO_PLAN.dayTypes.map((d, i) =>
        i === 0 ? { ...d, fijos } : d,
      ),
    }) as Plan;

  const primeraComida = DEMO_PLAN.dayTypes[0].meals[0];

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    useAppStore.setState({
      clients: [DEMO_CLIENT],
      plans: [conFijo({ [primeraComida.id]: [cafe] })],
      foods: FOOD_CATALOG,
      recipes: [],
      registros: [],
      mediciones: [],
      recursos: [],
    });
    useAuthStore.setState({
      perfil: { rol: 'cliente', clientId: DEMO_CLIENT.id } as never,
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

  it('sale con la comida, sin que ella lo elija', () => {
    abrir();
    expect(screen.getByText('Café con leche')).toBeTruthy();
  });

  /*
   * Sin esta línea, quien lleva la cuenta de sus porciones se pregunta si el
   * café va «encima» del plan.
   */
  it('y se le dice que ya está contado', () => {
    abrir();
    expect(screen.getByText(/Ya está contado/i)).toBeTruthy();
  });

  it('sin fijos no aparece nada', () => {
    useAppStore.setState({ plans: [DEMO_PLAN] });
    abrir();
    expect(screen.queryByText(/Ya está contado/i)).toBeNull();
  });
});
