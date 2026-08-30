import { describe, it, expect } from 'vitest';
import type { Alimento } from '../../types/food';
import type { Receta } from '../../types/recipe';
import { evaluarAlimento, evaluarReceta, ejesVigilados } from '../restrictions';
import { sanearGrupos } from '../../store/useAppStore';

/**
 * DOS COSAS DISTINTAS: PROHIBIR Y VIGILAR
 *
 * Un alérgeno es sí o no —un miligramo de gluten importa—. Un FODMAP es
 * cuánto: media aguacate cuadra y uno entero no. Bloquearlo todo parece más
 * seguro pero no lo es: deja a una paciente de SIBO con arroz y pollo, y a la
 * nutricionista levantando excepciones a mano una por una.
 */

const alimento = (id: string, extra: Partial<Alimento> = {}): Alimento =>
  ({
    id,
    nombre: id,
    grupo: 'almidones',
    medida_casera: '100 g',
    gramos: 100,
    intercambios: 1,
    comidas_sugeridas: [],
    alergenos: [],
    apto: [],
    ...extra,
  }) as Alimento;

const CEBOLLA = alimento('v-cebolla', {
  cargas: { fodmap: { nivel: 'alto', tipos: ['fructanos'] } },
});
const AGUACATE = alimento('a-aguacate', {
  cargas: { fodmap: { nivel: 'alto', tipos: ['sorbitol'], porcionSegura: 30 } },
});
const ARROZ = alimento('a-arroz', { cargas: { fodmap: { nivel: 'bajo' } } });
const SIN_MIRAR = alimento('a-sin-mirar');

const conSII = { patologias: ['sii_fodmap'], alergias: [], aversiones: [] };

describe('Las cargas avisan, no bloquean', () => {
  it('una cebolla alta en fructanos se sigue viendo', () => {
    const ev = evaluarAlimento(CEBOLLA, conSII);
    expect(ev.bloqueado).toBe(false);
    expect(ev.avisos?.[0].texto).toContain('Alto en fodmap (fructanos)');
  });

  /** La porción es el dato que hace útil la dieta: sin ella sólo sirve para prohibir. */
  it('y dice hasta cuántos gramos sigue siendo baja', () => {
    expect(evaluarAlimento(AGUACATE, conSII).avisos?.[0].texto).toContain('bajo hasta 30 g');
  });

  it('lo bajo no dice nada', () => {
    expect(evaluarAlimento(ARROZ, conSII).avisos).toBeUndefined();
  });

  /**
   * SIN DATO NO ES SIN PROBLEMA
   *
   * Con 281 alimentos y siete ejes, la mayoría de las casillas van a estar
   * vacías durante meses. Pintar en verde lo que nadie ha mirado es mentir.
   */
  it('y lo que nadie ha mirado se dice, en vez de darlo por bueno', () => {
    const ev = evaluarAlimento(SIN_MIRAR, conSII);
    expect(ev.bloqueado).toBe(false);
    expect(ev.sinDatos).toEqual(['fodmap']);
  });

  it('sin la patología activa no se mira ningún eje', () => {
    const ev = evaluarAlimento(CEBOLLA, { patologias: [], alergias: [], aversiones: [] });
    expect(ev.avisos).toBeUndefined();
    expect(ev.sinDatos).toBeUndefined();
  });

  it('cada patología vigila lo suyo', () => {
    expect(ejesVigilados({ patologias: ['sii_fodmap'] })).toEqual(['fodmap']);
    expect(ejesVigilados({ patologias: ['histamina', 'alergia_niquel'] })).toEqual([
      'histamina',
      'niquel',
    ]);
    expect(ejesVigilados({ patologias: ['celiaquia'] })).toEqual([]);
  });
});

/**
 * LA LECHE SON DOS COSAS
 *
 * La lactosa es el azúcar; la proteína son la caseína y el suero. Una leche sin
 * lactosa está llena de caseína, así que a una APLV no le vale. Antes las dos
 * condiciones bloqueaban la misma etiqueta y se le colaban todos los «sin
 * lactosa», que es justo lo que no puede tomar.
 */
