import { describe, it, expect } from 'vitest';
import type { MenuSemana } from '../../types/diary';
import type { MenuPropuesto } from '../../types/plan';
import {
  comidasPuestas,
  menuDelDia,
  menuEfectivo,
  menuVacio,
  ponerEnDias,
  semanaDelCiclo,
  tipoDeDiaPlaneado,
  vieneDeLaPropuesta,
} from '../menuSemana';

/**
 * LA SEMANA QUE LE REPARTIÓ SU NUTRICIONISTA
 *
 * A mucha gente le da pereza organizarse la semana y entonces no hay ni lista
 * de la compra ni batch cooking. Repartiéndosela, lo tiene todo hecho — pero
 * sigue siendo una propuesta: lo que ella cambie manda.
 */

// Semana 1: tostada lunes y miércoles, pollo el lunes. Semana 2: avena el lunes.
const PROPUESTO: MenuPropuesto = {
  desde: '2026-08-31', // un lunes
  semanas: [
    {
      dias: {
        0: { comidas: { desayuno: 'tostada', comida: 'pollo' }, dayTypeId: 'entreno' },
        2: { comidas: { desayuno: 'tostada' } },
      },
    },
    { dias: { 0: { comidas: { desayuno: 'avena' } } } },
  ],
};

const LUNES_1 = '2026-08-31';
const LUNES_2 = '2026-09-07';
const MIERCOLES_1 = '2026-09-02';

describe('Dos semanas que se alternan', () => {
  it('la primera semana es la 1 y la siguiente la 2', () => {
    expect(semanaDelCiclo(PROPUESTO, LUNES_1)).toBe(0);
    expect(semanaDelCiclo(PROPUESTO, LUNES_2)).toBe(1);
    expect(semanaDelCiclo(PROPUESTO, '2026-09-14')).toBe(0);
  });

  it('con una sola semana, siempre la misma', () => {
    const una = { ...PROPUESTO, semanas: [PROPUESTO.semanas[0]] };
    expect(semanaDelCiclo(una, LUNES_1)).toBe(0);
    expect(semanaDelCiclo(una, LUNES_2)).toBe(0);
  });

  /** Si se mira una semana anterior al reparto, tampoco se salta ninguna. */
  it('hacia atrás también alterna', () => {
    expect(semanaDelCiclo(PROPUESTO, '2026-08-24')).toBe(1);
    expect(semanaDelCiclo(PROPUESTO, '2026-08-17')).toBe(0);
  });

  it('y cada semana enseña sus platos', () => {
    expect(menuDelDia(menuEfectivo(PROPUESTO, undefined, LUNES_1), LUNES_1)).toEqual({
      desayuno: 'tostada',
      comida: 'pollo',
    });
    expect(menuDelDia(menuEfectivo(PROPUESTO, undefined, LUNES_2), LUNES_2)).toEqual({
      desayuno: 'avena',
    });
  });

  it('los días de entreno vienen puestos, para que las cantidades salgan solas', () => {
    const m = menuEfectivo(PROPUESTO, undefined, LUNES_1);
    expect(tipoDeDiaPlaneado(m, LUNES_1)).toBe('entreno');
    expect(tipoDeDiaPlaneado(m, MIERCOLES_1)).toBeUndefined();
  });
});

/**
 * ES UNA PROPUESTA, NO UNA IMPOSICIÓN. Lo que ella cambie gana, comida a
 * comida: cambiar la cena del martes no puede tirar por tierra el reparto.
 */
