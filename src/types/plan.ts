import type { ExchangeGroupId } from "../data/exchangeGroups";
import type { MacroBucket } from "../data/exchangeGroups";
import type { MealSlot } from "./food";

export type Phase = 1 | 2 | 3;

export interface FaseInfo {
  fase: Phase;
  titulo: string;
  resumen: string;
  recibe: string;
  paraQuien: string;
  autonomia: string;
}

/**
 * LAS TRES FASES DE ENTREGA
 *
 * Progresión natural: el cliente entra en la 1 y va ganando autonomía.
 * Cambiar de fase nunca toca los intercambios pautados, sólo la presentación.
 */
export const FASES: FaseInfo[] = [
  {
    fase: 1,
    titulo: "Recetas cerradas",
    resumen: "Recetas concretas con los gramajes ya multiplicados",
    recibe:
      "Tres recetas por comida entre las que elegir, con los gramos hechos",
    paraQuien: "Cliente nuevo, poca autonomía, quiere que le digan qué comer",
    autonomia: "Baja",
  },
  {
    fase: 2,
    titulo: "Alimentos con cantidades hechas",
    resumen: "Listas de alimentos con los gramos ya calculados para esa comida",
    recibe:
      'Opciones completas: "2 huevos (120 g) + 2 lonchas de jamón (40 g)"',
    paraQuien: "Ya sabe combinar, pero prefiere no contar porciones",
    autonomia: "Media",
  },
  {
    fase: 3,
    titulo: "Intercambios abiertos",
    resumen: "Sus porciones por comida y el menú de opciones para armarlas",
    recibe: '"Proteína: escoge 3" y la lista de la que escoger',
    paraQuien: "Cliente con experiencia, come fuera, quiere flexibilidad",
    autonomia: "Alta",
  },
];

export const FASE_POR_NUMERO = Object.fromEntries(
  FASES.map((f) => [f.fase, f]),
) as Record<Phase, FaseInfo>;

export interface Meal {
  id: string;
  nombre: string; // "Desayuno", "Post-entreno"…
  slot: MealSlot; // para filtrar el catálogo de opciones
  orden: number;
}

/** Reparto de intercambios: mealId → grupo → cantidad (múltiplos de 0.5). */
export type ExchangeGrid = Record<
  string,
  Partial<Record<ExchangeGroupId, number>>
>;

/**
 * DESPENSA DE UNA COMIDA
 *
 * Tres formas de decidir qué ve el cliente, de más a menos explícita:
 *   1. `seleccion` — la nutricionista lista los alimentos uno a uno.
 *   2. `anadidos` / `excluidos` — parte del catálogo y lo ajusta.
 *   3. Nada — el catálogo filtrado por el tipo de comida.
 */
export interface DespensaComida {
  /** Si tiene contenido, sustituye al catálogo por completo. */
  seleccion?: string[];
  /** Alimentos añadidos aunque no estén sugeridos para esa comida. */
  anadidos?: string[];
  /** Alimentos quitados sólo de esta comida. */
  excluidos?: string[];
}

/**
 * COMBINACIÓN GUARDADA (Fase 2)
 *
 * Cuando la nutricionista guarda combinaciones para una comida, son las
 * únicas que ve el cliente. Si no guarda ninguna, se usan las propuestas
 * automáticas.
 */
export interface CombinacionGuardada {
  id: string;
  bucket: MacroBucket;
  items: { foodId: string; porciones: number }[];
}

/** Alimento por defecto para el aceite de cocción. */
export const FOOD_ACEITE = "a-aceite-de-oliva-virgen-extra";

/** Comidas que llevan aceite de cocción por defecto. */
export const SLOTS_CON_COCCION: MealSlot[] = ["comida", "cena"];

