import type { Alimento } from '../types/food';
import type { IngredienteEscalado, RecetaEscalada } from '../types/recipe';
import type { ExchangeGroupId } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS } from '../data/exchangeGroups';
import { roundPortion } from './macros';
import type { ExchangeCounts } from './exchanges';
import { canRemoveIngredient } from './recipeScaling';

/**
 * SUSTITUCIONES DEL CLIENTE (§5)
 *
 * El cliente sólo puede cambiar un ingrediente por uno de su lista de
 * `sustitutos`. El gramaje NO se copia: se recalcula desde el catálogo de
 * alimentos, que es quien define cuántos gramos equivalen a 1 intercambio.
 * Así toda cifra sigue siendo trazable a la tabla de intercambios (§10.6).
 */

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export interface SustitutoResuelto {
  /** Etiqueta que ve el cliente (la escrita en la receta). */
  nombre: string;
  foodId?: string;
  /** Nombre completo tal y como está en el catálogo. */
  nombreCatalogo?: string;
  grupo?: ExchangeGroupId;
  /** Gramos que equivalen a 1 intercambio de su grupo. */
  gramosPorIntercambio?: number;
  medidaCasera?: string;
  unidad?: string;
  /** El sustituto pertenece al mismo grupo de intercambio que el original. */
  mismoGrupo: boolean;
  /** No se ha encontrado en el catálogo → se conserva el gramaje original. */
  sinReferencia: boolean;
}

/** Busca el alimento del catálogo que corresponde a un nombre de sustituto. */
export function findFood(nombre: string, foods: Alimento[], grupoPreferido?: string): Alimento | undefined {
  const n = norm(nombre);
  if (!n) return undefined;

  /**
   * El orden importa: "Aguacate" debe encontrar el aguacate, no el aceite de
   * aguacate. Primero la coincidencia exacta, luego la que empieza igual y
   * sólo al final la que lo contiene en medio.
   */
  const puntuar = (f: Alimento): number | undefined => {
    const fn = norm(f.nombre);
    if (fn === n) return 0;
    if (fn.startsWith(n)) return 1;
    if (fn.split(/[\s,()]+/).some((p) => p === n)) return 2;
    if (fn.includes(n) || n.includes(fn)) return 3;
    return undefined;
  };

  const candidatos = foods
    .map((f) => ({ f, p: puntuar(f) }))
    .filter((x): x is { f: Alimento; p: number } => x.p !== undefined)
    .sort(
      (a, b) =>
        a.p - b.p ||
        Number(b.f.grupo === grupoPreferido) - Number(a.f.grupo === grupoPreferido) ||
        a.f.nombre.length - b.f.nombre.length,
    );

  if (!candidatos.length) return undefined;
  return (
    candidatos.find((c) => c.p === 0)?.f ??
    candidatos.find((c) => c.f.grupo === grupoPreferido)?.f ??
    candidatos[0].f
  );
}

export function resolveSubstitute(
  nombre: string,
  grupoOriginal: string,
  foods: Alimento[],
): SustitutoResuelto {
  const food = findFood(nombre, foods, grupoOriginal);
  if (!food || !food.intercambios) {
    return { nombre, mismoGrupo: true, sinReferencia: true };
  }
  return {
    nombre,
    foodId: food.id,
    nombreCatalogo: food.nombre,
    grupo: food.grupo,
    gramosPorIntercambio: food.gramos / food.intercambios,
    medidaCasera: food.medida_casera,
    unidad: food.unidad ?? 'g',
    mismoGrupo: food.grupo === grupoOriginal,
    sinReferencia: false,
  };
}

/** Estado de personalización que mantiene el cliente sobre una receta. */
export interface CustomizationState {
  /** Ids de ingredientes quitados. */
  quitados: string[];
  /** ingredienteId → nombre del sustituto elegido. */
  sustituciones: Record<string, string>;
}

export const EMPTY_CUSTOMIZATION: CustomizationState = { quitados: [], sustituciones: {} };

export interface CustomizationResult {
  ingredientes: IngredienteEscalado[];
  /** Intercambios efectivos tras las sustituciones (para el panel antes/después). */
  exchangesDespues: ExchangeCounts;
  /** Descripción legible de cada cambio aplicado. */
  cambios: string[];
  /** Sustituciones que cruzan de grupo y por tanto sí mueven macros. */
  avisos: string[];
}

/**
 * Aplica quitados + sustituciones sobre una receta ya escalada.
 *
 * - Quitar verduras/condimentos/opcionales → sin impacto en macros.
 * - Sustituir dentro del mismo grupo → mismos intercambios, gramaje recalculado.
 * - Sustituir cruzando de grupo (p. ej. pollo magro → tofu semigraso) → se
 *   permite pero se mueve el intercambio de grupo y se avisa del cambio de grasa.
 */
export function applyCustomization(
  escalada: RecetaEscalada,
  requeridos: ExchangeCounts,
  state: CustomizationState,
  foods: Alimento[],
): CustomizationResult {
  const exchangesDespues: ExchangeCounts = { ...requeridos };
  const cambios: string[] = [];
  const avisos: string[] = [];

  const ingredientes = escalada.ingredientes
    .filter((ing) => {
      if (!state.quitados.includes(ing.id)) return true;
      // Blindaje: nunca se quita un ingrediente bloqueado (§5).
      if (!canRemoveIngredient(ing).allowed) return true;
      cambios.push(`Sin ${ing.nombre.toLowerCase()}`);
      return false;
    })
    .map((ing) => {
      const elegido = state.sustituciones[ing.id];
      if (!elegido || elegido === ing.nombre) return ing;

      const sust = resolveSubstitute(elegido, ing.grupo, foods);
      const grupoOriginal = ing.grupo as ExchangeGroupId;
      const n = requeridos[grupoOriginal] ?? 0;

      // Sin referencia en catálogo → conservamos gramaje y sólo cambia el nombre.
      if (sust.sinReferencia || sust.gramosPorIntercambio == null) {
        cambios.push(`${ing.nombre} → ${elegido}`);
        return { ...ing, nombre: elegido };
      }

      if (!sust.mismoGrupo && sust.grupo) {
        exchangesDespues[grupoOriginal] = (exchangesDespues[grupoOriginal] ?? 0) - n;
        if (!exchangesDespues[grupoOriginal]) delete exchangesDespues[grupoOriginal];
        exchangesDespues[sust.grupo] = (exchangesDespues[sust.grupo] ?? 0) + n;
        avisos.push(
          `${elegido} es del grupo "${EXCHANGE_GROUPS[sust.grupo].nombre}", no "${
            EXCHANGE_GROUPS[grupoOriginal].nombre
          }": tus macros cambian ligeramente.`,
        );
      }

      const final = n > 0 ? roundPortion(sust.gramosPorIntercambio * n) : ing.cantidad_final;
      const unidad = ing.unidad.includes('crudo') ? ing.unidad : (sust.unidad ?? ing.unidad);
      cambios.push(`${ing.nombre} → ${elegido} (${final} ${unidad})`);

      return {
        ...ing,
        nombre: elegido,
        cantidad_final: final,
        display: final == null ? ing.display : `${final} ${unidad}`,
      };
    });

  return { ingredientes, exchangesDespues, cambios, avisos };
}

/** Opciones de sustitución de un ingrediente, ya resueltas contra el catálogo. */
export function substitutionOptions(
  ing: { nombre: string; grupo: string; sustitutos?: string[] },
  foods: Alimento[],
): SustitutoResuelto[] {
  return (ing.sustitutos ?? []).map((s) => resolveSubstitute(s, ing.grupo, foods));
}
