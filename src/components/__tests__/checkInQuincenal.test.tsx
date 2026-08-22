// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CheckInQuincenal } from '../client/CheckInQuincenal';
import { CheckInsDelPrograma } from '../client/CheckInsDelPrograma';
import { registroVacio } from '../../types/diary';
import type { CheckIn, RegistroDia } from '../../types/diary';

afterEach(cleanup);

const respuestas = (n: number): CheckIn['respuestas'] => ({
  energia: n,
  digestion: n,
  sueno: n,
  hambre: n,
  antojos: n,
});

const dia = (fecha: string, checkins: CheckIn[]): RegistroDia => ({
  ...registroVacio('c1', fecha, `r_${fecha}`),
  checkins,
});

/**
 * NO ES UN EXAMEN
 *
 * Cinco cosas que ella siente, con lo que significa cada extremo, y una línea
 * libre. Sin nota, sin media y sin insistir: se puede dejar para otro día.
 */
describe('El check-in de la clienta', () => {
  it('no ocupa sitio hasta que ella quiere', () => {
    render(<CheckInQuincenal numero={1} fecha="2026-08-14" onGuardar={vi.fn()} />);
    expect(screen.queryByText(/energía/i)).toBeNull();

    fireEvent.click(screen.getByText('¿Qué tal estas dos semanas?'));
    expect(screen.getByText(/energía/i)).toBeTruthy();
  });

  it('se puede dejar para otro momento', () => {
    render(<CheckInQuincenal numero={1} fecha="2026-08-14" onGuardar={vi.fn()} />);
    fireEvent.click(screen.getByText('¿Qué tal estas dos semanas?'));
    expect(screen.getByText('Ahora no')).toBeTruthy();
  });

  it('y al contestarlo todo se envía con lo que escribió', () => {
    const onGuardar = vi.fn();
    render(<CheckInQuincenal numero={2} fecha="2026-08-28" onGuardar={onGuardar} />);
    fireEvent.click(screen.getByText('¿Qué tal estas dos semanas?'));

    for (const pregunta of [
      '¿Cómo has estado de energía?',
      '¿Y de digestiones?',
      '¿Has dormido bien?',
      '¿Has pasado hambre entre horas?',
      '¿Has tenido antojos?',
    ])
      fireEvent.click(screen.getByLabelText(`${pregunta} 4 de 5`));

    fireEvent.change(screen.getByPlaceholderText(/Lo que sea/), {
      target: { value: 'Semana de viaje' },
    });
    fireEvent.click(screen.getByText('Enviar'));

    const enviado = onGuardar.mock.calls[0][0] as CheckIn;
    expect(enviado.numero).toBe(2);
    expect(enviado.respuestas.sueno).toBe(4);
    expect(enviado.nota).toBe('Semana de viaje');
  });
});

/**
 * En su ficha lo que importa no es el número suelto sino hacia dónde va, y lo
 * que haya escrito: casi siempre es lo más útil de todo.
 */
describe('Lo que ve la nutricionista', () => {
  it('enseña la nota y el cambio respecto a la quincena anterior', () => {
    render(
      <CheckInsDelPrograma
        registros={[
          dia('2026-08-14', [{ numero: 1, fecha: '2026-08-14', respuestas: respuestas(2) }]),
          dia('2026-08-28', [
            { numero: 2, fecha: '2026-08-28', respuestas: respuestas(4), nota: 'Duermo mejor' },
          ]),
        ]}
      />,
    );

    expect(screen.getByText('«Duermo mejor»')).toBeTruthy();
    expect(document.body.textContent).toContain('antes 2');
  });

  it('y sin check-ins no ocupa sitio', () => {
    const { container } = render(<CheckInsDelPrograma registros={[]} />);
    expect(container.textContent).toBe('');
  });
});
