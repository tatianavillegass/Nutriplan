import { describe, it, expect } from 'vitest';
import type { DayType, Plan } from '../../types/plan';
import {
  ajustesDeReceta,
  comidasConPauta,
  comidasDeLaSemana,
  fotoDelPlan,
  hayCambiosSinEnviar,
  planParaCliente,
  queCambio,
  recetasDeLaComida,
  recetasDelPlan,
} from '../../types/plan';

/**
 * LOS PLATOS SON DEL PLAN; LAS CANTIDADES, DE CADA DÍA
 *
 * Jimena tiene un día base y un día de pierna con más hidrato. Los platos son
 * los mismos: la misma avena con más plátano. Elegirlos dos veces era pautar
 * dos veces y dejarle ochenta recetas que repartir en su semana sin que
 * ninguna fuera nueva de verdad.
 *
 * Lo que sigue siendo de cada tipo de día: el reparto de intercambios, los
 * gramos que ella ajusta a mano y los acompañamientos.
 */

const dia = (id: string, extra: Partial<DayType> = {}): DayType => ({
  id,
  nombre: id,
  proteinaGkg: 1.8,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 4 },
  ],
  grid: {},
  notas: {},
  ...extra,
});

const plan = (extra: Partial<Plan> = {}): Plan => ({
  id: 'pl',
  clientId: 'cl',
  nombre: 'Planificación 1',
  fase: 1,
  dayTypes: [dia('base'), dia('pierna')],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...extra,
});

describe('Las recetas valen para todos los tipos de día', () => {
  it('las del plan salen igual mire el día que mire', () => {
    const p = plan({ recetasAsignadas: { desayuno: ['avena', 'tostada'] } });
    expect(recetasDeLaComida(p, 'desayuno')).toEqual(['avena', 'tostada']);
  });

  /**
   * Una comida que sólo existe un día no necesita nada especial: tiene su
   * propio hueco aquí y sólo se le enseña los días en que lleva intercambios.
   */
  it('y una comida que sólo existe un día tiene las suyas', () => {
    const p = plan({
      recetasAsignadas: { desayuno: ['avena'], merienda: ['yogur'] },
    });
    expect(recetasDeLaComida(p, 'merienda')).toEqual(['yogur']);
  });

  it('una comida sin recetas no inventa ninguna', () => {
    expect(recetasDeLaComida(plan(), 'cena')).toEqual([]);
  });

  /**
   * La otra mitad de la regla: los platos se comparten, las cantidades no. Los
   * gramos que ella pone a mano para el día de pierna no se le cuelan al día
   * base.
   */
  it('pero los gramos ajustados a mano siguen siendo de cada día', () => {
    const base = dia('base');
    const pierna = dia('pierna', {
      ajustesReceta: { desayuno: { avena: { 'a-avena': 80 } } },
    });
    const p = plan({
      dayTypes: [base, pierna],
      recetasAsignadas: { desayuno: ['avena'] },
    });
    expect(recetasDeLaComida(p, 'desayuno')).toEqual(['avena']);
    expect(ajustesDeReceta(pierna, 'desayuno', 'avena')).toEqual({
      'a-avena': 80,
    });
    expect(ajustesDeReceta(base, 'desayuno', 'avena')).toEqual({});
  });

  /**
   * LA COMIDA QUE SÓLO EXISTE UN DÍA
   *
   * Si el día de entreno lleva merienda y el base no, basta con no repartirle
   * intercambios en el día base: la merienda tiene sus recetas en el plan como
   * cualquier otra comida, pero sólo se le enseña los días que la llevan.
   */
  it('la merienda del día de entreno no sale en el día base', () => {
    const base = dia('base', { grid: { desayuno: { almidones: 2 } } });
    const entreno = dia('entreno', {
      grid: { desayuno: { almidones: 3 }, merienda: { fruta: 1 } },
    });
    expect(comidasConPauta(base).map((m) => m.id)).toEqual(['desayuno']);
    expect(comidasConPauta(entreno).map((m) => m.id)).toEqual([
      'desayuno',
      'merienda',
    ]);
  });

  /**
   * Pero para organizar la semana hacen falta todas: si hoy es domingo y la
   * merienda es del martes, tiene que poder dejarla puesta igual.
   */
  it('aunque para organizar la semana salen todas', () => {
    const p = plan({
      dayTypes: [
        dia('base', { grid: { desayuno: { almidones: 2 } } }),
        dia('entreno', {
          grid: { desayuno: { almidones: 3 }, merienda: { fruta: 1 } },
        }),
      ],
    });
    expect(comidasDeLaSemana(p).map((m) => m.id)).toEqual([
      'desayuno',
      'merienda',
    ]);
  });
});

