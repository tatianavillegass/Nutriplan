import type { Sexo, BmrFormulaId } from './calculations';
import type { Alergeno } from './food';

export type Objetivo = 'perder_peso' | 'mantenimiento' | 'ganancia_muscular';

export interface Client {
  id: string;
  nombre: string;
  email?: string;
  edad: number;
  peso: number;   // kg
  altura: number; // cm
  sexo: Sexo;
  activityFactorId: string;
  objetivo: Objetivo;
  /** Multiplicador de ajuste elegido por la nutricionista (0.70 – 1.20 o libre). */
  goalMultiplier: number;
  /** Fórmula de TMB elegida; 'media' por defecto. */
  bmrFormula: BmrFormulaId;
  alergias: Alergeno[];
  preferencias: string[];   // tags que alimentan el matcher de recetas
  notas?: string;
  createdAt: string;
  updatedAt: string;
}

export const OBJETIVO_LABELS: Record<Objetivo, string> = {
  perder_peso: 'Perder peso',
  mantenimiento: 'Mantenimiento',
  ganancia_muscular: 'Ganancia de masa muscular',
};
