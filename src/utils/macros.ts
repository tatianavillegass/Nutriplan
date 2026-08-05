import { KCAL_PER_GRAM } from '../data/exchangeGroups';
import type { MacroGrams, MacroBreakdown } from '../types/calculations';

export function kcalFromMacros(m: MacroGrams): number {
  return (
    m.hc * KCAL_PER_GRAM.hc +
    m.proteina * KCAL_PER_GRAM.proteina +
    m.grasa * KCAL_PER_GRAM.grasa
  );
}

export function gkgToGrams(gkg: number, peso: number): number {
  return gkg * peso;
}

export function gramsToGkg(grams: number, peso: number): number {
  return peso > 0 ? grams / peso : 0;
}

/**
 * REGLA §10.2 — la grasa NUNCA se introduce a mano.
 * Es el residuo calórico tras proteína y carbohidratos.
 */
export function fatByDifference(
  caloriasObjetivo: number,
  proteinaG: number,
  hcG: number,
): number {
  const restantes =
    caloriasObjetivo - proteinaG * KCAL_PER_GRAM.proteina - hcG * KCAL_PER_GRAM.hc;
  return restantes / KCAL_PER_GRAM.grasa;
}

/**
 * Objetivos PLANEADOS de un tipo de día: la nutricionista introduce
 * proteína y HC en g/kg; la grasa sale por diferencia.
 */
export function planTargets(
  caloriasObjetivo: number,
  peso: number,
  proteinaGkg: number,
  hcGkg: number,
): MacroBreakdown {
  const proteina = gkgToGrams(proteinaGkg, peso);
  const hc = gkgToGrams(hcGkg, peso);
  const grasa = fatByDifference(caloriasObjetivo, proteina, hc);
  return buildBreakdown({ proteina, hc, grasa }, peso);
}

export function buildBreakdown(m: MacroGrams, peso: number): MacroBreakdown {
  const kcal = kcalFromMacros(m);
  const safe = kcal || 1;
  return {
    ...m,
    kcal,
    gkg: {
      proteina: gramsToGkg(m.proteina, peso),
      hc: gramsToGkg(m.hc, peso),
      grasa: gramsToGkg(m.grasa, peso),
    },
    pct: {
      proteina: (m.proteina * KCAL_PER_GRAM.proteina * 100) / safe,
      hc: (m.hc * KCAL_PER_GRAM.hc * 100) / safe,
      grasa: (m.grasa * KCAL_PER_GRAM.grasa * 100) / safe,
    },
  };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * REGLA §10.7 — redondeo de gramajes al mostrar:
 * múltiplos de 5 g a partir de 20 g; 1 g por debajo.
 */
export function roundPortion(grams: number): number {
  if (grams >= 20) return Math.round(grams / 5) * 5;
  return Math.round(grams);
}

/** Los intercambios sólo admiten medios (§10.3). */
export function snapHalf(n: number): number {
  return Math.round(n * 2) / 2;
}
