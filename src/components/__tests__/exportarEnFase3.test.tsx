// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { ClientDetail } from '../../pages/ClientDetail';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Plan } from '../../types/plan';

afterEach(cleanup);

/**
 * «EN FASE 3 NO ME DEJA EXPORTAR EN PDF»
 *
 * El botón estaba, pero no se encontraba:
 *
 *  - En la pantalla donde ella monta el plan **no había ninguno**. La única
 *    forma de exportar era abrir la vista del cliente y bajar hasta el final.
 *  - Y allí, en fase 3, caía al fondo: sin recetas asignadas no hay pestaña
 *    «Recetas» que lo acoja, así que quedaba tras un día entero de scroll.
 */

/** Fase 3 enviada, sin recetas asignadas: el caso de siempre. */
const F3 = {
  ...DEMO_PLAN,
  fase: 3,
  recetasAsignadas: {},
  envio: { fecha: '2026-10-01T09:00:00.000Z' },
  publicado: {
    fase: 3,
    dayTypes: DEMO_PLAN.dayTypes,
    recetasAsignadas: {},
    fecha: '2026-10-01T09:00:00.000Z',
  },
} as unknown as Plan;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore.setState({
    clients: [DEMO_CLIENT],
    plans: [F3],
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

const pestana = (nombre: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === nombre);

describe('En la app del cliente', () => {
  const abrir = () =>
    render(
      <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}/vista`]}>
        <Routes>
          <Route path="/clientes/:id/vista" element={<ClientView />} />
        </Routes>
      </MemoryRouter>,
    );

  /* Sin pestaña «Recetas», el sitio es «Resumen»: siempre existe. */
  it('sin recetas asignadas, el botón está en Resumen', () => {
    abrir();
    expect(pestana('Recetas')).toBeUndefined();
    fireEvent.click(pestana('Resumen')!);
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeTruthy();
  });

  /* Y ya no está al fondo del día, que es donde no lo encontraba nadie. */
  it('y ya no al final de la pantalla del día', () => {
    abrir();
    expect(screen.queryByRole('button', { name: 'Exportar PDF' })).toBeNull();
  });

  /* Lo que se imprime lleva el plan dentro, no una hoja vacía. */
  it('y el documento sale con contenido', () => {
    abrir();
    const doc = document.querySelector('.print-only');
    expect(doc?.textContent).toContain('Esquema del plan');
  });
});

describe('En la pantalla donde ella monta el plan', () => {
  beforeEach(() => {
    useAuthStore.setState({ perfil: { rol: 'nutricionista' } as never });
  });

  /** La tarjeta vive en «Entrega», junto a «Enviar»: es el mismo momento. */
  const abrirFicha = () => {
    render(
      <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}`]}>
        <Routes>
          <Route path="/clientes/:id" element={<ClientDetail />} />
        </Routes>
      </MemoryRouter>,
    );
    const entrega = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith('Entrega'),
    );
    if (entrega) fireEvent.click(entrega);
  };

  it('ahora hay un botón de exportar', () => {
    abrirFicha();
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeTruthy();
  });

  /* Dice qué va a salir: lo que ve ella, o el borrador si no se ha enviado. */
  it('y dice que es lo mismo que ve la clienta', () => {
    abrirFicha();
    expect(screen.getByText(/Lo mismo que ve/)).toBeTruthy();
  });

  it('sin enviar, avisa de que sale el borrador', () => {
    useAppStore.setState({
      plans: [{ ...F3, publicado: undefined, envio: undefined } as Plan],
    });
    abrirFicha();
    expect(screen.getByText(/sale el borrador/)).toBeTruthy();
  });

  /*
   * Y el documento va FUERA de `screen-only`: dentro, la regla de impresión
   * lo escondería con el resto de la pantalla.
   */
  it('el documento no está dentro de lo que se esconde al imprimir', () => {
    abrirFicha();
    const doc = document.querySelector('.print-only');
    expect(doc).toBeTruthy();
    expect(doc?.closest('.screen-only')).toBeNull();
  });
});
