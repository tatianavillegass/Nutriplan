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
  it('se apunta una consulta dentro del bono', () => {
    const onChange = vi.fn();
    render(<BonosPanel client={clienta({ bonos: [BONO] })} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Apuntar'));
    expect(onChange.mock.calls[0][0].sesiones[0].bonoId).toBe('b1');
    expect(onChange.mock.calls[0][0].sesiones[0].lineaId).toBe('l1');
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
    expect(
      (screen.getByLabelText('Fecha de la consulta') as HTMLInputElement).value,
    ).toBe('2026-08-24');
    fireEvent.click(screen.getByText('Quitar'));
    expect(onChange.mock.calls[0][0].sesiones).toHaveLength(0);
  });
});

/**
 * LA FECHA SE ESCRIBE, NO SE ADIVINA
 *
 * Una consulta se apunta cuando se acuerda —a veces semanas después—, así que
 * la fecha de hoy es mentira: la consulta de agosto acababa contando en
 * septiembre y el resumen del mes salía torcido.
 */
describe('La fecha de una consulta', () => {
  it('se puede corregir después', () => {
    const onChange = vi.fn();
    render(
      <BonosPanel
        client={clienta({ sesiones: [{ id: 's1', fecha: '2026-09-02' }] })}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Fecha de la consulta'), {
      target: { value: '2026-08-14' },
    });
    expect(onChange.mock.calls[0][0].sesiones[0].fecha).toBe('2026-08-14');
  });

  it('y la de un pago también', () => {
    const onChange = vi.fn();
    render(
      <BonosPanel
        client={clienta({
          bonos: [BONO],
          pagos: [{ id: 'p1', fecha: '2026-09-02', importe: 90, bonoId: 'b1' }],
        })}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Fecha del pago'), {
      target: { value: '2026-08-01' },
    });
    expect(onChange.mock.calls[0][0].pagos[0].fecha).toBe('2026-08-01');
  });
});

/**
 * UN PAGO SIEMPRE SABE DE QUÉ ES
 *
 * Antes había dos tarjetas y no se hablaban: apuntar un pago abajo no lo
 * colgaba de ningún bono, así que el «faltan 90» no se enteraba.
 */
describe('Los pagos', () => {
  it('se apuntan dentro del bono, y por lo que falta', () => {
    const onChange = vi.fn();
    render(<BonosPanel client={clienta({ bonos: [BONO] })} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Apuntar pago'));
    const pago = onChange.mock.calls[0][0].pagos[0];
    expect(pago.bonoId).toBe('b1');
    expect(pago.importe).toBe(270);
  });

  it('y lo que falta se descuenta de lo pagado', () => {
    render(
      <BonosPanel
        client={clienta({
          bonos: [BONO],
          pagos: [{ id: 'p1', fecha: '2026-08-01', importe: 180, bonoId: 'b1' }],
        })}
        onChange={vi.fn()}
      />,
    );
    expect(document.body.textContent).toContain('faltan 90');
  });
});

/**
 * Lo que se preguntaba antes y ya no: «cuánto paga al mes». Es de cuando no
 * había bonos; con un bono contratado esa pregunta ya está contestada.
 */
describe('La tarifa', () => {
  it('ya no pregunta la periodicidad', () => {
    render(<BonosPanel client={clienta()} onChange={vi.fn()} />);
    const texto = document.body.textContent ?? '';
    expect(texto.toLowerCase()).not.toContain('mensual');
    expect(texto.toLowerCase()).not.toContain('periodicidad');
  });

  it('sólo pregunta lo que cobras por una consulta suelta', () => {
    const onChange = vi.fn();
    render(<BonosPanel client={clienta()} onChange={onChange} />);
    expect(screen.getByText('Una consulta suelta')).toBeTruthy();
  });
});

/**
 * DE DÓNDE SALE EL «TRABAJO HECHO»
 *
 * En el resumen del mes aparecía una cifra en euros que no salía de ningún
 * sitio visible. Un número que no se puede comprobar no se puede creer.
 */
describe('El valor de una sesión', () => {
  it('se enseña en la tarjeta del bono', () => {
    render(<BonosPanel client={clienta({ bonos: [BONO] })} onChange={vi.fn()} />);
    // 270 € entre 3 consultas = 90 € por sesión.
    expect(document.body.textContent).toContain('90 € por sesión');
  });

  it('y no se enseña si el bono no incluye nada que repartir', () => {
    render(
      <BonosPanel client={clienta({ bonos: [{ ...BONO, incluye: [] }] })} onChange={vi.fn()} />,
    );
    expect(document.body.textContent).not.toContain('por sesión');
  });
});
