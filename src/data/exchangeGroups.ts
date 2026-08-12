/**
 * TABLA DE INTERCAMBIOS — FUENTE DE VERDAD DE TODA LA APP
 *
 * Todo gramo y toda caloría mostrada al cliente debe ser trazable a esta tabla.
 * Editar aquí (y solo aquí) si cambian los valores de referencia.
 */

export const EXCHANGE_GROUP_IDS = [
  'verduras',
  'fruta',
  'almidones',
  'legumbres',
  'azucares',
  'lacteos_desnatados',
  'lacteos_semi',
  'lacteos_enteros',
  'lacteos_proteicos',
  'proteicos_magros',
  'proteicos_semigrasos',
  'proteicos_grasos',
  'grasas',
  'frutos_secos',
] as const;

export type ExchangeGroupId = (typeof EXCHANGE_GROUP_IDS)[number];

/** Macro "sombrilla" con el que se agrega el grupo en el esquema de Fase 2. */
export type MacroBucket = 'proteina' | 'carbohidrato' | 'grasa';

/** Macro que define el tamaño de la porción de un subgrupo. */
export type MacroKey = 'hc' | 'proteina' | 'grasa';

/**
 * Familias de intercambio.
 *
 * Dentro de una familia los subgrupos SÍ se pueden sustituir entre sí (un
 * proteico graso por uno magro), porque son el mismo alimento con distinta
 * grasa, siempre que no se pase de las kcal pautadas. Entre familias NO: una
 * fruta no es un almidón por mucho que las calorías cuadren.
 *
 * Los lácteos van en la familia de los proteicos: en la práctica un yogur
 * proteico cubre una porción de proteína igual que una lata de atún. Lo que
 * sí cambia es el carbohidrato — un lácteo trae hasta 12 g — y de eso avisa
 * la validación de la comida, no la familia.
 */
export type Familia =
  | 'verduras'
  | 'fruta'
  | 'almidones'
  | 'legumbres'
  | 'azucares'
  | 'proteicos'
  | 'grasas';

export interface ExchangeGroup {
  id: ExchangeGroupId;
  nombre: string;
  /** Gramos de hidratos de carbono que aporta 1 intercambio. */
  hc: number;
  /** Gramos de proteína que aporta 1 intercambio. */
  proteina: number;
  /** Gramos de grasa que aporta 1 intercambio. */
  grasa: number;
  /** A qué columna del "Esquema del plan" (Fase 2) se agrega este grupo. */
  bucket: MacroBucket;
  /**
   * Macro de referencia para convertir "nutrientes por 100 g" en gramos por
   * intercambio. Para los almidones es el HC (14 g), para los proteicos la
   * proteína (7 g) y para las grasas la grasa (5 g).
   */
  ancla: MacroKey;
  /** Subgrupos de la misma familia se pueden intercambiar entre sí. */
  familia: Familia;
  /**
   * Dentro de la familia, cuánta grasa aporta: 0 es el más magro.
   * Se puede bajar de nivel (más magro) pero no subir sin pasarse de kcal.
   */
  nivel: number;
  /** Las verduras son ilimitadas por regla de negocio (§10.1). */
  ilimitado?: boolean;
  /** Color de acento para la grilla. */
  color: string;
  orden: number;
}

