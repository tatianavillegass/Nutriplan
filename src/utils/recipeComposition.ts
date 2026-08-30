import type { Alimento } from '../types/food';
import type { Ingrediente, Receta, RecipeBase } from '../types/recipe';
import type { ExchangeGroupId } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS } from '../data/exchangeGroups';
import { exchangesToMacros, esCompuesto } from './exchanges';
import { kcalFromMacros, snapHalf } from './macros';
import { calcularPorcion, hcNeto } from './portions';

/**
 * COMPOSICIÓN DE UNA RECETA A PARTIR DE SUS INGREDIENTES
 *
 * Los ingredientes enlazados al catálogo (`foodId`) mandan: cada uno aporta
 * `gramos / gramos_por_intercambio` intercambios de su subgrupo. Sumando todos
 * se obtiene lo que aporta la receta, sin que nadie teclee macros a mano.
 */

export interface AporteIngrediente {
  ingredienteId: string;
  nombre: string;
  grupo?: ExchangeGroupId;
  gramos?: number;
  /** Gramos que equivalen a 1 intercambio de su subgrupo. */
  gramosPorIntercambio?: number;
  intercambios: number;
  /** El ingrediente no aporta intercambios: verdura libre o condimento. */
  libre: boolean;
}

export interface ComposicionReceta {
  /** Intercambios por grupo, redondeados a medios. */
  base: RecipeBase;
  /** Intercambios exactos, sin redondear (para diagnósticos). */
  exacto: Partial<Record<ExchangeGroupId, number>>;
  aportes: AporteIngrediente[];
  macros: { proteina: number; hc: number; grasa: number };
  kcal: number;
  /** Ingredientes que no se pudieron resolver contra el catálogo. */
  sinResolver: string[];
}

/**
 * Manda la porción guardada en el catálogo: es la que ve el cliente y la que
 * la nutricionista ha podido ajustar a mano. Si no la hay, se deduce de los
 * nutrientes por 100 g.
 */
export function gramosPorIntercambio(food: Alimento): number | undefined {
  // Los alimentos libres (bebidas, alcohol) no tienen porción de intercambio.
  if (!food.grupo) return undefined;
  /**
   * En un compuesto la porción es la medida casera entera, no un intercambio
   * de un grupo: no se puede coger «un almidón» de una mezcla de tortitas sin
   * llevarse también su proteína.
   */
  if (esCompuesto(food)) return food.gramos && food.intercambios
    ? food.gramos / food.intercambios
    : food.gramos || undefined;
  if (food.gramos && food.intercambios) return food.gramos / food.intercambios;
  if (food.nutrientes) {
    const p = calcularPorcion(food.nutrientes, food.grupo);
    if (p?.gramos) return p.gramos;
  }
  return undefined;
}

/** Intercambios que aporta una cantidad de un ingrediente enlazado. */
export function aporteDeIngrediente(
  ing: Ingrediente,
  foods: Alimento[],
): AporteIngrediente {
  const base: AporteIngrediente = {
    ingredienteId: ing.id,
    nombre: ing.nombre,
    intercambios: 0,
    libre: false,
  };

  if (ing.grupo === 'condimento' || EXCHANGE_GROUPS[ing.grupo as ExchangeGroupId]?.ilimitado) {
    return { ...base, libre: true, grupo: ing.grupo === 'condimento' ? undefined : (ing.grupo as ExchangeGroupId) };
  }

  const food = ing.foodId ? foods.find((f) => f.id === ing.foodId) : undefined;
  if (!food || ing.cantidad_base == null) return base;

  const gpi = gramosPorIntercambio(food);
  if (!gpi) return base;

  return {
    ...base,
    grupo: food.grupo,
    gramos: ing.cantidad_base,
    gramosPorIntercambio: gpi,
    intercambios: ing.cantidad_base / gpi,
  };
}

