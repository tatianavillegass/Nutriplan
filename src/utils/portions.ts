import {
  EXCHANGE_GROUPS,
  EXCHANGE_GROUP_LIST,
  KCAL_PER_GRAM,
  type ExchangeGroupId,
  type MacroKey,
} from '../data/exchangeGroups';
import type { Nutrientes100 } from '../types/food';
import { roundPortion } from './macros';

/**
 * DE "NUTRIENTES POR 100 g" A "GRAMOS POR INTERCAMBIO"
 *
 * Cada subgrupo tiene un macro ancla (§ tabla de intercambios): los almidones
 * se definen por sus 14 g de HC, los proteicos por sus 7 g de proteína y las
 * grasas por sus 5 g de grasa. La porción es la cantidad de alimento que
 * aporta ese macro ancla:
 *
 *   gramos = 100 × (macro_ancla_del_grupo / macro_por_100g_del_alimento)
 *
 * Ejemplo: avena con 60 g de HC por 100 g → 100 × 14/60 = 23.3 g → 25 g.
 */

export interface PorcionCalculada {
  /** Gramos exactos antes de redondear. */
  gramosExactos: number;
  /** Gramos redondeados según la regla §10.7 (múltiplos de 5 desde 20 g). */
  gramos: number;
  /** Macro que ha definido la porción. */
  ancla: MacroKey;
  /** Lo que aporta realmente esa cantidad. */
  aporta: { hc: number; proteina: number; grasa: number; kcal: number };
  /** Lo que debería aportar según la tabla de intercambios. */
  nominal: { hc: number; proteina: number; grasa: number; kcal: number };
  /** Desviación relativa de cada macro respecto al nominal, en %. */
  desviacion: { hc: number; proteina: number; grasa: number; kcal: number };
  /** Avisos legibles cuando el alimento no encaja bien en el subgrupo. */
  avisos: string[];
}

const MACRO_EN_100: Record<MacroKey, keyof Nutrientes100> = {
  hc: 'hc',
  proteina: 'proteina',
  grasa: 'grasa',
};

const MACRO_LABEL: Record<MacroKey, string> = {
  hc: 'carbohidrato',
  proteina: 'proteína',
  grasa: 'grasa',
};

export function kcalDeMacros(hc: number, proteina: number, grasa: number): number {
  return hc * KCAL_PER_GRAM.hc + proteina * KCAL_PER_GRAM.proteina + grasa * KCAL_PER_GRAM.grasa;
}

/** Calcula la porción de un alimento dentro de un subgrupo de intercambio. */
export function calcularPorcion(
  n: Nutrientes100,
  grupo: ExchangeGroupId,
): PorcionCalculada | undefined {
  const g = EXCHANGE_GROUPS[grupo];
  if (!g) return undefined;

  const ancla = g.ancla;
  const por100 = n[MACRO_EN_100[ancla]];
  const objetivo = g[ancla];

  if (!por100 || por100 <= 0 || !objetivo) return undefined;

  const gramosExactos = (100 * objetivo) / por100;
  const gramos = roundPortion(gramosExactos);
  const f = gramos / 100;

  const aporta = {
    hc: n.hc * f,
    proteina: n.proteina * f,
    grasa: n.grasa * f,
    kcal: 0,
  };
  aporta.kcal = kcalDeMacros(aporta.hc, aporta.proteina, aporta.grasa);

  const nominal = {
    hc: g.hc,
    proteina: g.proteina,
    grasa: g.grasa,
    kcal: kcalDeMacros(g.hc, g.proteina, g.grasa),
  };

  const dev = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : ((a - b) / b) * 100);
  const desviacion = {
    hc: dev(aporta.hc, nominal.hc),
    proteina: dev(aporta.proteina, nominal.proteina),
    grasa: dev(aporta.grasa, nominal.grasa),
    kcal: dev(aporta.kcal, nominal.kcal),
  };

  const avisos: string[] = [];
  if (Math.abs(desviacion.kcal) > 20) {
    avisos.push(
      `La porción aporta ${Math.round(aporta.kcal)} kcal frente a las ${Math.round(
        nominal.kcal,
      )} del subgrupo. Revisa si encaja aquí.`,
    );
  }
  for (const k of ['hc', 'proteina', 'grasa'] as MacroKey[]) {
    if (k === ancla) continue;
    if (nominal[k] > 0 && Math.abs(desviacion[k]) > 60) {
      avisos.push(
        `Aporta ${aporta[k].toFixed(1)} g de ${MACRO_LABEL[k]} donde el subgrupo cuenta ${nominal[k]} g.`,
      );
    }
    if (nominal[k] === 0 && aporta[k] > 2) {
      avisos.push(
        `Aporta ${aporta[k].toFixed(1)} g de ${MACRO_LABEL[k]} y el subgrupo no cuenta ninguna.`,
      );
    }
  }
  if (gramosExactos < 5) {
    avisos.push('La porción sale muy pequeña: comprueba los datos por 100 g.');
  }

  return { gramosExactos, gramos, ancla, aporta, nominal, desviacion, avisos };
}