export const EXCHANGE_GROUPS: Record<ExchangeGroupId, ExchangeGroup> = {
  verduras: {
    id: 'verduras',
    nombre: 'Verduras y hortalizas',
    hc: 4,
    proteina: 2,
    grasa: 0.5,
    bucket: 'carbohidrato',
    ancla: 'hc',
    familia: 'verduras',
    nivel: 0,
    ilimitado: true,
    color: '#4B7F52',
    orden: 1,
  },
  fruta: {
    id: 'fruta',
    nombre: 'Fruta',
    hc: 15,
    proteina: 1,
    grasa: 0.25,
    bucket: 'carbohidrato',
    ancla: 'hc',
    familia: 'fruta',
    nivel: 0,
    color: '#C97B3E',
    orden: 2,
  },
  almidones: {
    id: 'almidones',
    nombre: 'Almidones',
    hc: 14,
    proteina: 2,
    grasa: 0.5,
    bucket: 'carbohidrato',
    ancla: 'hc',
    familia: 'almidones',
    nivel: 0,
    color: '#B08A3E',
    orden: 3,
  },
  legumbres: {
    id: 'legumbres',
    nombre: 'Legumbres',
    hc: 14,
    proteina: 7,
    grasa: 0.5,
    bucket: 'carbohidrato',
    ancla: 'hc',
    familia: 'legumbres',
    nivel: 0,
    color: '#8A6B3E',
    orden: 4,
  },
  azucares: {
    id: 'azucares',
    nombre: 'Azúcares',
    hc: 10,
    proteina: 0,
    grasa: 0,
    bucket: 'carbohidrato',
    ancla: 'hc',
    familia: 'azucares',
    nivel: 0,
    color: '#C4577A',
    orden: 5,
  },
  lacteos_desnatados: {
    id: 'lacteos_desnatados',
    nombre: 'Lácteos desnatados',
    hc: 12,
    proteina: 8,
    grasa: 0,
    bucket: 'proteina',
    ancla: 'hc',
    familia: 'proteicos',
    nivel: 0,
    color: '#8FA9C6',
    orden: 6,
  },
  lacteos_proteicos: {
    id: 'lacteos_proteicos',
    /**
     * UNA PORCIÓN AQUÍ ES UNA PORCIÓN DE PROTEÍNA
     *
     * Iba a 10 g de proteína, como el yogur del sistema clásico. Eso hacía que
     * un lácteo proteico y un proteico magro no fueran intercambiables: cambiar
     * uno por otro perdía 3 g de proteína y 23 kcal, y al escalar recetas el
     * desajuste daba problemas de verdad (con los 10 g y 0 de grasa, el tope de
     * grasa borraba la whey de una receta que cubriera el lácteo).
     *
     * Con 7 g el cambio es casi 1:1 —39 kcal contra 32,5— y el yogur deja de
     * ser un caso aparte dentro de la familia. El hidrato baja en proporción
     * (4 → 2,8) y se redondea a 3, que cae dentro de lo que traen los yogures
     * proteicos reales del catálogo (entre 2,2 y 3,9 por intercambio).
     *
     * Consecuencia diaria: un envase entero ya no es un intercambio, son ~1,4.
     * Por eso los cuatro yogures del catálogo llevan `intercambios: 1.4`, para
     * que la medida casera siga siendo el bote y no dos tercios de bote.
     */
    nombre: 'Lácteos proteicos',
    hc: 3,
    proteina: 7,
    grasa: 0,
    bucket: 'proteina',
    ancla: 'proteina',
    familia: 'proteicos',
    nivel: 0,
    color: '#7FA0C0',
    orden: 7,
  },
  lacteos_semi: {
    id: 'lacteos_semi',
    nombre: 'Lácteos semidesnatados',
    hc: 12,
    proteina: 8,
    grasa: 4,
    bucket: 'proteina',
    ancla: 'hc',
    familia: 'proteicos',
    nivel: 1,
    color: '#6E8CB0',
    orden: 8,
  },
  lacteos_enteros: {
    id: 'lacteos_enteros',
    nombre: 'Lácteos enteros',
    hc: 12,
    proteina: 8,
    grasa: 8,
    bucket: 'proteina',
    ancla: 'hc',
    familia: 'proteicos',
    nivel: 2,
    color: '#5C7A9E',
    orden: 9,
  },
  proteicos_magros: {
    id: 'proteicos_magros',
    nombre: 'Proteicos magros',
    hc: 0,
    proteina: 7,
    grasa: 0.5,
    bucket: 'proteina',
    ancla: 'proteina',
    familia: 'proteicos',
    nivel: 0,
    color: '#2E6B5E',
    orden: 10,
  },
  proteicos_semigrasos: {
    id: 'proteicos_semigrasos',
    nombre: 'Proteicos semigrasos',
    hc: 0,
    proteina: 7,
    grasa: 2,
    bucket: 'proteina',
    ancla: 'proteina',
    familia: 'proteicos',
    nivel: 1,
    color: '#3E7F70',
    orden: 11,
  },
  proteicos_grasos: {
    id: 'proteicos_grasos',
    nombre: 'Proteicos grasos',
    hc: 0,
    proteina: 7,
    grasa: 5,
    bucket: 'proteina',
    ancla: 'proteina',
    familia: 'proteicos',
    nivel: 2,
    color: '#5A9182',
    orden: 12,
  },
  grasas: {
    id: 'grasas',
    nombre: 'Grasas',
    hc: 0,
    proteina: 0,
    grasa: 5,
    bucket: 'grasa',
    ancla: 'grasa',
    familia: 'grasas',
    nivel: 0,
    color: '#D4A04F',
    orden: 13,
  },
  frutos_secos: {
    id: 'frutos_secos',
    /**
     * Grasa que además arrastra proteína e hidrato. Se llamaba «Frutos secos y
     * semillas», pero ahí caben también las cremas de frutos secos y los quesos
     * untables ligeros: un queso crema light anclado a 5 g de grasa aporta casi
     * lo mismo que un puñado de nueces, y ver «queso crema» bajo el epígrafe de
     * los frutos secos confundía.
     */
    nombre: 'Grasas proteicas',
    hc: 1.5,
    proteina: 2,
    grasa: 5,
    // Misma familia que las grasas, pero con más calorías por porción:
    // el tope calórico impide cambiar aceite por nueces sin margen.
    bucket: 'grasa',
    ancla: 'grasa',
    familia: 'grasas',
    nivel: 1,
    color: '#B98A4A',
    orden: 14,
  },
};

/** Lista ordenada — usar para renderizar filas de la grilla. */
export const EXCHANGE_GROUP_LIST: ExchangeGroup[] = EXCHANGE_GROUP_IDS.map(
  (id) => EXCHANGE_GROUPS[id],
).sort((a, b) => a.orden - b.orden);

/** Factores calóricos de Atwater. kcal = HC×4 + PROT×4 + GRASA×9 */
export const KCAL_PER_GRAM = {
  hc: 4,
  proteina: 4,
  grasa: 9,
} as const;

/** Subgrupos de una familia, del más magro al más graso. */
export function subgruposDeFamilia(familia: Familia): ExchangeGroup[] {
  return EXCHANGE_GROUP_LIST.filter((g) => g.familia === familia).sort((a, b) => a.nivel - b.nivel);
}

/** Mínimo recomendado de verdura en comida y cena (regla §10.1). */
export const MIN_VERDURA_G = 200;
