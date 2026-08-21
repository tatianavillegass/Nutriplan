// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { useAppStore } from '../../store/useAppStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { lunesDe, menuVacio, ponerEnDias, ponerTipoDeDia } from '../../utils/menuSemana';
import { claveFecha, registroVacio } from '../../types/diary';
import type { Receta } from '../../types/recipe';
import type { RegistroDia } from '../../types/diary';

afterEach(cleanup);

/**
 * LO QUE ORGANIZÓ LA SEMANA ES LO QUE VE ESE DÍA
 *
 * Si el martes puso tostada con aguacate, el martes tiene que abrir la app y
 * ver la tostada con aguacate. Organizar la semana y luego tener que volver a
 * elegir cada mañana sería hacer el trabajo dos veces, y a la tercera nadie
 * organiza nada.
 */

const COMIDA = DEMO_PLAN.dayTypes[0].meals[0];
const HOY = claveFecha(new Date());

const receta = (id: string, nombre: string): Receta => ({
  id,
  nombre,
  categorias: [COMIDA.slot],
  tags: [],
  base: { almidones: 2, proteicos_magros: 2 },
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
});

const PRIMERA = receta('r-primera', 'Avena de siempre');
const LA_QUE_PUSO = receta('r-puso', 'Tostada con aguacate');

const dia = (fecha: string, patch: Partial<RegistroDia>): RegistroDia => ({
  ...registroVacio(DEMO_CLIENT.id, fecha, `reg_${fecha}`),
  ...patch,
});

const montar = (menuDeHoy: boolean, dayTypeId?: string) => {
  let menu = menuVacio(HOY);
  if (menuDeHoy) menu = ponerEnDias(menu, COMIDA.id, LA_QUE_PUSO.id, [HOY]);
  if (dayTypeId) menu = ponerTipoDeDia(menu, HOY, dayTypeId);

  useAppStore.setState({
    clients: [DEMO_CLIENT],
    plans: [
      {
        ...DEMO_PLAN,
        fase: 1,
        dayTypes: [
          {
            ...DEMO_PLAN.dayTypes[0],
            id: 'descanso',
            nombre: 'Descanso',
            grid: {
              ...DEMO_PLAN.dayTypes[0].grid,
              [COMIDA.id]: { almidones: 2, proteicos_magros: 2 },
            },
            recetasAsignadas: { [COMIDA.id]: [PRIMERA.id, LA_QUE_PUSO.id] },
          },
          {
            ...DEMO_PLAN.dayTypes[0],
            id: 'entreno',
            nombre: 'Entreno',
            grid: {
              ...DEMO_PLAN.dayTypes[0].grid,
              [COMIDA.id]: { almidones: 4, proteicos_magros: 2 },
            },
            recetasAsignadas: { [COMIDA.id]: [PRIMERA.id, LA_QUE_PUSO.id] },
          },
        ],
      },
    ],
    foods: FOOD_CATALOG,
    recipes: [PRIMERA, LA_QUE_PUSO],
    registros: [dia(lunesDe(HOY), { menuSemana: menu })],
    mediciones: [],
    recursos: [],
    retos: [],
  });
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const abrir = () =>
  render(
    <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}/vista`]}>
      <Routes>
        <Route path="/clientes/:id/vista" element={<ClientView />} />
      </Routes>
    </MemoryRouter>,
  );

describe('El día que organizó', () => {
  it('abre con la receta que puso, no con la primera de la lista', () => {
    montar(true);
    abrir();

    const texto = document.body.textContent ?? '';
    expect(texto.indexOf('Tostada con aguacate')).toBeLessThan(
      texto.indexOf('Avena de siempre'),
    );
  });

  it('y sin menú, todo sigue como antes', () => {
    montar(false);
    abrir();
    expect(screen.getAllByText(/Avena de siempre/).length).toBeGreaterThan(0);
  });

  /**
   * Decir «entreno los lunes» una vez y que la app lo recuerde es la mitad de
   * la gracia de organizar la semana. Y si ese día lo cambia, lo único que
   * cambia son las cantidades: la receta se queda.
   */
  it('el tipo de día también sale del menú', () => {
    montar(true, 'entreno');
    abrir();
    expect(document.body.textContent).toContain('Entreno');
  });
});
