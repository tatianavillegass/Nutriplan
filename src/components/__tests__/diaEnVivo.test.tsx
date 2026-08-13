// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DiaEnVivo } from '../client/DiaEnVivo';
import { hayAlgoMarcado, vaciarLoMarcado } from '../../utils/diary';
import { claveFecha, registroVacio } from '../../types/diary';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { RegistroDia } from '../../types/diary';
import type { Client } from '../../types/client';
import type { Plan, DayType } from '../../types/plan';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

const HOY = claveFecha(new Date());
const POLLO = FOOD_CATALOG.find((f) => f.grupo === 'proteicos_magros' && !f.equivale)!;

const CLIENTE = { id: 'cl_1', nombre: 'Tatiana Villegas' } as unknown as Client;

const DIA_BASE: DayType = {
  id: 'dt_base',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
  grid: { comida: { proteicos_magros: 4, almidones: 3 } },
  recetasAsignadas: { comida: ['rc_1'] },
  notas: {},
};

const RECETA: Receta = {
  id: 'rc_1',
  nombre: 'Wok de pollo',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_magros: 4, almidones: 3 },
  ingredientes: [],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const plan = (fase: 1 | 2 | 3): Plan =>
  ({ id: 'p1', clientId: 'cl_1', fase, dayTypes: [DIA_BASE], envio: { fecha: HOY } }) as unknown as Plan;

const pintar = (fase: 1 | 2 | 3, registro: RegistroDia) =>
  render(
    <DiaEnVivo
      client={CLIENTE}
      plan={plan(fase)}
      registros={[registro]}
      recipes={[RECETA]}
      foods={FOOD_CATALOG}
    />,
  );

/**
 * La tarjeta sólo sabía leer la receta elegida, que es cosa de fase 1. Al
 * pasar una clienta a fase 2 el seguimiento se quedaba en blanco aunque
 * estuviera marcando porciones.
 */
describe('El directo entiende las tres fases', () => {
  it('en fase 1 enseña la receta que ha elegido', () => {
    pintar(1, { ...registroVacio('cl_1', HOY, 'rg1'), dayTypeId: 'dt_base', cumplidas: ['comida'] });
    expect(screen.getByText('Wok de pollo')).toBeTruthy();
    expect(screen.getByText('✓ hecha')).toBeTruthy();
  });

  it('en fase 2 enseña lo que ha marcado, no «sin elegir»', () => {
    pintar(2, {
      ...registroVacio('cl_1', HOY, 'rg1'),
      dayTypeId: 'dt_base',
      porciones: { comida: { [POLLO.id]: 4 } },
    });
    expect(screen.getByText(new RegExp(POLLO.nombre, 'i'))).toBeTruthy();
    expect(screen.queryByText('sin elegir')).toBeNull();
  });

  it('en fase 3 igual', () => {
    pintar(3, {
      ...registroVacio('cl_1', HOY, 'rg1'),
      dayTypeId: 'dt_base',
      porciones: { comida: { [POLLO.id]: 2 } },
    });
    expect(screen.getByText(new RegExp(POLLO.nombre, 'i'))).toBeTruthy();
  });

  it('si no ha marcado nada en fase 2 lo dice como tal', () => {
    pintar(2, { ...registroVacio('cl_1', HOY, 'rg1'), dayTypeId: 'dt_base', cumplidas: ['comida'] });
    expect(screen.getByText('sin marcar')).toBeTruthy();
  });

  it('enseña de qué tipo de día va el registro', () => {
    pintar(2, { ...registroVacio('cl_1', HOY, 'rg1'), dayTypeId: 'dt_base' });
    expect(screen.getByText('Día base')).toBeTruthy();
  });
});

/**
 * Lo marcado no se borraba al cambiar de tipo de día: quien marcaba su
 * desayuno en «descanso» y se pasaba a «base» se lo encontraba ya hecho, y al
 * volver a marcar porciones se le sumaban a las de antes.
 */
describe('Saber si el día ya tiene algo apuntado', () => {
  const vacio = registroVacio('cl_1', HOY, 'rg1');

  it('un día en blanco no tiene nada', () => {
    expect(hayAlgoMarcado(vacio)).toBe(false);
    expect(hayAlgoMarcado(undefined)).toBe(false);
  });

  it('una comida dada por hecha cuenta', () => {
    expect(hayAlgoMarcado({ ...vacio, cumplidas: ['comida'] })).toBe(true);
  });

  it('una porción marcada cuenta', () => {
    expect(hayAlgoMarcado({ ...vacio, porciones: { comida: { [POLLO.id]: 2 } } })).toBe(true);
  });

  it('una porción a cero no cuenta', () => {
    expect(hayAlgoMarcado({ ...vacio, porciones: { comida: { [POLLO.id]: 0 } } })).toBe(false);
  });

  it('un extra apuntado cuenta', () => {
    const extra = { id: 'e1', nombre: 'Cerveza', macros: { proteina: 0, hc: 0, grasa: 0 }, kcal: 150 };
    expect(hayAlgoMarcado({ ...vacio, extras: [extra] })).toBe(true);
  });

  it('vaciar deja el día en blanco', () => {
    const lleno: RegistroDia = {
      ...vacio,
      cumplidas: ['comida'],
      porciones: { comida: { [POLLO.id]: 2 } },
      extras: [{ id: 'e1', nombre: 'X', macros: { proteina: 0, hc: 0, grasa: 0 }, kcal: 10 }],
    };
    expect(hayAlgoMarcado({ ...lleno, ...vaciarLoMarcado() })).toBe(false);
  });
});
