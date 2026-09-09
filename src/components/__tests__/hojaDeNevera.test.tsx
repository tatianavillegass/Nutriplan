// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { HojaNeveraPDF } from '../export/HojaNeveraPDF';
import { PlanDocument } from '../export/PlanDocument';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { SEED_RECIPES } from '../../data/seedRecipes';
import type { Plan } from '../../types/plan';

afterEach(cleanup);

/**
 * LA HOJA DE LA NEVERA
 *
 * El PDF de fase 2 era el mismo tablero de la pantalla en blanco y negro: un
 * documento de trabajo. Esto es una hoja que se imprime y se cuelga, así que
 * lo que se comprueba aquí es que dice lo que hay que decir —las opciones de
 * cada comida, con sus cantidades ya hechas— y que NO dice lo que sobra en la
 * puerta de una nevera.
 */

const hoja = () =>
  render(
    <HojaNeveraPDF
      client={DEMO_CLIENT}
      plan={DEMO_PLAN}
      recipes={SEED_RECIPES}
      foods={FOOD_CATALOG}
    />,
  );

describe('Lo que lleva la hoja', () => {
  it('el nombre de la clienta y sus comidas', () => {
    hoja();
    expect(screen.getAllByText(DEMO_CLIENT.nombre).length).toBe(DEMO_PLAN.dayTypes.length);
    // Dos tipos de día, así que el desayuno sale dos veces.
    expect(screen.getAllByText('Desayuno').length).toBe(2);
    expect(screen.getAllByText('Cena').length).toBe(2);
  });

  it('la instrucción, que es lo único que hay que entender', () => {
    hoja();
    expect(screen.getAllByText(/una opción de cada columna/i).length).toBe(
      DEMO_PLAN.dayTypes.length,
    );
  });

  it('las tres columnas por comida', () => {
    hoja();
    expect(screen.getAllByText('Proteína').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carbohidrato').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Grasa').length).toBeGreaterThan(0);
  });

  /** En la cocina se señala con el dedo, y en consulta se dice «tira de la 2». */
  it('las opciones van numeradas', () => {
    const { container } = hoja();
    const listas = container.querySelectorAll('ol');
    expect(listas.length).toBeGreaterThan(0);
    expect(within(listas[0] as HTMLElement).getByText('1')).toBeTruthy();
  });

  it('un tipo de día por página', () => {
    const { container } = hoja();
    expect(container.querySelectorAll('.print-page').length).toBe(DEMO_PLAN.dayTypes.length);
  });

  /**
   * Una comida partida entre dos hojas deja la mitad de las opciones en la
   * página de detrás, que colgada en la nevera no se ve.
   */
  it('ninguna comida se parte entre dos hojas', () => {
    const { container } = hoja();
    const comidas = container.querySelectorAll('.print-page section');
    expect(comidas.length).toBeGreaterThan(0);
    for (const c of comidas) expect(c.className).toContain('break-inside-avoid');
  });

  it('lleva la marca de agua y la firma', () => {
    const { container } = hoja();
    // Dos brotes por página: el de la cabecera y el de la marca de agua.
    expect(container.querySelectorAll('img[src^="data:image/png"]').length).toBe(
      DEMO_PLAN.dayTypes.length * 2,
    );
    expect(screen.getAllByText('Tatiana Villegas').length).toBe(DEMO_PLAN.dayTypes.length);
  });

  it('y el recordatorio de la verdura, una vez y no en cada comida', () => {
    hoja();
    expect(screen.getAllByText(/Verdura libre/).length).toBe(DEMO_PLAN.dayTypes.length);
  });
});

/**
 * LO QUE NO LLEVA
 *
 * En fase 2 las cantidades ya vienen hechas: un número de calorías al lado
 * invita a sumar cuando no hay nada que sumar, y «Fase 2» es vocabulario de la
 * consulta, no de quien come.
 */
describe('Lo que se deja fuera a propósito', () => {
  it('ni calorías ni porciones', () => {
    const { container } = hoja();
    const texto = container.textContent ?? '';
    expect(texto).not.toMatch(/kcal/i);
    expect(texto).not.toMatch(/porcion/i);
  });

  it('ni la palabra fase', () => {
    const { container } = hoja();
    expect(container.textContent ?? '').not.toMatch(/fase/i);
  });
});

describe('Es lo único que sale al imprimir en fase 2', () => {
  const documento = (fase: Plan['fase']) =>
    render(
      <PlanDocument
        client={DEMO_CLIENT}
        plan={{ ...DEMO_PLAN, fase }}
        recipes={SEED_RECIPES}
        foods={FOOD_CATALOG}
      />,
    );

  it('en fase 2 sale la hoja, no el documento de trabajo', () => {
    const { container } = documento(2);
    expect(container.textContent).toContain('una opción de cada columna');
    // El esquema de porciones es del documento de fase 3.
    expect(container.textContent).not.toContain('Esquema del plan');
  });

  /** En fase 3 el cliente cuenta intercambios, y ahí la tabla sí sirve. */
  it('en fase 3 se queda como estaba', () => {
    const { container } = documento(3);
    expect(container.textContent).toContain('Esquema del plan');
    expect(container.textContent).not.toContain('una opción de cada columna');
  });
});
