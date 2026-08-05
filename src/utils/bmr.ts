import type { BmrInput, BmrResults, BmrFormulaId } from '../types/calculations';

/**
 * Harris-Benedict REVISADA (Roza & Shizgal, 1984) — la especificada en el brief.
 *   Hombre: 88.362 + 13.397·peso + 4.799·altura − 5.677·edad
 *   Mujer:  447.593 + 9.247·peso + 3.098·altura − 4.330·edad
 */
export function harrisBenedict({ sexo, peso, altura, edad }: BmrInput): number {
  return sexo === 'hombre'
    ? 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * edad
    : 447.593 + 9.247 * peso + 3.098 * altura - 4.33 * edad;
}

/**
 * Harris-Benedict ORIGINAL (1919). No se usa por defecto: se expone porque
 * el caso de referencia de la nutricionista (TMB media 1686) fue calculado
 * con esta variante, no con la revisada.
 *   Hombre: 66.473 + 13.7516·peso + 5.0033·altura − 6.755·edad
 *   Mujer:  655.0955 + 9.5634·peso + 1.8496·altura − 4.6756·edad
 */
export function harrisBenedictOriginal({ sexo, peso, altura, edad }: BmrInput): number {
  return sexo === 'hombre'
    ? 66.473 + 13.7516 * peso + 5.0033 * altura - 6.755 * edad
    : 655.0955 + 9.5634 * peso + 1.8496 * altura - 4.6756 * edad;
}

/** Owen — solo depende del peso. */
export function owen({ sexo, peso }: BmrInput): number {
  return sexo === 'hombre' ? 879 + 10.2 * peso : 795 + 7.18 * peso;
}

/** Mifflin-St. Jeor. */
export function mifflinStJeor({ sexo, peso, altura, edad }: BmrInput): number {
  const base = 10 * peso + 6.25 * altura - 5 * edad;
  return sexo === 'hombre' ? base + 5 : base - 161;
}

export function calcBmr(input: BmrInput): BmrResults {
  const hb = harrisBenedict(input);
  const hbo = harrisBenedictOriginal(input);
  const ow = owen(input);
  const mf = mifflinStJeor(input);

  return {
    harris_benedict: hb,
    owen: ow,
    mifflin: mf,
    media: (hb + ow + mf) / 3,
    harris_benedict_original: hbo,
    media_con_hb_original: (hbo + ow + mf) / 3,
  };
}

export function pickBmr(results: BmrResults, formula: BmrFormulaId): number {
  return results[formula] ?? results.media;
}

/** Default de la app: media de las tres con Harris-Benedict revisada. */
export const DEFAULT_BMR_FORMULA: BmrFormulaId = 'media';

export const BMR_FORMULA_LABELS: Record<BmrFormulaId, string> = {
  harris_benedict: 'Harris-Benedict (revisada)',
  harris_benedict_original: 'Harris-Benedict (original 1919)',
  owen: 'Owen',
  mifflin: 'Mifflin-St. Jeor',
  media: 'Media de las tres',
  media_con_hb_original: 'Media (con HB original)',
};

/** Orden de presentación en la tarjeta de TMB. */
export const BMR_FORMULA_ORDER: BmrFormulaId[] = [
  'harris_benedict',
  'harris_benedict_original',
  'owen',
  'mifflin',
  'media',
  'media_con_hb_original',
];

export const BMR_FORMULA_NOTES: Partial<Record<BmrFormulaId, string>> = {
  harris_benedict_original:
    'Variante de 1919. Es la que usaba la hoja de cálculo original: reproduce el caso de referencia (media 1686).',
  media: 'Media de HB revisada + Owen + Mifflin. Valor por defecto.',
  media_con_hb_original: 'Media sustituyendo la HB revisada por la original de 1919.',
};
