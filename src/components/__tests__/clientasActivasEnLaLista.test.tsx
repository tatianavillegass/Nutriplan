// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Clients } from '../../pages/Clients';
import { useAppStore } from '../../store/useAppStore';
import { DEMO_CLIENT } from '../../data/demoSeed';
import type { Client } from '../../types/client';

afterEach(cleanup);

/**
 * LA LÍNEA DE ARRIBA DE «CLIENTES»
 *
 * Decía «24 clientes» y ese número no sirve para decidir nada: dentro están
 * las de esta semana y las que se fueron en marzo. Ahora dice a cuántas está
 * atendiendo y cuánto le deja cada una este mes.
 */

const mesDeHoy = new Date().toISOString().slice(0, 7);
const el = (dia: string) => `${mesDeHoy}-${dia}`;

const con = (id: string, extra: Partial<Client>): Client => ({
  ...DEMO_CLIENT,
  id,
  nombre: id,
  ...extra,
});

beforeEach(() => {
  useAppStore.setState({
    clients: [
      con('Ana', { pagos: [{ id: 'p1', fecha: el('03'), importe: 120 }] }),
      con('Bea', { pagos: [{ id: 'p2', fecha: el('14'), importe: 80 }] }),
      // Se le acabó el acceso: sigue en la lista, pero no está activa.
      con('Carla', { accesoHasta: '2026-01-31' }),
    ],
    plans: [],
    registros: [],
  });
});

const abrir = () =>
  render(
    <MemoryRouter>
      <Clients />
    </MemoryRouter>,
  );

describe('Cuántas están activas', () => {
  it('se dice delante, y el total detrás', () => {
    abrir();
    expect(screen.getByText(/2 clientas activas/)).toBeTruthy();
    expect(screen.getByText(/3 en total/)).toBeTruthy();
  });

  it('y lo que deja cada una este mes', () => {
    abrir();
    // 200 € cobrados entre las 2 activas.
    expect(screen.getByText(/100 €/)).toBeTruthy();
    expect(screen.getByText(/por clienta este mes/)).toBeTruthy();
  });

  /*
   * «0 € por clienta» a primeros de mes no es un dato, es un susto: la cifra
   * sólo sale cuando hay cobros apuntados.
   */
  it('sin cobros apuntados, no se inventa un cero', () => {
    useAppStore.setState({
      clients: [con('Ana', { pagos: [] })],
    });
    abrir();
    expect(screen.getByText(/1 clienta activa/)).toBeTruthy();
    expect(screen.queryByText(/por clienta este mes/)).toBeNull();
  });
});
