// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AlgoDulce } from '../client/AlgoDulce';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

const brownie: Receta = {
  id: 'p1',
  nombre: 'Brownie de boniato',
  categorias: [],
  postre: true,
  tags: [],
  base: { almidones: 1, grasas: 1 },
  ingredientes: [],
  preparacion: 'Al horno 20 minutos.',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const pintar = (extra: Partial<Parameters<typeof AlgoDulce>[0]> = {}) => {
  const props = {
    postres: [{ postre: brownie, cabe: true, seLePasa: [] }],
    onEnPlan: vi.fn(),
    onComoExtra: vi.fn(),
    ...extra,
  };
  render(<AlgoDulce {...props} />);
  return props;
};

/**
 * Guardarse el hidrato de la cena para el postre es planificar; comérselo
 * después de haber cenado es un extra. Las dos son verdad y sólo ella sabe
 * cuál es la suya, así que se le pregunta en vez de decidirlo por ella.
 */
describe('Algo dulce', () => {
  it('va plegado: el antojo no ocupa sitio hasta que aparece', () => {
    pintar();
    expect(document.body.textContent).not.toContain('Brownie de boniato');
    fireEvent.click(screen.getByText('¿Algo dulce?'));
    expect(screen.getByText('Brownie de boniato')).toBeTruthy();
  });

  it('deja elegir si lo cuenta en el plan o como extra', () => {
    const props = pintar();
    fireEvent.click(screen.getByText('¿Algo dulce?'));
    fireEvent.click(screen.getByText('Brownie de boniato'));

    // Lo que cuesta, a la vista antes de decidir.
    expect(document.body.textContent).toContain('almidones');

    fireEvent.click(screen.getByText('Contarlo en mi plan'));
    expect(props.onEnPlan).toHaveBeenCalledWith(brownie);
  });

  it('y en fase 1 sólo cabe como extra', () => {
    const props = pintar({ soloExtra: true });
    fireEvent.click(screen.getByText('¿Algo dulce?'));
    fireEvent.click(screen.getByText('Brownie de boniato'));

    expect(screen.queryByText(/Contarlo en mi plan/)).toBeNull();
    fireEvent.click(screen.getByText('Apuntarlo como extra'));
    expect(props.onComoExtra).toHaveBeenCalledWith(brownie);
  });

  it('el que no cuadra se enseña igual, diciendo por qué', () => {
    pintar({ postres: [{ postre: brownie, cabe: false, seLePasa: ['carbohidrato'] }] });
    fireEvent.click(screen.getByText('¿Algo dulce?'));
    expect(document.body.textContent).toContain('Se te pasaría de');
    expect(screen.getByText('Brownie de boniato')).toBeTruthy();
  });
});
