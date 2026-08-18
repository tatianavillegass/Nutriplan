/**
 * ESCALADO DE MEDIDAS CASERAS
 *
 * "1 huevo" × 2 → "2 huevos" · "1/2 taza" × 3 → "1 1/2 tazas".
 * Es lo que hace que el documento del cliente se lea como el de siempre
 * en vez de como una hoja de cálculo.
 */

const FRACCIONES: [number, string][] = [
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [1 / 2, '1/2'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
];

/** Convierte "1", "1/2", "1 1/2" o "0,5" en número. */
export function parseCantidad(txt: string): number | undefined {
  const t = txt.trim().replace(',', '.');
  const mixta = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixta) return Number(mixta[1]) + Number(mixta[2]) / Number(mixta[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Devuelve el número como lo escribiría una persona: 1.5 → "1 1/2". */
export function formatCantidad(n: number): string {
  if (!Number.isFinite(n)) return '';
  const entero = Math.floor(n + 1e-9);
  const resto = n - entero;

  if (resto < 0.02) return String(entero);

  const cerca = FRACCIONES.find(([v]) => Math.abs(resto - v) < 0.04);
  if (cerca) return entero > 0 ? `${entero} ${cerca[1]}` : cerca[1];

  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

/**
 * Símbolos de unidad. No llevan plural: son 100 g, no 100 ges.
 * Es la regla del SI y además es como lo escribe cualquier receta.
 */
export const UNIDADES = new Set([
  'g', 'gr', 'kg', 'mg', 'ml', 'l', 'cl', 'dl', 'cc', 'oz', 'lb', 'kcal',
]);

/** Palabras que no cambian en plural o que ya vienen en su forma final. */
const INVARIABLES = new Set(['wasa', 'light', 'hass', 'cuch', 'sopera', 'soperas', 'peq']);

/** Adjetivos de tamaño que acompañan a la medida y sí concuerdan en plural. */
const ADJETIVOS = new Set([
  'pequeno', 'pequena', 'pequeño', 'pequeña',
  'grande', 'mediano', 'mediana', 'entero', 'entera', 'colmada', 'rasa',
]);

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** true si la palabra es un símbolo de unidad (g, ml, kg…). */
export function esUnidad(palabra: string): boolean {
  return UNIDADES.has(palabra.trim().toLowerCase());
}

/** Plural español para las palabras que aparecen en medidas caseras. */
export function pluralizar(palabra: string): string {
  const limpio = palabra.trim();
  if (!limpio) return limpio;
  if (esUnidad(limpio)) return limpio;
  if (INVARIABLES.has(limpio.toLowerCase())) return limpio;
  if (/s$/i.test(limpio)) return limpio; // ya está en plural
  if (/[aeiouáéíóú]$/i.test(limpio)) return `${limpio}s`;
  if (/ón$/i.test(limpio)) return `${limpio.slice(0, -2)}ones`;
  if (/z$/i.test(limpio)) return `${limpio.slice(0, -1)}ces`;
  if (/[bcdfghjklmnprstvwxy]$/i.test(limpio)) return `${limpio}es`;
  return limpio;
}

/** El camino inverso: "lonchas" → "loncha", "porciones" → "porción". */
export function singularizar(palabra: string): string {
  const limpio = palabra.trim();
  if (!limpio || esUnidad(limpio) || INVARIABLES.has(limpio.toLowerCase())) return limpio;
  if (!/s$/i.test(limpio)) return limpio;
  if (/ones$/i.test(limpio)) return `${limpio.slice(0, -4)}ón`;
  if (/ces$/i.test(limpio)) return `${limpio.slice(0, -3)}z`;
  if (/es$/i.test(limpio) && /[bcdfghjklmnprstvwxyz]$/i.test(limpio.slice(0, -2))) {
    return limpio.slice(0, -2);
  }
  return limpio.slice(0, -1);
}

/**
 * Escala una medida casera. Si empieza por un número lo multiplica y ajusta
 * el plural; si no, antepone el multiplicador.
 *
 *   escalarMedida('1 huevo', 2)      → '2 huevos'
 *   escalarMedida('1/2 taza', 3)     → '1 1/2 tazas'
 *   escalarMedida('2 lonchas', 2)    → '4 lonchas'
 *   escalarMedida('Filete pequeño', 3) → '3 × filete pequeño'
 */
/**
 * ALIMENTOS QUE SE CUENTAN, NO SE PESAN
 *
 * Un huevo pesa 55 g y no hay manera de comprar 1,5. Lo mismo con las
 * lonchas, las rebanadas o las tortitas de maíz. Cuando la medida casera es
 * una cuenta ("1 huevo", "2 unidades", "1 rebanada"), esto devuelve lo que
 * pesa UNA pieza, para poder redondear a piezas enteras.
 *
 * Devuelve `undefined` para lo que sí se pesa: tazas, cucharadas, filetes de
 * tamaño variable, o cualquier medida que no empiece por un número.
 */
const PIEZAS = /^(unidad|unidades|huevo|huevos|rebanada|rebanadas|loncha|lonchas|pieza|piezas|tortita|tortitas|biscote|biscotes|galleta|galletas)\b/i;

export function gramosPorPieza(alimento: {
  medida_casera?: string;
  gramos?: number;
}): number | undefined {
  const txt = (alimento.medida_casera ?? '').trim();
  const total = alimento.gramos;
  if (!txt || !total || total <= 0) return undefined;

  const m = /^(\d+)\s+(.+)$/.exec(txt);
  if (!m) return undefined;
  if (!PIEZAS.test(m[2])) return undefined;

  const cuantas = Number(m[1]);
  if (!cuantas || cuantas <= 0) return undefined;
  return total / cuantas;
}

/**
 * Redondea unos gramos al número entero de piezas más cercano, sin bajar
 * nunca de una: media loncha de pavo no existe, pero cero tampoco sirve si
 * la receta la lleva.
 */
export function redondearAPiezas(gramos: number, porPieza: number): number {
  if (porPieza <= 0) return gramos;
  const piezas = Math.max(1, Math.round(gramos / porPieza));
  return Math.round(piezas * porPieza);
}

export function escalarMedida(medida: string, factor: number): string {
  const txt = (medida ?? '').trim();
  if (!txt) return '';
  if (factor === 1) return txt;

  const m = /^((?:\d+\s+)?\d+(?:[.,]\d+)?(?:\/\d+)?)\s+(.+)$/.exec(txt);
  if (!m) {
    return `${formatCantidad(factor)} × ${txt.charAt(0).toLowerCase()}${txt.slice(1)}`;
  }

  const base = parseCantidad(m[1]);
  if (base == null || base <= 0) return `${formatCantidad(factor)} × ${txt}`;

  const total = base * factor;
  const resto = m[2];

  // Se ajusta la primera palabra y, si la acompaña, el adjetivo de tamaño:
  // "1 unidad pequeña" → "2 unidades pequeñas". El resto queda igual, porque
  // en "1/2 taza de avena" sólo cambia "taza".
  const palabras = resto.split(' ');
  const plural = total > 1;
  const ajustar = (p: string) => (plural ? pluralizar(singularizar(p)) : singularizar(p));

  const salida = palabras.map((p, i) => {
    if (i === 0) return ajustar(p);
    if (i === 1 && ADJETIVOS.has(sinTildes(singularizar(p)))) return ajustar(p);
    return p;
  });

  return `${formatCantidad(total)} ${salida.join(' ')}`;
}

/**
 * MEDIO HUEVO NO EXISTE
 *
 * Las porciones se mueven de media en media —media tostada, medio yogur—, pero
 * si una porción entera es UNA pieza, la mitad es media pieza y eso no se
 * puede echar a la sartén. Con dos lonchas por intercambio sí: media porción es
 * una loncha, así que sólo se mira el caso de la pieza única.
 */
export function pasoDePorcion(alimento: {
  medida_casera?: string;
  gramos?: number;
}): number {
  const pieza = gramosPorPieza(alimento);
  if (!pieza || !alimento.gramos) return 0.5;
  return Math.round(alimento.gramos / pieza) === 1 ? 1 : 0.5;
}
