import type { ExchangeGroupId } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS } from '../data/exchangeGroups';
import type { Receta } from '../types/recipe';
import type { MealSlot } from '../types/food';
import type { ExchangeCounts } from './exchanges';

export interface MatchOptions {
  slot: MealSlot;
  /** Tags/preferencias del cliente. */
  preferencias?: string[];
  /** Tags a evitar (alergias, rechazos). */
  evitar?: string[];
  /** Recetas ya asignadas esta semana → penaliza para dar variedad. */
  yaAsignadas?: string[];
  limite?: number;
}

export interface MatchResult {
  receta: Receta;
  score: number;
  /** Grupos del reparto que la receta no cubre. */
  faltantes: ExchangeGroupId[];
  /** Grupos que la receta aporta y el reparto no pide. */
  sobrantes: ExchangeGroupId[];
  motivos: string[];
}

function requiredGroups(counts: ExchangeCounts): ExchangeGroupId[] {
  return (Object.entries(counts) as [ExchangeGroupId, number][])
    .filter(([gid, n]) => n > 0 && !EXCHANGE_GROUPS[gid]?.ilimitado)
    .map(([gid]) => gid);
}

function recipeGroups(r: Receta): ExchangeGroupId[] {
  return (Object.entries(r.base) as [ExchangeGroupId, number | 'ilimitado'][])
    .filter(([gid, v]) => v !== 'ilimitado' && !!v && !EXCHANGE_GROUPS[gid]?.ilimitado)
    .map(([gid]) => gid);
}

/**
 * RECOMENDADOR (§5): busca recetas cuyo PERFIL DE GRUPOS coincida con el
 * reparto de la comida (la cantidad se resuelve escalando, no filtra).
 * Orden: cobertura de grupos → categoría de comida → tags → variedad.
 */
export function matchRecipes(
  recetas: Receta[],
  reparto: ExchangeCounts,
  opts: MatchOptions,
): MatchResult[] {
  const req = requiredGroups(reparto);
  const { slot, preferencias = [], evitar = [], yaAsignadas = [], limite = 4 } = opts;

  const results: MatchResult[] = recetas
    .filter((r) => !r.tags.some((t) => evitar.includes(t)))
    .map((r) => {
      const rg = recipeGroups(r);
      const faltantes = req.filter((g) => !rg.includes(g));
      const sobrantes = rg.filter((g) => !req.includes(g));
      const motivos: string[] = [];

      // 1. Cobertura de grupos: lo que más pesa.
      let score = 0;
      const cubiertos = req.length - faltantes.length;
      score += cubiertos * 40;
      score -= faltantes.length * 35;
      score -= sobrantes.length * 25;
      if (faltantes.length === 0 && sobrantes.length === 0) {
        score += 30;
        motivos.push('Perfil de grupos exacto');
      }

      // 2. Categoría de comida.
      if (r.categorias.includes(slot)) {
        score += 25;
        motivos.push(`Apta para ${slot}`);
      }

      // 3. Tags / preferencias del cliente.
      const coincidencias = r.tags.filter((t) => preferencias.includes(t));
      if (coincidencias.length) {
        score += coincidencias.length * 12;
        motivos.push(`Coincide con: ${coincidencias.join(', ')}`);
      }

      // 4. Variedad respecto a lo ya asignado.
      if (yaAsignadas.includes(r.id)) {
        score -= 45;
        motivos.push('Ya usada esta semana');
      }

      return { receta: r, score, faltantes, sobrantes, motivos };
    })
    .sort((a, b) => b.score - a.score);

  return results.slice(0, limite);
}
