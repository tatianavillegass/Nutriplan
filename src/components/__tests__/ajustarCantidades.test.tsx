// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AjustarCantidades } from '../phase1/AjustarCantidades';
import { scaleRecipe } from '../../utils/recipeScaling';
import { ajustesDeReceta } from '../../types/plan';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Receta } from '../../types/recipe';
import type { DayType } from '../../types/plan';

afterEach(cleanup);

const pollo = FOOD_CATALOG.find((f) => f.nombre === 'Pechuga de pollo cruda')!;
const arroz = FOOD_CATALOG.find((f) => f.nombre === 'Arroz blanco crudo')!;

const RECETA: Receta = {
  id: 'r1',
  nombre: 'Pollo con arroz',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_magros: 1, almidones: 1 },
  ingredientes: [
    { id: 'i-pollo', nombre: 'Pollo', foodId: pollo.id, cantidad_base: 30, unidad: 'g', grupo: 'proteicos_magros', escalable: true, opcional: false },
    { id: 'i-arroz', nombre: 'Arroz', foodId: arroz.id, cantidad_base: 18, unidad: 'g', grupo: 'almidones', escalable: true, opcional: false },
    { id: 'i-sal', nombre: 'Sal', cantidad_base: null, unidad: 'al gusto', grupo: 'condimento', escalable: false, opcional: true },
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const PAUTA = { proteicos_magros: 4, almidones: 3 };

const pintar = (ajustes: Record<string, number> = {}, onGuardar = vi.fn()) => {
  render(
    <AjustarCantidades
      receta={RECETA}
      requeridos={PAUTA}
      foods={FOOD_CATALOG}
      ajustes={ajustes}
      onGuardar={onGuardar}
      onCerrar={() => {}}
    />,
  );
  return onGuardar;
};

/**
 * AJUSTAR LAS CANTIDADES AL PAUTAR
 *
 * La app propone los gramos escalando la receta, pero la última palabra es de
 * quien pauta. Lo que se guarda vive en el plan de esa clienta, no en la
 * receta del banco.
 */
describe('Lo que ve la nutricionista', () => {
  it('enseña lo pautado de esa comida como referencia', () => {
    pintar();
    expect(screen.getByText(/Esta comida tiene pautado/i)).toBeTruthy();
    // Sale en la pauta de arriba y en la etiqueta de cada ingrediente.
    expect(screen.getAllByText(/proteicos magros/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/almidones/i).length).toBeGreaterThan(0);
  });

  it('parte de las cantidades que calcula la app', () => {
    pintar();
    // 30 g × 4 porciones de proteína; 18 × 3 = 54, redondeado a 55.
    expect(screen.getByDisplayValue('120')).toBeTruthy();
    expect(screen.getByDisplayValue('55')).toBeTruthy();
  });

  it('los ingredientes al gusto no se pueden pesar', () => {
    pintar();
    expect(screen.getByText('al gusto')).toBeTruthy();
  });

  it('dice cómo quedan los macros con lo que hay escrito', () => {
    pintar();
    expect(screen.getByText(/Con estas cantidades/i)).toBeTruthy();
    expect(screen.getByText('Proteína')).toBeTruthy();
    expect(screen.getByText('Carbohidrato')).toBeTruthy();
  });
});

describe('Cambiar una cantidad', () => {
  it('guarda sólo lo que se ha tocado', () => {
    const onGuardar = pintar();
    fireEvent.change(screen.getByDisplayValue('120'), { target: { value: '150' } });
    fireEvent.click(screen.getByText('Guardar cantidades'));

    expect(onGuardar).toHaveBeenCalledWith({ 'i-pollo': 150 }, []);
  });

  it('los macros se recalculan con lo escrito, no con lo pautado', () => {
    pintar();
    // Bajar el pollo a la mitad tiene que dejar la proteína corta.
    fireEvent.change(screen.getByDisplayValue('120'), { target: { value: '60' } });
    expect(screen.getByText(/faltan/i)).toBeTruthy();
  });

  it('«volver a lo calculado» deja el formulario limpio', () => {
    const onGuardar = pintar({ 'i-pollo': 999 });
    fireEvent.click(screen.getByText('Volver a lo calculado'));
    fireEvent.click(screen.getByText('Guardar cantidades'));
    expect(onGuardar).toHaveBeenCalledWith({}, []);
  });
});

/**
 * El escalado tiene que respetar esos gramos: son la última palabra, y no se
 * recalculan aunque la pauta cambie.
 */
describe('Los gramos a mano mandan sobre el cálculo', () => {
  it('la receta escalada usa lo ajustado', () => {
    const e = scaleRecipe(RECETA, PAUTA, FOOD_CATALOG, { 'i-pollo': 200 });
    const p = e.ingredientes.find((i) => i.id === 'i-pollo')!;
    expect(p.cantidad_final).toBe(200);
    expect(p.ajustado).toBe(true);
  });

  it('lo que no se ajusta sigue calculándose solo', () => {
    const e = scaleRecipe(RECETA, PAUTA, FOOD_CATALOG, { 'i-pollo': 200 });
    const a = e.ingredientes.find((i) => i.id === 'i-arroz')!;
    expect(a.cantidad_final).toBe(55);
    expect(a.ajustado).toBeUndefined();
  });

  it('sin ajustes, todo se calcula como siempre', () => {
    const e = scaleRecipe(RECETA, PAUTA, FOOD_CATALOG);
    expect(e.ingredientes.find((i) => i.id === 'i-pollo')!.cantidad_final).toBe(120);
  });
});

describe('Dónde se guardan: en el plan, no en la receta', () => {
  const dia = {
    id: 'dt',
    nombre: 'Día base',
    proteinaGkg: 2,
    hcGkg: 3,
    meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
    grid: { comida: PAUTA },
    notas: {},
    ajustesReceta: { comida: { r1: { 'i-pollo': 150 } } },
  } as unknown as DayType;

  it('se leen los de esa comida y esa receta', () => {
    expect(ajustesDeReceta(dia, 'comida', 'r1')).toEqual({ 'i-pollo': 150 });
  });

  it('otra receta de la misma comida no los hereda', () => {
    expect(ajustesDeReceta(dia, 'comida', 'r2')).toEqual({});
  });

  it('ni la misma receta en otra comida', () => {
    expect(ajustesDeReceta(dia, 'cena', 'r1')).toEqual({});
  });

  it('un día sin ajustes devuelve vacío, no revienta', () => {
    const limpio = { ...dia, ajustesReceta: undefined } as unknown as DayType;
    expect(ajustesDeReceta(limpio, 'comida', 'r1')).toEqual({});
  });
});


/**
 * ACOMPAÑAMIENTOS
 *
 * Cuando a una comida le falta una porción y no tiene sentido subir lo que ya
 * hay —a una arepa con huevo no se le echa más huevo— se le pone otra cosa al
 * lado. Cuenta en los macros como un ingrediente más.
 */
describe('Poner algo al lado de la receta', () => {
  const yogur = FOOD_CATALOG.find((f) => f.grupo === 'lacteos_proteicos')!;

  const conYogur = [
    {
      id: 'ac1',
      foodId: yogur.id,
      nombre: yogur.nombre,
      gramos: 70,
      unidad: 'g',
      tipo: 'acompanamiento' as const,
    },
  ];

  it('suma a lo que cubre la receta', () => {
    const sin = scaleRecipe(RECETA, PAUTA, FOOD_CATALOG);
    const con = scaleRecipe(RECETA, PAUTA, FOOD_CATALOG, {}, conYogur);
    const proteinaDe = (e: ReturnType<typeof scaleRecipe>) =>
      Object.entries(e.cubiertos)
        .filter(([g]) => g.startsWith('proteicos') || g.startsWith('lacteos'))
        .reduce((s, [, n]) => s + (n ?? 0), 0);
    expect(proteinaDe(con)).toBeGreaterThan(proteinaDe(sin));
  });

  it('entra en la lista marcado como acompañamiento, sin escalar', () => {
    const e = scaleRecipe(RECETA, PAUTA, FOOD_CATALOG, {}, conYogur);
    const a = e.ingredientes.find((i) => i.id === 'ac1')!;
    expect(a.cantidad_final).toBe(70);
    expect(a.acompanamiento).toBe('acompanamiento');
    expect(a.escalable).toBe(false);
  });

  it('tapa un macro que la receta no traía', () => {
    // Una receta sin grasa a la que se le pone aceite al lado.
    const sinGrasa = { ...RECETA, base: { proteicos_magros: 1 }, ingredientes: [RECETA.ingredientes[0]] };
    const aceite = FOOD_CATALOG.find((f) => f.grupo === 'grasas')!;
    const sin = scaleRecipe(sinGrasa, { proteicos_magros: 2, grasas: 2 }, FOOD_CATALOG);
    expect(sin.gruposSinCubrir).toContain('grasas');

    const con = scaleRecipe(sinGrasa, { proteicos_magros: 2, grasas: 2 }, FOOD_CATALOG, {}, [
      { id: 'ac2', foodId: aceite.id, nombre: aceite.nombre, gramos: 10, tipo: 'acompanamiento' },
    ]);
    expect(con.gruposSinCubrir).toEqual([]);
  });

  it('se guardan junto con las cantidades', () => {
    const onGuardar = vi.fn();
    render(
      <AjustarCantidades
        receta={RECETA}
        requeridos={PAUTA}
        foods={FOOD_CATALOG}
        ajustes={{}}
        acompanamientos={conYogur}
        onGuardar={onGuardar}
        onCerrar={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Guardar cantidades'));
    expect(onGuardar).toHaveBeenCalledWith({}, conYogur);
  });

  it('se pueden quitar', () => {
    const onGuardar = vi.fn();
    render(
      <AjustarCantidades
        receta={RECETA}
        requeridos={PAUTA}
        foods={FOOD_CATALOG}
        ajustes={{}}
        acompanamientos={conYogur}
        onGuardar={onGuardar}
        onCerrar={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText(new RegExp(`Quitar ${yogur.nombre}`)));
    fireEvent.click(screen.getByText('Guardar cantidades'));
    expect(onGuardar).toHaveBeenCalledWith({}, []);
  });
});
