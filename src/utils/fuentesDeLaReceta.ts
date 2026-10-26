import { EXCHANGE_GROUPS } from '../data/exchangeGroups';
import type { MacroBucket } from '../data/exchangeGroups';
import type { Receta } from '../types/recipe';

/**
 * DE DÓNDE SALE LA PROTEÍNA Y DE DÓNDE EL HIDRATO
 *
 * Al repartir la semana, la tabla de «cómo va quedando» decía el nombre del
 * plato y poco más. Pero lo que se decide ahí no es qué plato toca el martes:
 * es **no ponerle pollo cuatro días seguidos** y que el hidrato no sea siempre
 * arroz. Para eso hay que ver la fuente, no el título — «Bowl mediterráneo» no
 * dice si lleva pollo o atún.
 *
 * Así que de cada receta se sacan sus fuentes: qué le pone la proteína y qué
 * le pone el hidrato.
 *
 * SE MIRAN LOS GRAMOS, NO EL ORDEN
 * ================================
 * Manda el ingrediente que más pesa de su familia, que es el que define el
 * plato. El huevo de un salteado de arroz con huevo no es «el plato de huevo».
 *
 * LA VERDURA NO ES UNA FUENTE
 * ===========================
 * Es ilimitada y está en todos los platos: ponerla aquí sería escribir
 * «verdura» siete veces y tapar lo que sí cambia. Los condimentos, igual.
 *
 * LAS LEGUMBRES SALEN EN LAS DOS
 * ==============================
 * Unas lentejas son hidrato y proteína a la vez (`bucketExtra`), y es
 * exactamente lo que hay que ver al repartir: el día de lentejas no hace falta
 * otra proteína. Decir sólo una de las dos cosas escondería media verdad.
 */

export interface FuentesDeLaReceta {
  proteina: string[];
  carbohidrato: string[];
}

/** En qué columnas entra un subgrupo: la suya y las que comparta. */
function bucketsDe(grupo: string): MacroBucket[] {
  const g = EXCHANGE_GROUPS[grupo as keyof typeof EXCHANGE_GROUPS];
  if (!g || g.ilimitado) return [];
  return [g.bucket, ...(g.bucketExtra ?? [])];
}

/**
 * Qué le pone la proteína y qué el hidrato, de más a menos peso.
 *
 * `cuantas` limita lo que se devuelve porque esto se lee en una celda de una
 * tabla de siete columnas: con tres nombres ya no se lee nada.
 */
export function fuentesDeLaReceta(receta: Receta, cuantas = 2): FuentesDeLaReceta {
  const out: FuentesDeLaReceta = { proteina: [], carbohidrato: [] };

  const candidatos = receta.ingredientes
    .filter((i) => i.grupo !== 'condimento')
    .map((i) => ({
      nombre: i.nombre,
      /* Sin gramos (algo «al gusto») va al final, pero no se tira: existe. */
      peso: i.cantidad_base ?? 0,
      buckets: bucketsDe(i.grupo),
    }))
    .filter((i) => i.buckets.length)
    .sort((a, b) => b.peso - a.peso);

  for (const bucket of ['proteina', 'carbohidrato'] as const) {
    for (const c of candidatos) {
      if (!c.buckets.includes(bucket)) continue;
      if (out[bucket].includes(c.nombre)) continue;
      out[bucket].push(c.nombre);
      if (out[bucket].length >= cuantas) break;
    }
  }

  return out;
}

/** «Pollo · Arroz», para una línea suelta. Sin fuente, cadena vacía. */
export function fuentesEnTexto(receta: Receta): string {
  const f = fuentesDeLaReceta(receta, 1);
  return [f.proteina[0], f.carbohidrato[0]].filter(Boolean).join(' · ');
}
