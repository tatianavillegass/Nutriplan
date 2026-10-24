import { describe, it, expect } from 'vitest';
import { planVisibleParaCliente } from '../../types/plan';
import type { Plan } from '../../types/plan';

/**
 * MIENTRAS SE LE MONTA EL SIGUIENTE, SIGUE COMIENDO EL DE AHORA
 *
 * Empezar una planificación nueva archivaba la de antes, y hasta que se
 * enviara la nueva la clienta se quedaba **sin plan**: «tu plan todavía se
 * está preparando» durante las horas —a veces el día entero— que se tarda en
 * montarlo. Justo el día en que más mira la app.
 */

const plan = (id: string, extra: Partial<Plan> = {}): Plan =>
  ({
    id,
    clientId: 'c1',
    nombre: id,
    fase: 1,
    dayTypes: [],
    archivado: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...extra,
  }) as unknown as Plan;

/** Un plan que llegó a mandarse: tiene su foto. */
const enviado = (id: string, fecha: string, extra: Partial<Plan> = {}): Plan =>
  plan(id, {
    fecha,
    createdAt: fecha,
    envio: { fecha: `${fecha}T09:00:00.000Z` },
    publicado: { fase: 1, dayTypes: [], fecha: `${fecha}T09:00:00.000Z` },
    ...extra,
  } as Partial<Plan>);

describe('Lo que ve mientras le montan el siguiente', () => {
  it('con un plan enviado y nada más, ése', () => {
    const { plan: visible, preparando } = planVisibleParaCliente([
      enviado('p1', '2026-01-10'),
    ]);
    expect(visible?.id).toBe('p1');
    expect(preparando).toBeUndefined();
  });

  /*
   * El caso que lo rompía: una planificación nueva desde cero o desde una
   * plantilla nace sin foto, y archivaba la anterior.
   */
  it('con la nueva a medio montar, el último que se le mandó', () => {
    const { plan: visible, preparando } = planVisibleParaCliente([
      enviado('p1', '2026-01-10', { archivado: true }),
      plan('p2', { fecha: '2026-03-01', createdAt: '2026-03-01' }),
    ]);
    expect(visible?.id).toBe('p1');
    expect(preparando?.id).toBe('p2');
  });

  it('y en cuanto se envía, pasa a verse la nueva', () => {
    const { plan: visible, preparando } = planVisibleParaCliente([
      enviado('p1', '2026-01-10', { archivado: true }),
      enviado('p2', '2026-03-01'),
    ]);
    expect(visible?.id).toBe('p2');
    expect(preparando).toBeUndefined();
  });

  /** De varios anteriores, el más reciente: no uno de hace un año. */
  it('se cae al más reciente de los que sí se mandaron', () => {
    const { plan: visible } = planVisibleParaCliente([
      enviado('viejo', '2025-02-01', { archivado: true }),
      enviado('reciente', '2026-01-10', { archivado: true }),
      plan('nuevo', { fecha: '2026-03-01', createdAt: '2026-03-01' }),
    ]);
    expect(visible?.id).toBe('reciente');
  });

  /*
   * Un plan que nunca se mandó no fue nunca su plan: no puede aparecer ahora
   * sólo porque haga falta algo que enseñar.
   */
  it('un borrador viejo que nunca se envió no vale como respaldo', () => {
    const { plan: visible, preparando } = planVisibleParaCliente([
      plan('borrador-viejo', { fecha: '2026-01-10', archivado: true }),
      plan('nuevo', { fecha: '2026-03-01', createdAt: '2026-03-01' }),
    ]);
    expect(visible).toBeUndefined();
    expect(preparando).toBeUndefined();
  });

  it('y sin ningún plan, no hay nada que enseñar', () => {
    expect(planVisibleParaCliente([]).plan).toBeUndefined();
  });

  /*
   * La clonación ya copiaba la foto, así que ahí nunca hubo agujero: lo que se
   * comprueba es que sigue sin haberlo y que NO se avisa de nada, porque lo
   * que ve es la foto de su plan en uso.
   */
  it('si la nueva heredó la foto, no hay aviso: lo que ve es la suya', () => {
    const { plan: visible, preparando } = planVisibleParaCliente([
      enviado('p1', '2026-01-10', { archivado: true }),
      plan('p2', {
        fecha: '2026-03-01',
        createdAt: '2026-03-01',
        publicado: { fase: 1, dayTypes: [], fecha: '2026-01-10T09:00:00.000Z' },
      } as Partial<Plan>),
    ]);
    expect(visible?.id).toBe('p2');
    expect(preparando).toBeUndefined();
  });
});
