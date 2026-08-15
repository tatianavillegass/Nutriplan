import { describe, it, expect } from 'vitest';
import {
  alimentosQueFaltan,
  comidaGuardadaDe,
  copiarBocados,
  deCuandoEs,
  misComidas,
  ultimaVezQueComio,
} from '../misComidas';
import type { Bocado, RegistroDia } from '../../types/diary';
import type { Alimento } from '../../types/food';

const MIO: Alimento = {
  id: 'mio_1',
  nombre: 'Granola de la marca esa',
  medida_casera: '100 g',
  gramos: 100,
  intercambios: 1,
  nutrientes: { proteina: 8, hc: 60, grasa: 12 },
} as unknown as Alimento;

const bocado = (id: string, momento: string, foodId?: string): Bocado => ({
  id,
  nombre: 'Algo',
  foodId,
  cantidad: 100,
  macros: { proteina: 10, hc: 20, grasa: 5 },
  kcal: 165,
  momento,
});

const dia = (fecha: string, extra: Partial<RegistroDia>): RegistroDia => ({
  id: `r-${fecha}`,
  clientId: 'c1',
  fecha,
  recetaElegida: {},
  cumplidas: [],
  porciones: {},
  sustituciones: {},
  extras: [],
  ...extra,
});

/**
 * REPETIR LO DE SIEMPRE
 *
 * Quien desayuna lo mismo todos los días estaba volviendo a apuntar cinco
 * alimentos con sus gramos cada mañana: ese es el trabajo que hace que la
 * gente abandone los contadores, y encima no enseña nada.
 */
describe('La última vez que comió eso', () => {
  const registros = [
    dia('2026-08-10', { bocados: [bocado('b1', 'desayuno'), bocado('b2', 'cena')] }),
    dia('2026-08-12', { bocados: [bocado('b3', 'desayuno')] }),
  ];

  it('se busca hacia atrás y se coge la más reciente', () => {
    const u = ultimaVezQueComio(registros, '2026-08-14', 'desayuno');
    expect(u?.fecha).toBe('2026-08-12');
    expect(u?.bocados.map((b) => b.id)).toEqual(['b3']);
  });

  /** Saltarse un día no puede quitarle el atajo a quien come siempre igual. */
  it('no hace falta que sea ayer', () => {
    expect(ultimaVezQueComio(registros, '2026-08-20', 'desayuno')?.fecha).toBe('2026-08-12');
  });

  it('cada comida va por su cuenta', () => {
    expect(ultimaVezQueComio(registros, '2026-08-14', 'cena')?.fecha).toBe('2026-08-10');
    expect(ultimaVezQueComio(registros, '2026-08-14', 'merienda')).toBeUndefined();
  });

  /** Repetir lo que acabas de apuntar sería duplicarlo. */
  it('hoy no cuenta', () => {
    expect(ultimaVezQueComio(registros, '2026-08-12', 'desayuno')?.fecha).toBe('2026-08-10');
  });

  it('en fase 3 lo que se repite son las porciones marcadas', () => {
    const con = [dia('2026-08-12', { porciones: { desayuno: { 'a-avena': 2, 'a-huevo': 0 } } })];
    const u = ultimaVezQueComio(con, '2026-08-13', 'desayuno');
    expect(u?.porciones).toEqual({ 'a-avena': 2 });
  });

  /**
   * Sus alimentos de etiqueta viven en el registro de un día concreto: sin
   * traérselos, la comida repetida apunta a algo que hoy ya no existe.
   */
  it('se trae los alimentos que ella se calculó ese día', () => {
    const con = [
      dia('2026-08-12', {
        bocados: [bocado('b1', 'desayuno', 'mio_1')],
        alimentosPropios: [MIO],
      }),
    ];
    expect(ultimaVezQueComio(con, '2026-08-13', 'desayuno')?.alimentos).toEqual([MIO]);
  });
});

describe('De cuándo viene lo que se copia', () => {
  it('ayer se dice ayer', () => {
    expect(deCuandoEs('2026-08-13', '2026-08-14')).toBe('de ayer');
  });

  it('y si es más viejo, se dice el día', () => {
    expect(deCuandoEs('2026-08-02', '2026-08-14')).toMatch(/2 de agosto/);
  });
});

/** Con el mismo id, quitar el de hoy borraría también el de aquel día. */
describe('Al copiar unos bocados', () => {
  it('se les cambia el id y la comida', () => {
    const [copia] = copiarBocados([bocado('b1', 'desayuno')], 'merienda');
    expect(copia.id).not.toBe('b1');
    expect(copia.momento).toBe('merienda');
    expect(copia.macros.proteina).toBe(10);
  });
});

describe('Sus comidas guardadas', () => {
  const pancakes = comidaGuardadaDe(
    'Pancakes de avena',
    'desayuno',
    { bocados: [bocado('b1', 'desayuno', 'mio_1')] },
    [MIO],
  );
  const ensalada = comidaGuardadaDe('Ensalada de siempre', 'comida', {
    porciones: { 'a-pollo': 3 },
  });

  it('se juntan de todos sus días', () => {
    const registros = [
      dia('2026-08-10', { comidasGuardadas: [pancakes] }),
      dia('2026-08-12', { comidasGuardadas: [ensalada] }),
    ];
    expect(misComidas(registros)).toHaveLength(2);
  });

  it('se pueden pedir sólo las de una comida', () => {
    const registros = [dia('2026-08-10', { comidasGuardadas: [pancakes, ensalada] })];
    expect(misComidas(registros, 'desayuno').map((c) => c.nombre)).toEqual(['Pancakes de avena']);
  });

  /**
   * El día en que se creó no se puede reescribir desde hoy, así que borrar se
   * apunta en el día de hoy y se descuenta al juntarlas.
   */
  it('borrar una la quita de la lista', () => {
    const registros = [
      dia('2026-08-10', { comidasGuardadas: [pancakes] }),
      dia('2026-08-14', { comidasBorradas: [pancakes.id] }),
    ];
    expect(misComidas(registros)).toHaveLength(0);
  });

  it('se guarda con los alimentos que ella se calculó', () => {
    expect(pancakes.alimentos).toEqual([MIO]);
    expect(pancakes.porciones).toBeUndefined();
  });

  it('y una de fase 3 guarda porciones, no gramos', () => {
    expect(ensalada.porciones).toEqual({ 'a-pollo': 3 });
    expect(ensalada.bocados).toBeUndefined();
  });
});

describe('Los alimentos que hay que arrastrar', () => {
  it('sólo los que hoy no tiene', () => {
    expect(alimentosQueFaltan([MIO], [])).toEqual([MIO]);
    expect(alimentosQueFaltan([MIO], [MIO])).toEqual([]);
    expect(alimentosQueFaltan(undefined, [])).toEqual([]);
  });
});
