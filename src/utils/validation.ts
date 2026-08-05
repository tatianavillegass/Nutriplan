import type { MacroGrams } from '../types/calculations';
import { kcalFromMacros } from './macros';

export type Semaforo = 'verde' | 'ambar' | 'rojo';

export interface MacroComparison {
  key: 'proteina' | 'hc' | 'grasa' | 'kcal';
  label: string;
  planeado: number;
  pautado: number;
  diferencia: number;
  /** Desviación relativa en %, con signo. */
  desviacionPct: number;
  semaforo: Semaforo;
  /** Decimales sugeridos al mostrar (kcal → 0, gramos → 1). */
  decimales: number;
}

/** Verde ≤5% · Ámbar 5–10% · Rojo >10% (§3). */
export function semaforo(desviacionPct: number): Semaforo {
  const abs = Math.abs(desviacionPct);
  if (abs <= 5) return 'verde';
  if (abs <= 10) return 'ambar';
  return 'rojo';
}

function compare(
  key: MacroComparison['key'],
  label: string,
  planeado: number,
  pautado: number,
): MacroComparison {
  const diferencia = pautado - planeado;
  const desviacionPct = planeado !== 0 ? (diferencia / planeado) * 100 : pautado === 0 ? 0 : 100;
  return {
    key,
    label,
    planeado,
    pautado,
    diferencia,
    desviacionPct,
    semaforo: semaforo(desviacionPct),
    decimales: key === 'kcal' ? 0 : 1,
  };
}

/** Panel PLANEADO vs PAUTADO (§3). */
export function comparePlanned(
  planeado: MacroGrams,
  pautado: MacroGrams,
): MacroComparison[] {
  return [
    compare('proteina', 'Proteína (g)', planeado.proteina, pautado.proteina),
    compare('hc', 'Carbohidratos (g)', planeado.hc, pautado.hc),
    compare('grasa', 'Grasas (g)', planeado.grasa, pautado.grasa),
    compare('kcal', 'Calorías (kcal)', kcalFromMacros(planeado), kcalFromMacros(pautado)),
  ];
}

export function worstSemaforo(rows: MacroComparison[]): Semaforo {
  if (rows.some((r) => r.semaforo === 'rojo')) return 'rojo';
  if (rows.some((r) => r.semaforo === 'ambar')) return 'ambar';
  return 'verde';
}

export const SEMAFORO_CLASSES: Record<Semaforo, string> = {
  verde: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  ambar: 'text-amber-700 bg-amber-50 border-amber-200',
  rojo: 'text-red-700 bg-red-50 border-red-200',
};

export const SEMAFORO_DOT: Record<Semaforo, string> = {
  verde: 'bg-emerald-500',
  ambar: 'bg-amber-500',
  rojo: 'bg-red-500',
};

/** Umbral orientativo: ≥0.4 g/kg de proteína en cada comida principal (§3). */
export const MIN_PROT_GKG_COMIDA_PRINCIPAL = 0.4;
