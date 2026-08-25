// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BonosPanel } from '../client/BonosPanel';
import type { Bono, Client } from '../../types/client';

afterEach(cleanup);

/**
 * MARCAR UNA CONSULTA HECHA
 *
 * Los botones de «hecha» vivían sólo dentro de un bono, así que a quien no
 * tenía bono contratado no había forma de marcarle nada: ni un botón en toda
 * la ficha. Y ésa es media consulta de las de verdad — la primera visita, una
 * revisión suelta, alguien que paga por sesión.
 */

const BONO: Bono = {
  id: 'b1',
  nombre: 'Trimestral',
  importe: 270,
  inicio: '2026-01-01',
  incluye: [{ id: 'l1', concepto: 'Consultas', cuantas: 3 }],
};

const clienta = (extra: Partial<Client> = {}): Client =>
  ({ id: 'c1', nombre: 'Yenda', peso: 60, ...extra }) as unknown as Client;

describe('Sin bono contratado', () => {
  it('se puede marcar una consulta igualmente', () => {
    const onChange = vi.fn();
    render(<BonosPanel client={clienta()} onChange={onChange} />);

    fireEvent.click(screen.getByText('+ Consulta hecha'));

    const patch = onChange.mock.calls[0][0];
    expect(patch.sesiones).toHaveLength(1);
    // Sin bono: cuenta como consulta, pero no cuelga de ningún precio.
    expect(patch.sesiones[0].bonoId).toBeUndefined();
  });

  it('y se explica para qué sirve, que antes no había nada', () => {
    render(<BonosPanel client={clienta()} onChange={vi.fn()} />);
    expect(document.body.textContent).toContain('cuentan en el resumen del mes');
  });

  /** La modalidad se hereda de la ficha: es lo que evita el clic de más. */
  it('hereda la modalidad de su ficha sin repetirla', () => {
    const onChange = vi.fn();
    render(<BonosPanel client={clienta({ modalidad: 'online' })} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Consulta hecha'));
    // No se guarda porque es la de siempre: se sabe mirando la ficha.
    expect(onChange.mock.calls[0][0].sesiones[0].modalidad).toBeUndefined();
  });
});

describe('Con bono', () => {
  it('siguen estando los botones del bono', () => {
    render(<BonosPanel client={clienta({ bonos: [BONO] })} onChange={vi.fn()} />);
    expect(screen.getByText('+ Hecha')).toBeTruthy();
  });

  it('y además se pueden apuntar las que quedan fuera', () => {
    render(<BonosPanel client={clienta({ bonos: [BONO] })} onChange={vi.fn()} />);
    expect(screen.getByText('Consultas fuera de bono')).toBeTruthy();
  });

  it('las sueltas se listan y se pueden quitar', () => {
    const onChange = vi.fn();
    render(
      <BonosPanel
        client={clienta({ sesiones: [{ id: 's1', fecha: '2026-08-24' }] })}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('2026-08-24')).toBeTruthy();
    fireEvent.click(screen.getByText('Quitar'));
    expect(onChange.mock.calls[0][0].sesiones).toHaveLength(0);
  });
});
