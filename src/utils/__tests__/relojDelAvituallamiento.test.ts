import { describe, it, expect } from 'vitest';
import {
  gramosDeLaPauta,
  minutoLegible,
  minutosDeLaSesion,
  proponerPauta,
  tomasHechas,
} from '../avituallamiento';
import type { Alimento } from '../../types/food';
import type { Avituallamiento } from '../../types/plan';

/**
 * EL RELOJ DEL AVITUALLAMIENTO
 *
 * En bici se elige sobre la marcha. Corriendo no: quien no lleva pautado el
 * cuándo o se toma los tres geles en la última media hora o no se toma ninguno.
 */

const fuente = (id: string, hcPorMedida: number): Alimento =>
  ({
    id,
    nombre: id,
    grupo: 'azucares',
    medida_casera: '1 unidad',
    gramos: 100,
    intercambios: hcPorMedida / 10,
    nutrientes: { kcal: hcPorMedida * 4, hc: hcPorMedida, proteina: 0, grasa: 0 },
    comidas_sugeridas: [],
    alergenos: [],
    apto: [],
  }) as unknown as Alimento;

const GEL = fuente('gel', 25);
const DATIL = fuente('datil', 15);
const FUENTES = [GEL, DATIL];

/** 60 g/h durante hora y media = 90 g. Con geles de 25, cuatro tomas. */
const NOVENTA: Avituallamiento = { modo: 'hora', porHora: 60, horas: 1.5 };

describe('Repartir las tomas', () => {
  it('salen las que hacen falta para los gramos pautados', () => {
    expect(proponerPauta(NOVENTA, GEL).length).toBe(4);
    expect(proponerPauta(NOVENTA, DATIL).length).toBe(6);
  });

  /**
   * Empezar en los primeros veinte minutos es la recomendación de siempre, y
   * llegar con el último gel a meta no sirve de nada.
   */
  it('la primera cae pronto y la última no queda pegada al final', () => {
    const minutos = proponerPauta(NOVENTA, GEL).map((t) => t.minuto);
    expect(minutos[0]).toBeLessThanOrEqual(20);
    expect(minutos[minutos.length - 1]).toBeLessThan(90);
  });

  it('y van en orden, redondeadas a cinco minutos', () => {
    const minutos = proponerPauta(NOVENTA, GEL).map((t) => t.minuto);
    expect(minutos).toEqual([...minutos].sort((a, b) => a - b));
    for (const m of minutos) expect(m % 5).toBe(0);
  });

  it('lo que suma la pauta es lo pautado', () => {
    expect(gramosDeLaPauta(proponerPauta(NOVENTA, GEL), FUENTES)).toBeCloseTo(100, 0);
  });

  it('se puede pautar de dos en dos', () => {
    const p = proponerPauta(NOVENTA, DATIL, 2);
    expect(p[0].unidades).toBe(2);
    expect(p.length).toBe(3);
  });

  /** Sin duración no hay dónde repartirlas: se dice, no se inventa. */
  it('sin duración no se propone nada', () => {
    expect(proponerPauta({ modo: 'total', gramos: 90 }, GEL)).toEqual([]);
    expect(minutosDeLaSesion({ modo: 'total', gramos: 90 })).toBeUndefined();
  });

  it('ni sin gramos pautados', () => {
    expect(proponerPauta({ modo: 'hora', porHora: 0, horas: 2 }, GEL)).toEqual([]);
  });
});

describe('La hora se lee de un vistazo', () => {
  it('en horas y minutos', () => {
    expect(minutoLegible(30)).toBe('0:30');
    expect(minutoLegible(65)).toBe('1:05');
    expect(minutoLegible(120)).toBe('2:00');
  });
});

/**
 * No se guarda «la toma del minuto 30 está hecha»: se guarda lo marcado, como
 * en todo lo demás. Dos geles iguales son dos geles iguales.
 */
describe('Qué tomas se dan por hechas', () => {
  const pauta = proponerPauta(NOVENTA, GEL);

  it('sin marcar nada, ninguna', () => {
    expect(tomasHechas(pauta, {}, FUENTES)).toEqual([false, false, false, false]);
  });

  it('con dos geles marcados, las dos primeras', () => {
    // Un gel son 2,5 porciones de azúcares.
    expect(tomasHechas(pauta, { gel: 5 }, FUENTES)).toEqual([true, true, false, false]);
  });

  it('y con todos, todas', () => {
    expect(tomasHechas(pauta, { gel: 10 }, FUENTES)).toEqual([true, true, true, true]);
  });

  /**
   * Si se le acabaron los geles y tiró de dátiles, la pauta no se da por
   * hecha —no se tomó eso— pero los gramos sí cuentan, que es lo que importa.
   */
  it('lo marcado de otro producto no da por hecha una toma de gel', () => {
    expect(tomasHechas(pauta, { datil: 6 }, FUENTES)).toEqual([false, false, false, false]);
  });

  it('sin pauta no hay nada que dar por hecho', () => {
    expect(tomasHechas([], { gel: 5 }, FUENTES)).toEqual([]);
  });
});