describe('La proteína de la leche no es la lactosa', () => {
  const SIN_LACTOSA = alimento('a-leche-sin-lactosa', {
    alergenos: ['proteina_leche'],
  });
  const LECHE = alimento('a-leche', { alergenos: ['lactosa', 'proteina_leche'] });

  it('a una intolerante a la lactosa le vale la leche sin lactosa', () => {
    const ev = evaluarAlimento(SIN_LACTOSA, {
      patologias: ['intolerancia_lactosa'],
      alergias: [],
      aversiones: [],
    });
    expect(ev.bloqueado).toBe(false);
  });

  it('y a una alérgica a la proteína, no', () => {
    const ev = evaluarAlimento(SIN_LACTOSA, {
      patologias: ['aplv'],
      alergias: [],
      aversiones: [],
    });
    expect(ev.bloqueado).toBe(true);
    expect(ev.motivos[0]).toContain('proteína de la leche');
  });

  it('la leche normal las bloquea a las dos', () => {
    for (const p of ['intolerancia_lactosa', 'aplv']) {
      expect(
        evaluarAlimento(LECHE, { patologias: [p], alergias: [], aversiones: [] }).bloqueado,
      ).toBe(true);
    }
  });
});

/**
 * Los datos guardados con las etiquetas viejas se traducen hacia el lado
 * seguro: quitarle un veto a alguien sin saberlo es lo único que aquí no se
 * puede permitir.
 */
describe('Los alérgenos viejos se traducen', () => {
  it('lo que llevaba lactosa pasa a llevar también proteína de la leche', () => {
    const [f] = sanearGrupos([
      alimento('a-yogur', { alergenos: ['lactosa'] as never }),
    ]);
    expect(f.alergenos).toContain('lactosa');
    expect(f.alergenos).toContain('proteina_leche');
  });

  it('el marisco se parte en crustáceos y moluscos, sin quitar nada', () => {
    const [f] = sanearGrupos([alimento('a-gamba', { alergenos: ['marisco'] as never })]);
    expect(f.alergenos).toEqual(['crustaceos', 'moluscos']);
  });

  /** El FODMAP deja de ser un alérgeno: ahora es una carga con sus niveles. */
  it('y el fodmap deja de bloquear a ciegas', () => {
    const [f] = sanearGrupos([
      alimento('a-cebolla', { alergenos: ['fodmap'] as never }),
    ]);
    expect(f.alergenos).toEqual([]);
  });

  it('lo que ya estaba bien no se toca', () => {
    const antes = alimento('a-pan', { alergenos: ['gluten'] });
    expect(sanearGrupos([antes])[0]).toBe(antes);
  });
});

/**
 * UNA RECETA CARGA LO QUE CARGUE SU PEOR INGREDIENTE
 *
 * Si lleva cebolla es alta en fructanos aunque todo lo demás sea bajo. Así las
 * recetas se etiquetan solas y no hay que marcarlas a mano una por una.
 */
describe('Las recetas heredan de sus ingredientes', () => {
  const ing = (id: string, opcional = false) => ({
    id: `i-${id}`,
    nombre: id,
    foodId: id,
    cantidad_base: 50,
    unidad: 'g',
    grupo: 'almidones' as const,
    escalable: true,
    opcional,
  });

  const receta = (ids: string[]): Receta =>
    ({
      id: 'r1',
      nombre: 'Plato',
      categorias: [],
      tags: [],
      base: {},
      ingredientes: ids.map((i) => ing(i)),
      preparacion: '',
      notas: '',
      createdAt: '',
      updatedAt: '',
    }) as Receta;

  const foods = [CEBOLLA, ARROZ, AGUACATE, SIN_MIRAR];

  it('el arroz con cebolla es alto en fructanos', () => {
    const ev = evaluarReceta(receta(['a-arroz', 'v-cebolla']), conSII, foods);
    expect(ev.bloqueado).toBe(false);
    expect(ev.avisos?.[0].nivel).toBe('alto');
  });

  it('el arroz solo no avisa de nada', () => {
    expect(evaluarReceta(receta(['a-arroz']), conSII, foods).avisos).toBeUndefined();
  });

  it('y si lleva un ingrediente sin revisar, lo dice', () => {
    const ev = evaluarReceta(receta(['a-arroz', 'a-sin-mirar']), conSII, foods);
    expect(ev.sinDatos).toEqual(['fodmap']);
  });
});
