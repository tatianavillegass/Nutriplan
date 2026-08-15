// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { RetosPage } from '../../pages/RetosPage';
import { useAppStore } from '../../store/useAppStore';
import type { Reto } from '../../types/reto';
import type { Client } from '../../types/client';

afterEach(cleanup);

const CLIENTA = (id: string, nombre: string) =>
  ({ id, nombre, email: `${id}@ejemplo.com` }) as unknown as Client;

const RETO: Reto = {
  id: 'rt1',
  nombre: 'UPGRADE 1.0',
  descripcion: '30 días para ordenar la comida',
  fechaInicio: '2026-09-01',
  dias: 30,
  participantes: ['cl1'],
  recursos: [],
  recetas: [{ recetaId: 'rc1', slot: 'desayuno', desdeDia: 1 }],
  createdAt: '2026-08-01',
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore.setState({
    retos: [RETO],
    clients: [CLIENTA('cl1', 'Catalina'), CLIENTA('cl2', 'Jaia')],
    recipes: [
      { id: 'rc1', nombre: 'Porridge de avena', categorias: ['desayuno'] },
      { id: 'rc2', nombre: 'Pollo al horno', categorias: ['comida', 'cena'] },
    ] as never,
    recursos: [{ id: 'rs1', titulo: 'Guía de raciones', orden: 0, createdAt: '' }],
  });
});

/**
 * LA PANTALLA DE RETOS
 *
 * Un reto es un grupo que empieza el mismo día. Lo que se comparte es el banco
 * de recetas y los recursos; las porciones siguen siendo de cada una.
 */
describe('Ver los retos', () => {
  it('sale con sus fechas y cuánta gente hay', () => {
    render(<RetosPage />);
    expect(screen.getByText('UPGRADE 1.0')).toBeTruthy();
    expect(screen.getByText(/1 participante/)).toBeTruthy();
  });

  it('se despliega para trabajar en él', () => {
    render(<RetosPage />);
    expect(screen.queryByText('Participantes')).toBeNull();
    fireEvent.click(screen.getByText('UPGRADE 1.0'));
    expect(screen.getByText('Participantes')).toBeTruthy();
    expect(screen.getByText('Recetas del reto')).toBeTruthy();
    expect(screen.getByText('Recursos del reto')).toBeTruthy();
  });
});

describe('Apuntar gente al reto', () => {
  it('salen todas las clientas, marcadas las que ya están', () => {
    render(<RetosPage />);
    fireEvent.click(screen.getByText('UPGRADE 1.0'));
    const cajas = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // Las dos clientas más el recurso.
    expect(cajas.length).toBeGreaterThanOrEqual(3);
    expect(cajas[0].checked).toBe(true); // Catalina, ya apuntada
    expect(cajas[1].checked).toBe(false); // Jaia
  });

  it('marcar a alguien la apunta', () => {
    render(<RetosPage />);
    fireEvent.click(screen.getByText('UPGRADE 1.0'));
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(useAppStore.getState().retos[0].participantes).toEqual(['cl1', 'cl2']);
  });

  it('y desmarcarla la saca', () => {
    render(<RetosPage />);
    fireEvent.click(screen.getByText('UPGRADE 1.0'));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(useAppStore.getState().retos[0].participantes).toEqual([]);
  });
});

/**
 * El reto se va abriendo: diez recetas de golpe se leen como un PDF y se
 * cierran, tres cada semana se cocinan.
 */
describe('Las recetas, con su día de apertura', () => {
  /**
   * Se elige como al pautar: se mira la comida, se ven las recetas que valen
   * para esa comida y se toca la que se quiere.
   */
  it('sólo salen las recetas de la comida que se está montando', () => {
    render(<RetosPage />);
    fireEvent.click(screen.getByText('UPGRADE 1.0'));

    // Empieza en desayuno.
    expect(screen.getAllByText('Porridge de avena').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pollo al horno')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Cena$/ }));
    expect(screen.getByText('Pollo al horno')).toBeTruthy();
  });

  it('un toque la añade con el día que esté puesto', () => {
    render(<RetosPage />);
    fireEvent.click(screen.getByText('UPGRADE 1.0'));
    fireEvent.click(screen.getByRole('button', { name: /^Cena$/ }));
    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Pollo al horno'));

    const puestas = useAppStore.getState().retos[0].recetas;
    expect(puestas).toHaveLength(2);
    expect(puestas[1]).toMatchObject({ recetaId: 'rc2', slot: 'cena', desdeDia: 8 });
  });

  it('y otro toque la quita', () => {
    render(<RetosPage />);
    fireEvent.click(screen.getByText('UPGRADE 1.0'));
    fireEvent.click(screen.getAllByText('Porridge de avena')[0]);
    expect(useAppStore.getState().retos[0].recetas).toEqual([]);
  });

  it('la que ya está dice en qué día se abre', () => {
    render(<RetosPage />);
    fireEvent.click(screen.getByText('UPGRADE 1.0'));
    expect(screen.getByText('Día 1')).toBeTruthy();
    expect(screen.getByText(/Abierta el día 1/)).toBeTruthy();
  });

  it('una receta borrada del banco no deja el hueco en blanco', () => {
    useAppStore.setState({ recipes: [] });
    render(<RetosPage />);
    fireEvent.click(screen.getByText('UPGRADE 1.0'));
    expect(screen.getByText('receta borrada')).toBeTruthy();
  });
});

describe('Crear un reto', () => {
  it('pide nombre y fecha, y no deja crearlo vacío', () => {
    render(<RetosPage />);
    fireEvent.click(screen.getByText('+ Nuevo reto'));
    const crear = screen.getByText('Crear reto') as HTMLButtonElement;
    expect(crear.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('UPGRADE 1.0'), {
      target: { value: 'UPGRADE 2.0' },
    });
    expect((screen.getByText('Crear reto') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText('Crear reto'));

    expect(useAppStore.getState().retos.map((r) => r.nombre)).toContain('UPGRADE 2.0');
  });

  it('empieza con 30 días, que es lo corriente', () => {
    render(<RetosPage />);
    fireEvent.click(screen.getByText('+ Nuevo reto'));
    fireEvent.change(screen.getByPlaceholderText('UPGRADE 1.0'), {
      target: { value: 'Otro' },
    });
    fireEvent.click(screen.getByText('Crear reto'));
    expect(useAppStore.getState().retos.find((r) => r.nombre === 'Otro')?.dias).toBe(30);
  });
});
