import type { Plan, Meal } from '../types/plan';
import type { RegistroDia } from '../types/diary';
import type { Receta } from '../types/recipe';
import type { Alimento } from '../types/food';

/**
 * QUÉ DESAYUNA NORMALMENTE
 *
 * «¿Qué elige de verdad?» ya decía qué alimentos repite en el mes, pero
 * sueltos: la pregunta de consulta no es ésa, es «¿qué desayuna?». Un mes de
 * avena con plátano se ve aquí y no en una lista donde la avena y el plátano
 * están cada uno por su lado.
 *
 * Lo que se cuenta es lo que hay en cada fase, que es distinto en cada una:
 *
 *   · fase 1 — la receta que eligió esa mañana
 *   · fase 2 — la combinación que marcó, nombrada por sus alimentos
 *   · fases 3 y 4 — los alimentos que apuntó en esa comida
 *
 * Así la tarjeta siempre dice algo, y dice lo que de verdad pasó.
 */

export interface LoQueRepite {
  /** Lo que eligió: el nombre de la receta, de la combinación o del alimento. */
  nombre: string;
  /** Veces que aparece en el periodo. */
  veces: number;
  /** Días distintos: dos cafés el mismo día no son dos días de café. */
  dias: number;
}

export interface ComidaRepetida {
  mealId: string;
  nombre: string;
  orden: number;
  /** De lo más repetido a lo menos. */
  lista: LoQueRepite[];
  /** Días con algo apuntado en esa comida. */
  diasConAlgo: number;
}

/** Suma veces y días distintos sin repetir el día. */
class Cuenta {
  private veces = new Map<string, number>();
  private dias = new Map<string, Set<string>>();

  apunta(nombre: string, fecha: string) {
    const clave = nombre.trim();
    if (!clave) return;
    this.veces.set(clave, (this.veces.get(clave) ?? 0) + 1);
    if (!this.dias.has(clave)) this.dias.set(clave, new Set());
    this.dias.get(clave)!.add(fecha);
  }

  lista(): LoQueRepite[] {
    return [...this.veces.entries()]
      .map(([nombre, veces]) => ({ nombre, veces, dias: this.dias.get(nombre)?.size ?? 0 }))
      .sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre));
  }

  diasTocados(): number {
    const todos = new Set<string>();
    for (const d of this.dias.values()) for (const f of d) todos.add(f);
    return todos.size;
  }
}

/**
 * Qué repite en cada comida. `comidas` sale del plan y no de los registros:
 * si una comida dejó de existir, lo que se comió en ella hace dos meses ya no
 * contesta a nada.
 */
export function loQueRepitePorComida(
  plan: Plan | undefined,
  registros: RegistroDia[],
  recipes: Receta[],
  foods: Alimento[],
): ComidaRepetida[] {
  if (!plan) return [];

  // Las comidas de todos los tipos de día: la merienda del día de entreno
  // también cuenta, aunque no exista los demás días.
  const comidas = new Map<string, Meal>();
  for (const d of plan.dayTypes) for (const m of d.meals) if (!comidas.has(m.id)) comidas.set(m.id, m);

  const nombreReceta = new Map(recipes.map((r) => [r.id, r.nombre]));
  const nombreAlimento = new Map(foods.map((f) => [f.id, f.nombre]));
  const cuentas = new Map<string, Cuenta>();
  const cuentaDe = (mealId: string) => {
    if (!cuentas.has(mealId)) cuentas.set(mealId, new Cuenta());
    return cuentas.get(mealId)!;
  };

  for (const r of registros) {
    // Fase 1: la receta elegida en cada comida.
    for (const [mealId, recetaId] of Object.entries(r.recetaElegida ?? {})) {
      if (!comidas.has(mealId)) continue;
      const nombre = nombreReceta.get(recetaId);
      if (nombre) cuentaDe(mealId).apunta(nombre, r.fecha);
    }

    /*
     * Fases 2 y 3: lo marcado. En la 2 la comida ES la combinación entera, así
     * que los alimentos van juntos en una línea; en la 3 cada uno es una
     * elección suya y van por separado.
     */
    for (const [mealId, marcado] of Object.entries(r.porciones ?? {})) {
      if (!comidas.has(mealId)) continue;
      const nombres = Object.entries(marcado ?? {})
        .filter(([, n]) => n)
        .map(([foodId]) => nombreAlimento.get(foodId) ?? foodId)
        .sort((a, b) => a.localeCompare(b));
      if (!nombres.length) continue;

      if (plan.fase === 2) cuentaDe(mealId).apunta(nombres.join(' + '), r.fecha);
      else for (const n of nombres) cuentaDe(mealId).apunta(n, r.fecha);
    }

    // Fase 4: los bocados, que ya saben en qué comida se apuntaron.
    for (const b of r.bocados ?? []) {
      if (!b.momento || !comidas.has(b.momento)) continue;
      cuentaDe(b.momento).apunta(b.nombre, r.fecha);
    }
  }

  return [...comidas.values()]
    .map((m) => {
      const c = cuentas.get(m.id);
      return {
        mealId: m.id,
        nombre: m.nombre,
        orden: m.orden,
        lista: c?.lista() ?? [],
        diasConAlgo: c?.diasTocados() ?? 0,
      };
    })
    .filter((c) => c.lista.length)
    .sort((a, b) => a.orden - b.orden);
}

/**
 * ¿Come siempre lo mismo? La proporción que se lleva lo más repetido sobre
 * todo lo apuntado en esa comida. No se pinta como nota ni se juzga: comer
 * siempre lo mismo le va bien a mucha gente. Sirve para abrir la conversación
 * cuando alguien dice que se aburre.
 */
export function cuantoRepite(comida: ComidaRepetida): number {
  const total = comida.lista.reduce((s, l) => s + l.veces, 0);
  return total ? (comida.lista[0]?.veces ?? 0) / total : 0;
}
