// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CitaPanel } from '../client/AgendaPanel';
import { BonosPanel } from '../client/BonosPanel';
import { SusCitas } from '../client/SusCitas';
import { comoVaElBono } from '../../utils/bonos';
import { conLaCita, marcarRealizada } from '../../utils/citas';
import type { Bono, Client } from '../../types/client';

afterEach(cleanup);

/**
 * LO QUE PASA EN LA AGENDA TIENE QUE VERSE EN LA FICHA
 *
 * Son la misma clienta: agendar en la semana es poner su próxima cita, y
 * marcarla como realizada es gastar una sesión de su bono. Si la ficha no lo
 * enseña, en consulta se mira el «2 de 3» y no es verdad.
 */

const BONO: Bono = {
  id: 'bn_1',
  nombre: 'Bono 6',
  importe: 420,
  inicio: '2026-01-01',
  incluye: [
    { id: 'ln_c', concepto: 'Consultas', cuantas: 3 },
    { id: 'ln_l', concepto: 'Llamadas', cuantas: 3 },
  ],
};

const clienta = (p: Partial<Client> = {}): Client =>
  ({
    id: 'c1',
    nombre: 'Ana García',
    bonos: [BONO],
    sesiones: [],
    pagos: [],
    ...p,
  }) as unknown as Client;

/** Lo que hace la agenda al agendar, sin pasar por la pantalla. */
const agendar = (c: Client, fecha: string, modo: 'consulta' | 'llamada' = 'consulta') =>
  ({ ...c, ...conLaCita(c, { fecha, hora: '17:00', duracionMin: 30, modo }) }) as Client;

describe('Una cita puesta en la agenda sale en su ficha', () => {
  it('«Próxima cita» la enseña sin tener que volver a escribirla', () => {
    const conCita = agendar(clienta(), '2099-01-15');
    render(
      <MemoryRouter>
        <CitaPanel client={conCita} onChange={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/15 de enero/)).toBeTruthy();
  });
});

describe('Y al marcarla, el bono de su ficha se entera', () => {
  it('una consulta marcada en la agenda sale como «1 de 3 consultas»', () => {
    const conCita = agendar(clienta(), '2026-06-10');
    const id = conCita.citas![0].id!;
    const despues = { ...conCita, ...marcarRealizada(conCita, id) } as Client;

    render(<BonosPanel client={despues} onChange={vi.fn()} />);
    expect(screen.getByText('1 de 3')).toBeTruthy();
  });

  it('y una llamada gasta de las llamadas, no de las consultas', () => {
    const conCita = agendar(clienta(), '2026-06-10', 'llamada');
    const id = conCita.citas![0].id!;
    const despues = { ...conCita, ...marcarRealizada(conCita, id) } as Client;

    render(<BonosPanel client={despues} onChange={vi.fn()} />);
    const marcadores = screen.getAllByText(/de 3/);
    expect(marcadores.some((m) => m.textContent === '1 de 3')).toBe(true);
    expect(despues.sesiones![0].lineaId).toBe('ln_l');
  });
});

describe('Sus citas, en la ficha', () => {
  const conDos = () => {
    let c = agendar(clienta(), '2099-01-15');
    c = agendar(c, '2020-05-02');
    return c;
  };

  const pintar = (c: Client, onChange = vi.fn()) => {
    render(
      <MemoryRouter>
        <SusCitas client={c} onChange={onChange} />
      </MemoryRouter>,
    );
    return onChange;
  };

  it('salen las que vienen y las que ya pasaron', () => {
    pintar(conDos());
    expect(screen.getByText(/2099-01-15/)).toBeTruthy();
    expect(screen.getByText(/2020-05-02/)).toBeTruthy();
  });

  it('avisa de la que pasó y sigue sin marcar, que es la que miente en el bono', () => {
    pintar(conDos());
    expect(screen.getByText(/1 cita ya pasó y sigue sin marcar/)).toBeTruthy();
  });

  it('y se marca desde aquí: descuenta del bono igual que en la agenda', () => {
    const onChange = pintar(conDos());
    fireEvent.click(screen.getAllByText('Marcar hecha')[0]);

    const patch = onChange.mock.calls[0][0];
    expect(patch.sesiones).toHaveLength(1);
    expect(patch.sesiones[0].bonoId).toBe('bn_1');
    expect(patch.sesiones[0].lineaId).toBe('ln_c');
  });
});

describe('Una sesión que no cuadra con ninguna línea no desaparece', () => {
  it('cuenta como hecha y se dice que no tiene dónde apuntarse', () => {
    /* Bonos escritos sin líneas: antes marcar la consulta no se veía en
       ninguna parte, que es lo mismo que no haberla marcado. */
    const sinLineas: Bono = { ...BONO, id: 'bn_2', incluye: [] };
    const c = clienta({
      bonos: [sinLineas],
      sesiones: [{ id: 's1', fecha: '2026-06-10', bonoId: 'bn_2' }],
    });

    expect(comoVaElBono(sinLineas, c).sesionesHechas).toBe(1);
    expect(comoVaElBono(sinLineas, c).sueltas).toBe(1);

    render(<BonosPanel client={c} onChange={vi.fn()} />);
    expect(screen.getByText(/sin\s+asignar a ninguna línea/)).toBeTruthy();
  });
});
