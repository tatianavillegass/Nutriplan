import type { ExchangeGroupId } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS } from '../data/exchangeGroups';
import type { Receta } from '../types/recipe';
import type { Alimento, MealSlot } from '../types/food';
import type { Client } from '../types/client';
import type { ExchangeCounts } from './exchanges';
import { evaluarReceta, puntuarPreferencias } from './restrictions';

export interface MatchOptions {
  slot: MealSlot;
  /** Tags/preferencias del cliente. */
  preferencias?: string[];
  /** Tags a evitar (alergias, rechazos). */
  evitar?: string[];
  /** Recetas ya asignadas esta semana → penaliza para dar variedad. */
  yaAsignadas?: string[];
  limite?: number;
  /** Cliente y catálogo: si están, se bloquean las recetas no aptas. */
  client?: Pick<Client, 'patologias' | 'alergias' | 'aversiones' | 'preferidos' | 'preferencias'>;
  foods?: Alimento[];
  /** Incluir las bloqueadas en el resultado, marcadas (para poder explicarlas). */
  incluirBloqueadas?: boolean;
}

export interface MatchResult {
  receta: Receta;
  score: number;
  /** Grupos del reparto que la receta no cubre. */
  faltantes: ExchangeGroupId[];
  /** Grupos que la receta aporta y el reparto no pide. */
  sobrantes: ExchangeGroupId[];
  motivos: string[];
  /** Bloqueada por patología, alergia o aversión del cliente. */
  bloqueada?: boolean;
  motivosBloqueo?: string[];
  /** Ingredientes opcionales que hay que retirar para que encaje. */
  ingredientesAQuitar?: string[];
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
  const {
    slot,
    preferencias = [],
    evitar = [],
    yaAsignadas = [],
    limite = 4,
    client,
    foods = [],
    incluirBloqueadas = false,
  } = opts;

  const results: MatchResult[] = recetas
    .filter((r) => !r.tags.some((t) => evitar.includes(t)))
    .map((r) => {
      // 0. Restricciones del cliente: mandan sobre cualquier puntuación.
      const ev = client ? evaluarReceta(r, client, foods) : undefined;
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

      // 5. Alimentos que le gustan al cliente.
      if (client) {
        const pref = puntuarPreferencias(r, client);
        if (pref > 0) {
          score += pref * 8;
          motivos.push('Lleva alimentos que le gustan');
        }
        if (ev?.ingredientesAQuitar.length) {
          motivos.push(`Se retiran ${ev.ingredientesAQuitar.length} ingrediente(s) opcional(es)`);
        }
      }

      return {
        receta: r,
        score,
        faltantes,
        sobrantes,
        motivos,
        bloqueada: ev?.bloqueado ?? false,
        motivosBloqueo: ev?.motivos ?? [],
        ingredientesAQuitar: ev?.ingredientesAQuitar ?? [],
      };
    })
    .filter((r) => incluirBloqueadas || !r.bloqueada)
    .sort((a, b) => Number(a.bloqueada) - Number(b.bloqueada) || b.score - a.score);

  return results.slice(0, limite);
}
