import type { ExchangeGroupId } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS, MIN_VERDURA_G } from '../data/exchangeGroups';
import type { Receta, IngredienteEscalado, RecetaEscalada } from '../types/recipe';
import type { ExchangeCounts } from './exchanges';
import { roundPortion } from './macros';

/**
 * ESCALADO PROPORCIONAL POR GRUPO (§5)
 *   factor_grupo   = intercambios_requeridos / intercambios_base
 *   cantidad_final = cantidad_base × factor_grupo   (solo si escalable)
 *
 * Las verduras nunca escalan: son ilimitadas (§10.1).
 */
export function scaleRecipe(receta: Receta, requeridos: ExchangeCounts): RecetaEscalada {
  const factores: Partial<Record<ExchangeGroupId, number>> = {};
  const gruposSinCubrir: ExchangeGroupId[] = [];

  for (const [gid, baseVal] of Object.entries(receta.base) as [ExchangeGroupId, number | 'ilimitado'][]) {
    if (baseVal === 'ilimitado' || !baseVal) continue;
    const req = requeridos[gid] ?? 0;
    factores[gid] = req / baseVal;
  }

  // Grupos que el reparto pide pero la receta no tiene.
  for (const [gid, req] of Object.entries(requeridos) as [ExchangeGroupId, number][]) {
    if (!req) continue;
    if (EXCHANGE_GROUPS[gid]?.ilimitado) continue;
    const base = receta.base[gid];
    if (!base || base === 'ilimitado') gruposSinCubrir.push(gid);
  }

  const ingredientes: IngredienteEscalado[] = receta.ingredientes.map((ing) => {
    const esVerdura = ing.grupo === 'verduras';
    const factor =
      ing.escalable && ing.grupo !== 'condimento' && !esVerdura
        ? factores[ing.grupo as ExchangeGroupId] ?? 1
        : 1;

    if (ing.cantidad_base == null || !ing.escalable) {
      return {
        ...ing,
        factor: 1,
        cantidad_final: ing.cantidad_base,
        display: esVerdura
          ? `al gusto (mín. ${MIN_VERDURA_G} g)`
          : ing.cantidad_base == null
            ? ing.unidad || 'al gusto'
            : `${ing.cantidad_base} ${ing.unidad}`,
      };
    }

    const bruto = ing.cantidad_base * factor;
    const final = roundPortion(bruto);
    return {
      ...ing,
      factor,
      cantidad_final: final,
      display: `${final} ${ing.unidad}`,
    };
  });

  return { receta, ingredientes, factores, gruposSinCubrir };
}

/**
 * Sustitución de un ingrediente por uno de su lista de `sustitutos` (§5).
 * La equivalencia se resuelve dentro del MISMO grupo, así que los intercambios
 * —y por tanto los macros— no cambian (regla §10.4).
 */
export interface Sustitucion {
  ingredienteId: string;
  sustitutoNombre: string;
  /** g del sustituto por cada intercambio del grupo, si difiere del original. */
  gramosPorIntercambio?: number;
}

export function applySubstitutions(
  escalada: RecetaEscalada,
  sustituciones: Sustitucion[],
  intercambiosPorGrupo: ExchangeCounts,
): RecetaEscalada {
  const map = new Map(sustituciones.map((s) => [s.ingredienteId, s]));

  const ingredientes = escalada.ingredientes.map((ing) => {
    const s = map.get(ing.id);
    if (!s) return ing;

    if (s.gramosPorIntercambio != null && ing.grupo !== 'condimento') {
      const n = intercambiosPorGrupo[ing.grupo as ExchangeGroupId] ?? 0;
      const final = roundPortion(s.gramosPorIntercambio * n);
      return { ...ing, nombre: s.sustitutoNombre, cantidad_final: final, display: `${final} ${ing.unidad}` };
    }
    // Mismo grupo y misma densidad de intercambio → mismo gramaje.
    return { ...ing, nombre: s.sustitutoNombre };
  });

  return { ...escalada, ingredientes };
}

/** Reglas de edición del cliente (§5). */
export function canRemoveIngredient(ing: { escalable: boolean; opcional: boolean; grupo: string }): {
  allowed: boolean;
  reason?: string;
} {
  if (ing.grupo === 'condimento' || ing.grupo === 'verduras' || ing.opcional) {
    return { allowed: true };
  }
  if (ing.escalable) {
    return { allowed: false, reason: 'Esto cambiaría la composición de tu plan' };
  }
  return { allowed: true };
}
