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
  /**
   * SE COCINA EN TANDA
   *
   * Lo que se pone al fuego una vez y se guarda: arroz, pasta, patata,
   * legumbre, pollo, verduras al horno. El huevo revuelto y el queso feta no,
   * aunque sean del mismo subgrupo: no hay nada que adelantar.
   *
   * Sin decir nada se decide sola (`seCocinaEnTanda`), pero se puede fijar aquí
   * porque lo que se cocina o no depende de cada cocina y de cada producto.
   */
  batch?: boolean;
  /** Cuántos intercambios de su grupo aporta esa medida. */
  intercambios: number;
  /**
   * ALIMENTOS QUE GASTAN DOS COSAS A LA VEZ
   *
   * Lo que consume UNA medida casera, repartido por grupos. Es para los
   * productos que no caben en un solo grupo: una medida de mezcla de tortitas
   * proteicas son 2 almidones Y 2 proteicos magros, los dos enteros. Meterla a
   * la fuerza en un grupo mentiría siempre en el otro.
   *
   * Cuando está, manda sobre `grupo` para las cuentas: al marcar la porción se
   * descuenta de todos los grupos que lista. `grupo` se sigue usando para
   * ordenar y para saber bajo qué epígrafe enseñarlo.
   *
   * Regla para decidir si un alimento lo necesita: pasa cada macro de una
   * medida real a porciones; si el segundo no llega a media porción, se ignora
   * como se ignoran los 2 g de proteína de cualquier almidón.
   */
  equivale?: Partial<Record<ExchangeGroupId, number>>;
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
