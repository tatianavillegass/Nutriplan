// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LibroDeCaja } from '../perfil/LibroDeCaja';
import type { Client } from '../../types/client';
import type { Gasto } from '../../types/finanzas';

afterEach(cleanup);

/**
 * LA HOJA QUE PEDÍA
 *
 * «Deberíamos tener una hoja donde yo pueda ver quiénes han pagado y cuánto,
 * con fecha. Así veo de dónde vienen esos ingresos.»
 */

const clienta = (
  id: string,
  nombre: string,
  pagos: { id: string; fecha: string; importe: number; metodo?: string }[],
  modalidad?: string,
): Client =>
  ({ id, nombre, pagos, modalidad, createdAt: '', updatedAt: '' }) as unknown as Client;

const CLIENTAS = [
  clienta('c1', 'Isabela Cuevas', [{ id: 'p1', fecha: '2026-11-05', importe: 60, metodo: 'Bizum' }], 'online'),
  clienta('c2', 'Elena García', [{ id: 'p2', fecha: '2026-11-09', importe: 215 }], 'presencial'),
  clienta('c3', 'Lucía Mora', [{ id: 'p3', fecha: '2026-10-04', importe: 80 }], 'online'),
];

const GASTOS = [
  { id: 'g1', fecha: '2026-11-10', concepto: 'Plicómetro', importe: 120, categoria: 'material' },
] as unknown as Gasto[];

const pintar = (clients = CLIENTAS, gastos = GASTOS) =>
  render(
    <MemoryRouter>
      <LibroDeCaja clients={clients} gastos={gastos} moneda="€" />
    </MemoryRouter>,
  );

const fila = (nombre: string) => screen.getByText(nombre).closest('tr')!;

describe('La tabla de caja', () => {
  it('empieza por el mes más reciente', () => {
    pintar();
    expect(screen.getByText('Isabela Cuevas')).toBeTruthy();
    expect(screen.queryByText('Lucía Mora')).toBeNull();
  });

  it('con el día, el método y el importe de cada una', () => {
    pintar();
    const f = within(fila('Isabela Cuevas'));
    expect(f.getByText('05')).toBeTruthy();
    expect(f.getByText('Bizum')).toBeTruthy();
    expect(f.getByText('60 €')).toBeTruthy();
    expect(f.getByText('online')).toBeTruthy();
  });

  /* Los gastos van en la misma tabla: es una caja, no dos listas. */
  it('y los gastos del mes en la misma tabla', () => {
    pintar();
    expect(within(fila('Plicómetro')).getByText('120 €')).toBeTruthy();
  });

  /* El total es la suma de lo que se está viendo, no un número aparte. */
  it('el pie suma lo que hay arriba', () => {
    pintar();
    expect(screen.getByText('275 €')).toBeTruthy();
    expect(screen.getByText('155 €')).toBeTruthy();
  });

  it('y se puede cambiar de mes', () => {
    pintar();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2026-10' } });
    expect(screen.getByText('Lucía Mora')).toBeTruthy();
    expect(screen.queryByText('Isabela Cuevas')).toBeNull();
  });

  /* Si algo no cuadra, lo siguiente que se hace es abrir su ficha. */
  it('desde el nombre se salta a su ficha', () => {
    pintar();
    expect(screen.getByText('Isabela Cuevas').closest('a')?.getAttribute('href')).toBe(
      '/clientes/c1',
    );
  });

  it('sin movimientos lo dice en vez de enseñar una tabla vacía', () => {
    pintar([], []);
    expect(screen.getByText('Todavía no hay movimientos')).toBeTruthy();
  });
});

describe('Cuando un cobro parece repetido', () => {
  const dobles = [
    clienta('c1', 'Marines Estrada', [
      { id: 'p1', fecha: '2026-11-19', importe: 140 },
      { id: 'p2', fecha: '2026-11-19', importe: 140 },
    ]),
  ];

  it('se avisa arriba y se marca la línea', () => {
    pintar(dobles, []);
    expect(screen.getByText(/se repiten/)).toBeTruthy();
    expect(screen.getAllByText('repetido')).toHaveLength(2);
  });

  /*
   * No se descuenta: puede ser real y decidirlo por ella sería inventar. Sale
   * dos veces porque sin gastos el saldo es el mismo número que los ingresos.
   */
  it('pero el total los sigue contando', () => {
    pintar(dobles, []);
    expect(screen.getAllByText('280 €').length).toBeGreaterThan(0);
  });
});
