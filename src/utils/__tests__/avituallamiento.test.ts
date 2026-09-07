import { describe, it, expect } from 'vitest';
import type { Alimento } from '../../types/food';
import {
  RITMO_ELITE,
  RITMO_UNA_FUENTE,
  avisoDeRitmo,
  comoVa,
  convieneMezclar,
  gramosDelAvituallamiento,
  gramosMarcados,
  hcDeUnaMedida,
  repartoDelAvituallamiento,
  ritmoDelAvituallamiento,
  unidadesMarcadas,
} from '../avituallamiento';

/**
 * EL AVITUALLAMIENTO NO ES UNA COMIDA: ES UN RITMO
 *
 * Se pauta en gramos de hidrato por hora y se reparte a lo largo de la salida.
 * 60 g para una salida de dos horas y media no es el avituallamiento: son los
 * primeros cuarenta y cinco minutos.
 */

const fuente = (id: string, hcPorMedida: number, extra: Partial<Alimento> = {}): Alimento =>
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
    ...extra,
  }) as Alimento;

const GEL = fuente('gel', 25, { conFructosa: true });
const DATIL = fuente('datil', 15);
const PLATANO = fuente('platano', 25);
const FUENTES = [GEL, DATIL, PLATANO];

describe('Las dos formas de pautarlo', () => {
  it('en total son los gramos que escribió', () => {
    expect(gramosDelAvituallamiento({ modo: 'total', gramos: 60 })).toBe(60);
    expect(ritmoDelAvituallamiento({ modo: 'total', gramos: 60 })).toBeUndefined();
  });

  /** Es lo que evita quedarse corto en las salidas largas. */
  it('por hora se multiplica por la duración', () => {
    const a = { modo: 'hora' as const, porHora: 80, horas: 2.5 };
    expect(gramosDelAvituallamiento(a)).toBe(200);
    expect(ritmoDelAvituallamiento(a)).toBe(80);
  });

  it('y sin nada pautado no hay gramos que buscar', () => {
    expect(gramosDelAvituallamiento(undefined)).toBe(0);
  });
});

/**
 * Los umbrales son lo que separa a quien compite de quien sale los domingos, y
 * por eso se dicen en vez de bloquearse.
 */
describe('Los avisos por ritmo', () => {
  it('hasta 60 g/h una sola fuente basta', () => {
    expect(avisoDeRitmo(50)).toContain('una sola fuente');
    expect(avisoDeRitmo(RITMO_UNA_FUENTE)).toContain('una sola fuente');
  });

  it('por encima hay que mezclar glucosa y fructosa', () => {
    expect(avisoDeRitmo(80)).toContain('mezclar');
  });

  it('y por encima de 90 es territorio de élite', () => {
    expect(avisoDeRitmo(RITMO_ELITE + 10)).toContain('élite');
  });

  it('sin ritmo se explica para qué sirve cada modo', () => {
    expect(avisoDeRitmo(undefined)).toContain('quedarse corto');
  });
});

/**
 * 150 g de hidrato son 150 g, se coman en la mesa o en la bici: cuentan en el
 * día como todo lo demás.
 */
describe('Cuenta en el día', () => {
  it('los gramos se pasan a porciones de azúcares', () => {
    expect(repartoDelAvituallamiento({ modo: 'total', gramos: 60 })).toEqual({
      azucares: 6,
    });
    expect(repartoDelAvituallamiento({ modo: 'hora', porHora: 80, horas: 2.5 })).toEqual({
      azucares: 20,
    });
  });

  it('y se redondean a medias porciones, como todo', () => {
    expect(repartoDelAvituallamiento({ modo: 'total', gramos: 55 })).toEqual({
      azucares: 5.5,
    });
  });

  it('sin gramos no se escribe nada', () => {
    expect(repartoDelAvituallamiento({ modo: 'total', gramos: 0 })).toEqual({});
  });
});

/**
 * Un gel son 25 g y un dátil 15: se ven como unidades aunque por dentro se
 * guarden en porciones. Nadie lleva «2,5 geles» en el bolsillo del maillot.
 */
describe('Unidades reales, no bloques redondos', () => {
  it('una medida casera vale sus gramos de hidrato', () => {
    expect(hcDeUnaMedida(GEL)).toBeCloseTo(25, 1);
    expect(hcDeUnaMedida(DATIL)).toBeCloseTo(15, 1);
  });

  it('las porciones guardadas se enseñan como unidades', () => {
    // Un gel son 2,5 porciones de azúcares.
    expect(unidadesMarcadas(GEL, 5)).toBe(2);
    expect(unidadesMarcadas(DATIL, 4.5)).toBe(3);
    expect(unidadesMarcadas(GEL, 0)).toBe(0);
  });

  it('y se suman los gramos de lo que lleva', () => {
    // 2 geles (50) + 2 dátiles (30) = 80 g.
    expect(gramosMarcados({ gel: 5, datil: 3 }, FUENTES)).toBeCloseTo(80, 1);
  });

  it('lo que no está en sus fuentes no suma', () => {
    expect(gramosMarcados({ otro: 3 }, FUENTES)).toBe(0);
  });
});

/**
 * Por encima de 60 g/h una sola fuente satura el transportador. Es un
 * recordatorio: no se bloquea nada.
 */
describe('El recordatorio de mezclar', () => {
  it('salta si a ese ritmo sólo ha cogido glucosa', () => {
    expect(convieneMezclar(80, { datil: 3, platano: 2.5 }, FUENTES)).toBe(true);
  });

  it('pero no si alguna fuente ya lleva fructosa', () => {
    expect(convieneMezclar(80, { gel: 2.5, datil: 3 }, FUENTES)).toBe(false);
  });

  it('ni a ritmo bajo, donde da igual', () => {
    expect(convieneMezclar(50, { datil: 3 }, FUENTES)).toBe(false);
    expect(convieneMezclar(undefined, { datil: 3 }, FUENTES)).toBe(false);
  });

  it('ni antes de elegir nada', () => {
    expect(convieneMezclar(80, {}, FUENTES)).toBe(false);
  });
});

/** El mismo margen del 10 % con el que ya se juzga un día. */
describe('Cómo va', () => {
  it('a menos del 90 % va corto', () => {
    expect(comoVa(120, 150)).toBe('corto');
  });

  it('dentro del margen está bien', () => {
    expect(comoVa(140, 150)).toBe('bien');
    expect(comoVa(160, 150)).toBe('bien');
  });

  it('y pasarse se dice, sin bloquear nada', () => {
    expect(comoVa(200, 150)).toBe('pasado');
  });
});
