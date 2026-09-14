import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';

/**
 * QUITARLE UN INGREDIENTE A UNA CLIENTA
 *
 * «Me cuadra todo menos el pimentón.» La receta del banco es la misma para
 * todas y el plato de ella no, así que se quita en su plan. Y lo que el plato
 * cubre se recalcula sin él: si lo que se va es el salmón, esa receta deja de
 * traer la proteína y hay que verlo.
 */

const ALIMENTOS: Alimento[] = [
  {
    id: 'f-salmon',
    nombre: 'Salmón fresco',
    grupo: 'proteicos_grasos',
    medida_casera: '1 filete',
    gramos: 100,
    unidad: 'g',
    intercambios: 2,
    nutrientes: { kcal: 208, hc: 0, proteina: 20, grasa: 13 },
    comidas_sugeridas: ['cena'],
    alergenos: [],
    apto: [],
  } as unknown as Alimento,
];

const RECETA: Receta = {
  id: 'r-salmon',
  nombre: 'Salmón con arroz y pimentón',
  categorias: ['cena'],
  tags: [],
  base: { proteicos_grasos: 2, almidones: 2 },
  ingredientes: [
    {
      id: 'i-salmon',
      nombre: 'Salmón',
      foodId: 'f-salmon',
      cantidad_base: 100,
      unidad: 'g',
      grupo: 'proteicos_grasos',
      escalable: true,
      opcional: false,
    },
    {
      id: 'i-arroz',
      nombre: 'Arroz',
      cantidad_base: 60,
      unidad: 'g',
      grupo: 'almidones',
      escalable: true,
      opcional: false,
    },
    {
      id: 'i-pimenton',
      nombre: 'Pimentón',
      cantidad_base: null,
      unidad: 'al gusto',
      grupo: 'condimento',
      escalable: false,
      opcional: false,
    },
  ],
  preparacion: '',
} as unknown as Receta;

const PAUTA = { proteicos_grasos: 2, almidones: 2 };

const nombres = (r: ReturnType<typeof scaleRecipe>) => r.ingredientes.map((i) => i.nombre);

describe('Un ingrediente quitado para esta clienta', () => {
  it('desaparece de la lista', () => {
    const r = scaleRecipe(RECETA, PAUTA, ALIMENTOS, {}, [], ['i-pimenton']);
    expect(nombres(r)).toEqual(['Salmón', 'Arroz']);
  });

  /** Se quita, no se pone a cero: «pimentón: 0 g» es peor que nada. */
  it('y no se queda en la lista con cero gramos', () => {
    const r = scaleRecipe(RECETA, PAUTA, ALIMENTOS, {}, [], ['i-pimenton']);
    expect(r.ingredientes.some((i) => i.id === 'i-pimenton')).toBe(false);
  });

  /** Un condimento no aporta nada, así que el plato sigue cuadrando igual. */
  it('quitar un condimento no toca lo que cubre', () => {
    const con = scaleRecipe(RECETA, PAUTA, ALIMENTOS);
    const sin = scaleRecipe(RECETA, PAUTA, ALIMENTOS, {}, [], ['i-pimenton']);
    expect(sin.cubiertos).toEqual(con.cubiertos);
    expect(sin.gruposSinCubrir).toEqual(con.gruposSinCubrir);
  });

  /**
   * Y quitar el salmón sí: callarlo sería enviar un plan que no cuadra. Se
   * dice, no se bloquea — ella le pone algo al lado.
   */
  it('quitar la fuente de proteína deja el plato sin ella, y se dice', () => {
    const r = scaleRecipe(RECETA, PAUTA, ALIMENTOS, {}, [], ['i-salmon']);
    expect(r.cubiertos.proteicos_grasos ?? 0).toBe(0);
    expect(r.gruposSinCubrir).toContain('proteicos_grasos');
  });

  /** El arroz no crece para tapar el hueco: quitar no es sustituir. */
  it('lo que queda no crece para compensar', () => {
    const con = scaleRecipe(RECETA, PAUTA, ALIMENTOS);
    const sin = scaleRecipe(RECETA, PAUTA, ALIMENTOS, {}, [], ['i-salmon']);
    const arrozDe = (r: ReturnType<typeof scaleRecipe>) =>
      r.ingredientes.find((i) => i.id === 'i-arroz')!.cantidad_final;
    expect(arrozDe(sin)).toBe(arrozDe(con));
  });

  /** Sin quitar nada, todo sigue exactamente igual que antes. */
  it('sin quitados, el escalado no cambia', () => {
    const antes = scaleRecipe(RECETA, PAUTA, ALIMENTOS);
    const ahora = scaleRecipe(RECETA, PAUTA, ALIMENTOS, {}, [], []);
    expect(ahora).toEqual(antes);
  });
});
