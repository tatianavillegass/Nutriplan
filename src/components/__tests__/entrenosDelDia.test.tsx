// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EntrenosDelDia } from '../client/EntrenosDelDia';
import { SusEntrenos } from '../client/SusEntrenos';
import type { Actividad, RegistroDia } from '../../types/diary';

afterEach(cleanup);

const MIERCOLES = '2026-09-09';

const act = (id: string, tipo: Actividad['tipo'], extra: Partial<Actividad> = {}): Actividad => ({
  id,
  tipo,
  createdAt: '2026-09-09T10:00:00.000Z',
  ...extra,
});

const dia = (fecha: string, actividad: Actividad[]): RegistroDia =>
  ({ id: `r-${fecha}`, clientId: 'c1', fecha, actividad }) as unknown as RegistroDia;

const pintar = (entrenos: Actividad[], onGuardar = vi.fn(), registros: RegistroDia[] = []) => {
  const r = render(
    <EntrenosDelDia
      registros={registros}
      fecha={MIERCOLES}
      entrenos={entrenos}
      onGuardar={onGuardar}
    />,
  );
  return { ...r, onGuardar };
};

describe('Apuntar un entreno', () => {
  /** Dos toques: abrir y elegir qué. Todo lo demás es opcional. */
  it('con elegir el tipo ya se apunta', () => {
    const { onGuardar } = pintar([]);
    fireEvent.click(screen.getByText('Hoy he entrenado'));
    fireEvent.click(screen.getByText('Pilates'));
    fireEvent.click(screen.getByText('Apuntar'));

    const guardados = onGuardar.mock.calls[0][0];
    expect(guardados.length).toBe(1);
    expect(guardados[0].tipo).toBe('pilates');
    expect(guardados[0].minutos).toBeUndefined();
  });

  it('y guarda la duración, la cara y la nota si las pone', () => {
    const { onGuardar } = pintar([]);
    fireEvent.click(screen.getByText('Hoy he entrenado'));
    fireEvent.click(screen.getByText('Correr'));
    fireEvent.change(screen.getByPlaceholderText('45'), { target: { value: '40' } });
    fireEvent.click(screen.getByLabelText('Fuerte'));
    fireEvent.change(screen.getByPlaceholderText('¿Algo que contar? (opcional)'), {
      target: { value: 'Las piernas muy bien' },
    });
    fireEvent.click(screen.getByText('Apuntar'));

    expect(onGuardar.mock.calls[0][0][0]).toMatchObject({
      tipo: 'correr',
      minutos: 40,
      comoFue: 'fuerte',
      nota: 'Las piernas muy bien',
    });
  });

  it('«otro» pregunta cuál', () => {
    const { onGuardar } = pintar([]);
    fireEvent.click(screen.getByText('Hoy he entrenado'));
    fireEvent.click(screen.getByText('Otro'));
    fireEvent.change(screen.getByPlaceholderText('Padel, escalada, baile…'), {
      target: { value: 'Escalada' },
    });
    fireEvent.click(screen.getByText('Apuntar'));
    expect(onGuardar.mock.calls[0][0][0]).toMatchObject({ tipo: 'otro', otro: 'Escalada' });
  });

  it('se pueden apuntar dos el mismo día', () => {
    pintar([act('a', 'correr')]);
    expect(screen.getByText('+ Apuntar otro entreno')).toBeTruthy();
  });

  it('y quitarse', () => {
    const { onGuardar } = pintar([act('a', 'yoga')]);
    fireEvent.click(screen.getByLabelText('Quitar Yoga'));
    expect(onGuardar.mock.calls[0][0]).toEqual([]);
  });
});

/**
 * Lo que esto NO tiene es tan importante como lo que tiene: si aquí sale un
 * «2 de 4» o un día en rojo, deja de ser un registro y pasa a ser un examen.
 */
describe('No hay nada que cumplir', () => {
  it('la cuenta se dice sin objetivo', () => {
    pintar([], vi.fn(), [dia(MIERCOLES, [act('a', 'fuerza'), act('b', 'yoga')])]);
    expect(screen.getByText('2 esta semana')).toBeTruthy();
    expect(screen.queryByText(/de \d/)).toBeNull();
  });

  it('una semana sin entrenar no riñe', () => {
    pintar([]);
    expect(screen.getByText('ninguno esta semana')).toBeTruthy();
  });

  it('y se dice que no toca las comidas ni la racha', () => {
    pintar([]);
    expect(screen.getByText(/no cuentan en las comidas/)).toBeTruthy();
  });
});

/** En la pantalla de la nutricionista sí hay medias: es material de consulta. */
describe('Lo que ve ella', () => {
  it('la media, de qué entrena y los últimos', () => {
    render(
      <SusEntrenos
        fecha={MIERCOLES}
        registros={[
          dia(MIERCOLES, [act('a', 'correr', { minutos: 40, nota: 'Duro' })]),
          dia('2026-09-02', [act('b', 'fuerza'), act('c', 'fuerza')]),
        ]}
      />,
    );
    expect(screen.getByText('1 esta semana')).toBeTruthy();
    /* Una vez en «De qué» y dos en «Los últimos». */
    expect(screen.getAllByText(/Fuerza/).length).toBe(3);
    expect(screen.getByText(/Duro/)).toBeTruthy();
  });

  it('y si no ha apuntado nada lo dice sin gráficos vacíos', () => {
    render(<SusEntrenos fecha={MIERCOLES} registros={[]} />);
    expect(screen.getByText(/Todavía no ha apuntado ninguno/)).toBeTruthy();
  });
});