/** Composición completa de una receta desde su lista de ingredientes. */
export function composicionDesdeIngredientes(
  receta: Pick<Receta, 'ingredientes'>,
  foods: Alimento[],
): ComposicionReceta {
  const exacto: Partial<Record<ExchangeGroupId, number>> = {};
  const aportes: AporteIngrediente[] = [];
  const sinResolver: string[] = [];

  for (const ing of receta.ingredientes) {
    const a = aporteDeIngrediente(ing, foods);
    aportes.push(a);

    if (a.libre) continue;
    if (!a.grupo || !a.intercambios) {
      if (ing.cantidad_base != null) sinResolver.push(ing.nombre);
      continue;
    }
    exacto[a.grupo] = (exacto[a.grupo] ?? 0) + a.intercambios;
  }

  const base: RecipeBase = {};
  for (const [g, v] of Object.entries(exacto) as [ExchangeGroupId, number][]) {
    const r = snapHalf(v);
    if (r > 0) base[g] = r;
  }
  // Las verduras presentes se marcan como ilimitadas, nunca como cantidad.
  if (aportes.some((a) => a.libre && a.grupo === 'verduras')) base.verduras = 'ilimitado';

  const macros = exchangesToMacros(exacto);

  return {
    base,
    exacto,
    aportes,
    macros,
    kcal: kcalFromMacros(macros),
    sinResolver,
  };
}

/**
 * LO QUE PESA DE VERDAD UNA RECETA
 *
 * La composición de arriba pasa los gramos a intercambios y de ahí a macros:
 * eso es lo que la receta *cuesta* del plan, y es lo que tiene que ser, porque
 * el plan se pauta en porciones. Pero la tabla de intercambios es un modelo
 * redondeado —un lácteo proteico son 7 g de proteína, 3 de hidrato y 0 de
 * grasa— y hay alimentos reales que no caen justo ahí: un yogur griego light
 * lleva 2 g de grasa por cada 100, y esa grasa desaparece al contarlo por
 * porciones.
 *
 * Cuando lo que hay que decir son las calorías —y las calorías son un hecho,
 * no una decisión del plan— se leen los gramos y la etiqueta de cada
 * ingrediente. Es la misma cuenta que hacen las recetas que cocina la clienta
 * en fase 4, así que los dos sitios dicen el mismo número.
 */
export interface MacrosReales {
  proteina: number;
  hc: number;
  grasa: number;
  kcal: number;
  /** Gramos que se han podido leer del catálogo. Cero = no hay nada que decir. */
  gramos: number;
  /** Los que no están enlazados: la gelatina, el edulcorante, «al gusto». */
  sinResolver: string[];
}

export function macrosDeIngredientes(
  receta: Pick<Receta, 'ingredientes'>,
  foods: Alimento[],
): MacrosReales {
  const out: MacrosReales = {
    proteina: 0,
    hc: 0,
    grasa: 0,
    kcal: 0,
    gramos: 0,
    sinResolver: [],
  };

  for (const ing of receta.ingredientes) {
    // «Al gusto» y los condimentos no suman ni faltan: es lo que aportan.
    if (ing.cantidad_base == null) continue;

    const food = ing.foodId ? foods.find((f) => f.id === ing.foodId) : undefined;
    const n = food?.nutrientes;
    if (!n) {
      out.sinResolver.push(ing.nombre);
      continue;
    }

    const f = ing.cantidad_base / 100;
    out.proteina += (n.proteina || 0) * f;
    // El carbohidrato neto, como en toda la app.
    out.hc += hcNeto(n) * f;
    out.grasa += (n.grasa || 0) * f;
    out.gramos += ing.cantidad_base;
  }

  out.kcal = kcalFromMacros({ proteina: out.proteina, hc: out.hc, grasa: out.grasa });
  return out;
}

/** Alérgenos que arrastra una receta desde sus ingredientes enlazados. */
export function alergenosDeReceta(receta: Pick<Receta, 'ingredientes'>, foods: Alimento[]) {
  const set = new Set<string>();
  for (const ing of receta.ingredientes) {
    const food = ing.foodId ? foods.find((f) => f.id === ing.foodId) : undefined;
    for (const a of food?.alergenos ?? []) set.add(a);
  }
  return [...set];
}

/** Devuelve la receta con su `base` recalculada desde el catálogo. */
export function sincronizarReceta(receta: Receta, foods: Alimento[]): Receta {
  const enlazados = receta.ingredientes.some((i) => i.foodId);
  if (!enlazados) return receta;
  const c = composicionDesdeIngredientes(receta, foods);
  return { ...receta, base: c.base };
}
