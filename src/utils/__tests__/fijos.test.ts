import { describe, it, expect } from 'vitest';
import {
  aporteDeFijo,
  aporteDeFijos,
  fijosDeComida,
  hayDescuadre,
  pautaDeComida,
} from '../fijos';
import type { DayType, Fijo } from '../../types/plan';
import type { Alimento } from '../../types/food';

/**
 * LO QUE VA SIEMPRE, Y EL POSTRE
 *
 * El café con leche del desayuno y el cuadrito de chocolate de después de
 * cenar había que meterlos opción por opción: cinco desayunos, cinco cafés.
 * Ahora se ponen una vez en la comida, van con todas sus opciones y **gastan
 * de lo pautado**, como el aceite de cocción.
 */

const LECHE: Alimento = {
  id: 'a-leche-semi',
  nombre: 'Leche semidesnatada',
  grupo: 'lacteos_semi',
  medida_casera: '1 vaso',
  gramos: 200,
  unidad: 'ml',
  intercambios: 1,
  nutrientes: { kcal: 46, hc: 4.9, proteina: 3.4, grasa: 1.6 },
  comidas_sugeridas: ['desayuno'],
  alergenos: [],
  apto: [],
};

const CHOCOLATE: Alimento = {
  ...LECHE,
  id: 'a-chocolate',
  nombre: 'Chocolate 85%',
  grupo: 'grasas',
  medida_casera: '11 g',
  gramos: 11,
  unidad: undefined,
  nutrientes: { kcal: 576, hc: 22, proteina: 12, grasa: 46 },
};

const FOODS = [LECHE, CHOCOLATE];

const cafe: Fijo = {
  id: 'f1',
  foodId: LECHE.id,
  nombre: 'Café con leche',
  gramos: 100, // medio vaso → medio lácteo
  unidad: 'ml',
};

const postre: Fijo = {
  id: 'f2',
  foodId: CHOCOLATE.id,
  nombre: 'Cuadrito de chocolate',
  gramos: 11,
  tipo: 'postre',
  dias: [1, 4], // martes y viernes
};

const dia = (fijos: Record<string, Fijo[]>, grid: DayType['grid']) =>
  ({ fijos, grid }) as Pick<DayType, 'fijos' | 'grid'>;

describe('Lo que gasta un fijo', () => {
  it('sus gramos entre los que hacen una porción', () => {
    expect(aporteDeFijo(cafe, FOODS)).toEqual({ lacteos_semi: 0.5 });
  });

  it('y varios se suman', () => {
    expect(aporteDeFijos([cafe, cafe], FOODS)).toEqual({ lacteos_semi: 1 });
  });

  /* Sin alimento detrás no se sabe lo que aporta: es una nota, y no inventa. */
  it('sin alimento del catálogo no gasta nada', () => {
    expect(aporteDeFijo({ id: 'x', nombre: 'Infusión', gramos: 0 }, FOODS)).toEqual({});
  });
});

describe('La pauta que les queda a las opciones', () => {
  const d = dia({ desayuno: [cafe] }, { desayuno: { lacteos_semi: 1, almidones: 2 } });

  it('el café se lleva su medio lácteo', () => {
    const p = pautaDeComida(d, 'desayuno', FOODS);
    expect(p.pauta.lacteos_semi).toBe(0.5);
    expect(p.gastado).toEqual({ lacteos_semi: 0.5 });
  });

  it('y lo que no toca se queda como estaba', () => {
    expect(pautaDeComida(d, 'desayuno', FOODS).pauta.almidones).toBe(2);
  });

  it('si se lo lleva entero, ese grupo desaparece de lo elegible', () => {
    const entero = dia(
      { desayuno: [{ ...cafe, gramos: 200 }] },
      { desayuno: { lacteos_semi: 1 } },
    );
    expect(pautaDeComida(entero, 'desayuno', FOODS).pauta.lacteos_semi).toBeUndefined();
  });
});

/**
 * La app NO se lo quita a otra comida por su cuenta: eso sería mover su pauta
 * sin que lo vea. Lo dice y ella decide.
 */
describe('Lo que no estaba pautado se avisa', () => {
  const sinLacteo = dia({ desayuno: [cafe] }, { desayuno: { almidones: 2 } });

  it('se dice cuánto sobra, no el intercambio entero', () => {
    const p = pautaDeComida(sinLacteo, 'desayuno', FOODS);
    expect(p.sinPautar).toEqual({ lacteos_semi: 0.5 });
    expect(hayDescuadre(p)).toBe(true);
  });

  it('con 1 pautado y 1,5 gastado, sobra 0,5', () => {
    const d = dia(
      { desayuno: [{ ...cafe, gramos: 300 }] },
      { desayuno: { lacteos_semi: 1 } },
    );
    expect(pautaDeComida(d, 'desayuno', FOODS).sinPautar).toEqual({ lacteos_semi: 0.5 });
  });

  it('y cuando cuadra, no hay nada que avisar', () => {
    const d = dia({ desayuno: [cafe] }, { desayuno: { lacteos_semi: 1 } });
    expect(hayDescuadre(pautaDeComida(d, 'desayuno', FOODS))).toBe(false);
  });
});

