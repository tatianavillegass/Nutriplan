// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const enviada: Record<string, unknown>[] = [];

vi.mock('../../utils/solicitudes', () => ({
  leerRetoPublico: async (id: string) =>
    id === 'rt1'
      ? {
          id: 'rt1',
          nombre: 'UPGRADE 1.0',
          descripcion: '30 días para ordenar la comida',
          fechaInicio: '2999-09-01',
          dias: 30,
        }
      : undefined,
  enviarSolicitud: async (s: Record<string, unknown>) => {
    enviada.push(s);
    return { ok: true };
  },
  publicarRetos: async () => {},
  leerSolicitudes: async () => [],
  borrarSolicitud: async () => {},
}));

const { ApuntarsePage } = await import('../../pages/ApuntarsePage');

afterEach(cleanup);
beforeEach(() => {
  enviada.length = 0;
});

const abrir = (retoId = 'rt1') =>
  render(
    <MemoryRouter initialEntries={[`/apuntarse/${retoId}`]}>
      <Routes>
        <Route path="/apuntarse/:retoId" element={<ApuntarsePage />} />
      </Routes>
    </MemoryRouter>,
  );

const rellenar = () => {
  fireEvent.change(screen.getByPlaceholderText('Nombre y apellidos'), {
    target: { value: 'Marta Ruiz' },
  });
  fireEvent.change(screen.getByPlaceholderText('tu@correo.com'), {
    target: { value: 'marta@correo.com' },
  });
  const fecha = document.querySelector('input[type="date"]') as HTMLInputElement;
  fireEvent.change(fecha, { target: { value: '1992-03-15' } });
  fireEvent.change(screen.getByPlaceholderText('Peso (kg)'), { target: { value: '68' } });
  fireEvent.change(screen.getByPlaceholderText('Altura (cm)'), { target: { value: '165' } });
};

/**
 * LA ÚNICA PANTALLA QUE SE VE SIN CUENTA
 *
 * Se llega desde Stripe al terminar el pago. Que ya han pagado lo dice el
 * encabezado, y eso es la mitad de la tranquilidad de rellenar un formulario.
 */
describe('El formulario público', () => {
  it('enseña de qué reto es y cuándo empieza', async () => {
    abrir();
    expect(await screen.findByText('UPGRADE 1.0')).toBeTruthy();
    expect(screen.getByText(/Pago confirmado/i)).toBeTruthy();
    expect(screen.getByText(/1 de septiembre/)).toBeTruthy();
  });

  it('un enlace que no existe lo dice sin dramatizar', async () => {
    abrir('rt-que-no-existe');
    expect(await screen.findByText(/Este enlace ya no vale/i)).toBeTruthy();
  });

  it('no deja enviar hasta que hay con qué calcular', async () => {
    abrir();
    await screen.findByText('UPGRADE 1.0');
    const boton = screen.getByText(/Enviar y ver la cuenta atrás/) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    rellenar();
    expect((screen.getByText(/Enviar y ver la cuenta atrás/) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  /** Un toque, no un desplegable: y de paso se ve cómo come esa persona. */
  it('las comidas del día se eligen de un toque, y empieza en cuatro', async () => {
    abrir();
    await screen.findByText('UPGRADE 1.0');
    expect(screen.getByRole('button', { name: '4' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByRole('button', { name: '2' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('el cribado va al final y no pide explicaciones', async () => {
    abrir();
    await screen.findByText('UPGRADE 1.0');
    expect(screen.getByText(/Estoy embarazada o dando el pecho/)).toBeTruthy();
    expect(screen.getByText(/trastorno de la conducta alimentaria/)).toBeTruthy();
    expect(screen.getByText(/hablamos antes de empezar/i)).toBeTruthy();
  });

  it('al enviarlo se guarda lo que ha puesto', async () => {
    abrir();
    await screen.findByText('UPGRADE 1.0');
    rellenar();
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByText(/Enviar y ver la cuenta atrás/));

    await waitFor(() => expect(enviada).toHaveLength(1));
    expect(enviada[0]).toMatchObject({
      nombre: 'Marta Ruiz',
      email: 'marta@correo.com',
      comidasDia: 3,
      retoId: 'rt1',
    });
  });

  it('y después sale la cuenta atrás, no otro formulario', async () => {
    abrir();
    await screen.findByText('UPGRADE 1.0');
    rellenar();
    fireEvent.click(screen.getByText(/Enviar y ver la cuenta atrás/));

    expect(await screen.findByText(/Estás dentro, Marta/)).toBeTruthy();
    expect(screen.getByText(/días para empezar/)).toBeTruthy();
    expect(screen.queryByPlaceholderText('Peso (kg)')).toBeNull();
  });
});
