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
  cadera?: number;
  muslo_medio?: number;
  pierna_maximo?: number;
}

export interface Diametros {
  humero?: number;
  biestiloideo?: number;
  femur?: number;
  tobillo?: number;
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
