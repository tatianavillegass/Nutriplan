import { describe, it, expect } from 'vitest';
import { queCocinar, seCocinaEnTanda } from '../batchCooking';
import { diasDeLaSemana, lunesDe, menuVacio, ponerEnDias } from '../menuSemana';
import type { Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';

/**
 * COCINAR UNA VEZ PARA VARIOS DÍAS
 *
 * No se piensa por receta sino por ingrediente: da igual que el arroz esté en
 * el wok del martes y en el bowl del jueves, se cocina una olla. Y como lo
 * cocinado aguanta tres o cuatro días, va partido en tandas: decirle a alguien
 * que cocine el domingo lo que se come el sábado es mandarle a comer pollo de
 * siete días.
 */

const ARROZ = {
  id: 'f_arroz',
  nombre: 'Arroz blanco crudo',
  grupo: 'almidones',
  gramos: 18,
  intercambios: 1,
  nutrientes: { proteina: 7, hc: 78, grasa: 0.6 },
} as unknown as Alimento;

const LECHUGA = {
  id: 'f_lechuga',
  nombre: 'Lechuga',
  grupo: 'verduras',
  gramos: 100,
  intercambios: 1,
  nutrientes: { proteina: 1, hc: 2, grasa: 0 },
} as unknown as Alimento;

const FOODS = [ARROZ, LECHUGA];

const receta = (id: string, nombre: string): Receta => ({
  id,
  nombre,
  categorias: ['comida'],
  tags: [],
  base: { almidones: 3 },
  ingredientes: [
    {
      id: `${id}-i1`,
      nombre: 'Arroz',
      foodId: ARROZ.id,
      cantidad_base: 60,
      unidad: 'g',
      grupo: 'almidones',
      escalable: true,
      opcional: false,
    },
    {
      id: `${id}-i2`,
      nombre: 'Lechuga',
      foodId: LECHUGA.id,
      cantidad_base: 100,
      unidad: 'g',
      grupo: 'verduras',
      escalable: false,
      opcional: false,
    },
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
});

const WOK = receta('r_wok', 'Wok de pollo');
const BOWL = receta('r_bowl', 'Bowl de salmón');

const PLAN = {
  id: 'p1',
  clientId: 'c1',
  fase: 1,
  dayTypes: [
    {
      id: 'base',
      nombre: 'Base',
      meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
      grid: { comida: { almidones: 3 } },
    },
  ],
} as unknown as Plan;

const LUNES = lunesDe('2026-08-19');
const [lun, mar, mie, jue, vie] = diasDeLaSemana(LUNES);

describe('Qué cocinar', () => {
  it('junta el mismo ingrediente de recetas distintas', () => {
    let menu = ponerEnDias(menuVacio(LUNES), 'comida', WOK.id, [lun, mar]);
    menu = ponerEnDias(menu, 'comida', BOWL.id, [mie]);

    const arroz = queCocinar(menu, PLAN, [WOK, BOWL], FOODS)[0];

    expect(arroz.nombre).toBe('Arroz blanco crudo');
    expect(arroz.veces).toBe(3);
    // 60 g cada día, en crudo, que es lo que se pesa antes de la olla.
    expect(arroz.total).toBe(180);
    expect(arroz.enCrudo).toBe(true);
  });

  it('y dice en qué comidas se usa, para saber para qué es', () => {
    const menu = ponerEnDias(menuVacio(LUNES), 'comida', WOK.id, [lun, mar]);
    const arroz = queCocinar(menu, PLAN, [WOK], FOODS)[0];

    expect(arroz.tandas[0].usos.map((u) => u.dia)).toEqual(['Lunes', 'Martes']);
    expect(arroz.tandas[0].usos[0].receta).toBe('Wok de pollo');
  });

  /**
   * El límite real de cualquier guía de batch cooking. Sin esto, la app manda
   * a cocinar el domingo lo que se come el sábado.
   */
  it('parte en tandas lo que no aguanta hasta el final de la semana', () => {
    const menu = ponerEnDias(menuVacio(LUNES), 'comida', WOK.id, [lun, mar, jue, vie]);
    const arroz = queCocinar(menu, PLAN, [WOK], FOODS)[0];

    expect(arroz.tandas).toHaveLength(2);
    expect(arroz.tandas[0].desde).toBe(lun);
    expect(arroz.tandas[1].desde).toBe(jue);
    // Cada tanda con lo suyo: dos comidas y dos comidas.
    expect(arroz.tandas[0].gramos).toBe(120);
    expect(arroz.tandas[1].gramos).toBe(120);
  });

  it('la verdura no entra: se come fresca', () => {
    const menu = ponerEnDias(menuVacio(LUNES), 'comida', WOK.id, [lun, mar]);
    const lista = queCocinar(menu, PLAN, [WOK], FOODS);

    expect(lista.some((c) => c.nombre === 'Lechuga')).toBe(false);
  });

  it('y lo que sale una sola vez tampoco: eso no es batch cooking, es cenar', () => {
    const menu = ponerEnDias(menuVacio(LUNES), 'comida', WOK.id, [lun]);
    expect(queCocinar(menu, PLAN, [WOK], FOODS)).toEqual([]);
  });
});

/**
 * NO TODO LO QUE ES PROTEÍNA SE COCINA EN TANDA
 *
 * El huevo revuelto y el queso feta son del mismo subgrupo que el pollo, pero
 * no hay nada que adelantar: nadie se come unos huevos revueltos de cuatro
 * días. Lo decide el alimento, y ella puede fijarlo si su cocina va de otra
 * manera.
 */
describe('Qué se cocina en tanda', () => {
  it('el arroz y el pollo sí', () => {
    expect(seCocinaEnTanda({ nombre: 'Arroz blanco crudo', grupo: 'almidones' })).toBe(true);
    expect(
      seCocinaEnTanda({ nombre: 'Pechuga de pollo cruda', grupo: 'proteicos_magros' }),
    ).toBe(true);
  });

  it('el huevo y el queso feta no', () => {
    expect(seCocinaEnTanda({ nombre: 'Huevo', grupo: 'proteicos_grasos' })).toBe(false);
    expect(seCocinaEnTanda({ nombre: 'Queso feta', grupo: 'proteicos_grasos' })).toBe(false);
    expect(seCocinaEnTanda({ nombre: 'Yogur griego', grupo: 'lacteos_proteicos' })).toBe(false);
  });

  it('las verduras al horno sí, porque se adelantan', () => {
    expect(seCocinaEnTanda({ nombre: 'Calabacín', grupo: 'verduras' })).toBe(true);
  });

  it('y lo que ella diga manda sobre todo lo anterior', () => {
    expect(seCocinaEnTanda({ nombre: 'Huevo', grupo: 'proteicos_grasos', batch: true })).toBe(true);
    expect(
      seCocinaEnTanda({ nombre: 'Arroz blanco crudo', grupo: 'almidones', batch: false }),
    ).toBe(false);
  });
});
