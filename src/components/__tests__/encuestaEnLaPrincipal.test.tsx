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
 * LA ENCUESTA, DONDE SE ENTRA
 *
 * «La encuesta semanal no la hace nadie porque nadie se mete a Resumen. Quiero
 * que se active todos los domingos en la pantalla principal para que las
 * personas la vean.»
 *
 * A «Resumen» se entra a mirar la evolución, no a diario. La pantalla que se
 * abre todos los días es la del plan.
 */

/* Domingo 15 de noviembre de 2026: el día en que se abre la encuesta. */
const DOMINGO = new Date('2026-11-15T10:00:00');

/** Enviado hace tiempo: la semana que se pregunta ya se vivió con él. */
const PLAN: Plan = {
  ...DEMO_PLAN,
  envio: { fecha: '2026-10-01T09:00:00.000Z' },
} as Plan;

beforeEach(() => {
  vi.setSystemTime(DOMINGO);
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore.setState({
    clients: [DEMO_CLIENT],
    plans: [PLAN],
    foods: FOOD_CATALOG,
    recipes: [],
    registros: [],
    mediciones: [],
    recursos: [],
    retos: [],
  });
  useAuthStore.setState({
    perfil: { rol: 'cliente', clientId: DEMO_CLIENT.id } as never,
  });
});

afterEach(() => vi.useRealTimers());

const abrir = () =>
  render(
    <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}/vista`]}>
      <Routes>
        <Route path="/clientes/:id/vista" element={<ClientView />} />
      </Routes>
    </MemoryRouter>,
  );

const irA = (nombre: string) => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.textContent?.trim() === nombre,
  );
  if (!b) throw new Error(`No hay pestaña «${nombre}»`);
  fireEvent.click(b);
};

describe('El domingo, en la pantalla del plan', () => {
  it('la encuesta sale sin tocar ninguna pestaña', () => {
    abrir();
    expect(screen.getByText('¿Qué tal la semana?')).toBeTruthy();
  });

  /*
   * Plegada: cinco preguntas delante de la comida todos los días se leen una
   * vez y se ignoran para siempre.
   */
  it('va plegada, y se abre al tocarla', () => {
    abrir();
    expect(screen.queryByText(/¿Cómo has estado de energía\?/)).toBeNull();
    fireEvent.click(screen.getByText('¿Qué tal la semana?'));
    expect(screen.getByText(/¿Cómo has estado de energía\?/)).toBeTruthy();
  });

  /* Y ya no está en «Resumen»: en dos sitios acaban diciendo cosas distintas. */
  it('y ya no está en Resumen', () => {
    abrir();
    irA('Resumen');
    expect(screen.queryByText('¿Qué tal la semana?')).toBeNull();
  });
});

describe('Cuando no toca', () => {
  /* Contestada esta semana, no se vuelve a preguntar. */
  it('contestada, no sale', () => {
    useAppStore.setState({
      registros: [
        {
          id: 'r',
          clientId: DEMO_CLIENT.id,
          fecha: '2026-11-15',
          recetaElegida: {},
          cumplidas: [],
          porciones: {},
          sustituciones: {},
          extras: [],
          checkins: [
            {
              fecha: '2026-11-15',
              semana: '2026-11-09',
              respuestas: { energia: 4, digestion: 4, sueno: 4, hambre: 4, antojos: 4 },
            },
          ],
        } as never,
      ],
    });
    abrir();
    expect(screen.queryByText('¿Qué tal la semana?')).toBeNull();
  });

  /* A la nutricionista que entra a ver su pantalla no le toca contestarla. */
  it('a quien no es la clienta no le sale', () => {
    useAuthStore.setState({ perfil: { rol: 'nutricionista' } as never });
    abrir();
    expect(screen.queryByText('¿Qué tal la semana?')).toBeNull();
  });
});
