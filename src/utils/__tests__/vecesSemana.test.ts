import { describe, it, expect } from 'vitest';
import type { MenuSemana } from '../../types/diary';
import type { OpcionEscalada } from '../mealOptions';
import {
  DIAS_DE_LA_SEMANA,
  comidasDecididas,
  comoVaLaComida,
  ponerVeces,
  vecesDe,
} from '../vecesSemana';
import { listaDesdeVeces } from '../listaCompra';
import { FOOD_CATALOG } from '../../data/foodCatalog';

/**
 * CUÁNTAS VECES, NO QUÉ DÍA
 *
 * En fase 2 la clienta no come platos: come combinaciones que elige cada
 * mañana. Pedirle que diga «el martes huevos» le quita la libertad que esa
 * fase existe para darle, y sin saber qué come el jueves no hay lista de la
 * compra. Decir «huevos tres veces» resuelve las dos cosas.
 */

const HUEVO = FOOD_CATALOG.find((f) => f.id === 'a-huevo')!;
const CLARA = FOOD_CATALOG.find((f) => f.id === 'a-clara-de-huevo')!;
const PAN = FOOD_CATALOG.find((f) => f.id === 'a-pan-blanco-molde')!;

const item = (food: typeof HUEVO, gramos: number, intercambios: number) => ({
  foodId: food.id,
  nombre: food.nombre,
  grupo: food.grupo!,
  intercambios,
  gramos,
  unidad: food.unidad ?? 'g',
  medida: `${gramos} g`,
});

const opcion = (id: string, items: ReturnType<typeof item>[]): OpcionEscalada =>
  ({
    id,
    bucket: 'proteina',
    items,
    texto: id,
    cubre: {},
    unificada: false,
  }) as OpcionEscalada;

const HUEVOS_Y_CLARAS = opcion('huevos+claras', [
  item(HUEVO, 110, 2),
  item(CLARA, 130, 2),
]);
const SOLO_HUEVOS = opcion('huevos', [item(HUEVO, 110, 2)]);
const EL_PAN = {
  ...opcion('pan', [item(PAN, 60, 2)]),
  bucket: 'carbohidrato' as const,
};

const vacio = (): MenuSemana => ({ inicio: '2026-08-31', dias: {} });

describe('Poner cuántas veces', () => {
  it('guarda el número de esa opción en esa comida', () => {
    const m = ponerVeces(vacio(), 'desayuno', 'huevos+claras', 3);
    expect(vecesDe(m, 'desayuno', 'huevos+claras')).toBe(3);
    expect(vecesDe(m, 'desayuno', 'otra')).toBe(0);
    expect(vecesDe(m, 'comida', 'huevos+claras')).toBe(0);
  });

  /** Cero es «no la como», no «la como cero veces»: se borra. */
  it('a cero se borra en vez de guardar un cero', () => {
    let m = ponerVeces(vacio(), 'desayuno', 'huevos', 2);
    m = ponerVeces(m, 'desayuno', 'huevos', 0);
    expect(m.veces?.desayuno).toEqual({});
  });

  it('no baja de cero ni pasa de los días de la semana', () => {
    const m = ponerVeces(vacio(), 'desayuno', 'huevos', 99);
    expect(vecesDe(m, 'desayuno', 'huevos')).toBe(DIAS_DE_LA_SEMANA);
    expect(vecesDe(ponerVeces(m, 'desayuno', 'huevos', -3), 'desayuno', 'huevos')).toBe(0);
  });

  it('sin nada puesto, no hay nada decidido', () => {
    expect(comidasDecididas(undefined)).toBe(0);
    expect(comidasDecididas(vacio())).toBe(0);
  });
});

/**
 * Se cuenta POR MACRO: las columnas de fase 2 son independientes —se elige una
 * proteína, un carbohidrato y una grasa— y cada una tiene que llegar a siete
 * por su cuenta.
 */
