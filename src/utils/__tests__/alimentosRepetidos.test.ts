import { describe, it, expect } from 'vitest';
import { sinRepetidos, mismoNombre, suyoConEseNombre } from '../sinRepetidos';
import type { Alimento } from '../../types/food';

/**
 * EL MISMO ALIMENTO, DOS VECES
 *
 * Cuando la nutricionista acepta un alimento de una clienta, se lleva una copia
 * a su catálogo con id nuevo — y el de la clienta sigue en su registro, porque
 * no se puede borrar: el registro del día es suyo. Desde entonces el mismo
 * yogur salía dos veces en el buscador. Y calcular la misma etiqueta dos días
 * distintos hacía lo mismo sin que nadie tocara nada.
 */

const a = (id: string, nombre: string): Alimento =>
  ({ id, nombre, nutrientes: { kcal: 0, hc: 0, proteina: 0, grasa: 0 } }) as unknown as Alimento;

describe('Quitar los repetidos', () => {
  it('el mismo nombre con distinto id sale una sola vez', () => {
    const lista = [a('f_1', 'Yogur griego'), a('mio_9', 'Yogur griego')];
    expect(sinRepetidos(lista).map((f) => f.id)).toEqual(['f_1']);
  });

  /** El del catálogo está revisado; el de la clienta se escribió deprisa. */
  it('manda el que va primero, que es el del catálogo', () => {
    const lista = [a('mio_9', 'Yogur griego'), a('f_1', 'Yogur griego')];
    expect(sinRepetidos(lista)[0].id).toBe('mio_9');
  });

  it('no se fija en tildes, mayúsculas ni espacios de más', () => {
    const lista = [a('f_1', 'Plátano  Canario'), a('mio_9', 'platano canario')];
    expect(sinRepetidos(lista)).toHaveLength(1);
  });

  /** Dos alimentos distintos con nombres parecidos no son el mismo. */
  it('pero no junta lo que sólo se parece', () => {
    const lista = [a('f_1', 'Yogur griego'), a('f_2', 'Yogur griego light')];
    expect(sinRepetidos(lista)).toHaveLength(2);
  });

  it('y no pierde nada si no hay repetidos', () => {
    const lista = [a('f_1', 'Avena'), a('f_2', 'Pan'), a('f_3', 'Pollo')];
    expect(sinRepetidos(lista)).toHaveLength(3);
  });
});

describe('Reutilizar el que ya tenía', () => {
  const suyos = [a('f_1', 'Yogur griego'), a('mio_9', 'Granola de casa')];

  /**
   * La calculadora creaba uno con id nuevo cada vez. Reutilizando el suyo, lo
   * que marcó con él hace un mes sigue en pie.
   */
  it('encuentra el suyo por el nombre', () => {
    expect(suyoConEseNombre(suyos, 'granola de casa')?.id).toBe('mio_9');
  });

  /**
   * Nunca uno del catálogo: los macros que acaba de copiar de la etiqueta son
   * los de SU bote, no los que puso la nutricionista.
   */
  it('pero nunca uno del catálogo', () => {
    expect(suyoConEseNombre(suyos, 'Yogur griego')).toBeUndefined();
  });

  /** El aviso del catálogo sí mira todo, que es de lo que avisa. */
  it('el aviso de nombre repetido mira toda la lista', () => {
    expect(mismoNombre(suyos, 'yogur griego')?.id).toBe('f_1');
    expect(mismoNombre(suyos, 'Kéfir')).toBeUndefined();
  });
});
