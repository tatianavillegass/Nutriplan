import type { RecetaPropia, RegistroDia } from '../types/diary';
import type { Alimento, Nutrientes100 } from '../types/food';
import { hcNeto } from './portions';

/**
 * LAS RECETAS QUE COCINA ELLA
 *
 * En fase 4 mucha gente se cocina lo suyo, y hay dos casos que no se parecen
 * en nada a la hora de apuntarlo:
 *
 *  · **Una ración**: el mugcake es lo que se come, entero. Apuntarlo es decir
 *    «me he comido uno».
 *  · **Una tanda**: del banana bread salen diez rebanadas, o un kilo del que
 *    mañana se sirve 50 g. Ahí no sirve la receta entera: hace falta saber
 *    cuánto lleva cada cien gramos.
 *
 * Los dos se resuelven con lo mismo: una receta que dice qué sale de ella. De
 * ahí se saca un alimento normal y corriente —con sus macros por 100 g— que
 * entra en el buscador junto al catálogo, así que apuntarlo no necesita
 * ninguna pantalla nueva ni ninguna cuenta aparte.
 *
 * EL PESO FINAL MANDA SOBRE LA SUMA DE LOS INGREDIENTES
 * =====================================================
 * Al horno se va el agua: entran 800 g de masa y salen 650 g de pan. Contando
 * sobre lo crudo, cada rebanada saldría corta —los mismos macros repartidos en
 * más gramos de los que existen—. Por eso, si ella pesa el resultado, ese peso
 * es el que manda.
 */

export interface MacrosDeReceta {
  /** Lo que lleva la receta entera. */
  totales: Nutrientes100;
  /** El peso con el que se cuenta: el final si lo dio, o lo que entró. */
  peso: number;
  /** Lo que pesa una ración, si dijo cuántas salen. */
  gramosPorRacion?: number;
}

/** Suma lo que aporta cada ingrediente leyendo su alimento. */
export function macrosDeReceta(receta: RecetaPropia, foods: Alimento[]): MacrosDeReceta {
  const totales: Nutrientes100 = { hc: 0, proteina: 0, grasa: 0, kcal: 0, fibra: 0 };
  let crudo = 0;

  for (const ing of receta.ingredientes) {
    crudo += ing.gramos || 0;
    const food = ing.foodId ? foods.find((f) => f.id === ing.foodId) : undefined;
    const n = food?.nutrientes;
    if (!n || !ing.gramos) continue;

    const f = ing.gramos / 100;
    totales.proteina += (n.proteina || 0) * f;
    // El carbohidrato neto, como en toda la app: la fibra alta no se absorbe.
    totales.hc += hcNeto(n) * f;
    totales.grasa += (n.grasa || 0) * f;
    totales.fibra = (totales.fibra ?? 0) + (n.fibra || 0) * f;
  }

  totales.kcal = totales.proteina * 4 + totales.hc * 4 + totales.grasa * 9;

  const peso = receta.gramosFinales && receta.gramosFinales > 0 ? receta.gramosFinales : crudo;
  const gramosPorRacion =
    receta.raciones && receta.raciones > 0 && peso > 0 ? peso / receta.raciones : undefined;

  return { totales, peso, gramosPorRacion };
}

/**
 * La receta convertida en alimento: macros por 100 g, y una «porción» que es
 * una ración cuando ella dijo cuántas salen. Así, al elegirla en el buscador,
 * la casilla de gramos ya viene con lo que pesa una —que es lo que se come—.
 */
export function alimentoDeRecetaPropia(
  receta: RecetaPropia,
  foods: Alimento[],
): Alimento | undefined {
  const { totales, peso, gramosPorRacion } = macrosDeReceta(receta, foods);
  if (!(peso > 0)) return undefined;

  const por100 = (v: number) => (v / peso) * 100;
  const nutrientes: Nutrientes100 = {
    proteina: por100(totales.proteina),
    hc: por100(totales.hc),
    grasa: por100(totales.grasa),
    fibra: por100(totales.fibra ?? 0),
    kcal: por100(totales.kcal ?? 0),
  };

  const gramos = gramosPorRacion ? Math.round(gramosPorRacion) : 100;

  return {
    id: `rp_${receta.id}`,
    nombre: receta.nombre,
    medida_casera: gramosPorRacion ? '1 ración' : '100 g',
    gramos,
    intercambios: 1,
    nutrientes,
    comidas_sugeridas: [],
    alergenos: [],
    apto: [],
    /**
     * Sin subgrupo a propósito: esto es de fase 4, donde se cuentan gramos.
     * Ponerle uno le haría gastar intercambios en fase 3 con un reparto que la
     * nutricionista no ha visto.
     */
  } as unknown as Alimento;
}

/**
 * Todas sus recetas, leídas de sus días y sin las que borró. Como las comidas
 * guardadas: el día en que la escribió no se puede reescribir desde hoy, así
 * que borrar se apunta aparte.
 */
export function recetasPropiasDe(registros: RegistroDia[]): RecetaPropia[] {
  const borradas = new Set(registros.flatMap((r) => r.recetasBorradas ?? []));
  const vistas = new Map<string, RecetaPropia>();

  for (const r of [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha)))
    for (const receta of r.recetasPropias ?? []) {
      if (borradas.has(receta.id)) continue;
      // La versión más nueva gana: editar una receta es volver a guardarla.
      vistas.set(receta.id, receta);
    }

  return [...vistas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Sus recetas ya convertidas en alimentos, listas para el buscador. */
export function alimentosDeSusRecetas(
  registros: RegistroDia[],
  foods: Alimento[],
): Alimento[] {
  return recetasPropiasDe(registros)
    .map((r) => alimentoDeRecetaPropia(r, foods))
    .filter(Boolean) as Alimento[];
}
