import { describe, it, expect } from 'vitest';
import { scaleRecipe } from '../recipeScaling';
import { matchRecipes } from '../recipeMatcher';
import { exchangesToMacros } from '../exchanges';
import type { Receta } from '../../types/recipe';

/**
 * PAUTASTE LÁCTEO Y LA RECETA LO CUBRE CON WHEY
 *
 * Salió haciendo el plan de una clienta: desayuno con 3 lácteos proteicos
 * pautados y una avena trasnochada que pone la proteína con whey, sin lácteo.
 *
 * Pasaban dos cosas, las dos malas. El recomendador la marcaba como «no cubre
 * lácteos proteicos» aunque un proteico magro es de la misma familia. Y el
 * escalado dejaba la whey en CERO gramos: los lácteos proteicos no traen
 * grasa, así que el tope de grasa salía cero y borraba la proteína del plato
 * sin decir nada.
 */

const AVENA: Receta = {
  id: 'r_avena',
  nombre: 'Avena trasnochada con arándanos',
  categorias: ['desayuno'],
  tags: ['dulce'],
  base: { almidones: 1, proteicos_magros: 1, fruta: 1, frutos_secos: 1 },
  ingredientes: [
    { id: 'i1', nombre: 'Copos de avena', cantidad_base: 30, unidad: 'g', grupo: 'almidones', escalable: true, opcional: false },
    { id: 'i2', nombre: 'Proteína whey', cantidad_base: 7, unidad: 'g', grupo: 'proteicos_magros', escalable: true, opcional: false },
    { id: 'i3', nombre: 'Arándanos', cantidad_base: 80, unidad: 'g', grupo: 'fruta', escalable: true, opcional: false },
    { id: 'i4', nombre: 'Semillas de chía', cantidad_base: 10, unidad: 'g', grupo: 'frutos_secos', escalable: true, opcional: false },
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
};

const PAUTADO = { lacteos_proteicos: 3, frutos_secos: 2, fruta: 1, almidones: 1 };

describe('El escalado no puede borrar la proteína del plato', () => {
  const e = scaleRecipe(AVENA, PAUTADO, []);

  it('la whey no se queda en cero', () => {
    expect(e.factores.proteicos_magros).toBeGreaterThan(0);
    const whey = e.ingredientes.find((i) => i.nombre === 'Proteína whey')!;
    expect(whey.cantidad_final).toBeGreaterThan(0);
  });

  it('la whey cubre la proteína que se pautó en lácteos', () => {
    /**
     * Se mira sólo lo que pone la familia de los proteicos: el resto del plato
     * (avena, fruta, semillas) trae otros 7 g de proteína de regalo que no
     * vienen a cuento aquí.
     */
    const deLaWhey = exchangesToMacros({
      proteicos_magros: e.cubiertos.proteicos_magros ?? 0,
    }).proteina;
    const pedida = exchangesToMacros({ lacteos_proteicos: 3 }).proteina; // 30 g
    expect(deLaWhey).toBeCloseTo(pedida, 0);
  });

  it('no se queja de que falte nada', () => {
    expect(e.gruposSinCubrir).toEqual([]);
  });

  it('le explica a la nutricionista con qué lo ha cubierto', () => {
    expect(e.notas.join(' ')).toMatch(/lácteos proteicos.*proteicos magros/i);
  });

  it('y no dice que haya recortado nada, porque bajar de escalón es libre', () => {
    expect(e.notas.join(' ')).not.toMatch(/recortado/i);
  });
});

describe('El recomendador compara por familia', () => {
  it('no dice que falte el lácteo si la receta trae otro proteico', () => {
    const [m] = matchRecipes([AVENA], PAUTADO, { slot: 'desayuno' });
    expect(m.faltantes).toEqual([]);
    expect(m.sobrantes).toEqual([]);
  });

  it('avisa de que lo cubre con otro de su familia', () => {
    const [m] = matchRecipes([AVENA], PAUTADO, { slot: 'desayuno' });
    expect(m.motivos.join(' ')).toMatch(/otro de su familia/i);
  });

  it('una receta con el lácteo de verdad puntúa por encima', () => {
    const conYogur: Receta = {
      ...AVENA,
      id: 'r_yogur',
      nombre: 'Avena con yogur',
      base: { almidones: 1, lacteos_proteicos: 1, fruta: 1, frutos_secos: 1 },
    };
    const [primera] = matchRecipes([AVENA, conYogur], PAUTADO, { slot: 'desayuno' });
    expect(primera.receta.id).toBe('r_yogur');
  });

  it('lo que no trae de ninguna manera sí sigue faltando', () => {
    const sinProteina: Receta = {
      ...AVENA,
      id: 'r_sola',
      base: { almidones: 1, fruta: 1, frutos_secos: 1 },
    };
    const [m] = matchRecipes([sinProteina], PAUTADO, { slot: 'desayuno' });
    expect(m.faltantes).toEqual(['lacteos_proteicos']);
  });
});

describe('Subir de escalón sigue avisando y recortando', () => {
  it('nueces donde se pautó aceite se recorta, que cuestan más', () => {
    const conNueces: Receta = {
      ...AVENA,
      id: 'r_nueces',
      base: { frutos_secos: 2 },
      ingredientes: [
        { id: 'i1', nombre: 'Nueces', cantidad_base: 20, unidad: 'g', grupo: 'frutos_secos', escalable: true, opcional: false },
      ],
    };
    const e = scaleRecipe(conNueces, { grasas: 2 }, []);
    // La grasa manda: 2 porciones de grasa son 10 g y las nueces los cubren.
    expect(exchangesToMacros(e.cubiertos).grasa).toBeCloseTo(10, 0);
  });

  it('un proteico graso donde se pautó magro se recorta', () => {
    const conQueso: Receta = {
      ...AVENA,
      id: 'r_queso',
      base: { proteicos_grasos: 3 },
      ingredientes: [
        { id: 'i1', nombre: 'Queso curado', cantidad_base: 30, unidad: 'g', grupo: 'proteicos_grasos', escalable: true, opcional: false },
      ],
    };
    const e = scaleRecipe(conQueso, { proteicos_magros: 3 }, []);
    expect(e.notas.join(' ')).toMatch(/recortado/i);
    expect(e.factores.proteicos_grasos!).toBeLessThan(1);
  });
});
