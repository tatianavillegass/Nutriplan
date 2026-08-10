import {
  EXCHANGE_GROUPS,
  EXCHANGE_GROUP_LIST,
  type ExchangeGroupId,
  type MacroBucket,
} from '../data/exchangeGroups';
import type { Alimento, MealSlot } from '../types/food';
import type { ExchangeCounts } from './exchanges';
import { roundPortion } from './macros';
import { gramosPorIntercambio } from './recipeComposition';
import { escalarMedida, esUnidad } from './measures';

/**
 * OPCIONES YA ESCALADAS (Fase 2)
 *
 * A diferencia de la Fase 3 ("proteína: escoge 3"), aquí el cliente no cuenta
 * porciones: cada línea es una opción completa con los gramos ya multiplicados
 * por los intercambios que le tocan en esa comida.
 *
 *   Desayuno con 2 proteicos semigrasos + 1 magro →
 *     "2 huevos (120 g) + 2 lonchas jamón cocido (40 g)"
 *
 * Las opciones respetan el reparto por subgrupo que ha hecho la nutricionista,
 * así que los macros son exactamente los pautados.
 */

export interface ItemOpcion {
  foodId: string;
  nombre: string;
  grupo: ExchangeGroupId;
  intercambios: number;
  gramos: number;
  unidad: string;
  /** Medida casera ya multiplicada: "2 huevos", "1 1/2 tazas". */
  medida: string;
  /** Gramos en cocido, si aplica. */
  gramosCocido?: number;
}

export interface OpcionEscalada {
  id: string;
  bucket: MacroBucket;
  items: ItemOpcion[];
  /** Texto listo para el documento. */
  texto: string;
  /** Intercambios que cubre, por subgrupo. */
  cubre: ExchangeCounts;
  /**
   * true si un solo alimento cubre todo el bucket en lugar de respetar el
   * reparto por subgrupo. Cambia ligeramente la grasa, se marca en pantalla.
   */
  unificada: boolean;
}

export interface OpcionesDeComida {
  bucket: MacroBucket;
  /** Intercambios pautados de ese bucket en esa comida. */
  total: number;
  /** Desglose por subgrupo. */
  porSubgrupo: [ExchangeGroupId, number][];
  opciones: OpcionEscalada[];
}

const BUCKET_LABEL: Record<MacroBucket, string> = {
  proteina: 'Proteína',
  carbohidrato: 'Carbohidrato',
  grasa: 'Grasa',
};

export { BUCKET_LABEL };

function escalarAlimento(f: Alimento, intercambios: number): ItemOpcion | undefined {
  const gpi = gramosPorIntercambio(f);
  if (!gpi || !f.grupo || intercambios <= 0) return undefined;
  const gramos = roundPortion(gpi * intercambios);
  return {
    foodId: f.id,
    nombre: f.nombre,
    grupo: f.grupo,
    intercambios,
    gramos,
    unidad: f.unidad ?? 'g',
    medida: escalarMedida(f.medida_casera, intercambios),
    gramosCocido: f.equivalencia_cocido
      ? roundPortion(f.equivalencia_cocido * intercambios)
      : undefined,
  };
}

/** Preposiciones que, si abren el resto del nombre, se conservan. */
const PREPOSICIONES = ['de', 'del', 'con', 'en', 'sin', 'al'];

/**
 * Texto de una línea, sin repetir el alimento cuando la medida ya lo nombra.
 *
 *   "2 huevos"  + "Huevo entero"   → "2 huevos (120 g)"
 *   "2 claras"  + "Clara de huevo" → "2 claras de huevo (60 ml)"
 *   "1/4 taza"  + "Avena"          → "1/4 taza de avena (25 g)"
 */
/**
 * true si la medida es s\u00f3lo una cantidad con su unidad ("130 ml", "150 g").
 * Muchos alimentos de la hoja no tienen medida casera de verdad, as\u00ed que la
 * medida y el gramaje son el mismo dato y no hay que decirlo dos veces.
 */
export function medidaEsGramaje(medida: string): boolean {
  const m = /^\s*\d+(?:[.,]\d+)?\s*([a-zA-Z]+)\s*$/.exec(medida ?? '');
  return !!m && esUnidad(m[1]);
}

export function etiquetaItem(medida: string, nombre: string): string {
  const norm = (t: string) =>
    t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const palabrasMedida = norm(medida).split(/[\s,()]+/).filter(Boolean);
  const palabrasNombre = nombre.split(/[\s,]+/).filter(Boolean);
  const cabeza = palabrasNombre[0] ?? '';
  const cabezaNorm = norm(cabeza);

  // ¿La medida ya nombra el alimento? "2 huevos" contiene "huevo".
  const yaNombrado = palabrasMedida.some(
    (p) => p === cabezaNorm || p === `${cabezaNorm}s` || p === `${cabezaNorm}es`,
  );

  if (!yaNombrado) return `${medida} de ${nombre.toLowerCase()}`;

  // Se conserva el resto del nombre sólo si es un complemento ("de huevo").
  const resto = palabrasNombre.slice(1);
  if (resto.length && PREPOSICIONES.includes(norm(resto[0]))) {
    return `${medida} ${resto.join(' ').toLowerCase()}`;
  }
  return medida;
}

