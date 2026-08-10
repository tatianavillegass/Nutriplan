import { EXCHANGE_GROUPS, type ExchangeGroupId, type MacroBucket } from '../data/exchangeGroups';
import type { DayType, Meal } from '../types/plan';
import { bucketExchanges, gridTotals } from './exchanges';

/**
 * PRESUPUESTO DIARIO (Fase 3)
 *
 * El cliente arma sus platos escogiendo porciones. Si en una comida coge más
 * de las pautadas no se le bloquea: se le explica qué le queda para el resto
 * del día, que es como razona alguien que come fuera.
 */

/** Lo escogido: mealId → bucket → número de porciones. */
export type Seleccion = Record<string, Partial<Record<MacroBucket, number>>>;

export type EstadoBucket = 'pendiente' | 'completo' | 'excedido' | 'sin_margen';

export interface BalanceBucket {
  bucket: MacroBucket;
  /** Pautado en esta comida. */
  pautadoComida: number;
  /** Pautado en todo el día. */
  pautadoDia: number;
  /** Escogido en esta comida. */
  elegidoComida: number;
  /** Escogido en el resto de comidas. */
  elegidoOtras: number;
  /** Lo que queda del día contando todo lo elegido. */
  restanteDia: number;
  /** Lo que quedaba pautado para las comidas posteriores a ésta. */
  pautadoRestoDelDia: number;
  estado: EstadoBucket;
  mensaje?: string;
}

const LABEL: Record<MacroBucket, string> = {
  proteina: 'proteína',
  carbohidrato: 'carbohidrato',
  grasa: 'grasa',
};

const plural = (n: number, singular: string, plural_: string) => (n === 1 ? singular : plural_);

/** Pautado por bucket en una comida concreta. */
export function pautadoDeComida(dayType: DayType, mealId: string): Record<MacroBucket, number> {
  return bucketExchanges(dayType.grid[mealId] ?? {});
}

/** Pautado por bucket en todo el día. */
export function pautadoDelDia(dayType: DayType): Record<MacroBucket, number> {
  return bucketExchanges(gridTotals(dayType.grid, dayType.meals));
}

/**
 * Calcula el balance de un bucket en una comida, teniendo en cuenta lo que el
 * cliente ya ha escogido en las demás comidas del día.
 */
export function balanceBucket(
  dayType: DayType,
  meal: Meal,
  bucket: MacroBucket,
  seleccion: Seleccion,
): BalanceBucket {
  const pautadoComida = pautadoDeComida(dayType, meal.id)[bucket] ?? 0;
  const pautadoDia = pautadoDelDia(dayType)[bucket] ?? 0;
  const elegidoComida = seleccion[meal.id]?.[bucket] ?? 0;

  const elegidoOtras = dayType.meals
    .filter((m) => m.id !== meal.id)
    .reduce((s, m) => s + (seleccion[m.id]?.[bucket] ?? 0), 0);

  const restanteDia = pautadoDia - elegidoComida - elegidoOtras;

  // Lo que estaba pautado para las comidas que vienen después de ésta.
  const posteriores = dayType.meals.filter((m) => m.orden > meal.orden);
  const pautadoRestoDelDia = posteriores.reduce(
    (s, m) => s + (pautadoDeComida(dayType, m.id)[bucket] ?? 0),
    0,
  );

  let estado: EstadoBucket = 'pendiente';
  let mensaje: string | undefined;

  const nombre = LABEL[bucket];

  if (elegidoComida === 0) {
    estado = 'pendiente';
  } else if (elegidoComida === pautadoComida) {
    estado = 'completo';
  } else if (elegidoComida < pautadoComida) {
    estado = 'pendiente';
  } else if (bucket === 'proteina') {
    // Comer más proteína no descuadra el plan: la proteína magra apenas suma
    // calorías. Lo que hay que vigilar es la grasa, y de eso avisa
    // `balanceGrasa`. Aquí sólo se cuenta, sin regañar.
    estado = 'completo';
  } else {
    // Se ha pasado de lo pautado en esta comida.
    estado = restanteDia >= 0 ? 'excedido' : 'sin_margen';
    const sobra = elegidoComida - pautadoComida;

    if (restanteDia >= 0) {
      mensaje =
        `Tienes ${pautadoComida} ${plural(pautadoComida, 'porción', 'porciones')} de ${nombre} ` +
        `pautadas en esta comida y ${pautadoDia} al día. Si consumes ${elegidoComida}, ` +
        `te ${plural(restanteDia, 'queda', 'quedan')} ${restanteDia} para el resto del día ` +
        `(estaban previstas ${pautadoRestoDelDia}).`;
    } else {
      mensaje =
        `Te has pasado ${Math.abs(restanteDia)} ${plural(Math.abs(restanteDia), 'porción', 'porciones')} ` +
        `de ${nombre} sobre el total del día (${pautadoDia}). ` +
        `Puedes compensar quitando ${sobra} aquí o en otra comida.`;
    }
  }

  return {
    bucket,
    pautadoComida,
    pautadoDia,
    elegidoComida,
    elegidoOtras,
    restanteDia,
    pautadoRestoDelDia,
    estado,
    mensaje,
  };
}