export interface DayType {
  id: string;
  nombre: string; // "Día descanso", "Día entreno CrossFit"
  /** Si se define, sobreescribe las calorías objetivo del cliente. */
  caloriasOverride?: number;
  /** Objetivos introducidos por la nutricionista en g/kg. */
  proteinaGkg: number;
  hcGkg: number;
  meals: Meal[];
  grid: ExchangeGrid;
  /** Notas libres por comida (se imprimen en Fase 2). */
  notas: Record<string, string>;
  /** Postre de la cena (campo libre §6.2). */
  postre?: string;
  /**
   * Alimentos excluidos para todo el día. Se mantiene por compatibilidad con
   * los planes antiguos; lo nuevo se configura comida a comida en `despensa`.
   */
  alimentosExcluidos?: string[];
  /** Qué alimentos ve el cliente en cada comida. */
  despensa?: Record<string, DespensaComida>;
  /** Combinaciones elegidas por la nutricionista: mealId → lista. */
  combinaciones?: Record<string, CombinacionGuardada[]>;
  /**
   * Porciones de grasa reservadas para el aceite de cocción, por comida.
   * Salen de las opciones y aparecen como nota fija.
   */
  aceiteCoccion?: Record<string, number>;
  /**
   * Fase 1: recetas ofrecidas por comida. La nutricionista elige varias
   * (3 por defecto) y el cliente escoge entre ellas cada día.
   */
  recetasAsignadas?: Record<string, string[]>;
  /**
   * CANTIDADES AJUSTADAS A MANO, PARA ESTA CLIENTA
   *
   * La app calcula los gramos escalando la receta a lo pautado, pero la última
   * palabra es de quien pauta: a veces conviene subir el pan y bajar el aceite
   * aunque los macros salgan igual. Esos gramos viven aquí, en el plan, y no
   * en la receta del banco: la misma receta se cuadra distinto según a quién
   * se le pauta.
   *
   * mealId → recetaId → ingredienteId → gramos.
   */
  ajustesReceta?: Record<string, Record<string, Record<string, number>>>;
  /**
   * Lo que se le pone al lado a una receta para tapar un hueco de macro.
   * mealId → recetaId → lista.
   */
  acompanamientos?: Record<string, Record<string, Acompanamiento[]>>;
}

/** Los gramos que Tats haya fijado a mano para esa receta en esa comida. */
export function ajustesDeReceta(
  dayType: DayType,
  mealId: string,
  recetaId: string,
): Record<string, number> {
  return dayType.ajustesReceta?.[mealId]?.[recetaId] ?? {};
}

export const TIPOS_ACOMPANAMIENTO = [
  "acompanamiento",
  "postre",
  "cafe",
  "suplemento",
] as const;
export type TipoAcompanamiento = (typeof TIPOS_ACOMPANAMIENTO)[number];

export const LABEL_ACOMPANAMIENTO: Record<TipoAcompanamiento, string> = {
  acompanamiento: "Acompañamiento",
  postre: "Postre",
  cafe: "Café",
  suplemento: "Suplemento",
};

/**
 * ALGO QUE SE AÑADE A LA RECETA
 *
 * Cuando a una comida le falta media porción y no tiene sentido subir lo que
 * ya hay —a una arepa con huevo no se le echa más huevo— se le pone al lado
 * otra cosa: un yogur, una fruta, un café con leche. La receta del banco no se
 * toca; esto vive en el plan de esa clienta, como los gramos ajustados.
 */
export interface Acompanamiento {
  id: string;
  foodId: string;
  /** Copia del nombre, por si el alimento se renombra o se borra. */
  nombre: string;
  gramos: number;
  unidad?: string;
  tipo: TipoAcompanamiento;
}

/** Lo que Tats le haya puesto al lado a esa receta en esa comida. */
export function acompanamientosDeReceta(
  dayType: DayType,
  mealId: string,
  recetaId: string,
): Acompanamiento[] {
  return dayType.acompanamientos?.[mealId]?.[recetaId] ?? [];
}

export interface Plan {
  id: string;
  clientId: string;
  nombre: string;
  fase: Phase;
  dayTypes: DayType[];
  /**
   * Sólo hay una planificación en uso por cliente; las demás quedan como
   * histórico de solo lectura. Así se ve lo que se pautó en cada momento sin
   * riesgo de tocarlo por error.
   */
  archivado?: boolean;
  /** Fecha en la que se pautó, para ordenar el historial. */
  fecha?: string;
  /** Kcal objetivo con las que se cerró, congeladas al archivar. */
  kcalObjetivo?: number;
  /** Qué se cambió respecto a la anterior. */
  notas?: string;
  /**
   * Mientras no se envía, el cliente no ve nada: puedes montar el plan con
   * calma. Al enviarlo se guarda la fecha y el mensaje que le acompaña, que
   * es lo primero que lee al abrir su vista.
   */
  envio?: {
    fecha: string;
    mensaje?: string;
    /** El cliente ya lo ha abierto. */
    visto?: boolean;
  };
  /**
   * LO QUE EL CLIENTE VE DE VERDAD
   *
   * El plan de arriba es el borrador: lo que la nutricionista está tocando
   * ahora mismo. Esta copia es lo último que le envió, y es lo único que
   * llega a su pantalla.
   *
   * Sin esto, cambiar la fase a media tarde le cambiaba la app mientras
   * cenaba, y un plan a medio montar se veía en el móvil de alguien. Ahora se
   * trabaja con calma y se manda cuando está.
   */
  publicado?: PlanPublicado;
  createdAt: string;
  updatedAt: string;
}

/** La foto del plan tal y como se envió. Sólo lo que el cliente usa. */
export interface PlanPublicado {
  fase: Phase;
  dayTypes: DayType[];
  fecha: string;
}

/** Cuántas recetas se ofrecen por comida en Fase 1. */
export const RECETAS_POR_COMIDA = 3;

