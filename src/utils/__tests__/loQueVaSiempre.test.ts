import { describe, it, expect } from 'vitest';
import { hayDescuadre, pautaDeComida } from '../fijos';
import type { Alimento } from '../../types/food';

/**
 * UNA MIGAJA NO ES UN DESCUADRE
 *
 * «Me está poniendo esto, pero en el cálculo sí tengo 0,5 lácteos pautados»:
 * con medio lácteo pautado y 125 ml de leche semi de fijo, salía «aquí no
 * tienes pautado 0,0 lácteos semidesnatados». Y el cero era de verdad — se
 * pasaba de 0,0102 porciones, que son dos mililitros y medio.
 *
 * Una porción de leche semi son 245 ml y ella escribe 125, que es medio vaso.
 * Para cuadrar al milímetro tendría que escribir 122,5: cualquier cantidad
 * redonda deja un resto así, con casi cualquier alimento. Un aviso que dice
 * «te pasas de cero» no se puede arreglar —el reparto va de medio en medio— y
 * enseña a no leer los avisos.
 */
describe('Cuando se pasa por una migaja', () => {
  const LECHE: Alimento = {
    id: 'a-leche',
    nombre: 'Leche semidesnatada',
    grupo: 'lacteos_semi',
    medida_casera: '1 vaso',
    gramos: 245,
    unidad: 'ml',
    intercambios: 1,
    nutrientes: { kcal: 46, hc: 4.9, proteina: 3.4, grasa: 1.6 },
    comidas_sugeridas: [],
    alergenos: [],
    apto: [],
  };

  /** Medio vaso con medio lácteo pautado: 125 de 245 son 0,51 porciones. */
  const medioVaso = (gramos: number) =>
    pautaDeComida(
      {
        grid: { desayuno: { lacteos_semi: 0.5, almidones: 2 } },
        fijos: {
          desayuno: [
            { id: 'f1', foodId: LECHE.id, nombre: 'Leche', gramos, unidad: 'ml' },
          ],
        },
      } as never,
      'desayuno',
      [LECHE],
    );

  it('no se avisa de nada', () => {
    const p = medioVaso(125);
    expect(p.sinPautar).toEqual({});
    expect(hayDescuadre(p)).toBe(false);
  });

  /* Lo demás de la comida sigue intacto: sólo se gastó el lácteo. */
  it('y la comida conserva lo suyo', () => {
    expect(medioVaso(125).pauta).toEqual({ almidones: 2 });
  });

  /* Pero un descuadre de verdad se sigue viendo: un vaso entero de más. */
  it('un vaso entero sí se avisa', () => {
    const p = medioVaso(245);
    expect(hayDescuadre(p)).toBe(true);
    expect(p.sinPautar.lacteos_semi).toBeCloseTo(0.5, 2);
  });

  /* Y nunca se avisa de algo que se enseñaría como «0,0». */
  it('lo que se avisa siempre se ve en el número', () => {
    const p = medioVaso(260);
    for (const n of Object.values(p.sinPautar)) expect(Number(n?.toFixed(1))).toBeGreaterThan(0);
  });
});
