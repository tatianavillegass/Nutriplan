// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';

afterEach(cleanup);

/**
 * EL SELECTOR TIENE QUE LLEGAR A SU PANTALLA
 *
 * «El cliente no puede decidir de cuándo a cuándo quiere hacer la lista de la
 * compra.» Y era verdad, aunque el selector estuviera hecho y probado: las dos
 * props que lo encienden —`rango` y `hoy`— se habían puesto en la instancia de
 * «Reajustes», que es la del menú, en vez de en la de «Compra». La tarjeta es
 * la misma clase usada dos veces, así que no falló nada; simplemente no se
 * pintaba.
 *
 * El test que había probaba el componente suelto y pasaba. **Por eso este pasa
 * por la app entera**: lo que estaba roto era el cable, no la bombilla.
 */

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore.setState({
    clients: [DEMO_CLIENT],
    plans: [DEMO_PLAN],
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

const abrirLaCompra = () => {
  render(
    <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}/vista`]}>
      <Routes>
        <Route path="/clientes/:id/vista" element={<ClientView />} />
      </Routes>
    </MemoryRouter>,
  );
  const pestana = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'Compra',
  );
  if (!pestana) throw new Error('No hay pestaña de Compra');
  fireEvent.click(pestana);
};

describe('La lista de la compra, en su app', () => {
  it('puede elegir para cuántos días compra', () => {
    abrirLaCompra();
    expect(screen.getByText('Para cuántos días')).toBeTruthy();
  });

  it('con sus atajos y las fechas sueltas', () => {
    abrirLaCompra();
    for (const t of ['2 días', '3 días', '1 semana', '2 semanas', 'Elegir fechas'])
      expect(screen.getByRole('button', { name: t })).toBeTruthy();
  });

  /* Y al pulsarlos pasa algo: no es un botón de adorno. */
  it('y al elegir dos días lo dice', () => {
    abrirLaCompra();
    fireEvent.click(screen.getByRole('button', { name: '2 días' }));
    expect(screen.getByText(/2 días, del/)).toBeTruthy();
  });

  /* En la pestaña del menú no pinta nada: ahí se organiza, no se compra. */
  it('en «Reajustes» no sale', () => {
    render(
      <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}/vista`]}>
        <Routes>
          <Route path="/clientes/:id/vista" element={<ClientView />} />
        </Routes>
      </MemoryRouter>,
    );
    const pestana = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Reajustes',
    );
    fireEvent.click(pestana!);
    expect(screen.queryByText('Para cuántos días')).toBeNull();
  });
});