/** Balance de los tres buckets de una comida. */
export function balanceComida(
  dayType: DayType,
  meal: Meal,
  seleccion: Seleccion,
): BalanceBucket[] {
  const pautado = pautadoDeComida(dayType, meal.id);
  return (['proteina', 'carbohidrato', 'grasa'] as MacroBucket[])
    .filter((b) => (pautado[b] ?? 0) > 0 || (seleccion[meal.id]?.[b] ?? 0) > 0)
    .map((b) => balanceBucket(dayType, meal, b, seleccion));
}

// ── Nivel de subgrupo ───────────────────────────────────────

/** Lo elegido por subgrupo: mealId → grupo → porciones. */
export type SeleccionGrupos = Record<string, Partial<Record<ExchangeGroupId, number>>>;

/**
 * Familias donde manda la grasa: proteicos y grasas. Coincide con la regla
 * de las combinaciones, para que la nutricionista y el cliente vean lo mismo.
 */
function limitadaPorGrasa(familia: string): boolean {
  return familia === 'proteicos' || familia === 'grasas';
}

/** Grasa por porción por debajo de la cual pasarse da igual. */
const UMBRAL_GRASA_LIBRE = 1;

/** Lo que cuesta una porción de ese subgrupo. */
function kcalDeUnaPorcion(g: ExchangeGroupId): number {
  const i = EXCHANGE_GROUPS[g];
  if (!i) return 0;
  return i.hc * 4 + i.proteina * 4 + i.grasa * 9;
}

/**
 * ¿ES UN CAMBIO A LA BAJA?
 *
 * Dentro de una familia, bajar de escalón nunca descuadra el plan:
 *
 *   · pollo donde había queso curado — misma proteína, menos grasa
 *   · aceite donde había nueces      — la misma grasa, pero las nueces
 *                                      además traen hidratos y proteína
 *
 * En los dos casos el cliente come menos calorías de las previstas, así que
 * no hay nada que avisar. Lo que sí se avisa es lo contrario: coger nueces
 * donde estaba pautado el aceite, o queso donde estaba el pollo.
 *
 * Se compara contra lo más barato que se le pautó ese día en esa familia:
 * si su elección no cuesta más que eso, es libre.
 */
export function esCambioALaBaja(dayType: DayType, grupo: ExchangeGroupId): boolean {
  const info = EXCHANGE_GROUPS[grupo];
  if (!info) return false;

  let masBarato = Infinity;
  for (const m of dayType.meals) {
    for (const [g, n] of Object.entries(dayType.grid[m.id] ?? {}) as [ExchangeGroupId, number][]) {
      if (n > 0 && EXCHANGE_GROUPS[g]?.familia === info.familia) {
        masBarato = Math.min(masBarato, kcalDeUnaPorcion(g));
      }
    }
  }

  // Nada pautado de esa familia: entonces no hay contra qué comparar.
  if (masBarato === Infinity) return false;
  // Medio kcal de margen para que dos grupos iguales no se descarten por un
  // redondeo de la tabla.
  return kcalDeUnaPorcion(grupo) <= masBarato + 0.5;
}

export interface BalanceGrasa {
  /** Gramos de grasa que aporta lo pautado del día en esa familia. */
  pautadaDia: number;
  /** Gramos que aporta lo que el cliente lleva elegido. */
  elegidaDia: number;
  excedeEn: number;
  mensaje?: string;
}

