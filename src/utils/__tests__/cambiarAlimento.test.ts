import { describe, it, expect } from 'vitest';
import { alternativasDe, conAlimentoCambiado } from '../cambiarAlimento';
import { columnasDeComida } from '../combosGuardados';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Meal } from '../../types/plan';
import type { ItemOpcion } from '../mealOptions';

/**
 * CAMBIAR LA FRUTA SIN CAMBIAR DE OPCIÓN
 *
 * En cuanto la nutricionista compone «avena con arándanos», la app deja de
 * proponer y esa es la única que ve la clienta: el día que no le apetezcan
 * arándanos no hay nada que hacer. Ahora se pulsa el alimento y salen sus
 * alternativas, con los gramos ya hechos y la avena en su sitio.
 */

const DESAYUNO = { id: 'd', nombre: 'Desayuno', slot: 'desayuno', orden: 1 } as Meal;

/** Su despensa de desayuno: tres frutas y dos almidones. */
const DESPENSA = ['a-platano', 'a-manzana', 'a-arandanos', 'a-avena-copos', 'a-pan-integral'];

const dia = (seleccion = DESPENSA): DayType =>
  ({
    id: 'dt',
    nombre: 'Día base',
    meals: [DESAYUNO],
    grid: { d: { almidones: 1, fruta: 1 } },
    notas: {},
    despensa: { d: { seleccion } },
  }) as unknown as DayType;

/** La primera opción del carbohidrato, que lleva una fruta y un almidón. */
const primeraOpcion = (dayType: DayType) => {
  const col = columnasDeComida(dayType, DESAYUNO, FOOD_CATALOG).find(
    (c) => c.bucket === 'carbohidrato',
  );
  return col!.opciones.find((o) => o.items.length === 2)!;
};

const laFruta = (items: ItemOpcion[]) => items.find((i) => i.grupo === 'fruta')!;

describe('Las alternativas de un alimento', () => {
  it('son las otras de su mismo subgrupo, nunca de otro', () => {
    const dayType = dia();
    const fruta = laFruta(primeraOpcion(dayType).items);
    const otras = alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG);

    expect(otras.every((a) => a.grupo === 'fruta')).toBe(true);
    expect(otras.some((a) => a.foodId === fruta.foodId)).toBe(false);
  });

  /** Son las que ella le sugirió: van delante de las demás del catálogo. */
  it('y las de su despensa salen primero', () => {
    const dayType = dia();
    const fruta = laFruta(primeraOpcion(dayType).items);
    const otras = alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG);
    const suyas = ['a-platano', 'a-manzana', 'a-arandanos'].filter((id) => id !== fruta.foodId);

    expect(otras.slice(0, suyas.length).map((a) => a.foodId).sort()).toEqual([...suyas].sort());
  });

  /**
   * Un almidón no es intercambiable así —el pan y la avena no se desayunan
   * igual— y ahí la lista corta que ella dejó es justo lo que decide.
   */
  it('en los demás subgrupos se queda en su despensa', () => {
    const dayType = dia();
    const almidon = primeraOpcion(dayType).items.find((i) => i.grupo === 'almidones')!;
    const otras = alternativasDe(almidon, dayType, DESAYUNO, FOOD_CATALOG);
    /* Ni uno solo de fuera de la lista que ella dejó. */
    expect(otras.every((a) => DESPENSA.includes(a.foodId))).toBe(true);
    expect(otras.length).toBeLessThan(3);
  });

  /** 125 g de arándanos y 65 g de plátano son la misma porción. */
  it('vienen con los gramos hechos para esas mismas porciones', () => {
    const dayType = dia();
    const fruta = laFruta(primeraOpcion(dayType).items);
    for (const a of alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG)) {
      expect(a.intercambios).toBe(fruta.intercambios);
      expect(a.gramos).toBeGreaterThan(0);
      expect(a.medida).toBeTruthy();
    }
  });

  /**
   * EL CASO QUE ELLA TENÍA
   *
   * «Cuando escojo avena y arándanos no me aparece la opción de cambiar
   * arándanos»: con una sola fruta en la despensa no había ninguna otra suya
   * que ofrecer. Una porción de fruta es cualquier fruta —es la regla que ya
   * tenía la fase 3—, así que se abre el catálogo entero.
   */
  it('con una sola fruta en la despensa, se abren todas las del catálogo', () => {
    const dayType = dia(['a-arandanos', 'a-avena-copos']);
    const fruta = laFruta(primeraOpcion(dayType).items);
    const otras = alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG);

    expect(otras.length).toBeGreaterThan(5);
    expect(otras.every((a) => a.grupo === 'fruta')).toBe(true);
    /* Con sus gramos hechos, como las de su despensa. */
    expect(otras.every((a) => a.intercambios === fruta.intercambios && a.gramos > 0)).toBe(true);
  });

  /** Una exclusión es una decisión suya, no un hueco por rellenar. */
  it('pero lo que ella tachó a mano no vuelve por la puerta de atrás', () => {
    const dayType = {
      ...dia(['a-arandanos', 'a-avena-copos']),
      alimentosExcluidos: ['a-platano'],
    } as unknown as DayType;
    const fruta = laFruta(primeraOpcion(dayType).items);
    const otras = alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG);

    expect(otras.some((a) => a.foodId === 'a-platano')).toBe(false);
    expect(otras.length).toBeGreaterThan(5);
  });
});

