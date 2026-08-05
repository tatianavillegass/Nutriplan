export type Sexo = 'hombre' | 'mujer';

export type BmrFormulaId =
  | 'harris_benedict'
  | 'harris_benedict_original'
  | 'owen'
  | 'mifflin'
  | 'media'
  | 'media_con_hb_original';

export interface BmrInput {
  sexo: Sexo;
  peso: number;   // kg
  altura: number; // cm
  edad: number;   // años
}

export interface BmrResults {
  harris_benedict: number;
  owen: number;
  mifflin: number;
  media: number;
  /** Variante original de 1919, expuesta solo como referencia/auditoría. */
  harris_benedict_original: number;
  media_con_hb_original: number;
}

export type GetRounding = 'truncate' | 'round' | 'none';

export interface EnergyInput {
  tmb: number;
  activityFactor: number;
  thermogenesis?: number;
  goalMultiplier: number;
  /** Cómo tratar el GET antes de aplicar el objetivo. 'truncate' = hoja original. */
  getRounding?: GetRounding;
}

export interface EnergyResults {
  tmb: number;
  subtotal: number;      // TMB × factor actividad
  get: number;           // subtotal × termogénesis (sin redondear)
  getMostrado: number;   // GET tras aplicar getRounding — es el que se muestra
  caloriasObjetivo: number;
}

export interface MacroGrams {
  proteina: number;
  hc: number;
  grasa: number;
}

export interface MacroBreakdown extends MacroGrams {
  kcal: number;
  gkg: MacroGrams;
  pct: MacroGrams; // % de kcal
}
