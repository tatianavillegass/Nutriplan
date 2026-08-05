import type { ExchangeGroupId } from '../data/exchangeGroups';
import type { MealSlot } from './food';

/** Los condimentos no pertenecen a ningún grupo de intercambio. */
export type IngredientGroup = ExchangeGroupId | 'condimento';

export interface Ingrediente {
  id: string;
  nombre: string;
  /** null = "al gusto" (verduras, condimentos). */
  cantidad_base: number | null;
  unidad: string;               // "g", "g crudo", "ml", "al gusto"
  grupo: IngredientGroup;
  /** Si escala con los intercambios de su grupo. */
  escalable: boolean;
  /** Si el cliente puede quitarlo sin romper el plan. */
  opcional: boolean;
  sustitutos?: string[];
}

/** Composición base en intercambios; "ilimitado" para verduras. */
export type RecipeBase = Partial<Record<ExchangeGroupId, number | 'ilimitado'>>;

export interface Receta {
  id: string;
  nombre: string;
  foto_url?: string;
  categorias: MealSlot[];
  tags: string[];
  base: RecipeBase;
  ingredientes: Ingrediente[];
  preparacion: string;
  notas: string;
  createdAt: string;
  updatedAt: string;
}

/** Resultado del escalado por grupo. */
export interface IngredienteEscalado extends Ingrediente {
  cantidad_final: number | null;
  /** Texto listo para imprimir: "150 g", "al gusto (mín. 200 g)". */
  display: string;
  factor: number;
}

export interface RecetaEscalada {
  receta: Receta;
  ingredientes: IngredienteEscalado[];
  factores: Partial<Record<ExchangeGroupId, number>>;
  /** Grupos requeridos que la receta no cubre. */
  gruposSinCubrir: ExchangeGroupId[];
}
