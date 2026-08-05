import type { EnergyInput, EnergyResults } from '../types/calculations';
import { THERMOGENESIS_FACTOR } from '../data/activityFactors';

/**
 * Cadena de cálculo (§1):
 *   TMB × factor actividad → subtotal
 *   subtotal × 1.1         → GET
 *   GET × ajuste objetivo  → calorías objetivo
 *
 * `getRounding` replica el comportamiento de la hoja de cálculo original, que
 * TRUNCA el GET a entero antes de aplicar el multiplicador de objetivo.
 * Caso de referencia: 1686 × 1.5 × 1.1 = 2781.9 → se muestra 2781, y
 * 2781 × 1.2 = 3337.2 → 3337. Con redondeo normal saldría 2782 / 3338.
 */
export function calcEnergy({
  tmb,
  activityFactor,
  thermogenesis = THERMOGENESIS_FACTOR,
  goalMultiplier,
  getRounding = 'truncate',
}: EnergyInput): EnergyResults {
  const subtotal = tmb * activityFactor;
  const get = subtotal * thermogenesis;
  const getBase =
    getRounding === 'truncate' ? Math.floor(get)
    : getRounding === 'round' ? Math.round(get)
    : get;

  return {
    tmb,
    subtotal,
    get,
    getMostrado: getBase,
    caloriasObjetivo: getBase * goalMultiplier,
  };
}

/** Convierte un % de déficit/superávit en multiplicador. −25 → 0.75, +20 → 1.20 */
export function pctToMultiplier(pct: number): number {
  return 1 + pct / 100;
}

export function multiplierToPct(multiplier: number): number {
  return (multiplier - 1) * 100;
}
