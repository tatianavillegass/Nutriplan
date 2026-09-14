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
  it('son las otras de su mismo subgrupo, de su despensa', () => {
    const dayType = dia();
    const fruta = laFruta(primeraOpcion(dayType).items);
    const otras = alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG);

    /* Las otras dos frutas, ni ella misma ni los almidones. */
    expect(otras.every((a) => a.grupo === 'fruta')).toBe(true);
    expect(otras.some((a) => a.foodId === fruta.foodId)).toBe(false);
    expect(otras.length).toBe(2);
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
   * Lo que puede elegir lo decide ella comida a comida: ahí ya están filtrados
   * sus alérgenos y sus patologías. Ofrecerle el catálogo entero se los saltaría
   * justo en el momento de comer.
   */
  it('y no salen del catálogo: si su despensa tiene una fruta, no hay alternativa', () => {
    const dayType = dia(['a-arandanos', 'a-avena-copos']);
    const fruta = laFruta(primeraOpcion(dayType).items);
    expect(alternativasDe(fruta, dayType, DESAYUNO, FOOD_CATALOG)).toEqual([]);
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
