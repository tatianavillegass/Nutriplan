/** Factores de actividad física (§1). */

export interface ActivityFactor {
  id: string;
  label: string;
  factor: number;
  /** Agrupador para el selector. */
  grupo: 'base' | 'sedentario_entreno' | 'ligero_entreno';
}

export const ACTIVITY_FACTORS: ActivityFactor[] = [
  { id: 'sedentario', label: 'Sedentario', factor: 1.2, grupo: 'base' },
  { id: 'ligero', label: 'Ligero', factor: 1.38, grupo: 'base' },
  { id: 'moderado', label: 'Moderado', factor: 1.55, grupo: 'base' },
  { id: 'muy_activo', label: 'Muy activo', factor: 1.73, grupo: 'base' },
  { id: 'hiperactivo', label: 'Hiperactivo', factor: 1.9, grupo: 'base' },

  { id: 'sed_3', label: 'Sedentario + 3 días entreno', factor: 1.3, grupo: 'sedentario_entreno' },
  { id: 'sed_4', label: 'Sedentario + 4 días entreno', factor: 1.4, grupo: 'sedentario_entreno' },
  { id: 'sed_5', label: 'Sedentario + 5 días entreno', factor: 1.5, grupo: 'sedentario_entreno' },
  { id: 'sed_6', label: 'Sedentario + 6 días entreno', factor: 1.6, grupo: 'sedentario_entreno' },

  { id: 'lig_3', label: 'Ligeramente activo + 3 días entreno', factor: 1.5, grupo: 'ligero_entreno' },
  { id: 'lig_4', label: 'Ligeramente activo + 4 días entreno', factor: 1.6, grupo: 'ligero_entreno' },
  { id: 'lig_5', label: 'Ligeramente activo + 5 días entreno', factor: 1.7, grupo: 'ligero_entreno' },
];

export const ACTIVITY_GROUP_LABELS: Record<ActivityFactor['grupo'], string> = {
  base: 'Estilo de vida',
  sedentario_entreno: 'Sedentario + entrenamiento',
  ligero_entreno: 'Ligeramente activo + entrenamiento',
};

export function getActivityFactor(id: string): number {
  return ACTIVITY_FACTORS.find((a) => a.id === id)?.factor ?? 1.2;
}

/** Termogénesis inducida por la dieta: +10% sobre TMB × factor de actividad. */
export const THERMOGENESIS_FACTOR = 1.1;

export interface GoalPreset {
  id: string;
  label: string;
  multiplier: number;
  tipo: 'deficit' | 'mantenimiento' | 'superavit';
}

export const GOAL_PRESETS: GoalPreset[] = [
  { id: 'def_15', label: 'Déficit 15%', multiplier: 0.85, tipo: 'deficit' },
  { id: 'def_25', label: 'Déficit 25%', multiplier: 0.75, tipo: 'deficit' },
  { id: 'def_30', label: 'Déficit 30%', multiplier: 0.7, tipo: 'deficit' },
  { id: 'mant', label: 'Mantenimiento', multiplier: 1.0, tipo: 'mantenimiento' },
  { id: 'sup_10', label: 'Superávit 10%', multiplier: 1.1, tipo: 'superavit' },
  { id: 'sup_15', label: 'Superávit 15%', multiplier: 1.15, tipo: 'superavit' },
  { id: 'sup_20', label: 'Superávit 20%', multiplier: 1.2, tipo: 'superavit' },
];
