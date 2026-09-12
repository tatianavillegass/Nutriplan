import type { Sexo } from './calculations';

/**
 * PERFIL ANTROPOMÉTRICO ISAK
 *
 * Estructura calcada de la hoja de cálculo de la nutricionista:
 * 8 pliegues, 6 perímetros, 4 diámetros y las medidas básicas.
 * Todos los campos son opcionales: lo que no se mide, no se calcula.
 */

export interface Pliegues {
  triceps?: number;
  subscapular?: number;
  biceps?: number;
  cresta_iliaca?: number;
  supraespinal?: number;
  abdominal?: number;
  muslo?: number;
  medial_pierna?: number;
}

export interface Perimetros {
  brazo_relajado?: number;
  brazo_contraido?: number;
  cintura?: number;
  /**
   * Abdominal por el punto MÁXIMO, a la altura del ombligo. No es lo mismo que
   * la cintura —que va por el mínimo— y en su planilla de siempre van los dos:
   * en una barriga que baja, el mínimo se mueve antes que el máximo.
   */
  abdominal?: number;
  cadera?: number;
  muslo_medio?: number;
  pierna_maximo?: number;
}

/**
 * LAS TRES FOTOS DE UNA FECHA
 *
 * Con la misma luz, la misma ropa y el mismo sitio, que si no la comparación no
 * vale. Todas opcionales: pedir tres fotos cada mes es la forma más rápida de
 * que se dejen de hacer.
 */
export interface FotosDeProgreso {
  frente?: string;
  perfil?: string;
  espalda?: string;
}

export interface Diametros {
  humero?: number;
  biestiloideo?: number;
  femur?: number;
  tobillo?: number;
}

/**
 * LO QUE DA LA BÁSCULA DE BIOIMPEDANCIA
 *
 * Se copia tal cual, sin recalcular nada: su número sale de una fórmula suya
 * que no conocemos, así que mezclarlo con el de los pliegues sería inventar.
 * Se enseñan por separado y cada uno se compara consigo mismo.
 */
export interface Bioimpedancia {
  /** % de grasa que marca el aparato. */
  grasaPct?: number;
  /** % de masa muscular. */
  musculoPct?: number;
  /** % de agua corporal. */
  aguaPct?: number;
  /** Índice de grasa visceral (sin unidad: la escala del aparato). */
  visceral?: number;
}

export interface Medicion {
  id: string;
  clientId: string;
  fecha: string; // ISO
  peso?: number; // kg
  talla?: number; // cm
  talla_sentado?: number; // cm
  envergadura?: number; // cm
  pliegues: Pliegues; // mm
  perimetros: Perimetros; // cm
  diametros: Diametros; // cm
  /** Lo que dio la báscula ese día, si se usó. */
  bioimpedancia?: Bioimpedancia;
  /**
   * La foto del primer día, si ella quiso subirla. Vive aquí porque una foto
   * de progreso es de una fecha concreta, igual que un pliegue: guardarla en la
   * ficha dejaría sólo la última y la gracia es comparar.
   */
  foto?: string;
  /**
   * Las tres fotos de esa fecha. `foto` es la de antes —una sola, la que venía
   * de la cuenta atrás de un reto— y se sigue leyendo para no perderla.
   */
  fotos?: FotosDeProgreso;
  notas?: string;
}

export type PliegueId = keyof Pliegues;
export type PerimetroId = keyof Perimetros;
export type DiametroId = keyof Diametros;

export const PLIEGUE_LABELS: Record<PliegueId, string> = {
  triceps: 'Tríceps',
  subscapular: 'Subescapular',
  biceps: 'Bíceps',
  cresta_iliaca: 'Cresta ilíaca',
  supraespinal: 'Supraespinal',
  abdominal: 'Abdominal',
  muslo: 'Muslo frontal',
  medial_pierna: 'Pierna medial',
};

export const PERIMETRO_LABELS: Record<PerimetroId, string> = {
  brazo_relajado: 'Brazo relajado',
  brazo_contraido: 'Brazo contraído',
  cintura: 'Cintura (mínimo)',
  abdominal: 'Abdominal (máximo)',
  cadera: 'Cadera (máximo)',
  muslo_medio: 'Muslo medio',
  pierna_maximo: 'Pierna (máximo)',
};

export const DIAMETRO_LABELS: Record<DiametroId, string> = {
  humero: 'Húmero (biepicondíleo)',
  biestiloideo: 'Muñeca (biestiloideo)',
  femur: 'Fémur (biepicondíleo)',
  tobillo: 'Tobillo (bimaleolar)',
};

/** Pliegues que entran en cada sumatorio. */
export const SUMA_6: PliegueId[] = [
  'triceps',
  'subscapular',
  'supraespinal',
  'abdominal',
  'muslo',
  'medial_pierna',
];

export const SUMA_8: PliegueId[] = [...SUMA_6, 'biceps', 'cresta_iliaca'];

/** Faulkner usa 4: tríceps, subescapular, supraespinal y abdominal. */
export const SUMA_4_FAULKNER: PliegueId[] = ['triceps', 'subscapular', 'supraespinal', 'abdominal'];

/** Durnin-Womersley: tríceps, bíceps, subescapular y cresta ilíaca. */
export const SUMA_4_DW: PliegueId[] = ['triceps', 'biceps', 'subscapular', 'cresta_iliaca'];

export type FormulaGrasaId = 'faulkner' | 'yuhasz' | 'durnin_womersley';

export const FORMULA_GRASA_LABELS: Record<FormulaGrasaId, string> = {
  faulkner: 'Faulkner (4 pliegues)',
  yuhasz: 'Yuhasz (6 pliegues)',
  durnin_womersley: 'Durnin-Womersley (4 pliegues)',
};

export interface Somatotipo {
  endomorfia: number;
  mesomorfia: number;
  ectomorfia: number;
  /** Coordenadas para la somatocarta. */
  x: number;
  y: number;
  categoria: string;
}

export interface Composicion {
  imc?: number;
  categoriaImc?: string;
  ratioCinturaCadera?: number;
  riesgoIcc?: string;
  suma6?: number;
  suma8?: number;
  /** Perímetro − π × (pliegue/10). */
  perimetroCorregidoBrazo?: number;
  perimetroCorregidoMuslo?: number;
  perimetroCorregidoPierna?: number;
  /** % de grasa por cada fórmula disponible. */
  grasaPct: Partial<Record<FormulaGrasaId, number>>;
  grasaKg: Partial<Record<FormulaGrasaId, number>>;
  masaMagraKg: Partial<Record<FormulaGrasaId, number>>;
  /** Masa muscular esquelética (Lee, 2000) en kg. */
  masaMuscularKg?: number;
  masaMuscularPct?: number;
  /** Masa ósea (Rocha) en kg. */
  masaOseaKg?: number;
  somatotipo?: Somatotipo;
  /** Medidas que faltan para completar cada cálculo. */
  faltan: string[];
}

export interface DeltaMedicion {
  key: string;
  label: string;
  actual?: number;
  previo?: number;
  inicial?: number;
  deltaPrevio?: number;
  deltaInicial?: number;
  decimales: number;
  unidad: string;
  /** true si bajar es el objetivo (grasa, cintura). */
  bajarEsMejor?: boolean;
}

export function medicionVacia(clientId: string, id: string, fecha: string): Medicion {
  return { id, clientId, fecha, pliegues: {}, perimetros: {}, diametros: {} };
}

export type { Sexo };
