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
