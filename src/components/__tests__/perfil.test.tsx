// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PerfilPage } from '../../pages/PerfilPage';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Client } from '../../types/client';
import type { Gasto } from '../../types/finanzas';

afterEach(cleanup);

/**
 * MI CUENTA
 *
 * El correo con el que entra, la contraseña, y cómo va la consulta. Los
 * ingresos NO se apuntan aquí: salen de los pagos de cada ficha, que es donde
 * ella los mira al hablar con esa clienta.
 */

const clienta = (id: string, pagos: { fecha: string; importe: number }[]): Client =>
  ({
    id,
    nombre: id,
    peso: 60,
    pagos: pagos.map((p, i) => ({ id: `${id}-${i}`, ...p })),
  }) as unknown as Client;

const gasto = (id: string, importe: number, extra: Partial<Gasto> = {}): Gasto => ({
  id,
  fecha: '2026-08-01',
  concepto: id,
  importe,
  categoria: 'herramientas',
  ...extra,
});

const mesDeHoy = () => new Date().toISOString().slice(0, 7);

const poner = (clients: Client[], gastos: Gasto[]) => {
  useAppStore.setState({ clients, gastos });
  useAuthStore.setState({
    cuentas: [
      {
        id: 'n1',
        email: 'tats@ejemplo.com',
        nombre: 'Tatiana',
        rol: 'nutricionista',
        createdAt: '2026-01-01',
      },
    ],
    sesion: { cuentaId: 'n1', desde: '2026-01-01' },
  } as never);
};

beforeEach(() => poner([], []));

describe('Los datos de acceso', () => {
  it('enseñan con qué correo entras', () => {
    render(<PerfilPage />);
    expect(screen.getByText('tats@ejemplo.com')).toBeTruthy();
  });

  it('y dejan cambiar la contraseña sin fingir que se te ha olvidado', () => {
    render(<PerfilPage />);
    expect(screen.getByText('Cambiar contraseña')).toBeTruthy();
  });

  it('avisando si las dos nuevas no coinciden', async () => {
    const cambiar = vi.fn();
    useAuthStore.setState({ cambiarContrasena: cambiar } as never);
    const { container } = render(<PerfilPage />);

    // Las dos últimas casillas de contraseña son «la nueva» y «repítela».
    const claves = Array.from(
      container.querySelectorAll('input[type="password"]'),
    ) as HTMLInputElement[];
    fireEvent.change(claves[claves.length - 2], { target: { value: 'unaclave123' } });
    fireEvent.change(claves[claves.length - 1], { target: { value: 'otraclave123' } });
    fireEvent.click(screen.getByText('Cambiar contraseña'));

    expect(await screen.findByText(/no coinciden/i)).toBeTruthy();
    expect(cambiar).not.toHaveBeenCalled();
  });
});

describe('Cómo va la consulta', () => {
  it('sin nada apuntado, dice de dónde salen los ingresos', () => {
    render(<PerfilPage />);
    expect(screen.getByText(/Sin ingresos ni gastos todavía/i)).toBeTruthy();
    expect(document.body.textContent).toContain('Citas y pagos');
  });

  it('suma lo cobrado de todas las fichas', () => {
    const mes = mesDeHoy();
    poner(
      [
        clienta('ana', [{ fecha: `${mes}-02`, importe: 110 }]),
        clienta('bea', [{ fecha: `${mes}-10`, importe: 270 }]),
      ],
      [],
    );
    render(<PerfilPage />);
    expect(document.body.textContent).toContain('380');
  });

  /** Un mes a deber es información, y es la que hace falta ver a tiempo. */
  it('y no esconde un mes en negativo', () => {
    const mes = mesDeHoy();
    poner([], [gasto('supabase', 25, { fecha: `${mes}-01` })]);
    render(<PerfilPage />);
    expect(document.body.textContent).toContain('-25');
  });
});

describe('Los gastos fijos', () => {
  it('se apuntan una vez y se dice lo que cuestan al mes', () => {
    poner(
      [],
      [
        gasto('Supabase', 25, { cada: 'mes' }),
        gasto('Dominio', 12, { cada: 'año' }),
      ],
    );
    render(<PerfilPage />);
    // 25 al mes + 12/12 = 26 al mes.
    expect(document.body.textContent).toContain('26');
  });

  /**
   * Dar de baja, no borrar: borrarlo se lleva por delante los meses en que sí
   * se pagó y el flujo de caja del año pasado dejaría de cuadrar.
   */
  it('se dan de baja en vez de borrarse', () => {
    poner([], [gasto('Supabase', 25, { cada: 'mes' })]);
    render(<PerfilPage />);
    expect(screen.getByText('Dar de baja')).toBeTruthy();
  });

  it('y uno dado de baja deja de salir entre los vigentes', () => {
    poner([], [gasto('Viejo', 25, { cada: 'mes', hasta: '2026-01-01' })]);
    render(<PerfilPage />);
    expect(screen.queryByText('Dar de baja')).toBeNull();
  });
});
