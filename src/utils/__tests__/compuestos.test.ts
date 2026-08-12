import { describe, it, expect } from 'vitest';
import {
  aporteDeAlimento,
  esCompuesto,
  gruposDeAlimento,
  describeEquivalencia,
  exchangesToMacros,
} from '../exchanges';
import { kcalFromMacros } from '../macros';
import { seleccionPorBucket, seleccionPorGrupo, marcadoDeBucket, limpiarBucket } from '../marcado';
import { macrosDePorciones, porcionesDeBucket } from '../diary';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Alimento } from '../../types/food';
import type { RegistroDia } from '../../types/diary';

/** La mezcla de tortitas: una medida son 2 almidones y 2 proteicos magros. */
const TORTITAS = FOOD_CATALOG.find((f) => f.id === 'a-mezcla-tortitas-proteicas')!;
/** Un alimento normal, de un solo grupo. */
const POLLO = FOOD_CATALOG.find((f) => f.grupo === 'proteicos_magros' && !f.equivale)!;

const FOODS: Alimento[] = [TORTITAS, POLLO];

describe('Un alimento puede gastar más de un intercambio', () => {
  it('reconoce cuál es compuesto y cuál no', () => {
    expect(esCompuesto(TORTITAS)).toBe(true);
    expect(esCompuesto(POLLO)).toBe(false);
  });

  it('una medida gasta los dos grupos', () => {
    expect(aporteDeAlimento(TORTITAS, 1)).toEqual({ almidones: 2, proteicos_magros: 2 });
  });

  it('dos medidas gastan el doble', () => {
    expect(aporteDeAlimento(TORTITAS, 2)).toEqual({ almidones: 4, proteicos_magros: 4 });
  });

  it('media medida gasta la mitad', () => {
    expect(aporteDeAlimento(TORTITAS, 0.5)).toEqual({ almidones: 1, proteicos_magros: 1 });
  });

  it('un alimento normal sigue gastando sólo lo suyo', () => {
    expect(aporteDeAlimento(POLLO, 3)).toEqual({ proteicos_magros: 3 });
  });

  it('ocupa los dos grupos', () => {
    expect(gruposDeAlimento(TORTITAS).sort()).toEqual(['almidones', 'proteicos_magros']);
    expect(gruposDeAlimento(POLLO)).toEqual(['proteicos_magros']);
  });

  it('lo explica en palabras para quien lo va a comer', () => {
    expect(describeEquivalencia(TORTITAS)).toBe('2 almidones + 2 proteicos magros');
    expect(describeEquivalencia(POLLO)).toBe('');
  });

  /**
   * Se comprueba por calorías. Cada grupo arrastra sus macros de regalo (un
   * almidón trae 2 g de proteína), así que el reparto declarado siempre sale
   * un poco alto en proteína: 18 g declarados contra los 15 de la etiqueta.
   * Lo que tiene que cuadrar es la energía, que es la moneda del plan.
   */
  it('el reparto declarado cuadra en calorías con la etiqueta', () => {
    const declarado = exchangesToMacros(TORTITAS.equivale!);
    const f = TORTITAS.gramos / 100;
    const real = {
      hc: TORTITAS.nutrientes!.hc * f,
      proteina: TORTITAS.nutrientes!.proteina * f,
      grasa: TORTITAS.nutrientes!.grasa * f,
    };
    const kcalDeclaradas = kcalFromMacros(declarado);
    const kcalReales = kcalFromMacros(real);
    expect(Math.abs(kcalDeclaradas - kcalReales) / kcalReales).toBeLessThan(0.12);
    expect(Math.abs(declarado.hc - real.hc)).toBeLessThan(4);
  });
});

describe('Marcarlo descuenta de los dos sitios', () => {
  const porciones = { desayuno: { [TORTITAS.id]: 1 } };

  it('suma en carbohidrato y en proteína a la vez', () => {
    const porBucket = seleccionPorBucket(porciones, FOODS);
    expect(porBucket.desayuno?.carbohidrato).toBe(2);
    expect(porBucket.desayuno?.proteina).toBe(2);
  });

  it('aparece en los dos subgrupos', () => {
    const porGrupo = seleccionPorGrupo(porciones, FOODS);
    expect(porGrupo.desayuno?.almidones).toBe(2);
    expect(porGrupo.desayuno?.proteicos_magros).toBe(2);
  });

  it('se suma a lo que ya hubiera de ese grupo', () => {
    const conPollo = { desayuno: { [TORTITAS.id]: 1, [POLLO.id]: 1 } };
    expect(seleccionPorGrupo(conPollo, FOODS).desayuno?.proteicos_magros).toBe(3);
    expect(marcadoDeBucket(conPollo, 'desayuno', 'proteina', FOODS)).toBe(3);
  });

  it('los macros del día cuentan los dos grupos', () => {
    const registro = { porciones } as unknown as RegistroDia;
    const macros = macrosDePorciones(registro, FOODS);
    const esperado = exchangesToMacros({ almidones: 2, proteicos_magros: 2 });
    expect(macros.hc).toBeCloseTo(esperado.hc);
    expect(macros.proteina).toBeCloseTo(esperado.proteina);
  });

  it('el recuento por macro de una comida también', () => {
    const registro = { porciones } as unknown as RegistroDia;
    expect(porcionesDeBucket(registro, 'desayuno', 'carbohidrato', FOODS)).toBe(2);
    expect(porcionesDeBucket(registro, 'desayuno', 'proteina', FOODS)).toBe(2);
  });

  it('al vaciar un macro se va entero: no se parte una medida', () => {
    // Se limpia el carbohidrato, pero la mezcla también aportaba proteína.
    const limpio = limpiarBucket(porciones, 'desayuno', 'carbohidrato', FOODS);
    expect(limpio.desayuno?.[TORTITAS.id]).toBeUndefined();
  });
});

describe('El grupo de las grasas proteicas', () => {
  it('se llama por lo que es, no sólo por los frutos secos', () => {
    expect(EXCHANGE_GROUPS.frutos_secos.nombre).toBe('Grasas proteicas');
  });

  it('sigue en la familia de las grasas y por encima del aceite', () => {
    expect(EXCHANGE_GROUPS.frutos_secos.familia).toBe('grasas');
    expect(EXCHANGE_GROUPS.frutos_secos.nivel).toBeGreaterThan(EXCHANGE_GROUPS.grasas.nivel);
  });
});