/** «Chocolate los martes y los viernes» es el mismo concepto que el café. */
describe('El postre es un fijo con días', () => {
  const d = dia({ cena: [postre] }, { cena: { grasas: 2, proteicos_magros: 3 } });

  it('el martes se lo come y se lleva su grasa', () => {
    const p = pautaDeComida(d, 'cena', FOODS, 1);
    expect(p.fijos).toHaveLength(1);
    expect(p.pauta.grasas).toBe(1);
  });

  it('el lunes no, y la cena va entera', () => {
    const p = pautaDeComida(d, 'cena', FOODS, 0);
    expect(p.fijos).toHaveLength(0);
    expect(p.pauta.grasas).toBe(2);
  });

  it('sin decir qué día, se cuentan todos los que hay', () => {
    expect(fijosDeComida({ fijos: { cena: [postre] } }, 'cena')).toHaveLength(1);
  });

  /* Sin días puestos va siempre: es el caso del café. */
  it('el que no lleva días va todos', () => {
    const todos = dia({ desayuno: [cafe] }, { desayuno: { lacteos_semi: 1 } });
    for (let i = 0; i < 7; i++) {
      expect(pautaDeComida(todos, 'desayuno', FOODS, i).fijos).toHaveLength(1);
    }
  });
});

describe('Sin fijos no cambia nada', () => {
  it('la pauta es la de siempre', () => {
    const d = dia({}, { comida: { proteicos_magros: 4, almidones: 3 } });
    const p = pautaDeComida(d, 'comida', FOODS);
    expect(p.pauta).toEqual({ proteicos_magros: 4, almidones: 3 });
    expect(p.fijos).toEqual([]);
    expect(hayDescuadre(p)).toBe(false);
  });
});


/**
 * UN CAFÉ CON LECHE TODOS LOS DÍAS ES LITRO Y MEDIO A LA SEMANA
 *
 * No sale en ninguna receta —va en la comida, no en el plato— así que sin
 * esto la lista de la compra se quedaba corta justo en lo que se toma a
 * diario.
 */
describe('La lista de la compra lo incluye', () => {
  it('suma los gramos de cada día que toca', async () => {
    const { listaDeLaCompra } = await import('../listaCompra');
    const dayType = {
      id: 'dt',
      nombre: 'Base',
      proteinaGkg: 2,
      hcGkg: 3,
      meals: [{ id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 }],
      grid: { desayuno: { lacteos_semi: 1 } },
      notas: {},
      fijos: { desayuno: [cafe] },
    } as unknown as DayType;

    const menu = {
      inicio: '2026-01-05',
      dias: Object.fromEntries(
        ['2026-01-05', '2026-01-06', '2026-01-07'].map((f) => [
          f,
          { dayTypeId: 'dt', comidas: {} },
        ]),
      ),
    };

    const lista = listaDeLaCompra(
      menu as never,
      { id: 'p', dayTypes: [dayType] } as never,
      [],
      FOODS,
    );
    const leche = lista.lineas.find((l) => l.nombre.includes('Leche'));
    expect(leche).toBeTruthy();
    // Tres días a 100 ml, ya redondeado a lo que se vende.
    expect(leche!.cantidad).toBeGreaterThanOrEqual(300);
    expect(leche!.veces).toBe(3);
  });

  it('y el postre sólo los días marcados', async () => {
    const { listaDeLaCompra } = await import('../listaCompra');
    const dayType = {
      id: 'dt',
      nombre: 'Base',
      proteinaGkg: 2,
      hcGkg: 3,
      meals: [{ id: 'cena', nombre: 'Cena', slot: 'cena', orden: 1 }],
      grid: { cena: { grasas: 2 } },
      notas: {},
      // Martes y viernes.
      fijos: { cena: [postre] },
    } as unknown as DayType;

    const menu = {
      inicio: '2026-01-05',
      dias: Object.fromEntries(
        ['2026-01-05', '2026-01-06', '2026-01-07'].map((f) => [
          f,
          { dayTypeId: 'dt', comidas: {} },
        ]),
      ),
    };

    const lista = listaDeLaCompra(
      menu as never,
      { id: 'p', dayTypes: [dayType] } as never,
      [],
      FOODS,
    );
    const choco = lista.lineas.find((l) => l.nombre.includes('Chocolate'));
    // De los tres días puestos, sólo el martes lleva postre.
    expect(choco?.veces).toBe(1);
  });
});
