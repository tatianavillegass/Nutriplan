import { EXCHANGE_GROUPS, type ExchangeGroupId } from '../data/exchangeGroups';
import type { MacroGrams } from '../types/calculations';
import type { ExchangeGrid, Meal } from '../types/plan';
import type { ExchangeCounts } from './exchanges';
import { exchangesToMacros } from './exchanges';
import { kcalFromMacros, snapHalf } from './macros';

/**
 * RECOMENDADOR DE PORCIONES
 *
 * A partir de los gramos objetivo de cada macro, propone cuántos intercambios
 * de cada grupo componen el día. El orden de resolución no es arbitrario:
 *
 *   1. Verduras, fruta, legumbres, azúcares y lácteos van fijados por la
 *      nutricionista (por defecto 3 verduras y 3 frutas).
 *   2. Los almidones absorben el carbohidrato que queda.
 *   3. La proteína que falta se reparte entre proteicos magros y grasos.
 *   4. Las grasas cierran el hueco calórico que queda, igual que en el
 *      cálculo de macros: la grasa siempre es el residuo (§10.2).
 *
 * Todo se redondea a medios intercambios y después se puede editar a mano.
 */

export interface OpcionesReparto {
  verduras: number;
  fruta: number;
  legumbres: number;
  azucares: number;
  /** Subgrupo de lácteo que se usa al fijar porciones. */
  lacteos: number;
  lacteoSubgrupo: ExchangeGroupId;
  /** Proporción de la proteína animal que sale de proteicos grasos (0–1). */
  pctProteicosGrasos: number;
}

export const REPARTO_POR_DEFECTO: OpcionesReparto = {
  verduras: 3,
  fruta: 3,
  legumbres: 0,
  azucares: 0,
  lacteos: 0,
  lacteoSubgrupo: 'lacteos_desnatados',
  pctProteicosGrasos: 0.35,
};

export interface RepartoRecomendado {
  intercambios: ExchangeCounts;
  macros: MacroGrams;
  kcal: number;
  /** Diferencia con el objetivo, en gramos y kcal. */
  desviacion: { proteina: number; hc: number; grasa: number; kcal: number };
}

const suma = (c: ExchangeCounts, k: 'hc' | 'proteina' | 'grasa') =>
  (Object.entries(c) as [ExchangeGroupId, number][]).reduce(
    (s, [g, n]) => s + (n || 0) * EXCHANGE_GROUPS[g][k],
    0,
  );

/** Propone los intercambios del día a partir de los macros objetivo. */
export function recomendarReparto(
  objetivo: MacroGrams,
  opciones: Partial<OpcionesReparto> = {},
): RepartoRecomendado {
  const o = { ...REPARTO_POR_DEFECTO, ...opciones };

  // 1 · Grupos fijados por la nutricionista.
  const c: ExchangeCounts = {};
  const fijos: [ExchangeGroupId, number][] = [
    ['verduras', o.verduras],
    ['fruta', o.fruta],
    ['legumbres', o.legumbres],
    ['azucares', o.azucares],
    [o.lacteoSubgrupo, o.lacteos],
  ];
  for (const [g, n] of fijos) if (n > 0) c[g] = snapHalf(n);

  // 2 · Almidones = carbohidrato que queda.
  const hcRestante = objetivo.hc - suma(c, 'hc');
  const almidones = Math.max(0, snapHalf(hcRestante / EXCHANGE_GROUPS.almidones.hc));
  if (almidones > 0) c.almidones = almidones;

  // 3 · Proteína que falta, repartida entre magros y grasos.
  const protRestante = objetivo.proteina - suma(c, 'proteina');
  const totalProteicos = Math.max(0, protRestante / EXCHANGE_GROUPS.proteicos_magros.proteina);
  const grasos = Math.max(0, snapHalf(totalProteicos * o.pctProteicosGrasos));
  const magros = Math.max(0, snapHalf(totalProteicos - grasos));
  if (grasos > 0) c.proteicos_grasos = grasos;
  if (magros > 0) c.proteicos_magros = magros;

  // 4 · Grasas = residuo.
  const grasaRestante = objetivo.grasa - suma(c, 'grasa');
  const grasas = Math.max(0, snapHalf(grasaRestante / EXCHANGE_GROUPS.grasas.grasa));
  if (grasas > 0) c.grasas = grasas;

  const macros = exchangesToMacros(c);
  const kcal = kcalFromMacros(macros);

  return {
    intercambios: c,
    macros,
    kcal,
    desviacion: {
      proteina: macros.proteina - objetivo.proteina,
      hc: macros.hc - objetivo.hc,
      grasa: macros.grasa - objetivo.grasa,
      kcal: kcal - kcalFromMacros(objetivo),
    },
  };
}