export function textoItem(i: ItemOpcion): string {
  const cantidad = i.gramosCocido
    ? `${i.gramos} ${i.unidad} crudo / ${i.gramosCocido} ${i.unidad} cocido`
    : `${i.gramos} ${i.unidad}`;

  // Sin medida casera de verdad: "130 ml de clara de huevo", no
  // "130 ml de clara de huevo (130 ml)".
  if (medidaEsGramaje(i.medida) && !i.gramosCocido) {
    return `${i.gramos} ${i.unidad} de ${i.nombre.toLowerCase()}`;
  }
  return `${etiquetaItem(i.medida, i.nombre)} (${cantidad})`;
}

function textoOpcion(items: ItemOpcion[]): string {
  return items.map(textoItem).join(' + ');
}

export interface OpcionesConfig {
  slot: MealSlot;
  /** Alimentos excluidos para este cliente. */
  excluidos?: string[];
  /** Cuántas opciones combinadas generar por bucket. */
  maximo?: number;
  /** Añadir opciones de un solo alimento que cubren todo el bucket. */
  incluirUnificadas?: boolean;
}

/** Alimentos del catálogo aptos para un subgrupo y una comida. */
function candidatos(
  foods: Alimento[],
  grupo: ExchangeGroupId,
  { slot, excluidos = [] }: OpcionesConfig,
): Alimento[] {
  return foods.filter(
    (f) =>
      f.grupo === grupo &&
      !excluidos.includes(f.id) &&
      f.comidas_sugeridas.includes(slot) &&
      !!gramosPorIntercambio(f),
  );
}

/**
 * Genera las opciones de un bucket para una comida.
 *
 * Combina un alimento por cada subgrupo pautado y va rotando los candidatos,
 * de forma que salen opciones variadas sin caer en la explosión combinatoria
 * de cruzar todos con todos.
 */
export function generarOpcionesBucket(
  counts: ExchangeCounts,
  bucket: MacroBucket,
  foods: Alimento[],
  config: OpcionesConfig,
): OpcionesDeComida {
  const maximo = config.maximo ?? 5;

  const porSubgrupo = EXCHANGE_GROUP_LIST.filter(
    (g) => g.bucket === bucket && !g.ilimitado && (counts[g.id] ?? 0) > 0,
  ).map((g) => [g.id, counts[g.id] as number] as [ExchangeGroupId, number]);

  const total = porSubgrupo.reduce((s, [, n]) => s + n, 0);
  if (!total) return { bucket, total: 0, porSubgrupo: [], opciones: [] };

  const listas = porSubgrupo.map(([g]) => candidatos(foods, g, config));

  const opciones: OpcionEscalada[] = [];

  // 1 · Opciones que respetan el reparto por subgrupo.
  const vueltas = Math.max(...listas.map((l) => l.length), 0);
  for (let i = 0; i < Math.min(vueltas, maximo); i++) {
    const items: ItemOpcion[] = [];
    let completa = true;
    porSubgrupo.forEach(([, n], idx) => {
      const lista = listas[idx];
      if (!lista.length) {
        completa = false;
        return;
      }
      const item = escalarAlimento(lista[i % lista.length], n);
      if (!item) completa = false;
      else items.push(item);
    });
    if (!completa || !items.length) continue;

    const cubre: ExchangeCounts = {};
    for (const it of items) cubre[it.grupo] = (cubre[it.grupo] ?? 0) + it.intercambios;

    const id = items.map((x) => x.foodId).join('+');
    if (opciones.some((o) => o.id === id)) continue;
    opciones.push({ id, bucket, items, texto: textoOpcion(items), cubre, unificada: false });
  }

  // 2 · Opciones de un solo alimento para todo el bucket.
  if (config.incluirUnificadas !== false && porSubgrupo.length > 1) {
    const todos = EXCHANGE_GROUP_LIST.filter((g) => g.bucket === bucket && !g.ilimitado).flatMap(
      (g) => candidatos(foods, g.id, config),
    );
    for (const f of todos.slice(0, 3)) {
      const item = escalarAlimento(f, total);
      if (!item) continue;
      const id = `solo:${f.id}`;
      if (opciones.some((o) => o.id === id)) continue;
      opciones.push({
        id,
        bucket,
        items: [item],
        texto: textoOpcion([item]),
        cubre: { [f.grupo as ExchangeGroupId]: total },
        unificada: true,
      });
    }
  }

  return { bucket, total, porSubgrupo, opciones };
}

/** Las tres listas (proteína, carbohidrato, grasa) de una comida. */
export function generarOpcionesComida(
  counts: ExchangeCounts,
  foods: Alimento[],
  config: OpcionesConfig,
): OpcionesDeComida[] {
  return (['proteina', 'carbohidrato', 'grasa'] as MacroBucket[])
    .map((b) => generarOpcionesBucket(counts, b, foods, config))
    .filter((x) => x.total > 0);
}

/** Resumen legible del reparto: "2 semigrasos + 1 magro". */
export function describirReparto(porSubgrupo: [ExchangeGroupId, number][]): string {
  return porSubgrupo
    .map(([g, n]) => `${n} ${EXCHANGE_GROUPS[g].nombre.toLowerCase()}`)
    .join(' + ');
}
