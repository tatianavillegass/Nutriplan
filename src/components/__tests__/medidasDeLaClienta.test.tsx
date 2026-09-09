// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MedidasDeLaClienta } from '../client/MedidasDeLaClienta';
import { MedidasDeCliente } from '../planning/MedidasDeCliente';
import type { Client } from '../../types/client';
import type { MedidasDelDia, RegistroDia } from '../../types/diary';

afterEach(cleanup);

const dia = (fecha: string, medidas: MedidasDelDia): RegistroDia =>
  ({ id: `r-${fecha}`, clientId: 'c1', fecha, medidas }) as unknown as RegistroDia;

const clienta = (extra: Partial<Client> = {}) =>
  ({ id: 'c1', nombre: 'Ana', ...extra }) as Client;

/**
 * LO QUE SE HA MEDIDO ELLA, EN LA FICHA
 *
 * Antes sólo se veía desde la pantalla de retos, así que una clienta de
 * consulta podía estar apuntándose el peso todas las semanas sin que su
 * nutricionista lo viera por ningún lado.
 */
describe('En Seguimiento', () => {
  const registros = [
    dia('2026-08-03', { peso: 70, cintura: 82 }),
    dia('2026-08-17', { peso: 68.5, cintura: 79, nota: 'Semana de viaje' }),
  ];

  it('sale la tabla con lo último y las dos diferencias', () => {
    render(<MedidasDeLaClienta registros={registros} />);
    expect(screen.getByText('Cintura (mínimo)')).toBeTruthy();
    expect(screen.getByText(/Desde la anterior/)).toBeTruthy();
    expect(screen.getByText(/Desde el día 1/)).toBeTruthy();
  });

  /** Casi siempre es lo más útil de todo. */
  it('y lo primero, lo que haya escrito', () => {
    render(<MedidasDeLaClienta registros={registros} />);
    expect(screen.getByText('«Semana de viaje»')).toBeTruthy();
  });

  it('el histórico se abre, no ocupa de entrada', () => {
    render(<MedidasDeLaClienta registros={registros} />);
    const boton = screen.getByText(/Ver las 2 tomas/);
    fireEvent.click(boton);
    expect(screen.getByText('Ocultar el histórico')).toBeTruthy();
  });

  it('si no ha apuntado nada, no ocupa sitio', () => {
    const { container } = render(<MedidasDeLaClienta registros={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

/**
 * Cada báscula usa su fórmula, así que su % de grasa no se compara con unos
 * pliegues ni con otra báscula. Va en su bloque y se dice.
 */
describe('La bioimpedancia va aparte', () => {
  it('en su propio bloque y con el aviso', () => {
    render(
      <MedidasDeLaClienta
        registros={[dia('2026-08-17', { peso: 68, bioimpedancia: { grasaPct: 27.4 } })]}
      />,
    );
    expect(screen.getByText(/Su báscula de bioimpedancia/)).toBeTruthy();
    expect(screen.getByText(/No se compara con tus pliegues/)).toBeTruthy();
  });
});

describe('El interruptor de la ficha', () => {
  it('viene apagado: a las presenciales las mides tú', () => {
    render(<MedidasDeCliente client={clienta()} onChange={vi.fn()} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  /** Sugerir, no imponer: hay a quien medirse le hace daño. */
  it('con una online apagada, avisa de lo que te estás perdiendo', () => {
    render(<MedidasDeCliente client={clienta({ modalidad: 'online' })} onChange={vi.fn()} />);
    expect(screen.getByText(/Esta clienta es online/)).toBeTruthy();
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  it('encendido, dice qué se le pide y que no entra en tu antropometría', () => {
    render(<MedidasDeCliente client={clienta({ medidas: true })} onChange={vi.fn()} />);
    expect(screen.getByText(/Cintura \(mínimo\)/)).toBeTruthy();
    expect(screen.getByText(/no entran en tu antropometría/)).toBeTruthy();
  });

  it('y se puede apagar', () => {
    const onChange = vi.fn();
    render(<MedidasDeCliente client={clienta({ medidas: true })} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith({ medidas: false });
  });
});