/**
 * LO ÚNICO QUE HAY QUE VIGILAR
 *
 * Da igual que se pase de proteicos magros: son 0.5 g de grasa por porción.
 * Lo que sí mueve las calorías es cambiar magros por grasos, y eso se mide
 * en gramos de grasa del día, no en número de porciones.
 */
export function balanceGrasa(
  dayType: DayType,
  familia: string,
  seleccion: SeleccionGrupos,
): BalanceGrasa {
  const deFamilia = (g: ExchangeGroupId) => EXCHANGE_GROUPS[g]?.familia === familia;

  let pautadaDia = 0;
  for (const m of dayType.meals) {
    for (const [g, n] of Object.entries(dayType.grid[m.id] ?? {}) as [ExchangeGroupId, number][]) {
      if (deFamilia(g)) pautadaDia += (EXCHANGE_GROUPS[g]?.grasa ?? 0) * n;
    }
  }

  let elegidaDia = 0;
  for (const m of dayType.meals) {
    for (const [g, n] of Object.entries(seleccion[m.id] ?? {}) as [ExchangeGroupId, number][]) {
      if (deFamilia(g)) elegidaDia += (EXCHANGE_GROUPS[g]?.grasa ?? 0) * (n ?? 0);
    }
  }

  const excedeEn = elegidaDia - pautadaDia;
  // Medio gramo de margen: los redondeos de porción no deben disparar avisos.
  const mensaje =
    excedeEn > 0.5
      ? `Llevas ${elegidaDia.toFixed(1)} g de grasa de ${familia} y el día tenía ${pautadaDia.toFixed(
          1,
        )} g. Cambia alguna opción grasa por una más magra.`
      : undefined;

  return { pautadaDia, elegidaDia, excedeEn, mensaje };
}

export interface BalanceSubgrupo {
  grupo: ExchangeGroupId;
  nombre: string;
  pautadoComida: number;
  pautadoDia: number;
  elegidoComida: number;
  elegidoOtras: number;
  restanteDia: number;
  estado: EstadoBucket;
  mensaje?: string;
}

/**
 * Guía a nivel de subgrupo. La proteína no es intercambiable entre sí: tres
 * huevos donde había dos semigrasos pautados suben la grasa aunque el total
 * de proteína cuadre. Este balance es el que lo detecta.
 */
export function balanceSubgrupo(
  dayType: DayType,
  meal: Meal,
  grupo: ExchangeGroupId,
  seleccion: SeleccionGrupos,
): BalanceSubgrupo {
  const info = EXCHANGE_GROUPS[grupo];
  const pautadoComida = dayType.grid[meal.id]?.[grupo] ?? 0;
  const pautadoDia = dayType.meals.reduce((s, m) => s + (dayType.grid[m.id]?.[grupo] ?? 0), 0);
  const elegidoComida = seleccion[meal.id]?.[grupo] ?? 0;
  const elegidoOtras = dayType.meals
    .filter((m) => m.id !== meal.id)
    .reduce((s, m) => s + (seleccion[m.id]?.[grupo] ?? 0), 0);

  const restanteDia = pautadoDia - elegidoComida - elegidoOtras;
  const nombre = info?.nombre.toLowerCase() ?? grupo;

  let estado: EstadoBucket = 'pendiente';
  let mensaje: string | undefined;

  /**
   * En proteína y grasa lo que importa es la grasa, no el recuento.
   * Pasarse de proteicos magros no cambia las calorías de forma apreciable
   * (0.5 g de grasa por porción), así que no se avisa: sólo se cuenta.
   * Lo mismo vale para cualquier cambio a la baja dentro de la familia,
   * como coger aceite donde estaban pautadas las nueces.
   * El aviso de verdad lo da `balanceGrasa`, que mira los gramos del día.
   */
  if (
    info &&
    limitadaPorGrasa(info.familia) &&
    (info.grasa <= UMBRAL_GRASA_LIBRE || esCambioALaBaja(dayType, grupo))
  ) {
    return {
      grupo,
      nombre: info.nombre,
      pautadoComida,
      pautadoDia,
      elegidoComida,
      elegidoOtras,
      restanteDia,
      estado: elegidoComida === 0 ? 'pendiente' : elegidoComida < pautadoComida ? 'pendiente' : 'completo',
    };
  }

  if (elegidoComida === 0) estado = 'pendiente';
  else if (elegidoComida === pautadoComida) estado = 'completo';
  else if (elegidoComida < pautadoComida) estado = 'pendiente';
  else {
    estado = restanteDia >= 0 ? 'excedido' : 'sin_margen';
    if (pautadoComida === 0) {
      mensaje =
        pautadoDia > 0
          ? `En esta comida no había ${nombre} pautados, pero tienes ${pautadoDia} en el día. ` +
            `Con ${elegidoComida} aquí, te ${plural(restanteDia, 'queda', 'quedan')} ${Math.max(
              0,
              restanteDia,
            )} para el resto.`
          : `${info?.nombre ?? grupo} no entra en tu plan de hoy. Si lo tomas, cuenta como extra.`;
    } else if (restanteDia >= 0) {
      mensaje =
        `Tienes ${pautadoComida} de ${nombre} en esta comida y ${pautadoDia} al día. ` +
        `Con ${elegidoComida}, te ${plural(restanteDia, 'queda', 'quedan')} ${restanteDia} para el resto del día.`;
    } else {
      mensaje =
        `Te has pasado ${Math.abs(restanteDia)} de ${nombre} sobre el total del día (${pautadoDia}). ` +
        `Cambia ${elegidoComida - pautadoComida} por otro grupo de proteína o compénsalo luego.`;
    }
  }

  return {
    grupo,
    nombre: info?.nombre ?? grupo,
    pautadoComida,
    pautadoDia,
    elegidoComida,
    elegidoOtras,
    restanteDia,
    estado,
    mensaje,
  };
}

