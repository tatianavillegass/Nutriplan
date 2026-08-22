import type { MenuSemana } from '../types/diary';
import type { Alimento } from '../types/food';
import type { DayType, Plan } from '../types/plan';
import type { Receta } from '../types/recipe';
import { scaleRecipe } from './recipeScaling';
import { diasDeLaSemana, nombreDelDia } from './menuSemana';
import { gramosPorPieza } from './measures';
import { seccionDe, type Seccion } from './listaCompra';
import type { ExchangeGroupId } from '../data/exchangeGroups';

/**
 * COCINAR UNA VEZ PARA VARIOS DÍAS
 *
 * La lista de la compra dice qué comprar; esto dice qué poner al fuego el
 * domingo. Y no se piensa por receta, sino por ingrediente: da igual que el
 * arroz esté en el wok del martes y en el bowl del jueves, se cocina una olla.
 *
 * LO COCINADO DURA TRES O CUATRO DÍAS
 * ===================================
 * Ése es el límite real de cualquier guía de batch cooking, y una app que diga
 * «cocina 900 g de pollo el domingo» para comérselo el sábado está mandando a
 * alguien a comer pollo de siete días.
 *
 * No se inventa una caducidad por alimento —no la sabemos, y depende de cómo
 * lo guarde— sino que se parte la semana en tandas de tres días: lo del lunes
 * al miércoles se cocina el domingo, y lo del jueves en adelante se cocina el
 * miércoles. Es lo que hace cualquiera que se organiza, y no obliga a la app a
 * fingir que sabe cuánto aguanta un táper.
 *
 * QUÉ ENTRA
 * =========
 * Sólo lo que se cocina y se guarda: arroz, pasta, patata, legumbre, carne,
 * pescado, huevo. Ni la verdura —que se come fresca y va al gusto— ni el
 * aceite ni el yogur. Y sólo si sale al menos dos veces: cocinar una vez para
 * una comida no es batch cooking, es cenar.
 */

const COCINABLES = new Set<ExchangeGroupId>([
  'almidones',
  'legumbres',
  'proteicos_magros',
  'proteicos_semigrasos',
  'proteicos_grasos',
]);

/** Lo cocinado aguanta tres o cuatro días; se parte por tres. */
export const DIAS_QUE_AGUANTA = 3;

export interface UsoEnComida {
  fecha: string;
  /** «Lunes», para poder decírselo sin fechas. */
  dia: string;
  receta: string;
  gramos: number;
}

export interface TandaDeCocina {
  /** Qué día conviene cocinarlo: el primero en que hace falta. */
  desde: string;
  hasta: string;
  gramos: number;
  piezas?: number;
  usos: UsoEnComida[];
}

export interface QueCocinar {
  foodId?: string;
  nombre: string;
  seccion: Seccion;
  unidad: string;
  /** En cuántas comidas de la semana aparece. */
  veces: number;
  total: number;
  /** Partido por lo que aguanta en la nevera. */
  tandas: TandaDeCocina[];
  /** Los gramos son de crudo porque es lo que se pesa antes de cocinar. */
  enCrudo: boolean;
}

/**
 * Qué cocinar, cuánto y para qué comidas. Sale del mismo menú que la lista de
 * la compra, así que no hay nada nuevo que guardar.
 */
