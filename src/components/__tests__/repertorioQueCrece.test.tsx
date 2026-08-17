// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { useAppStore } from '../../store/useAppStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

const COMIDA = DEMO_PLAN.dayTypes[0].meals[0];

const receta = (id: string, nombre: string, base: Receta['base']): Receta => ({
  id,
  nombre,
  categorias: [COMIDA.slot],
  tags: [],
  base,
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
});

/** La comida pauta almidones y proteicos magros: eso es lo que hay que cubrir. */
const PAUTA = { almidones: 2, proteicos_magros: 2 };

const FLOJA = receta('rc-floja', 'Sólo tostada', { almidones: 2 });
const BUENA = receta('rc-buena', 'Tostada con pavo', PAUTA);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore.setState({
    clients: [DEMO_CLIENT],
    plans: [
      {
        ...DEMO_PLAN,
        fase: 1,
        dayTypes: [
          {
            ...DEMO_PLAN.dayTypes[0],
            grid: { ...DEMO_PLAN.dayTypes[0].grid, [COMIDA.id]: PAUTA },
            // Se añadió primero la que peor encaja: el orden de alta no manda.
            recetasAsignadas: { [COMIDA.id]: [FLOJA.id, BUENA.id] },
          },
        ],
      },
    ],
    foods: FOOD_CATALOG,
    recipes: [FLOJA, BUENA],
    registros: [],
    mediciones: [],
    recursos: [],
    retos: [],
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

/**
 * EL REPERTORIO CRECE Y SE ORDENA SOLO
 *
 * Según crece, el orden en que se añadieron deja de decir nada: la receta que
 * mejor cuadra con lo pautado hoy puede ser la última que se puso.
 */
describe('Las recetas de una comida', () => {
  it('se abren por la que mejor encaja con lo pautado', () => {
    abrir();
    // Las dos están —el documento para imprimir las lleva todas—, pero la que
    // cubre los dos grupos va delante aunque se añadiera después.
    const texto = document.body.textContent ?? '';
    expect(texto.indexOf('Tostada con pavo')).toBeGreaterThanOrEqual(0);
    expect(texto.indexOf('Tostada con pavo')).toBeLessThan(texto.indexOf('Sólo tostada'));
  });

  it('y las demás siguen estando para elegir', () => {
    abrir();
    expect(screen.getByText(/Cambiar/i)).toBeTruthy();
  });
});
