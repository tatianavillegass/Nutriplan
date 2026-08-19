import type { Receta } from '../types/recipe';
import type { DayType } from '../types/plan';
import { EXCHANGE_GROUPS, type ExchangeGroupId, type MacroBucket } from '../data/exchangeGroups';
import { presupuestoDelDia, type SeleccionGrupos } from './dailyBudget';

/**
 * ALGO DULCE
 *
 * La nutricionista escribe unos cuantos postres para toda la consulta y la
 * clienta los tiene ahí cuando le apetece algo dulce. Un postre es una receta
 * pequeña marcada como tal: hereda foto, ingredientes y escalado, y no hace
 * falta inventarse nada nuevo.
 *
 * SE ENSEÑAN TODOS, MARCANDO CUÁLES CABEN
 * =======================================
 * Esconder un postre porque «hoy no le toca» es la app dando lecciones, y a
 * quien tiene mala relación con la comida eso le hace daño. Lo que sí ayuda es
 * decirle cuál le cuadra con lo que le queda del día: elegir con la
 * información delante es distinto de que elijan por ti.
 *
 * Y LO PAGA EL PLAN O LO PAGA EL EXTRA, PERO LO DECIDE ELLA
 * ========================================================
 * Hay dos casos reales y los dos son legítimos: quien se guarda el hidrato de
 * la cena para el postre —eso es planificar— y quien ya ha cenado y le
 * apetece algo dulce —eso es un extra, y el día dirá si el desvío importa—.
 */

/** Lo que cuesta el postre, en porciones por subgrupo. La verdura no cuenta. */
export function costeDelPostre(postre: Receta): Partial<Record<ExchangeGroupId, number>> {
  const out: Partial<Record<ExchangeGroupId, number>> = {};
  for (const [g, n] of Object.entries(postre.base ?? {}) as [ExchangeGroupId, number][]) {
    if (!n || EXCHANGE_GROUPS[g]?.ilimitado) continue;
    out[g] = n;
  }
  return out;
}

export interface CabeHoy {
  /** Le cuadra con lo que le queda del día, con el margen de media porción. */
  cabe: boolean;
  /** Qué macro se le pasaría, para poder decirlo sin que lo tenga que deducir. */
  seLePasa: MacroBucket[];
}

/**
 * ¿Le cuadra hoy? Se mira por macro y no por subgrupo, como todo lo demás: si
 * le quedan dos almidones y el postre lleva fruta, es el mismo carbohidrato.
 *
 * El margen es media porción, el mismo con el que se pintan los anillos: nadie
 * come un cuarto de porción y pasarse 0,1 no es pasarse.
 */
export function cabeHoy(
  postre: Receta,
  dayType: DayType,
  seleccion: SeleccionGrupos,
): CabeHoy {
  const restante = new Map<MacroBucket, number>();
  for (const macro of presupuestoDelDia(dayType, seleccion))
    restante.set(macro.bucket, macro.restante);

  const cuesta = new Map<MacroBucket, number>();
  for (const [g, n] of Object.entries(costeDelPostre(postre)) as [ExchangeGroupId, number][]) {
    const bucket = EXCHANGE_GROUPS[g]?.bucket;
    if (!bucket) continue;
    cuesta.set(bucket, (cuesta.get(bucket) ?? 0) + n);
  }

  const seLePasa: MacroBucket[] = [];
  for (const [bucket, n] of cuesta)
    if (n - (restante.get(bucket) ?? 0) > 0.5) seLePasa.push(bucket);

  return { cabe: seLePasa.length === 0, seLePasa };
}

/**
 * Los postres del banco, con los que caben delante. No se esconde ninguno: se
 * ordenan, que es otra cosa.
 */
export function postresDelBanco(
  recetas: Receta[],
  dayType: DayType | undefined,
  seleccion: SeleccionGrupos,
): { postre: Receta; cabe: boolean; seLePasa: MacroBucket[] }[] {
  return recetas
    .filter((r) => r.postre)
    .map((postre) => {
      const estado = dayType
        ? cabeHoy(postre, dayType, seleccion)
        : { cabe: true, seLePasa: [] as MacroBucket[] };
      return { postre, ...estado };
    })
    .sort((a, b) => {
      if (a.cabe !== b.cabe) return a.cabe ? -1 : 1;
      return a.postre.nombre.localeCompare(b.postre.nombre);
    });
}
