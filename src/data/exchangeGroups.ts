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
  'proteicos_magros',
  'proteicos_semigrasos',
  'proteicos_grasos',
  'grasas',
] as const;

export type ExchangeGroupId = (typeof EXCHANGE_GROUP_IDS)[number];

/** Macro "sombrilla" con el que se agrega el grupo en el esquema de Fase 2. */
export type MacroBucket = 'proteina' | 'carbohidrato' | 'grasa';

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
    color: '#C4577A',
    orden: 5,
  },
  proteicos_magros: {
    id: 'proteicos_magros',
    nombre: 'Proteicos magros',
    hc: 0,
    proteina: 7,
    grasa: 0.5,
    bucket: 'proteina',
    color: '#2E6B5E',
    orden: 6,
  },
  proteicos_semigrasos: {
    id: 'proteicos_semigrasos',
    nombre: 'Proteicos semigrasos',
    hc: 0,
    proteina: 7,
    grasa: 2,
    bucket: 'proteina',
    color: '#3E7F70',
    orden: 7,
  },
  proteicos_grasos: {
    id: 'proteicos_grasos',
    nombre: 'Proteicos grasos',
    hc: 0,
    proteina: 7,
    grasa: 5,
    bucket: 'proteina',
    color: '#5A9182',
    orden: 8,
  },
  grasas: {
    id: 'grasas',
    nombre: 'Grasas',
    hc: 0,
    proteina: 0,
    grasa: 5,
    bucket: 'grasa',
    color: '#D4A04F',
    orden: 9,
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

/** Mínimo recomendado de verdura en comida y cena (regla §10.1). */
export const MIN_VERDURA_G = 200;