describe('Lo que se pautó con el formato viejo no se pierde', () => {
  it('se leen las que estaban guardadas en el tipo de día', () => {
    const p = plan({
      dayTypes: [dia('base', { recetasAsignadas: { desayuno: ['avena'] } })],
    });
    expect(recetasDeLaComida(p, 'desayuno')).toEqual(['avena']);
  });

  /** Si cada día tenía las suyas se quedan todas: no se elige por ella. */
  it('y si cada día tenía las suyas, se juntan sin repetir', () => {
    const p = plan({
      dayTypes: [
        dia('base', { recetasAsignadas: { desayuno: ['avena', 'tostada'] } }),
        dia('pierna', { recetasAsignadas: { desayuno: ['tostada', 'crepes'] } }),
      ],
    });
    expect(recetasDeLaComida(p, 'desayuno')).toEqual([
      'avena',
      'tostada',
      'crepes',
    ]);
  });

  /** En cuanto toca una comida, esa comida pasa al plan y manda. */
  it('lo del plan manda sobre lo viejo, comida a comida', () => {
    const p = plan({
      dayTypes: [
        dia('base', {
          recetasAsignadas: { desayuno: ['avena'], merienda: ['yogur'] },
        }),
      ],
      recetasAsignadas: { desayuno: ['crepes'] },
    });
    expect(recetasDelPlan(p)).toEqual({
      desayuno: ['crepes'],
      merienda: ['yogur'],
    });
  });

  it('quitar todas las de una comida la deja vacía, no la devuelve al día', () => {
    const p = plan({
      dayTypes: [dia('base', { recetasAsignadas: { desayuno: ['avena'] } })],
      recetasAsignadas: { desayuno: [] },
    });
    expect(recetasDeLaComida(p, 'desayuno')).toEqual([]);
  });
});

describe('Lo que ve la clienta', () => {
  it('la foto que se envía se guarda ya juntada', () => {
    const p = plan({
      dayTypes: [dia('base', { recetasAsignadas: { desayuno: ['avena'] } })],
    });
    expect(fotoDelPlan(p).recetasAsignadas).toEqual({ desayuno: ['avena'] });
  });

  it('y a la clienta le llegan las de la foto, no las del borrador', () => {
    const p = plan({
      recetasAsignadas: { desayuno: ['crepes'] },
      envio: { fecha: '2026-01-02' },
      publicado: {
        fase: 1,
        dayTypes: [dia('base')],
        recetasAsignadas: { desayuno: ['avena'] },
        fecha: '2026-01-02',
      },
    });
    expect(recetasDeLaComida(planParaCliente(p)!, 'desayuno')).toEqual(['avena']);
  });

  /**
   * Las fotos de antes de esto no traen recetas propias: entonces se leen las
   * de sus tipos de día, que es donde estaban. Sin esto, el día que se
   * publique, quien no reciba un plan nuevo se queda sin recetas.
   */
  it('las fotos antiguas siguen enseñando sus recetas', () => {
    const p = plan({
      envio: { fecha: '2026-01-02' },
      publicado: {
        fase: 1,
        dayTypes: [dia('base', { recetasAsignadas: { desayuno: ['avena'] } })],
        fecha: '2026-01-02',
      },
    });
    expect(recetasDeLaComida(planParaCliente(p)!, 'desayuno')).toEqual(['avena']);
  });
});

describe('Cambiar una receta es un cambio que hay que enviar', () => {
  const enviado = plan({
    recetasAsignadas: { desayuno: ['avena'] },
    envio: { fecha: '2026-01-02' },
    publicado: {
      fase: 1,
      dayTypes: [dia('base'), dia('pierna')],
      recetasAsignadas: { desayuno: ['avena'] },
      fecha: '2026-01-02',
    },
  });

  it('sin tocar nada no hay nada que enviar', () => {
    expect(hayCambiosSinEnviar(enviado)).toBe(false);
    expect(queCambio(enviado)).toEqual([]);
  });

  /**
   * Las recetas ya no viven en ningún tipo de día, así que sin mirarlas aparte
   * cambiarle el desayuno salía como que no había nada pendiente.
   */
  it('cambiarle el desayuno sí', () => {
    const tocado = { ...enviado, recetasAsignadas: { desayuno: ['crepes'] } };
    expect(hayCambiosSinEnviar(tocado)).toBe(true);
    expect(queCambio(tocado)).toEqual([
      'Las recetas entre las que puede elegir han cambiado.',
    ]);
  });
});