/** Compatibilidad: las versiones antiguas guardaban una sola receta por comida. */
export function recetasDeComida(
  asignadas: Record<string, string | string[]> | undefined,
  mealId: string,
): string[] {
  const v = asignadas?.[mealId];
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).filter(Boolean);
}

/**
 * LAS COMIDAS QUE EL DÍA TIENE DE VERDAD
 *
 * Un tipo de día arranca con las cinco de siempre, pero si a la merienda no se
 * le reparte ningún intercambio es que ese día no hay merienda. No debe contar
 * en «cómo va tu día» ni dejar el anillo a medias: quien desayuna, come y cena
 * y lo marca todo, ha terminado el día.
 *
 * Si no hay nada repartido en ninguna comida el día está a medio hacer, así
 * que se devuelven todas y ya se irá viendo.
 */
export function comidasConPauta(dayType: DayType): Meal[] {
  const conPauta = dayType.meals.filter((m) =>
    Object.values(dayType.grid[m.id] ?? {}).some((n) => (n ?? 0) > 0),
  );
  return conPauta.length ? conPauta : dayType.meals;
}

export const DEFAULT_MEALS: Meal[] = [
  { id: "desayuno", nombre: "Desayuno", slot: "desayuno", orden: 1 },
  { id: "almuerzo", nombre: "Almuerzo", slot: "almuerzo", orden: 2 },
  { id: "comida", nombre: "Comida", slot: "comida", orden: 3 },
  { id: "merienda", nombre: "Merienda", slot: "merienda", orden: 4 },
  { id: "cena", nombre: "Cena", slot: "cena", orden: 5 },
];

// ── Borrador y envío ────────────────────────────────────────

/**
 * EL PLAN QUE VE EL CLIENTE
 *
 * Lo último enviado. Si no se ha enviado nada todavía, no hay plan que
 * enseñar — y eso es lo correcto: un plan a medio montar no es un plan.
 */
export function planParaCliente(plan: Plan): Plan | undefined {
  if (plan.publicado) {
    return {
      ...plan,
      fase: plan.publicado.fase,
      dayTypes: plan.publicado.dayTypes,
    };
  }

  /**
   * LOS PLANES DE ANTES DE QUE HUBIERA BORRADOR
   *
   * Se enviaron cuando enviar era sólo abrir la puerta, así que no tienen foto
   * guardada. Sin esto, el día que esto se publique todas las clientas se
   * quedarían sin plan hasta que la nutricionista fuera una por una dándole a
   * enviar — y se enterarían ellas antes que ella.
   *
   * Se les enseña el plan tal cual está. En cuanto se envíe una vez, ese plan
   * ya tiene su foto y pasa a funcionar como los demás.
   */
  return plan.envio ? plan : undefined;
}

/** La foto que se guarda al enviar. */
export function fotoDelPlan(plan: Plan): PlanPublicado {
  return {
    fase: plan.fase,
    dayTypes: plan.dayTypes,
    fecha: new Date().toISOString(),
  };
}

/**
 * ¿HAY ALGO TOCADO SIN ENVIAR?
 *
 * Se comparan las dos cosas que el cliente usa: la fase y los días. El resto
 * —el nombre del plan, las notas de la nutricionista— no le llega, así que
 * cambiarlo no es un cambio que haya que enviar.
 *
 * Trabajar en borrador tiene un precio: si se olvida de enviar, el cliente
 * come el plan de antes. Por eso esto existe y se enseña bien visible.
 */
export function hayCambiosSinEnviar(plan: Plan): boolean {
  if (!plan.publicado) return true;
  const ahora = JSON.stringify({ fase: plan.fase, dayTypes: plan.dayTypes });
  const enviado = JSON.stringify({
    fase: plan.publicado.fase,
    dayTypes: plan.publicado.dayTypes,
  });
  return ahora !== enviado;
}

/** Qué cambió respecto a lo enviado, en castellano y para la nutricionista. */
export function queCambio(plan: Plan): string[] {
  if (!plan.publicado) return ["Todavía no le has enviado nada."];
  const cambios: string[] = [];

  if (plan.fase !== plan.publicado.fase) {
    cambios.push(`La fase pasa de ${plan.publicado.fase} a ${plan.fase}.`);
  }

  const antes = new Map(plan.publicado.dayTypes.map((d) => [d.id, d]));
  for (const d of plan.dayTypes) {
    const viejo = antes.get(d.id);
    if (!viejo) {
      cambios.push(`«${d.nombre}» es nuevo.`);
      continue;
    }
    if (JSON.stringify(viejo) !== JSON.stringify(d)) {
      cambios.push(`«${d.nombre}» ha cambiado.`);
    }
    antes.delete(d.id);
  }
  for (const [, viejo] of antes) cambios.push(`«${viejo.nombre}» ya no está.`);

  return cambios;
}