describe('La opción con el alimento cambiado', () => {
  it('cambia el que se pulsó y deja el otro donde estaba', () => {
    const dayType = dia();
    const opcion = primeraOpcion(dayType);
    const fruta = laFruta(opcion.items);
    const almidon = opcion.items.find((i) => i.grupo === 'almidones')!;
    const otra = alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG)[0];

    const nueva = conAlimentoCambiado(opcion, fruta.foodId, otra);
    expect(nueva.items.some((i) => i.foodId === otra.foodId)).toBe(true);
    expect(nueva.items.some((i) => i.foodId === fruta.foodId)).toBe(false);
    expect(nueva.items.some((i) => i.foodId === almidon.foodId)).toBe(true);
  });

  /** Mismas porciones del mismo subgrupo: el plan cuadra igual. */
  it('cubre exactamente lo mismo', () => {
    const dayType = dia();
    const opcion = primeraOpcion(dayType);
    const fruta = laFruta(opcion.items);
    const otra = alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG)[0];
    expect(conAlimentoCambiado(opcion, fruta.foodId, otra).cubre).toEqual(opcion.cubre);
  });

  /**
   * El id es lo que la pantalla mira para saber cuál está marcada. Si se armara
   * de otra manera, la misma combinación propuesta por la app no se reconocería
   * como la que la clienta acaba de elegir.
   */
  it('tiene un id nuevo, armado como los de la app', () => {
    const dayType = dia();
    const opcion = primeraOpcion(dayType);
    const fruta = laFruta(opcion.items);
    const otra = alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG)[0];
    const nueva = conAlimentoCambiado(opcion, fruta.foodId, otra);

    expect(nueva.id).not.toBe(opcion.id);
    expect(nueva.id).toContain(otra.foodId);
    /* Ordenado, como el del generador: da igual en qué orden vengan. */
    expect(nueva.id.split('+')).toEqual([...nueva.id.split('+')].sort());
  });

  it('y el texto se rehace con el alimento nuevo', () => {
    const dayType = dia();
    const opcion = primeraOpcion(dayType);
    const fruta = laFruta(opcion.items);
    const otra = alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG)[0];
    const nueva = conAlimentoCambiado(opcion, fruta.foodId, otra);

    /* El texto escribe el alimento en minúscula: «1 unidad de manzana». */
    expect(nueva.texto.toLowerCase()).toContain(otra.nombre.split(' ')[0].toLowerCase());
    expect(nueva.texto.toLowerCase()).not.toContain(fruta.nombre.toLowerCase());
  });
});
