import type { ExchangeGroupId } from '../data/exchangeGroups';

export type MealSlot =
  | 'desayuno'
  | 'almuerzo'
  | 'comida'
  | 'merienda'
  | 'cena'
  | 'extra';

export type Alergeno = 'gluten' | 'lactosa' | 'frutos_secos' | 'huevo' | 'soja' | 'pescado';
export type Apto = 'vegetariano' | 'vegano' | 'sin_gluten' | 'sin_lactosa';

export interface Alimento {
  id: string;
  nombre: string;
  grupo: ExchangeGroupId;
  /** "1/4 taza", "2 lonchas", "1 cdta"… */
  medida_casera: string;
  /** Gramos (o ml) que corresponden a esa medida casera. */
  gramos: number;
  unidad?: 'g' | 'ml';
  /** Gramos en cocido, si el gramaje base es en crudo. */
  equivalencia_cocido?: number;
  /** Cuántos intercambios de su grupo aporta esa medida. */
  intercambios: number;
  comidas_sugeridas: MealSlot[];
  alergenos: Alergeno[];
  apto: Apto[];
  /** Alimentos añadidos por la nutricionista desde la interfaz. */
  custom?: boolean;
  /** Aporta grasa + proteína a la vez (bloque "Grasa Prot" de merienda). */
  grasa_prot?: boolean;
}

/** Texto que se imprime en la lista "escoge X" de Fase 2. */
export function formatFoodOption(a: Alimento): string {
  const u = a.unidad ?? 'g';
  if (a.equivalencia_cocido) {
    return `${a.medida_casera} (${a.gramos} ${u} crudo / ${a.equivalencia_cocido} ${u} cocido)`;
  }
  return `${a.medida_casera} (${a.gramos} ${u})`;
}
