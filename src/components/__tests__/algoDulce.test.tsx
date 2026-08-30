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
    foods: [],
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

  /**
   * LAS CALORÍAS SON DE LA COMIDA, NO DEL PLAN
   *
   * El froyo de Tats —240 g de yogur griego light y 200 g de kéfir— salía a
   * 60 kcal la ración aquí y a 104 en «Mis recetas» de fase 4. La diferencia
   * era la tabla de intercambios: el yogur entra como lácteo proteico y ahí la
   * grasa vale cero, así que sus 2 g por cada 100 desaparecían. Lo que se
   * gasta del plan se cuenta en porciones; las calorías se leen de la etiqueta.
   */
  it('las calorías salen de los gramos, no de las porciones', () => {
    const yogur = {
      id: 'a-yogur-griego-light',
      nombre: 'Yogur griego light',
      grupo: 'lacteos_proteicos',
      medida_casera: '1 unidad',
      gramos: 170,
      intercambios: 1.42,
      nutrientes: { kcal: 60, hc: 4.7, proteina: 5.8, grasa: 2 },
      comidas_sugeridas: [],
      alergenos: [],
      apto: [],
    } as unknown as Parameters<typeof AlgoDulce>[0]['foods'][number];

    const froyo: Receta = {
      ...brownie,
      id: 'p2',
      nombre: 'Froyo',
      raciones: 2,
      // Lo que la tabla diría: 2 lácteos proteicos = 80 kcal, 40 por ración.
      base: { lacteos_proteicos: 2 },
      ingredientes: [
        {
          id: 'i1',
          nombre: 'Yogur griego light',
          foodId: 'a-yogur-griego-light',
          cantidad_base: 240,
          unidad: 'g',
          grupo: 'lacteos_proteicos',
          escalable: true,
          opcional: false,
        },
      ],
    };

    pintar({ postres: [{ postre: froyo, cabe: true, seLePasa: [] }], foods: [yogur] });
    fireEvent.click(screen.getByText('¿Algo dulce?'));
    fireEvent.click(screen.getByText('Froyo'));

    // 240 g × 60 kcal/100 g = 144 kcal entre 2 raciones = 72, no 40.
    expect(document.body.textContent).toContain('72 kcal');
  });

  /** Sin ingredientes enlazados no hay gramos que leer: se dice lo que se sabe. */
  it('y si no hay ingredientes enlazados, se dicen las de las porciones', () => {
    pintar();
    fireEvent.click(screen.getByText('¿Algo dulce?'));
    fireEvent.click(screen.getByText('Brownie de boniato'));
    // 1 almidón (68,5) + 1 grasa (45) = 113,5 → 114 kcal.
    expect(document.body.textContent).toContain('114 kcal');
  });

  it('el que no cuadra se enseña igual, diciendo por qué', () => {
    pintar({ postres: [{ postre: brownie, cabe: false, seLePasa: ['carbohidrato'] }] });
    fireEvent.click(screen.getByText('¿Algo dulce?'));
    expect(document.body.textContent).toContain('Se te pasaría de');
    expect(screen.getByText('Brownie de boniato')).toBeTruthy();
  });
});

/**
 * En fase 1 no hay porciones que gastar, así que para que el postre no se sume
 * encima del día la única salida es dejarse otra cosa: hoy no meriendo, que he
 * comido bizcocho.
 */
describe('En fase 1, cambiar una comida por el postre', () => {
  it('deja elegir cuál se deja', () => {
    const onEnLugarDe = vi.fn();
    render(
      <AlgoDulce
        postres={[{ postre: brownie, cabe: true, seLePasa: [] }]}
        foods={[]}
        soloExtra
        comidas={[{ id: 'm3', nombre: 'Merienda' }]}
        onEnPlan={vi.fn()}
        onComoExtra={vi.fn()}
        onEnLugarDe={onEnLugarDe}
      />,
    );

    fireEvent.click(screen.getByText('¿Algo dulce?'));
    fireEvent.click(screen.getByText('Brownie de boniato'));
    fireEvent.click(screen.getByText('En vez de una comida'));
    fireEvent.click(screen.getByText('Merienda'));

    expect(onEnLugarDe).toHaveBeenCalledWith(brownie, 'm3');
  });

  it('y lo ya cambiado se puede deshacer', () => {
    const onDeshacerCambio = vi.fn();
    render(
      <AlgoDulce
        postres={[{ postre: brownie, cabe: true, seLePasa: [] }]}
        foods={[]}
        soloExtra
        comidas={[{ id: 'm3', nombre: 'Merienda' }]}
        cambiadas={{ m3: brownie.id }}
        onEnPlan={vi.fn()}
        onComoExtra={vi.fn()}
        onDeshacerCambio={onDeshacerCambio}
      />,
    );

    fireEvent.click(screen.getByText('¿Algo dulce?'));
    expect(document.body.textContent).toContain('Hoy cambias merienda por');
    fireEvent.click(screen.getByText('Deshacer'));
    expect(onDeshacerCambio).toHaveBeenCalledWith('m3');
  });
});