/**
 * Sugiere el subgrupo que mejor encaja con un perfil de nutrientes.
 * Se usa para preseleccionar el desplegable al dar de alta un alimento.
 */
export function sugerirSubgrupo(n: Nutrientes100): ExchangeGroupId | undefined {
  const { hc, proteina, grasa } = n;
  const azucar = n.azucar ?? 0;
  const fibra = n.fibra ?? 0;
  const total = hc * 4 + proteina * 4 + grasa * 9;
  if (total <= 0) return undefined;

  const pPr = (proteina * 4) / total;
  const pGr = (grasa * 9) / total;

  // Grasas puras: aceites, mantequillas, frutos secos.
  if (pGr > 0.7 && proteina < 5) return 'grasas';

  // Lácteos: carbohidrato moderado, proteína media y nada de fibra.
  if (hc >= 3 && hc <= 20 && proteina >= 3 && proteina <= 12 && fibra < 2) {
    if (proteina >= 8) return 'lacteos_proteicos';
    if (grasa <= 0.5) return 'lacteos_desnatados';
    if (grasa <= 2.5) return 'lacteos_semi';
    return 'lacteos_enteros';
  }

  // Alimentos proteicos: poco carbohidrato y la proteína manda.
  if (pPr >= 0.35 && hc < 8) {
    if (grasa <= 2.5) return 'proteicos_magros';
    if (grasa <= 8) return 'proteicos_semigrasos';
    return 'proteicos_grasos';
  }

  // Legumbres: mucho almidón, mucha proteína vegetal y mucha fibra.
  if (hc >= 30 && proteina >= 15 && fibra >= 8) return 'legumbres';
  if (hc >= 10 && hc < 30 && proteina >= 6 && fibra >= 4) return 'legumbres';

  // Azúcares: casi todo el carbohidrato es azúcar libre.
  if (hc >= 40 && azucar >= hc * 0.8) return 'azucares';

  // Verduras: muy poco carbohidrato.
  if (hc <= 8) return 'verduras';

  // Fruta: carbohidrato mayoritariamente en forma de azúcar.
  if (hc <= 30 && azucar >= hc * 0.6) return 'fruta';

  // El resto de fuentes de carbohidrato son almidones.
  if (hc >= 8) return 'almidones';

  return undefined;
}

/** Subgrupos disponibles para un grupo macro (para los desplegables en cascada). */
export function subgruposDeBucket(bucket: 'proteina' | 'carbohidrato' | 'grasa'): ExchangeGroupId[] {
  return EXCHANGE_GROUP_LIST.filter((g) => g.bucket === bucket).map((g) => g.id);
}

/** Cuántos intercambios aporta una cantidad concreta de un alimento. */
export function intercambiosDeGramos(
  n: Nutrientes100,
  grupo: ExchangeGroupId,
  gramos: number,
): number {
  const p = calcularPorcion(n, grupo);
  if (!p || !p.gramos) return 0;
  return gramos / p.gramos;
}
