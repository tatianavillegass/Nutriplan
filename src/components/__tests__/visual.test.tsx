// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { PortionRing, estadoDePorciones } from '../common/PortionRing';
import { DayProgressBar } from '../client/DayProgressBar';
import { FoodPortionPicker } from '../phase3/FoodPortionPicker';
import { AuthPage } from '../../pages/AuthPage';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { guardarCuentas, hashear } from '../../utils/auth';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Meal } from '../../types/plan';

afterEach(cleanup);

const DESAYUNO: Meal = { id: 'm1', nombre: 'Desayuno', slot: 'desayuno', orden: 1 };
const COMIDA: Meal = { id: 'm2', nombre: 'Comida', slot: 'comida', orden: 2 };

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [DESAYUNO, COMIDA],
  grid: {
    m1: { proteicos_magros: 2, proteicos_grasos: 1, almidones: 2, grasas: 1 },
    m2: { proteicos_magros: 3, almidones: 2 },
  },
  despensa: { m1: { seleccion: ['a-huevo', 'a-queso-cottage', 'a-avena-copos', 'a-aceite-de-oliva-virgen-extra'] } },
  notas: {},
};

describe('Anillo de porciones', () => {
  it('pendiente, completo o excedido según lo elegido', () => {
    expect(estadoDePorciones(0, 3)).toBe('pendiente');
    expect(estadoDePorciones(2, 3)).toBe('pendiente');
    expect(estadoDePorciones(3, 3)).toBe('completo');
    expect(estadoDePorciones(4, 3)).toBe('excedido');
  });

  it('enseña las porciones en grande', () => {
    render(<PortionRing titulo="Proteína" elegido={2} pautado={3} />);
    expect(screen.getByText('Proteína')).toBeTruthy();
    expect(screen.getByText('porciones')).toBeTruthy();
    expect(document.body.textContent?.replace(/\s+/g, '')).toContain('2/3');
  });

  it('sin nada pautado no dibuja progreso', () => {
    const { container } = render(<PortionRing titulo="Grasa" elegido={0} pautado={0} />);
    // Sólo la pista de fondo, sin arco de progreso.
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });

  it('con porciones elegidas dibuja el arco', () => {
    const { container } = render(<PortionRing titulo="Grasa" elegido={1} pautado={2} />);
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });
});