describe('Cómo va cada macro', () => {
  const columnas = [
    { bucket: 'proteina' as const, opciones: [HUEVOS_Y_CLARAS, SOLO_HUEVOS] },
    { bucket: 'carbohidrato' as const, opciones: [EL_PAN] },
  ];

  it('suma las veces de todas las opciones de ese macro', () => {
    let m = ponerVeces(vacio(), 'desayuno', 'huevos+claras', 3);
    m = ponerVeces(m, 'desayuno', 'huevos', 4);
    const como = comoVaLaComida(m, 'desayuno', columnas);
    expect(como[0]).toEqual({ bucket: 'proteina', puestas: 7, faltan: 0 });
  });

  /** Dejar días sueltos para improvisar es una decisión, no un fallo. */
  it('y dice cuántos días quedan sin decidir, sin reñir', () => {
    const m = ponerVeces(vacio(), 'desayuno', 'huevos+claras', 5);
    expect(comoVaLaComida(m, 'desayuno', columnas)[0].faltan).toBe(2);
  });

  it('pasarse también se dice, en negativo', () => {
    let m = ponerVeces(vacio(), 'desayuno', 'huevos+claras', 5);
    m = ponerVeces(m, 'desayuno', 'huevos', 4);
    expect(comoVaLaComida(m, 'desayuno', columnas)[0].faltan).toBe(-2);
  });

  it('cada macro va por su cuenta', () => {
    const m = ponerVeces(vacio(), 'desayuno', 'pan', 7);
    const como = comoVaLaComida(m, 'desayuno', columnas);
    expect(como[0].faltan).toBe(7);
    expect(como[1].faltan).toBe(0);
  });
});

/**
 * LA COMPRA ES UNA MULTIPLICACIÓN
 *
 * Tres desayunos de dos huevos son seis huevos. Y pasa por el mismo redondeo y
 * las mismas secciones que la lista de fase 1, así que no hay dos formatos.
 */
describe('La lista de la compra desde las veces', () => {
  const comidas = [
    { mealId: 'desayuno', opciones: [HUEVOS_Y_CLARAS, SOLO_HUEVOS, EL_PAN] },
  ];

  it('multiplica los gramos por las veces', () => {
    let m = ponerVeces(vacio(), 'desayuno', 'huevos+claras', 3);
    m = ponerVeces(m, 'desayuno', 'pan', 7);
    const lista = listaDesdeVeces(comidas, m.veces, FOOD_CATALOG);

    const pan = lista.lineas.find((l) => l.foodId === PAN.id)!;
    expect(pan.cantidad).toBe(420); // 60 g × 7
  });

  /** El mismo alimento en dos opciones se suma en una sola línea. */
  it('y suma el mismo alimento aunque venga de dos opciones', () => {
    let m = ponerVeces(vacio(), 'desayuno', 'huevos+claras', 3);
    m = ponerVeces(m, 'desayuno', 'huevos', 4);
    const lista = listaDesdeVeces(comidas, m.veces, FOOD_CATALOG);

    const huevo = lista.lineas.filter((l) => l.foodId === HUEVO.id);
    expect(huevo).toHaveLength(1);
    // 110 g × 7 veces = 770 g, que redondeado a piezas son 14 huevos.
    expect(huevo[0].piezas).toBe(14);
    expect(huevo[0].veces).toBe(7);
  });

  it('lo que no se come no entra en la lista', () => {
    const m = ponerVeces(vacio(), 'desayuno', 'huevos+claras', 2);
    const lista = listaDesdeVeces(comidas, m.veces, FOOD_CATALOG);
    expect(lista.lineas.find((l) => l.foodId === PAN.id)).toBeUndefined();
    expect(lista.comidas).toBe(2);
  });

  it('sin nada puesto, la lista está vacía', () => {
    expect(listaDesdeVeces(comidas, undefined, FOOD_CATALOG).lineas).toEqual([]);
  });

  /** Las secciones son las del supermercado, iguales que en fase 1. */
  it('se ordena por secciones, como la de siempre', () => {
    let m = ponerVeces(vacio(), 'desayuno', 'huevos', 3);
    m = ponerVeces(m, 'desayuno', 'pan', 3);
    const lista = listaDesdeVeces(comidas, m.veces, FOOD_CATALOG);
    expect(lista.lineas[0].seccion).toBe('Carnes, pescados y huevos');
    expect(lista.lineas[1].seccion).toBe('Cereales, pan y tubérculos');
  });
});
