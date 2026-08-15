// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { useAppStore } from '../../store/useAppStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';

afterEach(cleanup);

beforeEach(() => {
  // jsdom no trae ni scrollIntoView ni matchMedia, que usa el impreso.
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore.setState({
    clients: [DEMO_CLIENT],
    plans: [DEMO_PLAN],
    foods: FOOD_CATALOG,
    recipes: [],
    registros: [],
    mediciones: [],
    recursos: [],
  });
});

/**
 * Hay dos juegos de pestañas: el de arriba para pantalla ancha y el de abajo
 * para el móvil. Sólo se ve uno cada vez —lo decide el CSS— pero en las
 * pruebas están los dos, así que se busca por posición.
 */
const pestana = (nombre: string) => screen.getAllByRole('button', { name: nombre })[0];

const abrir = () =>
  render(
    <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}/vista`]}>
      <Routes>
        <Route path="/clientes/:id/vista" element={<ClientView />} />
      </Routes>
    </MemoryRouter>,
  );

/**
 * LA PANTALLA DEL CLIENTE TIENE QUE ABRIRSE
 *
 * Esta prueba existe porque se quedó en blanco: un selector del store que
 * filtraba dentro —`s.mediciones.filter(...)`— devolvía una lista nueva en
 * cada pintada, el store creía que había cambiado algo y volvía a pintar sin
 * parar hasta que React cortaba. No lo vio ningún test porque ninguno abría la
 * página entera.
 */
describe('El día de la clienta se abre', () => {
  it('sin quedarse en blanco', () => {
    abrir();
    expect(screen.getByText(/Hola,/)).toBeTruthy();
  });

  it('y empieza en «Hoy»', () => {
    abrir();
    expect(pestana('Hoy').getAttribute('aria-current')).toBe('true');
  });
});

describe('Las tres pestañas', () => {
  it('el resumen enseña constancia y comidas fuera', () => {
    abrir();
    fireEvent.click(pestana('Resumen'));
    expect(screen.getByText('Tu constancia')).toBeTruthy();
    expect(screen.getByText(/Comidas fuera este mes/i)).toBeTruthy();
  });

  it('los recursos dicen que todavía no hay nada', () => {
    abrir();
    fireEvent.click(pestana('Recursos'));
    expect(screen.getByText(/todavía no ha dejado nada/i)).toBeTruthy();
  });

  it('y se vuelve al día sin perder nada', () => {
    abrir();
    fireEvent.click(pestana('Resumen'));
    fireEvent.click(pestana('Hoy'));
    expect(screen.queryByText('Tu constancia')).toBeNull();
    expect(screen.getByText(/Hola,/)).toBeTruthy();
  });
});
