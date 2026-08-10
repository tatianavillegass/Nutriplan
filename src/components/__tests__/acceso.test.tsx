// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { AuthPage } from '../../pages/AuthPage';
import { ClientAccountPanel } from '../client/ClientAccountPanel';
import { useAuthStore } from '../../store/useAuthStore';
import { guardarCuentas, hashear, leerSesion } from '../../utils/auth';
import { guardarPlantillasDia, guardarPlantillaDia } from '../../utils/plantillas';
import type { Client } from '../../types/client';

afterEach(cleanup);

const reset = () => {
  localStorage.clear();
  guardarCuentas([]);
  useAuthStore.setState({ cuentas: [], sesion: null });
};

const CLIENTE: Client = {
  id: 'c1',
  nombre: 'Vanessa Muñoz',
  edad: 30,
  peso: 68,
  altura: 170,
  sexo: 'mujer',
  activityFactorId: 'moderado',
  objetivo: 'mantenimiento',
  goalMultiplier: 1,
  bmrFormula: 'media',
  alergias: [],
  preferencias: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('Pantalla de acceso', () => {
  beforeEach(reset);

  it('arranca en "entrar" y deja pasar a crear cuenta', () => {
    render(<AuthPage />);
    expect(screen.getByText('Entra en NutriPlan')).toBeTruthy();
    fireEvent.click(screen.getByText('Crear una'));
    expect(screen.getByText('Crea tu cuenta')).toBeTruthy();
  });

  it('crear cuenta abre sesión directamente', async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Crear una'));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tats' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'tats@correo.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'plan12345' } });
    fireEvent.click(screen.getByText('Crear cuenta'));
    await waitFor(() => expect(useAuthStore.getState().actual()?.nombre).toBe('Tats'));
    expect(leerSesion()).toBeTruthy();
  });

  it('una contraseña corta se explica en vez de fallar en silencio', async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Crear una'));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tats' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'tats@correo.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: '123' } });
    fireEvent.click(screen.getByText('Crear cuenta'));
    expect(await screen.findByText(/8 caracteres/)).toBeTruthy();
    expect(leerSesion()).toBeNull();
  });

  it('entrar con datos que no cuadran lo dice sin pistas de más', async () => {
    guardarCuentas([
      {
        id: 'cu1',
        email: 'tats@correo.com',
        nombre: 'Tats',
        rol: 'nutricionista',
        hash: hashear('plan12345'),
        createdAt: '2026-01-01',
      },
    ]);
    useAuthStore.setState({ cuentas: [], sesion: null });
    useAuthStore.setState({ cuentas: JSON.parse(localStorage.getItem('nutriplan:v1:cuentas')!) });

    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'tats@correo.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'otracosa' } });
    fireEvent.click(screen.getByText('Entrar'));
    expect(await screen.findByText(/Email o contraseña incorrectos/)).toBeTruthy();
  });

  it('un cliente invitado ve la pantalla de elegir contraseña con su nombre', async () => {
    const cuentas = [
      {
        id: 'cu2',
        email: 'vanessa@correo.com',
        nombre: 'Vanessa Muñoz',
        rol: 'cliente' as const,
        clientId: 'c1',
        createdAt: '2026-01-01',
      },
    ];
    guardarCuentas(cuentas);
    useAuthStore.setState({ cuentas, sesion: null });

    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'vanessa@correo.com' } });
    expect(screen.getByText(/Bienvenida, Vanessa/)).toBeTruthy();
    expect(screen.getAllByText(/Elige una contraseña/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'vanessa123' } });
    fireEvent.click(screen.getByText('Guardar y entrar'));
    await waitFor(() => expect(useAuthStore.getState().sesion?.rol).toBe('cliente'));
  });
});

describe('Dar acceso al cliente desde su ficha', () => {
  beforeEach(() => {
    reset();
    useAuthStore.setState({
      cuentas: [
        {
          id: 'cu1',
          email: 'tats@correo.com',
          nombre: 'Tats',
          rol: 'nutricionista',
          hash: hashear('plan12345'),
          createdAt: '2026-01-01',
        },
      ],
      sesion: { cuentaId: 'cu1', rol: 'nutricionista', desde: '2026-01-01' },
    });
  });

  it('sin cuenta ofrece invitarlo con su email', () => {
    render(<ClientAccountPanel client={CLIENTE} onEmail={() => {}} />);
    expect(screen.getByText(/Dar acceso a Vanessa/)).toBeTruthy();
  });

  it('invitar deja la cuenta pendiente y guarda el email en la ficha', async () => {
    const onEmail = vi.fn();
    const { rerender } = render(<ClientAccountPanel client={CLIENTE} onEmail={onEmail} />);
    fireEvent.change(screen.getByPlaceholderText('nombre@correo.com'), {
      target: { value: 'vanessa@correo.com' },
    });
    fireEvent.click(screen.getByText('Invitar'));
    await waitFor(() => expect(onEmail).toHaveBeenCalledWith('vanessa@correo.com'));

    rerender(<ClientAccountPanel client={CLIENTE} onEmail={onEmail} />);
    expect(screen.getByText('Invitación pendiente')).toBeTruthy();
  });

  it('un email inválido no crea nada y lo explica', async () => {
    render(<ClientAccountPanel client={CLIENTE} onEmail={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('nombre@correo.com'), {
      target: { value: 'esto-no-es-un-email' },
    });
    fireEvent.click(screen.getByText('Invitar'));
    expect(await screen.findByText(/no parece válido/)).toBeTruthy();
  });
});

describe('Plantillas de día que se crean a mano', () => {
  beforeEach(() => {
    localStorage.clear();
    guardarPlantillasDia([]);
  });

  it('una plantilla con una comida marcada pero vacía sí se guarda', () => {
    const lista = guardarPlantillaDia([], 'Día nuevo', { desayuno: [] });
    expect(lista).toHaveLength(1);
    expect(lista[0].comidas.desayuno).toEqual([]);
  });

  it('desmarcar una comida la quita de la plantilla', () => {
    const uno = guardarPlantillaDia([], 'Día nuevo', { desayuno: ['a-huevo'], cena: [] });
    const dos = guardarPlantillaDia(uno, 'Día nuevo', {
      desayuno: ['a-huevo'],
      cena: undefined,
    });
    expect(Object.keys(dos[0].comidas)).toEqual(['desayuno']);
  });

  it('sin ninguna comida marcada no se guarda', () => {
    expect(guardarPlantillaDia([], 'Vacía', {})).toHaveLength(0);
  });
});
