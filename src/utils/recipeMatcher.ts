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
    /*
     * Un acompañamiento no compite por ser la comida: va al lado de un plato,
     * así que nunca se sugiere como opción de desayuno o de cena.
     */
    .filter((r) => !r.acompanamiento)
    .filter((r) => !r.tags.some((t) => evitar.includes(t)))
    .map((r) => {
      // 0. Restricciones del cliente: mandan sobre cualquier puntuación.
      const ev = client ? evaluarReceta(r, client, foods) : undefined;
      const rg = recipeGroups(r);
      const motivos: string[] = [];

      /**
       * SE COMPARA POR MACRO, COMO EN TODO LO DEMÁS
       *
       * Lo que tiene que cuadrar son las porciones de proteína, carbohidrato y
       * grasa. Si el desayuno pide un almidón y la receta lo cubre con fruta,
       * está cubierto: son los mismos 15 g de hidrato. Antes esto miraba
       * subgrupos y luego familias, y en los dos casos salían avisos de «no
       * cubre fruta» que no querían decir nada y hundían recetas buenas fuera
       * de las ocho sugerencias.
       *
       * Falta de verdad el macro que la receta no trae de ninguna manera.
       */
      const bucketDe = (g: ExchangeGroupId) => EXCHANGE_GROUPS[g]?.bucket;
      const bucketsReq = new Set(req.map(bucketDe));
      const bucketsReceta = new Set(rg.map(bucketDe));

      const faltantes = req.filter((g) => !bucketsReceta.has(bucketDe(g)));
      const sobrantes = rg.filter((g) => !bucketsReq.has(bucketDe(g)));

      /** Cubre el macro con otro grupo: la whey por el lácteo, fruta por almidón. */
      const porFamilia = req.filter((g) => !rg.includes(g) && bucketsReceta.has(bucketDe(g)));
      if (porFamilia.length) {
        motivos.push(
          `Cubre ${porFamilia.map((g) => EXCHANGE_GROUPS[g].nombre.toLowerCase()).join(' y ')} con otro alimento`,
        );
      }

      // 1. Cobertura de grupos: lo que más pesa.
      let score = 0;
      const cubiertos = req.length - faltantes.length;
      score += cubiertos * 40;
      score -= faltantes.length * 35;
      score -= sobrantes.length * 25;
      if (faltantes.length === 0 && sobrantes.length === 0) {
        score += 30;
        // Con los mismos subgrupos, no sólo la misma familia: si pautaste un
        // lácteo, una receta con yogur de verdad va por delante de una con whey.
        if (porFamilia.length === 0) motivos.push('Perfil de grupos exacto');
      }
      score += (req.length - porFamilia.length) * 10;

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
