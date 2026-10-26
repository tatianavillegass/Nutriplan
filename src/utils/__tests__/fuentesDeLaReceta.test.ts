import { describe, it, expect } from 'vitest';
import { fuentesDeLaReceta, fuentesEnTexto } from '../fuentesDeLaReceta';
import type { Ingrediente, Receta } from '../../types/recipe';

/**
 * DE DÓNDE SALE LA PROTEÍNA Y DE DÓNDE EL HIDRATO
 *
 * Al repartir la semana lo que se decide no es qué plato toca el martes: es
 * no ponerle pollo cuatro días seguidos y que el hidrato no sea siempre
 * arroz. Para eso hay que ver la fuente, no el título — «Bowl mediterráneo»
 * no dice si lleva pollo o atún.
 */

const ing = (
  nombre: string,
  grupo: Ingrediente['grupo'],
  cantidad: number | null = 100,
): Ingrediente => ({
  id: `i-${nombre}`,
  nombre,
  cantidad_base: cantidad,
  unidad: 'g',
  grupo,
  escalable: true,
  opcional: false,
});

const receta = (ingredientes: Ingrediente[]): Receta =>
  ({
    id: 'r1',
    nombre: 'Prueba',
    categorias: ['comida'],
    tags: [],
    base: {},
    ingredientes,
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  }) as Receta;

describe('Qué le pone la proteína y qué el hidrato', () => {
  it('lo dice, aunque el nombre del plato no lo diga', () => {
    const f = fuentesDeLaReceta(
      receta([
        ing('Pollo', 'proteicos_magros', 120),
        ing('Arroz', 'almidones', 60),
        ing('Brócoli', 'verduras', null),
      ]),
    );
    expect(f.proteina).toEqual(['Pollo']);
    expect(f.carbohidrato).toEqual(['Arroz']);
  });

  /* Manda el que más pesa: es el que define el plato. */
  it('con dos de la misma familia, primero el que más pesa', () => {
    const f = fuentesDeLaReceta(
      receta([
        ing('Huevo', 'proteicos_grasos', 50),
        ing('Pollo', 'proteicos_magros', 120),
        ing('Arroz', 'almidones', 60),
      ]),
    );
    expect(f.proteina).toEqual(['Pollo', 'Huevo']);
  });

  /*
   * La verdura es ilimitada y está en todos los platos: ponerla sería
   * escribir «verdura» siete veces y tapar lo que sí cambia.
   */
  it('la verdura no es una fuente, y el condimento tampoco', () => {
    const f = fuentesDeLaReceta(
      receta([
        ing('Lechuga', 'verduras', null),
        ing('Sal', 'condimento', null),
        ing('Atún', 'proteicos_magros', 80),
      ]),
    );
    expect(f.carbohidrato).toEqual([]);
    expect(f.proteina).toEqual(['Atún']);
  });

  /*
   * Unas lentejas son las dos cosas, y eso es justo lo que hay que ver al
   * repartir: ese día no hace falta otra proteína.
   */
  it('las legumbres salen en las dos columnas', () => {
    const f = fuentesDeLaReceta(receta([ing('Lentejas', 'legumbres', 80)]));
    expect(f.proteina).toEqual(['Lentejas']);
    expect(f.carbohidrato).toEqual(['Lentejas']);
  });

  it('el desayuno de avena con huevo sale entero', () => {
    const f = fuentesDeLaReceta(
      receta([ing('Avena', 'almidones', 40), ing('Huevo', 'proteicos_grasos', 60)]),
    );
    expect(f.proteina).toEqual(['Huevo']);
    expect(f.carbohidrato).toEqual(['Avena']);
  });

  /** Y los lácteos ponen proteína: un yogur es la proteína de esa merienda. */
  it('el yogur cuenta como proteína', () => {
    const f = fuentesDeLaReceta(
      receta([ing('Yogur griego', 'lacteos_desnatados', 150), ing('Fresas', 'fruta', 100)]),
    );
    expect(f.proteina).toEqual(['Yogur griego']);
    expect(f.carbohidrato).toEqual(['Fresas']);
  });

  /** Un plato sin hidrato no se inventa uno: se deja el hueco. */
  it('lo que no hay, no se rellena', () => {
    const f = fuentesDeLaReceta(receta([ing('Merluza', 'proteicos_magros', 150)]));
    expect(f.carbohidrato).toEqual([]);
  });

  it('se puede pedir sólo la primera de cada una', () => {
    const f = fuentesDeLaReceta(
      receta([
        ing('Pollo', 'proteicos_magros', 120),
        ing('Huevo', 'proteicos_grasos', 50),
      ]),
      1,
    );
    expect(f.proteina).toEqual(['Pollo']);
  });

  it('y en una línea, para donde no caben dos', () => {
    const r = receta([ing('Pollo', 'proteicos_magros', 120), ing('Arroz', 'almidones', 60)]);
    expect(fuentesEnTexto(r)).toBe('Pollo · Arroz');
  });

  it('sin ninguna fuente, nada que decir', () => {
    expect(fuentesEnTexto(receta([ing('Lechuga', 'verduras', null)]))).toBe('');
  });
});
