// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Plan } from '../../types/plan';

afterEach(cleanup);

/**
 * «TU SIGUIENTE PLAN ESTÁ SIENDO ELABORADO»
 *
 * Empezar una planificación nueva dejaba a la clienta sin plan: «todavía se
 * está preparando» durante las horas —a veces el día entero— que se tarda en
 * montarlo, y ése es justo el día en que más mira la app.
 */

/** El que tenía: enviado, con su foto. */
const ENVIADO: Plan = {
  ...DEMO_PLAN,
  id: 'pl_viejo',
  archivado: true,
  fecha: '2026-01-10',
  envio: { fecha: '2026-01-10T09:00:00.000Z' },
  publicado: {
    fase: DEMO_PLAN.fase,
    dayTypes: DEMO_PLAN.dayTypes,
    fecha: '2026-01-10T09:00:00.000Z',
  },
} as Plan;

/** El que se está montando ahora: sin foto y sin enviar. */
const AMEDIAS: Plan = {
  ...DEMO_PLAN,
  id: 'pl_nuevo',
  archivado: false,
  fecha: '2026-03-01',
  envio: undefined,
  publicado: undefined,
} as Plan;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore.setState({
    clients: [DEMO_CLIENT],
    plans: [ENVIADO, AMEDIAS],
    foods: FOOD_CATALOG,
    recipes: [],
    registros: [],
    mediciones: [],
    recursos: [],
  });
  useAuthStore.setState({
    perfil: { rol: 'cliente', clientId: DEMO_CLIENT.id } as never,
  });
});

const abrir = () =>
  render(
    <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}/vista`]}>
      <Routes>
        <Route path="/clientes/:id/vista" element={<ClientView />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Mientras le montan el siguiente', () => {
  /* Esto es lo que estaba roto: se quedaba sin nada. */
  it('no se queda sin plan', () => {
    abrir();
    expect(screen.queryByText(/todavía se está preparando/i)).toBeNull();
    expect(screen.getByText(/Hola,/)).toBeTruthy();
  });

  it('se le dice que viene uno nuevo', () => {
    abrir();
    expect(screen.getByText('Tu siguiente plan está siendo elaborado')).toBeTruthy();
  });

  /*
   * Lo que de verdad hace falta decir: que mientras tanto lo que tiene delante
   * sigue valiendo. Sin eso, el aviso sólo crea la duda.
   */
  it('y que mientras tanto siga con el que tiene', () => {
    abrir();
    expect(screen.getByText(/sigue con éste/i)).toBeTruthy();
  });

  it('se puede quitar, y el plan se queda', () => {
    abrir();
    fireEvent.click(screen.getByLabelText('Cerrar el aviso'));
    expect(screen.queryByText('Tu siguiente plan está siendo elaborado')).toBeNull();
    expect(screen.getByText(/Hola,/)).toBeTruthy();
  });

  /* Cerrado una vez, cerrado para siempre con ESA planificación. */
  it('cerrado ayer, hoy no vuelve', () => {
    useAppStore.setState({
      registros: [
        {
          id: 'r-ayer',
          clientId: DEMO_CLIENT.id,
          fecha: '2026-02-28',
          dayTypeId: DEMO_PLAN.dayTypes[0].id,
          recetaElegida: {},
          cumplidas: [],
          porciones: {},
          sustituciones: {},
          extras: [],
          avisoPlanNuevo: 'pl_nuevo',
        },
      ],
    });
    abrir();
    expect(screen.queryByText('Tu siguiente plan está siendo elaborado')).toBeNull();
  });

  /* Pero el aviso del plan que venga después sí tiene que salir. */
  it('y el de la planificación siguiente vuelve a salir', () => {
    useAppStore.setState({
      plans: [ENVIADO, { ...AMEDIAS, id: 'pl_otro_mas' }],
      registros: [
        {
          id: 'r-ayer',
          clientId: DEMO_CLIENT.id,
          fecha: '2026-02-28',
          dayTypeId: DEMO_PLAN.dayTypes[0].id,
          recetaElegida: {},
          cumplidas: [],
          porciones: {},
          sustituciones: {},
          extras: [],
          avisoPlanNuevo: 'pl_nuevo',
        },
      ],
    });
    abrir();
    expect(screen.getByText('Tu siguiente plan está siendo elaborado')).toBeTruthy();
  });
});

describe('Sin nada a medio montar', () => {
  it('no hay aviso que dar', () => {
    useAppStore.setState({ plans: [{ ...ENVIADO, archivado: false }] });
    abrir();
    expect(screen.queryByText('Tu siguiente plan está siendo elaborado')).toBeNull();
    expect(screen.getByText(/Hola,/)).toBeTruthy();
  });
});
