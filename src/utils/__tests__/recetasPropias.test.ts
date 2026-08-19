import { describe, it, expect } from 'vitest';
import {
  alimentoDeRecetaPropia,
  macrosDeReceta,
  recetasPropiasDe,
} from '../recetasPropias';
import { registroVacio } from '../../types/diary';
import type { RecetaPropia, RegistroDia } from '../../types/diary';
import type { Alimento } from '../../types/food';

/**
 * LAS DOS MANERAS DE COCINAR
 *
 * El mugcake es una ración: se come entero. Del banana bread salen diez
 * rebanadas, o un kilo del que mañana se sirve 50 g. La app tiene que servir
 * para los dos, y la diferencia no está en la receta sino en qué sale de ella.
 */

const AVENA = {
  id: 'f_avena',
  nombre: 'Avena',
  nutrientes: { proteina: 13, hc: 60, grasa: 7, fibra: 10 },
  gramos: 30,
} as unknown as Alimento;

const HUEVO = {
  id: 'f_huevo',
  nombre: 'Huevo',
  nutrientes: { proteina: 12.5, hc: 0, grasa: 11 },
  gramos: 55,
} as unknown as Alimento;

const FOODS = [AVENA, HUEVO];

const receta = (extra: Partial<RecetaPropia>): RecetaPropia => ({
  id: 'r1',
  nombre: 'Lo mío',
  ingredientes: [
    { id: 'i1', foodId: AVENA.id, nombre: 'Avena', gramos: 100 },
    { id: 'i2', foodId: HUEVO.id, nombre: 'Huevo', gramos: 100 },
  ],
  creada: '2026-08-19T10:00:00.000Z',
  ...extra,
});

describe('Una receta de una sola ración', () => {
  it('se cuenta sobre lo que pesa lo que entró', () => {
    const { peso, totales } = macrosDeReceta(receta({}), FOODS);
    expect(peso).toBe(200);
    // 13 + 12,5 de proteína, uno de cada cien gramos.
    expect(totales.proteina).toBeCloseTo(25.5, 1);
  });
});

describe('Una receta de la que salen raciones', () => {
  const conRaciones = receta({ raciones: 4 });

  it('dice lo que pesa cada una', () => {
    expect(macrosDeReceta(conRaciones, FOODS).gramosPorRacion).toBe(50);
  });

  it('y el alimento que sale ya viene con esa ración puesta', () => {
    const a = alimentoDeRecetaPropia(conRaciones, FOODS)!;
    // Al elegirla en el buscador, la casilla de gramos trae una ración: es lo
    // que se come, y es lo que evita tener que calcularlo de cabeza.
    expect(a.gramos).toBe(50);
    expect(a.medida_casera).toBe('1 ración');
    expect(a.nutrientes?.proteina).toBeCloseTo(12.75, 1);
  });
});

/**
 * Al horno se va el agua: entran 200 g de masa y salen 150 g de pan. Contando
 * sobre lo crudo, cada rebanada saldría corta —los mismos macros repartidos en
 * más gramos de los que existen—, así que si ella lo pesa, ese peso manda.
 */
describe('Cuando pesa el resultado', () => {
  it('los macros por 100 g salen de ese peso', () => {
    const a = alimentoDeRecetaPropia(receta({ gramosFinales: 150 }), FOODS)!;
    expect(a.nutrientes?.proteina).toBeCloseTo((25.5 / 150) * 100, 1);
  });

  it('y una ración pesa lo del resultado, no lo de la masa', () => {
    const { gramosPorRacion } = macrosDeReceta(
      receta({ raciones: 3, gramosFinales: 150 }),
      FOODS,
    );
    expect(gramosPorRacion).toBe(50);
  });
});

/**
 * Como las comidas guardadas: viven en el día en que se escribieron, la lista
 * se junta leyendo todos sus días y borrar se apunta aparte, porque el día en
 * que la creó no se puede reescribir desde hoy.
 */
describe('Sus recetas a lo largo de los días', () => {
  const dia = (fecha: string, patch: Partial<RegistroDia>): RegistroDia => ({
    ...registroVacio('c1', fecha, `reg_${fecha}`),
    ...patch,
  });

  it('se juntan y la versión más nueva gana', () => {
    const lista = recetasPropiasDe([
      dia('2026-08-10', { recetasPropias: [receta({ nombre: 'Bizcocho' })] }),
      dia('2026-08-14', { recetasPropias: [receta({ nombre: 'Bizcocho de plátano' })] }),
    ]);
    expect(lista).toHaveLength(1);
    expect(lista[0].nombre).toBe('Bizcocho de plátano');
  });

  it('y lo borrado deja de salir aunque siga escrito en su día', () => {
    const lista = recetasPropiasDe([
      dia('2026-08-10', { recetasPropias: [receta({})] }),
      dia('2026-08-19', { recetasBorradas: ['r1'] }),
    ]);
    expect(lista).toEqual([]);
  });
});