/**
 * DISTRIBUCIÓN POR COMIDA
 *
 * Cada grupo tiene afinidad con unas comidas: las verduras van a comida y cena,
 * la fruta a desayuno, almuerzo y merienda, y los almidones y proteicos se
 * reparten por toda la jornada con más peso en las comidas principales.
 */

const PESO_COMIDA: Record<string, number> = {
  desayuno: 0.25,
  almuerzo: 0.1,
  comida: 0.3,
  merienda: 0.1,
  cena: 0.25,
  extra: 0.1,
};

const AFINIDAD: Partial<Record<ExchangeGroupId, string[]>> = {
  verduras: ['comida', 'cena'],
  fruta: ['desayuno', 'almuerzo', 'merienda'],
  legumbres: ['comida'],
  azucares: ['desayuno', 'merienda'],
  lacteos_desnatados: ['desayuno', 'merienda'],
  lacteos_semi: ['desayuno', 'merienda'],
  lacteos_enteros: ['desayuno', 'merienda'],
  lacteos_proteicos: ['desayuno', 'merienda', 'extra'],
  proteicos_grasos: ['comida', 'cena'],
};

/**
 * Reparte los intercambios del día entre las comidas configuradas.
 * El reparto respeta los medios intercambios y corrige la deriva del redondeo
 * añadiendo o quitando el sobrante en la comida de mayor peso.
 */
export function distribuirPorComida(
  intercambios: ExchangeCounts,
  meals: Meal[],
): ExchangeGrid {
  const grid: ExchangeGrid = {};
  for (const m of meals) grid[m.id] = {};
  if (!meals.length) return grid;

  for (const [gid, totalRaw] of Object.entries(intercambios) as [ExchangeGroupId, number][]) {
    const total = totalRaw || 0;
    if (!total) continue;

    const afines = AFINIDAD[gid];
    let candidatas = afines ? meals.filter((m) => afines.includes(m.slot)) : meals;
    if (!candidatas.length) candidatas = meals;

    const pesoTotal = candidatas.reduce((s, m) => s + (PESO_COMIDA[m.slot] ?? 0.15), 0) || 1;

    let repartido = 0;
    const asignaciones = candidatas.map((m) => {
      const cuota = (total * (PESO_COMIDA[m.slot] ?? 0.15)) / pesoTotal;
      const v = snapHalf(cuota);
      repartido += v;
      return { mealId: m.id, v };
    });

    // Corrección del redondeo en la comida de mayor peso.
    let resto = snapHalf(total - repartido);
    if (resto !== 0) {
      const orden = [...asignaciones].sort(
        (a, b) =>
          (PESO_COMIDA[meals.find((m) => m.id === b.mealId)!.slot] ?? 0.15) -
          (PESO_COMIDA[meals.find((m) => m.id === a.mealId)!.slot] ?? 0.15),
      );
      for (const a of orden) {
        if (resto === 0) break;
        const paso = resto > 0 ? 0.5 : -0.5;
        if (a.v + paso < 0) continue;
        a.v = snapHalf(a.v + paso);
        resto = snapHalf(resto - paso);
      }
    }

    for (const a of asignaciones) {
      if (a.v > 0) grid[a.mealId][gid] = a.v;
    }
  }

  return grid;
}

/** Atajo: de macros objetivo directamente a grilla repartida por comida. */
export function proponerGrilla(
  objetivo: MacroGrams,
  meals: Meal[],
  opciones?: Partial<OpcionesReparto>,
): { grid: ExchangeGrid; reparto: RepartoRecomendado } {
  const reparto = recomendarReparto(objetivo, opciones);
  return { grid: distribuirPorComida(reparto.intercambios, meals), reparto };
}
