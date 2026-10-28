import type { DayType, Plan } from '../types/plan';
import { uid } from './storage';

/**
 * UNA COMIDA RENOMBRADA ES OTRA COMIDA
 * ====================================
 * Todos los tipos de día nacen con **las mismas ids de comida**
 * (`desayuno`, `comida`, `merienda`…), y eso es a propósito: así los platos
 * del desayuno son los mismos coma lo que coma ese día, y lo único que cambia
 * son las cantidades. Funciona mientras los dos días tengan las mismas
 * comidas.
 *
 * Deja de funcionar en cuanto no las tienen. En un día de tirada larga hay
 * pre-entreno e intra-entreno que en el día base no existen, y al montarlos
 * renombrando una comida que ya estaba —«Merienda» pasa a «Pre-entreno»— la
 * **id no cambiaba**. Entonces:
 *
 *   · las recetas del pre-entreno eran las de la merienda del día base, y al
 *     revés: lo que se ponía en uno aparecía en el otro;
 *   · al repartir la semana, que junta las comidas de todos los días por id y
 *     se queda con el primer nombre que encuentra, el pre-entreno salía
 *     rotulado «Merienda» — con la tostada con mermelada de desayuno.
 *
 * Así que renombrar una comida en un tipo de día, cuando esa misma id vive en
 * otro, **la separa**: pasa a tener id propia y deja de compartir nada.
 *
 * SE LLEVA LO SUYO
 * ================
 * La comida separada arranca con lo que tenía —su reparto, su despensa, su
 * nota, sus recetas, sus ajustes— porque renombrar no es empezar de cero: es
 * decir que a partir de ahora esto es otra cosa. Lo que cambia es que desde
 * ese momento cada una va por su lado.
 *
 * NO SE SEPARA SI NO HACE FALTA
 * =============================
 * Con un solo tipo de día, o si esa id no está en ningún otro, renombrar es
 * sólo cambiarle el nombre: separarla crearía ids nuevas sin motivo y rompería
 * los registros que la clienta ya tiene apuntados contra esa id.
 */

/** Las claves de `DayType` que guardan cosas por comida. */
const POR_COMIDA = [
  'grid',
  'notas',
  'despensa',
  'combinaciones',
  'avituallamientos',
  'aceiteCoccion',
  'ajustesReceta',
  'acompanamientos',
  'ingredientesQuitados',
  'ingredientesAnadidos',
  'fijos',
] as const;

/** Si esa comida la comparte con otro tipo de día. */
export function comidaCompartida(plan: Plan, dayTypeId: string, mealId: string): boolean {
  return plan.dayTypes.some(
    (d) => d.id !== dayTypeId && d.meals.some((m) => m.id === mealId),
  );
}

/**
 * Le da id propia a una comida dentro de su tipo de día, copiando todo lo que
 * colgaba de la vieja. Devuelve el plan entero —las recetas viven ahí— y la
 * id que le ha quedado, que es la nueva si hubo que separarla.
 */
export function separarComida(
  plan: Plan,
  dayTypeId: string,
  mealId: string,
): { plan: Plan; mealId: string } {
  if (!comidaCompartida(plan, dayTypeId, mealId)) return { plan, mealId };

  const nueva = uid('m_');

  const dayTypes = plan.dayTypes.map((d) => {
    if (d.id !== dayTypeId) return d;

    const copia: DayType = {
      ...d,
      meals: d.meals.map((m) => (m.id === mealId ? { ...m, id: nueva } : m)),
    };

    for (const clave of POR_COMIDA) {
      const mapa = d[clave] as Record<string, unknown> | undefined;
      if (!mapa || !(mealId in mapa)) continue;
      const { [mealId]: suyo, ...resto } = mapa;
      (copia as unknown as Record<string, unknown>)[clave] = { ...resto, [nueva]: suyo };
    }

    /* Las recetas del formato viejo también colgaban del tipo de día. */
    if (d.recetasAsignadas?.[mealId]) {
      const { [mealId]: suyas, ...resto } = d.recetasAsignadas;
      copia.recetasAsignadas = { ...resto, [nueva]: [...suyas] };
    }

    return copia;
  });

  /*
   * Las recetas viven en el plan y las comparten todos los días, así que la
   * comida separada se lleva una COPIA: el día base sigue con las suyas.
   */
  const asignadas = plan.recetasAsignadas?.[mealId];
  const recetasAsignadas = asignadas
    ? { ...plan.recetasAsignadas, [nueva]: [...asignadas] }
    : plan.recetasAsignadas;

  return { plan: { ...plan, dayTypes, recetasAsignadas }, mealId: nueva };
}


/**
 * LAS QUE YA ESTABAN MAL
 * ======================
 * Los planes montados antes de esto tienen la comida renombrada compartiendo
 * id con la del otro día: el pre-entreno de la tirada larga y la merienda del
 * día base son la misma casilla, con las mismas recetas, y al repartir la
 * semana sale una con el nombre de la otra.
 *
 * Pedirle que entre a renombrarlas una por una para que se separen es pedirle
 * que arregle a mano algo que no rompió ella. Se separan solas al cargar.
 *
 * **La señal es el nombre.** Dos días que llaman igual a la misma id son la
 * misma comida y siguen compartiendo, que es lo que se quiere. Si la llaman
 * distinto son dos cosas distintas, y se separan — se queda con la id el
 * primer tipo de día, que es el que manda en el reparto de la semana.
 */
export function separarComidasRenombradas(plan: Plan): Plan {
  let out = plan;

  /* Sobre el plan original: lo que ya se separó cambia de id y no vuelve. */
  for (const [i, d] of plan.dayTypes.entries()) {
    if (i === 0) continue;
    for (const m of d.meals) {
      const otro = plan.dayTypes
        .slice(0, i)
        .flatMap((x) => x.meals)
        .find((x) => x.id === m.id);
      if (!otro || otro.nombre.trim() === m.nombre.trim()) continue;
      out = separarComida(out, d.id, m.id).plan;
    }
  }

  return out;
}
