import { describe, it, expect } from 'vitest';
import {
  fotoDelPlan,
  hayCambiosSinEnviar,
  planParaCliente,
  queCambio,
} from '../../types/plan';
import type { Plan } from '../../types/plan';

const PLAN: Plan = {
  id: 'p1',
  clientId: 'cl1',
  nombre: 'Planificación 1',
  fase: 1,
  dayTypes: [
    {
      id: 'dt1',
      nombre: 'Día base',
      proteinaGkg: 2,
      hcGkg: 3,
      meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
      grid: { comida: { proteicos_magros: 4 } },
      notas: {},
    },
  ],
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
};

const enviado = (p: Plan = PLAN): Plan => ({
  ...p,
  publicado: fotoDelPlan(p),
  envio: { fecha: '2026-08-09T09:30:00.000Z' },
});

/**
 * BORRADOR Y VERSIÓN ENVIADA
 *
 * Lo que la nutricionista toca es un borrador; la clienta ve lo último
 * enviado. Sin esto, cambiar la fase un martes por la tarde le cambiaba la app
 * mientras cenaba, y un plan a medio montar se veía en el móvil de alguien.
 */
describe('Qué ve la clienta', () => {
  it('sin haber enviado nada, no ve plan', () => {
    expect(planParaCliente(PLAN)).toBeUndefined();
  });

  it('enviado, ve exactamente lo que se mandó', () => {
    const p = planParaCliente(enviado());
    expect(p?.fase).toBe(1);
    expect(p?.dayTypes).toHaveLength(1);
  });

  /** Lo importante: tocar el borrador no le mueve nada a ella. */
  it('lo que se toque después no le llega', () => {
    const tocado = { ...enviado(), fase: 3 as const };
    expect(planParaCliente(tocado)?.fase).toBe(1);
  });

  it('al retirarlo deja de ver el plan', () => {
    const retirado = { ...enviado(), publicado: undefined, envio: undefined };
    expect(planParaCliente(retirado)).toBeUndefined();
  });

  /**
   * Los planes de antes de que existiera el borrador no tienen foto. Sin este
   * apaño, el día que esto se publique todas las clientas se quedarían sin
   * plan — y se enterarían ellas antes que la nutricionista.
   */
  it('los planes antiguos, ya enviados, se siguen viendo', () => {
    const viejo: Plan = { ...PLAN, envio: { fecha: '2026-07-01T10:00:00.000Z' } };
    expect(planParaCliente(viejo)?.fase).toBe(1);
  });
});

describe('Qué queda sin enviar', () => {
  it('un plan recién montado está entero sin enviar', () => {
    expect(hayCambiosSinEnviar(PLAN)).toBe(true);
  });

  it('recién enviado, nada', () => {
    expect(hayCambiosSinEnviar(enviado())).toBe(false);
  });

  it('cambiar la fase cuenta', () => {
    expect(hayCambiosSinEnviar({ ...enviado(), fase: 2 })).toBe(true);
  });

  it('y tocar un día, también', () => {
    const p = enviado();
    const otro = {
      ...p,
      dayTypes: [{ ...p.dayTypes[0], grid: { comida: { proteicos_magros: 5 } } }],
    };
    expect(hayCambiosSinEnviar(otro)).toBe(true);
  });

  /** El nombre del plan y las notas no le llegan: cambiarlos no es un cambio. */
  it('cambiar cosas que ella no ve no pide enviar nada', () => {
    expect(hayCambiosSinEnviar({ ...enviado(), nombre: 'Otro nombre' })).toBe(false);
  });
});

describe('Qué cambió, dicho en castellano', () => {
  it('la fase', () => {
    expect(queCambio({ ...enviado(), fase: 3 })).toContain('La fase pasa de 1 a 3.');
  });

  it('un día tocado', () => {
    const p = enviado();
    const otro = {
      ...p,
      dayTypes: [{ ...p.dayTypes[0], grid: { comida: { proteicos_magros: 5 } } }],
    };
    expect(queCambio(otro)).toContain('«Día base» ha cambiado.');
  });

  it('un día nuevo', () => {
    const p = enviado();
    const otro = {
      ...p,
      dayTypes: [...p.dayTypes, { ...p.dayTypes[0], id: 'dt2', nombre: 'Día libre' }],
    };
    expect(queCambio(otro)).toContain('«Día libre» es nuevo.');
  });

  it('y un día que se ha quitado', () => {
    const otro = { ...enviado(), dayTypes: [] };
    expect(queCambio(otro)).toContain('«Día base» ya no está.');
  });

  it('sin haber enviado nunca, lo dice y ya', () => {
    expect(queCambio(PLAN)).toEqual(['Todavía no le has enviado nada.']);
  });
});
