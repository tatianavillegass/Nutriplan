import { describe, it, expect } from 'vitest';
import { cabeHoy, costeDelPostre, postresDelBanco } from '../postres';
import type { Receta } from '../../types/recipe';
import type { DayType } from '../../types/plan';

/**
 * ALGO DULCE
 *
 * La nutricionista escribe unos postres para toda la consulta. La clienta los
 * ve todos —esconder uno porque «hoy no le toca» es la app dando lecciones— y
 * lo que la app aporta es decirle cuál le cuadra con lo que le queda del día.
 */

const postre = (id: string, base: Receta['base'], nombre = id): Receta => ({
  id,
  nombre,
  categorias: [],
  postre: true,
  tags: [],
  base,
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
});

const DIA: DayType = {
  id: 'd1',
  nombre: 'Base',
  meals: [
    { id: 'm1', nombre: 'Comida', slot: 'comida', orden: 1 },
    { id: 'm2', nombre: 'Cena', slot: 'cena', orden: 2 },
  ],
  grid: {
    m1: { almidones: 2, proteicos_magros: 3, grasas: 1 },
    m2: { almidones: 2, proteicos_magros: 3, grasas: 1 },
  },
} as unknown as DayType;

describe('Lo que cuesta un postre', () => {
  it('son sus porciones, y la verdura no cuenta', () => {
    expect(costeDelPostre(postre('p1', { almidones: 1, grasas: 1, verduras: 2 }))).toEqual({
      almidones: 1,
      grasas: 1,
    });
  });
});

describe('Si le cuadra hoy', () => {
  it('cabe cuando le queda sitio de ese macro', () => {
    // No ha marcado nada: le quedan cuatro almidones del día.
    expect(cabeHoy(postre('p1', { almidones: 1 }), DIA, {}).cabe).toBe(true);
  });

  it('y no cuando se le pasaría', () => {
    const r = cabeHoy(postre('p2', { almidones: 6 }), DIA, {});
    expect(r.cabe).toBe(false);
    expect(r.seLePasa).toContain('carbohidrato');
  });

  /**
   * Se mira por macro, no por subgrupo: si le quedan almidones y el postre
   * lleva fruta, es el mismo carbohidrato. Es la misma regla que en todo lo
   * demás de la app.
   */
  it('la fruta gasta el carbohidrato que le quede, venga de donde venga', () => {
    expect(cabeHoy(postre('p3', { fruta: 1 }), DIA, {}).cabe).toBe(true);
  });
});

describe('La lista de postres', () => {
  it('los enseña todos, con los que cuadran delante', () => {
    const lista = postresDelBanco(
      [postre('malo', { almidones: 9 }, 'Tarta entera'), postre('bueno', { fruta: 1 }, 'Fresas')],
      DIA,
      {},
    );
    expect(lista).toHaveLength(2);
    expect(lista[0].postre.nombre).toBe('Fresas');
    expect(lista[1].cabe).toBe(false);
  });

  it('y no se cuela ninguna receta que no sea postre', () => {
    const cena = { ...postre('cena', { almidones: 2 }), postre: false };
    expect(postresDelBanco([cena], DIA, {})).toEqual([]);
  });
});
