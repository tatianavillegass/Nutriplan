import { describe, it, expect } from 'vitest';
import { escalarMedida, pluralizar, singularizar, esUnidad } from '../measures';
import { etiquetaItem, textoItem, medidaEsGramaje } from '../mealOptions';
import { sanearGrupos } from '../../store/useAppStore';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import type { Alimento } from '../../types/food';
import type { ItemOpcion } from '../mealOptions';

describe('Los símbolos de unidad no se pluralizan', () => {
  it('gramos y mililitros se quedan como están', () => {
    expect(pluralizar('g')).toBe('g');
    expect(pluralizar('ml')).toBe('ml');
    expect(pluralizar('kg')).toBe('kg');
    expect(esUnidad('ML')).toBe(true);
    expect(esUnidad('taza')).toBe(false);
  });

  it('escalar una medida en gramos no inventa "ges"', () => {
    expect(escalarMedida('30 g', 5)).toBe('150 g');
    expect(escalarMedida('130 ml', 1)).toBe('130 ml');
    expect(escalarMedida('65 ml', 2)).toBe('130 ml');
  });

  it('tampoco al singularizar', () => {
    expect(singularizar('g')).toBe('g');
    expect(singularizar('ml')).toBe('ml');
  });

  it('las medidas caseras de verdad sí concuerdan', () => {
    expect(escalarMedida('1 huevo', 2)).toBe('2 huevos');
    expect(escalarMedida('1/2 taza', 3)).toBe('1 1/2 tazas');
    expect(escalarMedida('1 cda', 3)).toBe('3 cdas');
  });

  it('el adjetivo de tamaño acompaña al plural', () => {
    expect(escalarMedida('1 unidad pequeña', 3)).toBe('3 unidades pequeñas');
    expect(escalarMedida('1 puñado pequeño', 2)).toBe('2 puñados pequeños');
    expect(escalarMedida('1 unidad grande', 2)).toBe('2 unidades grandes');
    // Y una preposición no se toca: "1/2 taza de avena".
    expect(escalarMedida('1/2 taza de avena', 3)).toBe('1 1/2 tazas de avena');
  });
});

describe('Sin repetir la cantidad en la misma línea', () => {
  const item = (extra: Partial<ItemOpcion> = {}): ItemOpcion => ({
    foodId: 'x',
    nombre: 'Clara de huevo',
    grupo: 'proteicos_magros',
    intercambios: 2,
    gramos: 130,
    unidad: 'ml',
    medida: '130 ml',
    ...extra,
  });

  it('reconoce la medida que es sólo un gramaje', () => {
    expect(medidaEsGramaje('130 ml')).toBe(true);
    expect(medidaEsGramaje('150 g')).toBe(true);
    expect(medidaEsGramaje('1 huevo')).toBe(false);
    expect(medidaEsGramaje('1/2 taza')).toBe(false);
  });

  it('"130 ml de clara de huevo", no "(130 ml)" otra vez', () => {
    expect(textoItem(item())).toBe('130 ml de clara de huevo');
  });

  it('con medida casera de verdad sí se ponen los gramos', () => {
    expect(textoItem(item({ nombre: 'Huevo', medida: '2 huevos', gramos: 120, unidad: 'g' }))).toBe(
      '2 huevos (120 g)',
    );
  });

  it('el crudo/cocido se sigue mostrando entero', () => {
    const t = textoItem(
      item({ nombre: 'Arroz blanco crudo', medida: '60 g', gramos: 60, unidad: 'g', gramosCocido: 180 }),
    );
    expect(t).toMatch(/60 g crudo \/ 180 g cocido/);
  });

  it('etiquetaItem sigue sin repetir el nombre del alimento', () => {
    expect(etiquetaItem('2 huevos', 'Huevo')).toBe('2 huevos');
    expect(etiquetaItem('2 claras', 'Clara de huevo')).toBe('2 claras de huevo');
  });
});

describe('Catálogo guardado con subgrupos antiguos', () => {
  const viejo = [
    { id: 'v1', nombre: 'Yogur de antes', grupo: 'lacteos', gramos: 200, medida_casera: '1 unidad', intercambios: 1, comidas_sugeridas: [], nutrientes: { kcal: 100, hc: 12, proteina: 8, grasa: 4 } },
    { id: 'v2', nombre: 'Pollo de antes', grupo: 'proteicos', gramos: 30, medida_casera: '30 g', intercambios: 1, comidas_sugeridas: [], nutrientes: { kcal: 110, hc: 0, proteina: 23, grasa: 1.5 } },
  ] as unknown as Alimento[];

  it('"lacteos" pasa a un subgrupo que existe y vuelve a contar como proteína', () => {
    const [yogur] = sanearGrupos(viejo);
    expect(yogur.grupo).toBe('lacteos_semi');
    expect(EXCHANGE_GROUPS[yogur.grupo!].bucket).toBe('proteina');
  });

  it('un alimento con subgrupo desconocido no rompe la lista', () => {
    const raro = sanearGrupos([{ ...viejo[0], grupo: 'inventado' } as unknown as Alimento]);
    expect(raro[0].grupo).toBeUndefined();
  });

  it('los alimentos del catálogo actual no se tocan', () => {
    const antes = FOOD_CATALOG.slice(0, 20);
    expect(sanearGrupos(antes)).toEqual(antes);
  });

  it('todos los lácteos del catálogo cuentan como proteína', () => {
    const lacteos = FOOD_CATALOG.filter((f) => f.grupo?.startsWith('lacteos'));
    expect(lacteos.length).toBeGreaterThan(8);
    for (const f of lacteos) expect(EXCHANGE_GROUPS[f.grupo!].bucket).toBe('proteina');
  });

  it('el queso cottage está y se puede pautar como proteína', () => {
    const cottage = FOOD_CATALOG.find((f) => f.nombre === 'Queso cottage')!;
    expect(cottage).toBeTruthy();
    expect(EXCHANGE_GROUPS[cottage.grupo!].bucket).toBe('proteina');
  });
});