/**
 * Subgrupos relevantes de un bucket en una comida: los pautados más los que
 * el cliente haya marcado aunque no estuvieran previstos.
 */
export function balanceSubgruposDeBucket(
  dayType: DayType,
  meal: Meal,
  bucket: MacroBucket,
  seleccion: SeleccionGrupos,
): BalanceSubgrupo[] {
  const grupos = new Set<ExchangeGroupId>();
  for (const [g, n] of Object.entries(dayType.grid[meal.id] ?? {}) as [ExchangeGroupId, number][]) {
    if (n > 0 && EXCHANGE_GROUPS[g]?.bucket === bucket && !EXCHANGE_GROUPS[g].ilimitado) {
      grupos.add(g);
    }
  }
  for (const [g, n] of Object.entries(seleccion[meal.id] ?? {}) as [ExchangeGroupId, number][]) {
    if ((n ?? 0) > 0 && EXCHANGE_GROUPS[g]?.bucket === bucket && !EXCHANGE_GROUPS[g].ilimitado) {
      grupos.add(g);
    }
  }
  return [...grupos]
    .sort((a, b) => EXCHANGE_GROUPS[a].orden - EXCHANGE_GROUPS[b].orden)
    .map((g) => balanceSubgrupo(dayType, meal, g, seleccion));
}

export interface ResumenDia {
  bucket: MacroBucket;
  pautado: number;
  elegido: number;
  restante: number;
}

/** Cómo va el día completo, para la barra de resumen. */
export function resumenDia(dayType: DayType, seleccion: Seleccion): ResumenDia[] {
  const pautado = pautadoDelDia(dayType);
  return (['proteina', 'carbohidrato', 'grasa'] as MacroBucket[]).map((bucket) => {
    const elegido = dayType.meals.reduce((s, m) => s + (seleccion[m.id]?.[bucket] ?? 0), 0);
    return { bucket, pautado: pautado[bucket] ?? 0, elegido, restante: (pautado[bucket] ?? 0) - elegido };
  });
}

/** Etiqueta del grupo para los mensajes. */
export function nombreBucket(b: MacroBucket): string {
  return LABEL[b];
}

/** Subgrupos que componen un bucket, con lo pautado en la comida. */
export function subgruposDeComida(dayType: DayType, mealId: string, bucket: MacroBucket) {
  const counts = dayType.grid[mealId] ?? {};
  return Object.entries(counts)
    .filter(([g, n]) => EXCHANGE_GROUPS[g as keyof typeof EXCHANGE_GROUPS]?.bucket === bucket && (n ?? 0) > 0)
    .map(([g, n]) => [g, n] as [string, number]);
}
