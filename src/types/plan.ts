import type { ExchangeGroupId } from '../data/exchangeGroups';
import type { MealSlot } from './food';

export type Phase = 1 | 2;

export interface Meal {
  id: string;
  nombre: string;      // "Desayuno", "Post-entreno"…
  slot: MealSlot;      // para filtrar el catálogo de opciones
  orden: number;
}

/** Reparto de intercambios: mealId → grupo → cantidad (múltiplos de 0.5). */
export type ExchangeGrid = Record<string, Partial<Record<ExchangeGroupId, number>>>;

export interface DayType {
  id: string;
  nombre: string;                 // "Día descanso", "Día entreno CrossFit"
  /** Si se define, sobreescribe las calorías objetivo del cliente. */
  caloriasOverride?: number;
  /** Objetivos introducidos por la nutricionista en g/kg. */
  proteinaGkg: number;
  hcGkg: number;
  meals: Meal[];
  grid: ExchangeGrid;
  /** Notas libres por comida (se imprimen en Fase 2). */
  notas: Record<string, string>;
  /** Postre de la cena (campo libre §6.2). */
  postre?: string;
  /** Alimentos excluidos para este cliente (ids del catálogo). */
  alimentosExcluidos?: string[];
  /** Fase 1: receta elegida por comida. */
  recetasAsignadas?: Record<string, string>;
}

export interface Plan {
  id: string;
  clientId: string;
  nombre: string;
  fase: Phase;
  dayTypes: DayType[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_MEALS: Meal[] = [
  { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
  { id: 'almuerzo', nombre: 'Almuerzo', slot: 'almuerzo', orden: 2 },
  { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 3 },
  { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 4 },
  { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 5 },
];
