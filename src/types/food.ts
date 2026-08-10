import type { ExchangeGroupId, MacroBucket } from '../data/exchangeGroups';

export type MealSlot =
  | 'desayuno'
  | 'almuerzo'
  | 'comida'
  | 'merienda'
  | 'cena'
  | 'extra';

export type Alergeno =
  | 'gluten'
  | 'lactosa'
  | 'frutos_secos'
  | 'huevo'
  | 'soja'
  | 'pescado'
  | 'marisco'
  | 'fodmap';

export type Apto = 'vegetariano' | 'vegano' | 'sin_gluten' | 'sin_lactosa';

/** Datos de la etiqueta o de la tabla de composición, por 100 g de alimento. */
export interface Nutrientes100 {
  kcal?: number;
  hc: number;
  proteina: number;
  grasa: number;
  fibra?: number;
  azucar?: number;
}

export interface Alimento {
  id: string;
  nombre: string;
  /** Grupo macro: proteína, carbohidrato o grasa. Se deriva del subgrupo. */
  bucket?: MacroBucket;
  /**
   * Subgrupo de intercambio: almidones, fruta, lácteos, proteicos magros…
   * Sin subgrupo el alimento es "libre": no se pauta por porciones y sólo
   * aparece para registrarlo como extra (bebidas, refrescos, alcohol).
   */
  grupo?: ExchangeGroupId;
  /** "1/4 taza", "2 lonchas", "1 cdta"… */
  medida_casera: string;
  /** Gramos (o ml) que corresponden a esa medida casera. */
  gramos: number;
  unidad?: 'g' | 'ml';
  /** Gramos en cocido, si el gramaje base es en crudo. */
  equivalencia_cocido?: number;
  /** Cuántos intercambios de su grupo aporta esa medida. */
  intercambios: number;
  /** Composición por 100 g. Si está, la porción se calcula sola. */
  nutrientes?: Nutrientes100;
  comidas_sugeridas: MealSlot[];
  alergenos: Alergeno[];
  apto: Apto[];
  /** Alimentos añadidos por la nutricionista desde la interfaz. */
  custom?: boolean;
  /** Aporta grasa + proteína a la vez (bloque "Grasa Prot" de merienda). */
  grasa_prot?: boolean;
  notas?: string;
}

/** Texto que se imprime en la lista "escoge X" de Fase 2. */
export function formatFoodOption(a: Alimento): string {
  const u = a.unidad ?? 'g';
  const cantidad = a.equivalencia_cocido
    ? `${a.medida_casera} (${a.gramos} ${u} crudo / ${a.equivalencia_cocido} ${u} cocido)`
    : `${a.medida_casera} (${a.gramos} ${u})`;
  return `${a.nombre} — ${cantidad}`;
}

export const ALERGENO_LABELS: Record<Alergeno, string> = {
  gluten: 'Gluten',
  lactosa: 'Lactosa',
  frutos_secos: 'Frutos secos',
  huevo: 'Huevo',
  soja: 'Soja',
  pescado: 'Pescado',
  marisco: 'Marisco',
  fodmap: 'Alto en FODMAP',
};
