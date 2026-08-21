import { describe, it, expect } from 'vitest';
import { listaDeLaCompra, vecesPorReceta } from '../listaCompra';
import { diasDeLaSemana, lunesDe, menuVacio, ponerEnDias, ponerTipoDeDia } from '../menuSemana';
import type { Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';

/**
 * DE LO QUE VA A COMER A LO QUE HAY QUE COMPRAR
 *
 * En fase 1 nadie sabe qué va a comer el jueves hasta el jueves, así que no
 * había forma de hacer la compra. Con el menú de la semana sí: se suman los
 * ingredientes de cada día, con los gramos que le tocan a ella.
 */

const POLLO = {
  id: 'f_pollo',
  nombre: 'Pechuga de pollo cruda',
  grupo: 'proteicos_magros',
  gramos: 30,
  intercambios: 1,
  nutrientes: { proteina: 23, hc: 0, grasa: 2 },
} as unknown as Alimento;

const HUEVO = {
  id: 'f_huevo',
  nombre: 'Huevo',
  grupo: 'proteicos_grasos',
  medida_casera: '1 huevo',
  gramos: 55,
  intercambios: 1,
  nutrientes: { proteina: 12.5, hc: 0, grasa: 11 },
} as unknown as Alimento;

const LECHUGA = {
  id: 'f_lechuga',
  nombre: 'Lechuga',
  grupo: 'verduras',
  gramos: 100,
  intercambios: 1,
  nutrientes: { proteina: 1, hc: 2, grasa: 0 },
} as unknown as Alimento;

const FOODS = [POLLO, HUEVO, LECHUGA];

const CENA: Receta = {
  id: 'r_cena',
  nombre: 'Pollo con ensalada',
  categorias: ['cena'],
  tags: [],
  base: { proteicos_magros: 3 },
  ingredientes: [
    {
      id: 'i1',
      nombre: 'Pechuga de pollo',
      foodId: POLLO.id,
      cantidad_base: 90,
      unidad: 'g',
      grupo: 'proteicos_magros',
      escalable: true,
      opcional: false,
    },
    {
      id: 'i2',
      nombre: 'Lechuga',
      foodId: LECHUGA.id,
      cantidad_base: null,
      unidad: 'g',
      grupo: 'verduras',
      escalable: false,
      opcional: false,
    },
    {
      id: 'i3',
      nombre: 'Perejil',
      cantidad_base: 2,
      unidad: 'g',
      grupo: 'condimento',
      escalable: false,
      opcional: false,
    },
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const PLAN: Plan = {
  id: 'p1',
  clientId: 'c1',
  fase: 1,
  dayTypes: [
    {
      id: 'descanso',
      nombre: 'Descanso',
      meals: [{ id: 'cena', nombre: 'Cena', slot: 'cena', orden: 1 }],
      grid: { cena: { proteicos_magros: 3 } },
    },
    {
      id: 'entreno',
      nombre: 'Entreno',
      meals: [{ id: 'cena', nombre: 'Cena', slot: 'cena', orden: 1 }],
      grid: { cena: { proteicos_magros: 6 } },
    },
  ],
} as unknown as Plan;

const LUNES = lunesDe('2026-08-19');
const [lun, mar] = diasDeLaSemana(LUNES);

describe('La lista de la compra', () => {
  it('suma el mismo alimento de todos los días', () => {
    const menu = ponerEnDias(menuVacio(LUNES), 'cena', CENA.id, [lun, mar]);
    const { lineas, comidas } = listaDeLaCompra(menu, PLAN, [CENA], FOODS);

    expect(comidas).toBe(2);
    const pollo = lineas.find((l) => l.foodId === POLLO.id)!;
    // 90 g cada noche, redondeado a la decena de gramos.
    expect(pollo.cantidad).toBe(180);
    expect(pollo.veces).toBe(2);
  });

  /**
   * Es la razón de ser de todo esto: la misma cena, con más pollo el día que
   * entrena. Sin esto habría que hacer dos listas o comprar a ojo.
   */
  it('y usa las cantidades del tipo de día de cada fecha', () => {
    const conEntreno = ponerTipoDeDia(
      ponerEnDias(menuVacio(LUNES), 'cena', CENA.id, [lun, mar]),
      mar,
      'entreno',
    );
    const { lineas } = listaDeLaCompra(conEntreno, PLAN, [CENA], FOODS);
    const pollo = lineas.find((l) => l.foodId === POLLO.id)!;

    // Lunes 90 g y martes el doble: 270 g.
    expect(pollo.cantidad).toBe(270);
  });

  it('la verdura se cuenta por veces, no por peso', () => {
    const menu = ponerEnDias(menuVacio(LUNES), 'cena', CENA.id, [lun, mar]);
    const { lineas } = listaDeLaCompra(menu, PLAN, [CENA], FOODS);
    const lechuga = lineas.find((l) => l.nombre === 'Lechuga')!;

    expect(lechuga.alGusto).toBe(true);
    expect(lechuga.veces).toBe(2);
    expect(lechuga.cantidad).toBe(0);
  });

  it('y lo que no está en el catálogo se enseña aparte, marcado', () => {
    const menu = ponerEnDias(menuVacio(LUNES), 'cena', CENA.id, [lun]);
    const { lineas } = listaDeLaCompra(menu, PLAN, [CENA], FOODS);
    const perejil = lineas.find((l) => l.nombre === 'Perejil');

    // Va al final y avisado: no se puede sumar lo que no se sabe qué es.
    expect(perejil?.alGusto || perejil?.sinEnlazar).toBe(true);
    expect(lineas[lineas.length - 1].nombre).toBe('Perejil');
  });
});

/**
 * «7,3 huevos» no es una lista de la compra: son 8. Lo que se vende por piezas
 * sube a la pieza entera y el resto a la decena de gramos.
 */
describe('Lo que se compra se redondea', () => {
  const CONHUEVO: Receta = {
    ...CENA,
    id: 'r_huevo',
    base: { proteicos_grasos: 2 },
    ingredientes: [
      {
        id: 'h1',
        nombre: 'Huevo',
        foodId: HUEVO.id,
        cantidad_base: 110,
        unidad: 'g',
        grupo: 'proteicos_grasos',
        escalable: true,
        opcional: false,
      },
    ],
  };

  const PLAN_HUEVO = {
    ...PLAN,
    dayTypes: [
      {
        ...PLAN.dayTypes[0],
        grid: { cena: { proteicos_grasos: 3 } },
      },
    ],
  } as unknown as Plan;

  it('a piezas enteras', () => {
    const menu = ponerEnDias(menuVacio(LUNES), 'cena', CONHUEVO.id, [lun]);
    const { lineas } = listaDeLaCompra(menu, PLAN_HUEVO, [CONHUEVO], FOODS);
    const huevo = lineas.find((l) => l.foodId === HUEVO.id)!;

    expect(huevo.piezas).toBe(3);
    expect(huevo.cantidad).toBe(165);
  });
});

/**
 * La misma semana leída por receta es la cabeza del batch cooking: si el pollo
 * sale tres veces, se cocina una vez para tres días.
 */
describe('Cuántas veces sale cada receta', () => {
  it('se cuenta sin guardar nada nuevo', () => {
    const menu = ponerEnDias(menuVacio(LUNES), 'cena', CENA.id, [lun, mar]);
    expect(vecesPorReceta(menu, [CENA])).toEqual([{ receta: CENA, veces: 2 }]);
  });
});

/**
 * LOS DÍAS DE LA SEMANA
 *
 * El menú vive en el registro del lunes, así que hay que saber cuál es sin
 * líos: el domingo es el final de su semana, no el principio de la siguiente.
 */
describe('La semana', () => {
  it('empieza en lunes y el domingo es el último día', () => {
    // 2026-08-19 es miércoles.
    expect(lunesDe('2026-08-19')).toBe('2026-08-17');
    expect(lunesDe('2026-08-23')).toBe('2026-08-17');
    expect(diasDeLaSemana('2026-08-17')).toHaveLength(7);
    expect(diasDeLaSemana('2026-08-17')[6]).toBe('2026-08-23');
  });

  /**
   * Desmarcar el martes no puede borrar la receta que el martes tenía puesta
   * por otro lado: sólo se quita lo suyo.
   */
  it('y quitar una receta de unos días no toca lo demás', () => {
    const con = ponerEnDias(menuVacio(LUNES), 'cena', 'r1', [lun, mar]);
    const otra = ponerEnDias(con, 'cena', 'r2', [mar]);
    const menos = ponerEnDias(otra, 'cena', 'r1', [lun]);

    expect(menos.dias[lun].comidas.cena).toBe('r1');
    expect(menos.dias[mar].comidas.cena).toBe('r2');
  });
});
