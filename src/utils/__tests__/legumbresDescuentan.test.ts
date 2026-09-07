import { describe, it, expect } from 'vitest';
import type { PorcionesMarcadas } from '../../types/diary';
import type { DayType, Meal } from '../../types/plan';
import { columnasDeComida } from '../combosGuardados';
import { cubiertoPorOtroMacro, elegirOpcion, marcadoDeBucket } from '../marcado';
import { FOOD_CATALOG } from '../../data/foodCatalog';

/**
 * SI YA HA ELEGIDO LENTEJAS, LA PROTEÍNA PIDE MENOS
 *
 * Una porción de legumbre son 14 g de hidrato Y 7 g de proteína. Al elegirla en
 * la columna del carbohidrato, la proteína de esa comida ya está medio hecha —
 * pero la columna se calculaba sólo del reparto pautado, así que seguía
 * pidiendo las cuatro porciones enteras y quien las marcaba se comía la
 * proteína dos veces.
 */

const COMIDA: Meal = { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 3 };

const LENTEJAS = FOOD_CATALOG.find((f) => f.id === 'a-lentejas-cocidas')!;
const POLLO = FOOD_CATALOG.find((f) => f.id === 'a-pechuga-de-pollo-cruda')!;
const ARROZ = FOOD_CATALOG.find((f) => f.id === 'a-arroz-blanco-crudo')!;

/** 3 de carbohidrato y 4 de proteína, con lentejas en la despensa. */
const DIA = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 1.8,
  hcGkg: 3,
  meals: [COMIDA],
  grid: { comida: { almidones: 3, proteicos_magros: 4 } },
  notas: {},
  despensa: {
    comida: { alimentos: [LENTEJAS.id, ARROZ.id, POLLO.id] },
  },
} as unknown as DayType;

const columnas = (porciones?: PorcionesMarcadas) =>
  columnasDeComida(DIA, COMIDA, FOOD_CATALOG, { porciones });

const de = (cols: ReturnType<typeof columnas>, bucket: string) =>
  cols.find((c) => c.bucket === bucket)!;

describe('Sin nada marcado', () => {
  it('la proteína pide las cuatro porciones, como siempre', () => {
    expect(de(columnas(), 'proteina').objetivo.porciones).toBe(4);
    expect(de(columnas(), 'carbohidrato').objetivo.porciones).toBe(3);
  });

  /** En el PDF y en la pantalla de la nutricionista no hay nada que descontar. */
  it('y sin porciones se comporta igual que antes', () => {
    expect(de(columnas(), 'proteina').cubiertoPorOtro).toBeUndefined();
  });
});

describe('Con lentejas elegidas en el carbohidrato', () => {
  // 3 porciones de lentejas cubren el hidrato Y 3 de proteína.
  const conLentejas: PorcionesMarcadas = { comida: { [LENTEJAS.id]: 3 } };

  it('se sabe cuánta proteína le trae otro macro', () => {
    expect(cubiertoPorOtroMacro(conLentejas, 'comida', 'proteina', FOOD_CATALOG)).toBe(3);
  });

  it('la columna de proteína pide sólo lo que falta', () => {
    const col = de(columnas(conLentejas), 'proteina');
    expect(col.objetivo.porciones).toBe(1);
    expect(col.cubiertoPorOtro).toBe(3);
  });

  it('y genera opciones de esa porción, no de cuatro', () => {
    const col = de(columnas(conLentejas), 'proteina');
    expect(col.opciones.length).toBeGreaterThan(0);
    for (const o of col.opciones) {
      const total = o.items.reduce((s, i) => s + i.intercambios, 0);
      expect(total).toBeCloseTo(1, 1);
    }
  });

  /** El carbohidrato no se toca: la proteína del pollo no es hidrato. */
  it('el carbohidrato sigue pidiendo lo mismo', () => {
    expect(de(columnas(conLentejas), 'carbohidrato').objetivo.porciones).toBe(3);
  });

  /**
   * Y la pescadilla que hay que evitar: si lo marcado en la propia columna
   * bajara el objetivo, cada porción de pollo lo bajaría y nunca se llegaría.
   */
  it('marcar pollo no baja el objetivo de la proteína', () => {
    const conPollo: PorcionesMarcadas = { comida: { [POLLO.id]: 2 } };
    expect(cubiertoPorOtroMacro(conPollo, 'comida', 'proteina', FOOD_CATALOG)).toBe(0);
    expect(de(columnas(conPollo), 'proteina').objetivo.porciones).toBe(4);
  });

  /** Al desmarcarlas vuelve a pedir las cuatro: no queda nada pegado. */
  it('y al quitar las lentejas vuelve a pedir cuatro', () => {
    expect(de(columnas({ comida: {} }), 'proteina').objetivo.porciones).toBe(4);
  });
});

describe('Cuando la legumbre lo cubre todo', () => {
  it('la columna lo dice en vez de quedarse sin opciones', () => {
    const pocaProteina = {
      ...DIA,
      grid: { comida: { almidones: 3, proteicos_magros: 2 } },
    } as unknown as DayType;

    const cols = columnasDeComida(pocaProteina, COMIDA, FOOD_CATALOG, {
      porciones: { comida: { [LENTEJAS.id]: 3 } },
    });
    const col = cols.find((c) => c.bucket === 'proteina')!;

    expect(col.cubiertoDelTodo).toBe(true);
    expect(col.opciones).toEqual([]);
  });
});

/**
 * Y el recuento de lo marcado sigue contando la legumbre en los dos macros:
 * lo que cambia es el objetivo, no lo que se ha comido.
 */
describe('Lo marcado no cambia', () => {
  it('la legumbre sigue contando en proteína y en carbohidrato', () => {
    const p: PorcionesMarcadas = { comida: { [LENTEJAS.id]: 3 } };
    expect(marcadoDeBucket(p, 'comida', 'proteina', FOOD_CATALOG)).toBe(3);
    expect(marcadoDeBucket(p, 'comida', 'carbohidrato', FOOD_CATALOG)).toBe(3);
  });

  it('y elegir la opción de lentejas marca sus porciones', () => {
    const cols = columnas();
    const carbo = de(cols, 'carbohidrato');
    const conLentejas = carbo.opciones.find((o) =>
      o.items.some((i) => i.foodId === LENTEJAS.id),
    );
    if (!conLentejas) return; // la despensa puede no dar esa combinación
    const p = elegirOpcion({}, 'comida', conLentejas, FOOD_CATALOG);
    expect(marcadoDeBucket(p, 'comida', 'carbohidrato', FOOD_CATALOG)).toBeCloseTo(3, 1);
  });
});
