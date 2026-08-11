import type { Alimento } from '../types/food';
import type { ExchangeGroupId } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS } from '../data/exchangeGroups';
import type { ExchangeCounts } from './exchanges';
import { gramosPorIntercambio } from './recipeComposition';
import { roundPortion } from './macros';
import { escalarMedida } from './measures';
import { coincide } from './similitud';

/**
 * AÑADIR ALIMENTOS A UNA COMIDA (§5)
 *
 * Tres cosas distintas que la gente hace de verdad y que hasta ahora no
 * cabían en "Personalizar":
 *
 *   1. VERDURA LIBRE — echarle espinaca o tomate al plato. Es ilimitada por
 *      regla de negocio (§10.1): no gasta intercambios ni mueve macros.
 *
 *   2. COMPLETAR LO PAUTADO — la receta cubre el proteico y el almidón pero
 *      la comida tenía además 1 fruta. Se añade con su gramaje ya calculado
 *      desde la tabla de intercambios, nunca a ojo.
 *
 *   3. EXTRA — el café con leche. Lleva un lácteo de verdad, así que la
 *      pregunta no la decide la app: la decide quien come. Si lo cuenta,
 *      ocupa el hueco pautado; si no, va encima del plan y se ve lo que
 *      cuesta en calorías.
 */

/** Un alimento añadido por el cliente a una comida. */
export interface Anadido {
  /** Id único de la línea (no del alimento: se puede añadir dos veces). */
  id: string;
  foodId: string;
  nombre: string;
  /** Sin grupo = alimento libre (café solo, infusión, agua con gas). */
  grupo?: ExchangeGroupId;
  /** Intercambios que aporta. 0 en verduras y libres. */
  intercambios: number;
  /** Gramos o ml resultantes. null cuando es "al gusto". */
  cantidad: number | null;
  unidad: string;
  /** Medida casera equivalente, si el catálogo la trae. */
  medida?: string;
  /**
   * true  → ocupa sitio en lo pautado (cuenta para completar la comida).
   * false → va encima del plan y se contabiliza aparte como extra.
   * Las verduras y los alimentos libres siempre van a false: no ocupan nada.
   */
  cuenta: boolean;
}

/** Las verduras y lo que no tiene grupo nunca gastan intercambios (§10.1). */
export function esLibre(food: Alimento): boolean {
  return !food.grupo || EXCHANGE_GROUPS[food.grupo]?.ilimitado === true;
}

let contador = 0;
const nuevoId = () => `add_${Date.now().toString(36)}_${(contador++).toString(36)}`;

/**
 * Construye una línea de añadido con el gramaje resuelto contra el catálogo.
 *
 * `intercambios` es lo que se quiere aportar; los gramos salen de ahí, nunca
 * al revés, para que toda cifra siga siendo trazable a la tabla (§10.6).
 */
export function crearAnadido(
  food: Alimento,
  intercambios: number,
  cuenta: boolean,
): Anadido {
  const libre = esLibre(food);
  const gpi = libre ? undefined : gramosPorIntercambio(food);
  const n = libre ? 0 : Math.max(0, intercambios);

  const cantidad = gpi && n > 0 ? roundPortion(gpi * n) : libre ? null : food.gramos || null;
  const medida =
    food.medida_casera && food.gramos > 0 && cantidad
      ? escalarMedida(food.medida_casera, cantidad / food.gramos)
      : food.medida_casera || undefined;

  return {
    id: nuevoId(),
    foodId: food.id,
    nombre: food.nombre,
    grupo: libre ? undefined : food.grupo,
    intercambios: n,
    cantidad,
    unidad: food.unidad ?? 'g',
    medida,
    // Una verdura o un café solo no pueden "contar": no ocupan nada.
    cuenta: libre ? false : cuenta,
  };
}

/** Cambia si un añadido ocupa el hueco pautado o va como extra. */
export function alternarCuenta(a: Anadido): Anadido {
  if (!a.grupo || a.intercambios <= 0) return a;
  return { ...a, cuenta: !a.cuenta };
}

/** Texto listo para la lista de ingredientes: "150 g" o "al gusto". */
export function displayAnadido(a: Anadido): string {
  if (a.cantidad == null) return 'al gusto';
  return `${a.cantidad} ${a.unidad}`;
}

export interface AporteAnadidos {
  /** Intercambios que ocupan sitio en lo pautado. */
  cuenta: ExchangeCounts;
  /** Intercambios que van encima del plan. */
  extra: ExchangeCounts;
}

/** Reparte los añadidos entre lo que cuenta en el plan y lo que va encima. */
export function aporteAnadidos(anadidos: Anadido[]): AporteAnadidos {
  const out: AporteAnadidos = { cuenta: {}, extra: {} };
  for (const a of anadidos) {
    if (!a.grupo || a.intercambios <= 0) continue;
    const destino = a.cuenta ? out.cuenta : out.extra;
    destino[a.grupo] = (destino[a.grupo] ?? 0) + a.intercambios;
  }
  return out;
}

/** Suma dos conjuntos de intercambios. */
export function sumarIntercambios(...partes: ExchangeCounts[]): ExchangeCounts {
  const out: ExchangeCounts = {};
  for (const p of partes) {
    for (const [g, n] of Object.entries(p) as [ExchangeGroupId, number][]) {
      if (!n) continue;
      out[g] = (out[g] ?? 0) + n;
    }
  }
  return out;
}

/** Una opción del buscador, con el gramaje ya calculado. */
export interface OpcionAnadido {
  food: Alimento;
  intercambios: number;
  /** null = al gusto (verduras y libres). */
  cantidad: number | null;
  unidad: string;
  medida?: string;
  /** No gasta intercambios: verdura ilimitada o alimento sin grupo. */
  libre: boolean;
}

function aOpcion(food: Alimento, intercambios: number): OpcionAnadido {
  const a = crearAnadido(food, intercambios, false);
  return {
    food,
    intercambios: a.intercambios,
    cantidad: a.cantidad,
    unidad: a.unidad,
    medida: a.medida,
    libre: !a.grupo,
  };
}

/** Verduras del catálogo: siempre libres, siempre al gusto. */
export function verdurasLibres(foods: Alimento[], busqueda = ''): OpcionAnadido[] {
  return foods
    .filter((f) => f.grupo === 'verduras')
    .filter((f) => coincide(f.nombre, busqueda))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map((f) => aOpcion(f, 0));
}

/**
 * Candidatos para tapar un hueco pautado: los alimentos de ese grupo, con el
 * gramaje que hace falta para cubrir justo lo que falta.
 */
export function opcionesParaGrupo(
  grupo: ExchangeGroupId,
  intercambios: number,
  foods: Alimento[],
  busqueda = '',
): OpcionAnadido[] {
  return foods
    .filter((f) => f.grupo === grupo && !!gramosPorIntercambio(f))
    .filter((f) => coincide(f.nombre, busqueda))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map((f) => aOpcion(f, intercambios));
}

/**
 * Buscador abierto sobre todo el catálogo — para el café con leche y demás
 * extras que no estaban en el plan de esa comida.
 */
export function buscarParaAnadir(
  foods: Alimento[],
  busqueda: string,
  limite = 40,
): OpcionAnadido[] {
  const q = busqueda.trim();
  if (!q) return [];
  return foods
    .filter((f) => coincide(f.nombre, q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite)
    .map((f) => aOpcion(f, esLibre(f) ? 0 : 1));
}
