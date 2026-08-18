import type { Alimento } from '../types/food';
import type { ExchangeCounts } from './exchanges';
import type { PorcionesMarcadas } from '../types/diary';
import { EXCHANGE_GROUPS, type ExchangeGroupId, type MacroBucket } from '../data/exchangeGroups';
import { aporteDeAlimento } from './exchanges';

/**
 * EL POLLO SE LLEVA CASI TODA LA PROTEÍNA DE LA COMIDA
 *
 * En fase 3 la comida suele resolverse con un alimento por macro: cuatro
 * porciones de pollo, no cuatro alimentos distintos. Pulsar cuatro veces el
 * mismo botón para decir algo que la app ya sabe —lo que falta— es trabajo
 * inventado, y se hace de pie en la cocina con una mano.
 *
 * Así que el primer toque mete lo que falta de ese macro en esa comida. Los
 * siguientes suman de una en una, que es cuando ella está afinando.
 *
 * LO QUE ESTO NO HACE
 * ===================
 * No le quita porciones a nada. Si después añade un yogur, el pollo se queda
 * como está y el día se pasa: pasarse un poco es información honesta, y
 * cambiarle un número que ya había dado por bueno sería la app corrigiendo lo
 * que ella ya se comió. Para eso está el «−» de cada línea, que decide ella.
 */

const bucketDe = (g?: string): MacroBucket | undefined =>
  g ? EXCHANGE_GROUPS[g as ExchangeGroupId]?.bucket : undefined;

function porBucket(counts: ExchangeCounts): Partial<Record<MacroBucket, number>> {
  const out: Partial<Record<MacroBucket, number>> = {};
  for (const [g, n] of Object.entries(counts) as [ExchangeGroupId, number][]) {
    const grupo = EXCHANGE_GROUPS[g];
    if (!n || !grupo || grupo.ilimitado) continue;
    out[grupo.bucket] = (out[grupo.bucket] ?? 0) + n;
  }
  return out;
}

/**
 * Cuántas porciones de este alimento entran de golpe. Siempre al menos una:
 * si el macro ya está cubierto, el toque vale lo de siempre.
 */
export function porcionesDeGolpe(
  pautado: ExchangeCounts,
  marcadas: PorcionesMarcadas[string] | undefined,
  foods: Alimento[],
  alimento: Alimento,
): number {
  const bucket = bucketDe(alimento.grupo);
  if (!bucket) return 1;

  const falta = (porBucket(pautado)[bucket] ?? 0) - (porBucket(yaMarcado(marcadas, foods))[bucket] ?? 0);
  if (falta <= 0.5) return 1;

  /**
   * Lo que aporta UNA porción suya a ese macro. Casi siempre 1, pero una
   * legumbre gasta carbohidrato y proteína a la vez y unas tortitas proteicas
   * valen por dos, así que se lee del alimento y no se da por supuesto.
   */
  const suyo = porBucket(aporteDeAlimento(alimento, 1))[bucket] ?? 1;
  if (suyo <= 0) return 1;

  return Math.max(1, Math.round(falta / suyo));
}

/** Lo ya marcado en esa comida, en intercambios. */
function yaMarcado(
  marcadas: PorcionesMarcadas[string] | undefined,
  foods: Alimento[],
): ExchangeCounts {
  const out: ExchangeCounts = {};
  for (const [foodId, n] of Object.entries(marcadas ?? {})) {
    const food = foods.find((f) => f.id === foodId);
    if (!food || !n) continue;
    for (const [g, cuantos] of Object.entries(aporteDeAlimento(food, n)) as [
      ExchangeGroupId,
      number,
    ][]) {
      if (!cuantos) continue;
      out[g] = (out[g] ?? 0) + cuantos;
    }
  }
  return out;
}