describe('Lo que ella cambia manda', () => {
  const suyo: MenuSemana = {
    inicio: LUNES_1,
    dias: { [LUNES_1]: { comidas: { desayuno: 'avena' } } },
  };

  it('su desayuno gana al que le pusieron', () => {
    const m = menuEfectivo(PROPUESTO, suyo, LUNES_1);
    expect(menuDelDia(m, LUNES_1).desayuno).toBe('avena');
  });

  it('pero la comida que no tocó sigue siendo la propuesta', () => {
    const m = menuEfectivo(PROPUESTO, suyo, LUNES_1);
    expect(menuDelDia(m, LUNES_1).comida).toBe('pollo');
  });

  /**
   * Quitar un plato tiene que quedar escrito. Si sólo se borrara la línea, la
   * propuesta asomaría por debajo y el plato reaparecería al recargar.
   */
  it('y si quita un plato, no vuelve a aparecer', () => {
    const quitado: MenuSemana = {
      inicio: LUNES_1,
      dias: { [LUNES_1]: { comidas: { comida: '' } } },
    };
    const m = menuEfectivo(PROPUESTO, quitado, LUNES_1);
    expect(menuDelDia(m, LUNES_1).comida).toBeUndefined();
    expect(menuDelDia(m, LUNES_1).desayuno).toBe('tostada');
  });

  it('el tipo de día que ella ponga también gana', () => {
    const otro: MenuSemana = {
      inicio: LUNES_1,
      dias: { [LUNES_1]: { comidas: {}, dayTypeId: 'descanso' } },
    };
    expect(tipoDeDiaPlaneado(menuEfectivo(PROPUESTO, otro, LUNES_1), LUNES_1)).toBe(
      'descanso',
    );
  });

  it('sin propuesta, se ve lo suyo y ya está', () => {
    expect(menuEfectivo(undefined, suyo, LUNES_1)).toBe(suyo);
  });

  it('se puede saber qué viene de ella y qué de su nutricionista', () => {
    expect(vieneDeLaPropuesta(PROPUESTO, suyo, LUNES_1, 'comida')).toBe(true);
    expect(vieneDeLaPropuesta(PROPUESTO, suyo, LUNES_1, 'desayuno')).toBe(false);
    expect(vieneDeLaPropuesta(undefined, suyo, LUNES_1, 'comida')).toBe(false);
  });
});

/**
 * AL TOCAR UNA COMIDA, ESA COMIDA PASA A SER SUYA
 *
 * Se escriben los siete días de esa comida, también los vacíos. Las demás
 * comidas siguen la propuesta.
 */
describe('Cuando desmarca un día', () => {
  const efectivo = menuEfectivo(PROPUESTO, undefined, LUNES_1)!;

  it('lo que quita se queda quitado', () => {
    // Tenía tostada lunes y miércoles; se queda sólo con el miércoles.
    const nuevo = ponerEnDias(
      menuVacio(LUNES_1),
      'desayuno',
      'tostada',
      [MIERCOLES_1],
      efectivo,
    );
    const m = menuEfectivo(PROPUESTO, nuevo, LUNES_1)!;
    expect(menuDelDia(m, LUNES_1).desayuno).toBeUndefined();
    expect(menuDelDia(m, MIERCOLES_1).desayuno).toBe('tostada');
  });

  it('y la comida que no tocó no se mueve', () => {
    const nuevo = ponerEnDias(menuVacio(LUNES_1), 'desayuno', 'tostada', [], efectivo);
    const m = menuEfectivo(PROPUESTO, nuevo, LUNES_1)!;
    expect(menuDelDia(m, LUNES_1).comida).toBe('pollo');
  });

  it('sin propuesta de por medio funciona como siempre', () => {
    const menu = ponerEnDias(menuVacio(LUNES_1), 'desayuno', 'tostada', [LUNES_1]);
    expect(menuDelDia(menu, LUNES_1).desayuno).toBe('tostada');
    const sin = ponerEnDias(menu, 'desayuno', 'tostada', []);
    expect(menuDelDia(sin, LUNES_1).desayuno).toBeUndefined();
  });
});

describe('Las comidas en blanco no cuentan', () => {
  it('ni al leer el día ni al contar cuántas van puestas', () => {
    const menu: MenuSemana = {
      inicio: LUNES_1,
      dias: { [LUNES_1]: { comidas: { desayuno: 'tostada', comida: '' } } },
    };
    expect(menuDelDia(menu, LUNES_1)).toEqual({ desayuno: 'tostada' });
    expect(comidasPuestas(menu)).toBe(1);
  });
});