export function queCocinar(
  menu: MenuSemana | undefined,
  plan: Plan | undefined,
  recetas: Receta[],
  foods: Alimento[],
  diasQueAguanta = DIAS_QUE_AGUANTA,
): QueCocinar[] {
  if (!menu || !plan) return [];

  const porId = new Map(foods.map((f) => [f.id, f]));
  const porAlimento = new Map<
    string,
    { nombre: string; foodId?: string; grupo?: string; unidad: string; enCrudo: boolean; usos: UsoEnComida[] }
  >();

  for (const fecha of diasDeLaSemana(menu.inicio)) {
    const dia = menu.dias?.[fecha];
    if (!dia) continue;

    const dayType: DayType | undefined =
      plan.dayTypes.find((d) => d.id === dia.dayTypeId) ?? plan.dayTypes[0];
    if (!dayType) continue;

    for (const [mealId, recetaId] of Object.entries(dia.comidas ?? {})) {
      const receta = recetas.find((r) => r.id === recetaId);
      if (!receta) continue;

      const escalada = scaleRecipe(receta, dayType.grid[mealId] ?? {}, foods);

      for (const ing of escalada.ingredientes) {
        const food = ing.foodId ? porId.get(ing.foodId) : undefined;
        const grupo = (food?.grupo ?? ing.grupo) as ExchangeGroupId | undefined;
        if (!grupo || !COCINABLES.has(grupo)) continue;
        if (ing.cantidad_final == null || !(ing.cantidad_final > 0)) continue;

        /*
         * En crudo, que es lo que se pesa antes de echarlo a la olla. Si la
         * receta habla de cocido y el alimento tiene su equivalencia, se pasa;
         * si no la tiene, se dice que esos gramos son los del plato.
         */
        let gramos = ing.cantidad_final;
        let enCrudo = true;
        if (food?.equivalencia_cocido && food.gramos > 0) {
          const aCrudo = food.gramos / food.equivalencia_cocido;
          if (aCrudo > 0 && aCrudo < 1) gramos *= aCrudo;
        } else if (/cocid|hervid|asad/i.test(food?.nombre ?? ing.nombre)) {
          enCrudo = false;
        }

        const clave = food ? `f:${food.id}` : `n:${ing.nombre.trim().toLowerCase()}`;
        const ya = porAlimento.get(clave);
        porAlimento.set(clave, {
          nombre: food?.nombre ?? ing.nombre,
          foodId: food?.id,
          grupo,
          unidad: ing.unidad || food?.unidad || 'g',
          enCrudo: (ya?.enCrudo ?? true) && enCrudo,
          usos: [
            ...(ya?.usos ?? []),
            { fecha, dia: nombreDelDia(fecha), receta: receta.nombre, gramos },
          ],
        });
      }
    }
  }

  const out: QueCocinar[] = [];

  for (const v of porAlimento.values()) {
    // Cocinar para una sola comida no es batch cooking, es cenar.
    if (v.usos.length < 2) continue;

    const usos = [...v.usos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const food = v.foodId ? porId.get(v.foodId) : undefined;
    const pieza = food ? gramosPorPieza(food) : undefined;

    /*
     * Las tandas: se abre una con el primer uso y se cierra cuando el
     * siguiente cae más allá de lo que aguanta en la nevera.
     */
    const tandas: TandaDeCocina[] = [];
    for (const uso of usos) {
      const abierta = tandas[tandas.length - 1];
      const cabe =
        abierta && diferenciaEnDias(abierta.desde, uso.fecha) < diasQueAguanta;

      if (cabe) {
        abierta.usos.push(uso);
        abierta.gramos += uso.gramos;
        abierta.hasta = uso.fecha;
      } else {
        tandas.push({
          desde: uso.fecha,
          hasta: uso.fecha,
          gramos: uso.gramos,
          usos: [uso],
        });
      }
    }

    for (const t of tandas) {
      t.gramos = redondear(t.gramos, pieza);
      if (pieza) t.piezas = Math.round(t.gramos / pieza);
    }

    out.push({
      foodId: v.foodId,
      nombre: v.nombre,
      seccion: seccionDe(v.grupo),
      unidad: v.unidad,
      veces: usos.length,
      total: tandas.reduce((s, t) => s + t.gramos, 0),
      tandas,
      enCrudo: v.enCrudo,
    });
  }

  // Lo que más se repite primero: es lo que más tiempo ahorra cocinar de una vez.
  return out.sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre));
}

function redondear(gramos: number, pieza?: number): number {
  if (pieza && pieza > 0) return Math.max(1, Math.round(gramos / pieza)) * pieza;
  return Math.round(gramos / 10) * 10 || Math.ceil(gramos);
}

function diferenciaEnDias(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const uno = Date.UTC(a1, m1 - 1, d1);
  const dos = Date.UTC(a2, m2 - 1, d2);
  return Math.round((dos - uno) / 86_400_000);
}