describe('Fase 3 con anillos', () => {
  it('cada macro tiene su anillo con las porciones', () => {
    render(
      <FoodPortionPicker
        dayType={DIA}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        porciones={{}}
        onMarcar={() => {}}
      />,
    );
    expect(screen.getByText('Proteína')).toBeTruthy();
    expect(screen.getByText('Carbohidrato')).toBeTruthy();
    expect(screen.getByText('Grasa')).toBeTruthy();
    expect(screen.getAllByText('porciones').length).toBe(3);
  });

  it('los subgrupos siguen visibles bajo el anillo', () => {
    render(
      <FoodPortionPicker
        dayType={DIA}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        porciones={{}}
        onMarcar={() => {}}
      />,
    );
    // La proteína del desayuno lleva magros y grasos: dos barras.
    expect(screen.getAllByText('Proteicos magros').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Proteicos grasos').length).toBeGreaterThan(0);
  });

  it('lo elegido se ve en grande, con sus gramos y sus botones', () => {
    render(
      <FoodPortionPicker
        dayType={DIA}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        porciones={{ m1: { 'a-queso-cottage': 2 } }}
        onMarcar={() => {}}
      />,
    );
    const tarjeta = screen.getAllByText('Queso cottage')[0].closest('li')!;
    expect(within(tarjeta).getAllByText(/100 g/).length).toBeGreaterThan(0);
    expect(within(tarjeta).getByLabelText(/Añadir una porción/)).toBeTruthy();
    expect(within(tarjeta).getByLabelText(/Quitar una porción/)).toBeTruthy();
  });

  it('el anillo refleja lo marcado', () => {
    render(
      <FoodPortionPicker
        dayType={DIA}
        meal={DESAYUNO}
        foods={FOOD_CATALOG}
        porciones={{ m1: { 'a-queso-cottage': 2 } }}
        onMarcar={() => {}}
      />,
    );
    expect(document.body.textContent?.replace(/\s+/g, '')).toContain('2/3');
  });
});

describe('Barra del día', () => {
  it('marca cada comida como pendiente, elegida o hecha', () => {
    render(
      <DayProgressBar
        dayType={DIA}
        porciones={{ m1: { 'a-huevo': 1 } }}
        cumplidas={['m2']}
      />,
    );
    const desayuno = screen.getByText('Desayuno').closest('button')!;
    const comida = screen.getByText('Comida').closest('button')!;
    expect(within(desayuno).getByText('elegida')).toBeTruthy();
    expect(within(comida).getByText('✓ hecha')).toBeTruthy();
  });

  it('resume cuántas van hechas', () => {
    render(<DayProgressBar dayType={DIA} porciones={{}} cumplidas={['m1']} />);
    expect(screen.getByText(/1 de 2 comidas hechas/)).toBeTruthy();
  });

  it('pulsar una comida avisa de a cuál ir', () => {
    const onIr = vi.fn();
    render(<DayProgressBar dayType={DIA} porciones={{}} cumplidas={[]} onIr={onIr} />);
    fireEvent.click(screen.getByText('Comida'));
    expect(onIr).toHaveBeenCalledWith('m2');
  });

  it('sin nada marcado todas salen pendientes', () => {
    render(<DayProgressBar dayType={DIA} porciones={{}} cumplidas={[]} />);
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});

describe('Se me olvidó la contraseña', () => {
  beforeEach(() => {
    localStorage.clear();
    const cuentas = [
      {
        id: 'cu2',
        email: 'vanessa@correo.com',
        nombre: 'Vanessa',
        rol: 'cliente' as const,
        clientId: 'c1',
        hash: hashear('vieja12345'),
        createdAt: '2026-01-01',
      },
    ];
    guardarCuentas(cuentas);
    useAuthStore.setState({ cuentas, sesion: null });
    useAppStore.setState({
      clients: [
        {
          id: 'c1',
          nombre: 'Vanessa',
          fechaNacimiento: '1991-03-15',
          edad: 35,
          peso: 68,
          altura: 170,
          sexo: 'mujer',
          activityFactorId: 'moderado',
          objetivo: 'mantenimiento',
          goalMultiplier: 1,
          bmrFormula: 'media',
          alergias: [],
          preferencias: [],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
    });
  });

  const abrirOlvido = () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Se me olvidó la contraseña'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'vanessa@correo.com' } });
  };

  it('con la fecha correcta puede poner una contraseña nueva y entra', async () => {
    abrirOlvido();
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), {
      target: { value: '1991-03-15' },
    });
    fireEvent.change(screen.getByLabelText(/Elige una contraseña/), {
      target: { value: 'nueva12345' },
    });
    fireEvent.click(screen.getByText('Guardar y entrar'));
    await waitFor(() => expect(useAuthStore.getState().sesion?.rol).toBe('cliente'));
  });

  it('con la fecha equivocada no cambia nada', async () => {
    abrirOlvido();
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), {
      target: { value: '1990-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/Elige una contraseña/), {
      target: { value: 'nueva12345' },
    });
    fireEvent.click(screen.getByText('Guardar y entrar'));
    expect(await screen.findByText(/no coinciden/)).toBeTruthy();
    expect(useAuthStore.getState().sesion).toBeNull();
  });

  it('si la ficha no tiene fecha, lo dice en vez de dejarla colgada', async () => {
    useAppStore.setState({
      clients: useAppStore.getState().clients.map((c) => ({ ...c, fechaNacimiento: undefined })),
    });
    abrirOlvido();
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), {
      target: { value: '1991-03-15' },
    });
    fireEvent.change(screen.getByLabelText(/Elige una contraseña/), {
      target: { value: 'nueva12345' },
    });
    fireEvent.click(screen.getByText('Guardar y entrar'));
    expect(await screen.findByText(/no tiene fecha de nacimiento/)).toBeTruthy();
  });

  it('se puede volver a la pantalla de entrar', () => {
    abrirOlvido();
    fireEvent.click(screen.getByText('← Volver'));
    expect(screen.getByText('Entra en NutriPlan')).toBeTruthy();
  });
});
