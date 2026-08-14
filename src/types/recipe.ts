import type { ExchangeGroupId } from '../data/exchangeGroups';
import type { MealSlot, Alergeno } from './food';

/** Los condimentos no pertenecen a ningún grupo de intercambio. */
export type IngredientGroup = ExchangeGroupId | 'condimento';

export interface Ingrediente {
  id: string;
  nombre: string;
  /**
   * Id del alimento en la base de datos. Cuando está presente, el grupo y los
   * intercambios que aporta el ingrediente se calculan solos: la receta no
   * guarda macros propios, siempre los deriva del catálogo.
   */
  foodId?: string;
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

/** Minutos de preparación, en tramos: es lo que mira el cliente al elegir. */
export const TIEMPOS = ['<5 min', '5-15 min', '15-30 min', '30-60 min', '+1 h'] as const;
export type TiempoReceta = (typeof TIEMPOS)[number];

export const DIFICULTADES = ['Muy fácil', 'Fácil', 'Media', 'Elaborada'] as const;
export type Dificultad = (typeof DIFICULTADES)[number];

export interface Receta {
  id: string;
  nombre: string;
  /** Foto en data URL (subida por la nutricionista) o enlace externo. */
  foto_url?: string;
  tiempo?: TiempoReceta;
  dificultad?: Dificultad;
  /** Si aguanta preparada de un día para otro. */
  tupper?: boolean;
  categorias: MealSlot[];
  tags: string[];
  /** Alérgenos declarados a mano, para recetas sin ingredientes enlazados. */
  alergenos?: Alergeno[];
  /**
   * Composición base en intercambios. Si los ingredientes están enlazados al
   * catálogo, se recalcula sola con `composicionDesdeIngredientes`.
   */
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
  /** Texto listo para imprimir: "150 g", "al gusto". */
  display: string;
  factor: number;
  /** Gramos fijados a mano por la nutricionista, no calculados. */
  ajustado?: boolean;
  /** Si no es un ingrediente de la receta sino algo puesto al lado. */
  acompanamiento?: string;
}

export interface RecetaEscalada {
  receta: Receta;
  ingredientes: IngredienteEscalado[];
  factores: Partial<Record<ExchangeGroupId, number>>;
  /**
   * Intercambios que la receta cubre de verdad, ya escalada. Es la base de la
   * receta multiplicada por su factor, así que es con lo que se compara lo
   * pautado para saber si la comida está completa o le falta algo.
   */
  cubiertos: Partial<Record<ExchangeGroupId, number>>;
  /** Grupos requeridos que la receta no cubre con ninguna de su familia. */
  gruposSinCubrir: ExchangeGroupId[];
  /**
   * Qué se ha tenido que ajustar y por qué: que las nueces cubran la grasa
   * pautada, o que haya habido que recortar para no pasarse. Es información
   * para la nutricionista, no para quien come.
   */
  notas: string[];
}
