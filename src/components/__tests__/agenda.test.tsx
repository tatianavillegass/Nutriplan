// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgendaPage } from '../../pages/AgendaPage';
import { useAppStore } from '../../store/useAppStore';
import type { Bono, Cita, Client } from '../../types/client';

afterEach(cleanup);

/**
 * LA AGENDA
 *
 * La semana delante y conectada a las fichas: marcar una cita como realizada
 * es lo que descuenta la sesión del bono, y cobrar apunta el pago colgado de
 * ese bono. Ésas son las dos cosas que se quedaban sin hacer.
 */

const hoy = new Date();
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOY = iso(hoy);
const HACE_DOS_DIAS = iso(new Date(hoy.getTime() - 2 * 86_400_000));

const BONO: Bono = {
  id: 'bn_1',
  nombre: 'Bono 6',
  importe: 420,
  inicio: '2026-01-01',
  incluye: [{ id: 'ln_c', concepto: 'Consultas', cuantas: 3 }],
};

const cita = (p: Partial<Cita> & { fecha: string; id: string }): Cita => ({
  modo: 'consulta',
  hora: '10:00',
  ...p,
});

const clienta = (p: Partial<Client> = {}): Client =>
  ({
    id: 'c1',
    nombre: 'Ana García',
    bonos: [BONO],
    sesiones: [],
    pagos: [],
    ...p,
  }) as unknown as Client;

const pintar = (clients: Client[]) => {
  useAppStore.setState({ clients, gastos: [] });
  return render(
    <MemoryRouter>
      <AgendaPage />
    </MemoryRouter>,
  );
};

beforeEach(() => useAppStore.setState({ clients: [], gastos: [] }));

describe('La semana', () => {
  it('enseña los siete días y la cita de hoy con su hora', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    expect(screen.getByText('Ana García')).toBeTruthy();
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText(/1 cita esta semana/)).toBeTruthy();
  });

  it('una clienta sin citas no ocupa ningún hueco de la semana', () => {
    /* Sale en el aviso de «sin la siguiente puesta», pero en la rejilla no. */
    pintar([clienta()]);
    expect(screen.queryByText('10:00')).toBeNull();
    expect(screen.getByText(/0 citas esta semana/)).toBeTruthy();
  });
});

describe('Marcarla realizada descuenta su bono', () => {
  it('al pulsarla se abre, y marcarla crea la sesión del bono', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);

    fireEvent.click(screen.getByText('Ana García'));
    /* La tarjeta abierta trae lo que lleva de su bono. */
    expect(screen.getByText(/0 de 3 consultas/)).toBeTruthy();

    fireEvent.click(screen.getByText('Marcar realizada'));

    const guardada = useAppStore.getState().clients[0];
    expect(guardada.sesiones).toHaveLength(1);
    expect(guardada.sesiones![0].bonoId).toBe('bn_1');
    expect(guardada.citas!.find((c) => c.id === 'ci_1')!.estado).toBe('realizada');
  });

  it('y se puede deshacer, que quita esa misma sesión', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    fireEvent.click(screen.getByText('Ana García'));
    fireEvent.click(screen.getByText('Marcar realizada'));
    fireEvent.click(screen.getByText('Deshacer'));
    expect(useAppStore.getState().clients[0].sesiones).toHaveLength(0);
  });
});

describe('Cobrar desde la cita', () => {
  it('propone lo que falta del bono y apunta el pago colgado de él', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    fireEvent.click(screen.getByText('Ana García'));

    fireEvent.click(screen.getByText(/Cobrar · faltan 420/));
    fireEvent.click(screen.getByText('Apuntar el pago'));

    const pagos = useAppStore.getState().clients[0].pagos!;
    expect(pagos).toHaveLength(1);
    expect(pagos[0].importe).toBe(420);
    expect(pagos[0].bonoId).toBe('bn_1');
  });
});

describe('Lo que se olvida', () => {
  it('avisa de las citas que ya pasaron y siguen sin marcar', () => {
    pintar([clienta({ citas: [cita({ fecha: HACE_DOS_DIAS, id: 'ci_v' })] })]);
    expect(screen.getByText(/ya pasó y sigue sin marcar|ya pasaron y siguen sin marcar/)).toBeTruthy();
  });

  it('y de quién se fue sin la siguiente puesta', () => {
    pintar([clienta()]);
    expect(screen.getByText(/no tiene la siguiente cita puesta/)).toBeTruthy();
  });

  it('quien ya tiene cita no sale en ese aviso', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    expect(screen.queryByText(/no tiene la siguiente cita puesta/)).toBeNull();
  });
});

describe('El mes', () => {
  it('cuenta las consultas marcadas y lo que entró en caja', () => {
    const mes = HOY.slice(0, 7);
    pintar([
      clienta({
        sesiones: [{ id: 's1', fecha: `${mes}-02`, bonoId: 'bn_1', lineaId: 'ln_c' }],
        pagos: [{ id: 'p1', fecha: `${mes}-02`, importe: 210, bonoId: 'bn_1' }],
      }),
    ]);
    expect(screen.getByText('Consultas hechas')).toBeTruthy();
    expect(screen.getByText('210 €')).toBeTruthy();
  });
});
