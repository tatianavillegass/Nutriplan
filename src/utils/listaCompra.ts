import type { MenuSemana } from '../types/diary';
import type { Alimento } from '../types/food';
import type { DayType, Plan } from '../types/plan';
import type { Receta } from '../types/recipe';
import { scaleRecipe } from './recipeScaling';
import { diasDeLaSemana } from './menuSemana';
import { gramosPorPieza } from './measures';
import type { ExchangeGroupId } from '../data/exchangeGroups';

/**
 * LA LISTA DE LA COMPRA
 *
 * Sale del menú de la semana: si el jueves toca pollo al horno, el pollo de
 * ese día entra en la lista con los gramos que le tocan a ella —los de su
 * plan, escalados a su día de entreno o de descanso—.
 *
 * LAS CUATRO TRAMPAS
 * ==================
 *  1. **Se suma por alimento, no por nombre.** «Pollo» y «Pechuga de pollo»
 *     son dos líneas si se agrupa por texto. Se agrupa por el alimento del
 *     catálogo, y lo que no está enlazado se lista aparte y marcado: no se
 *     puede sumar lo que no se sabe qué es.
 *  2. **Se compra crudo.** Si la receta lleva 150 g de arroz cocido, en la
 *     lista tiene que poner lo que hay que comprar. Se usa la equivalencia del
 *     catálogo y, cuando no la hay, se dice que esos gramos son los del plato.
 *  3. **Se redondea a lo que se vende.** «7,3 huevos» no es una lista: son 8.
 *     Las piezas suben al entero y el resto a la decena de gramos.
 *  4. **La verdura no tiene gramos.** Va «al gusto», así que se dice para
 *     cuántas comidas hace falta y no se inventa una cantidad.
 */

/**
 * LAS SECCIONES DEL SUPERMERCADO
 *
 * Una lista ordenada alfabéticamente obliga a dar cuatro vueltas al
 * supermercado: el aguacate al principio, el pollo en medio y el brócoli al
 * final. Agrupada por sección se recorre una vez.
 *
 * No es una clasificación nutricional —eso ya lo hacen los subgrupos— sino el
 * mapa de la tienda, que es otra cosa: el yogur y la leche van juntos aunque
 * uno sea proteico y el otro no.
 */
export const SECCIONES = [
  'Carnes, pescados y huevos',
  'Lácteos',
  'Frutas',
  'Verduras',
  'Cereales, pan y tubérculos',
  'Legumbres',
  'Aceites y frutos secos',
  'Otros',
] as const;

export type Seccion = (typeof SECCIONES)[number];

const POR_GRUPO: Partial<Record<ExchangeGroupId, Seccion>> = {
  proteicos_magros: 'Carnes, pescados y huevos',
  proteicos_semigrasos: 'Carnes, pescados y huevos',
  proteicos_grasos: 'Carnes, pescados y huevos',
  lacteos_desnatados: 'Lácteos',
  lacteos_semi: 'Lácteos',
  lacteos_enteros: 'Lácteos',
  lacteos_proteicos: 'Lácteos',
  fruta: 'Frutas',
  verduras: 'Verduras',
  almidones: 'Cereales, pan y tubérculos',
  legumbres: 'Legumbres',
  grasas: 'Aceites y frutos secos',
  frutos_secos: 'Aceites y frutos secos',
  azucares: 'Otros',
};

export function seccionDe(grupo?: string): Seccion {
  return POR_GRUPO[grupo as ExchangeGroupId] ?? 'Otros';
}

export interface LineaCompra {
  /** Identidad estable de la línea, para poder tacharla y que siga tachada. */
  clave: string;
  /** Por dónde cae en el supermercado. */
  seccion: Seccion;
  /** El alimento del catálogo, cuando se pudo enlazar. */
  foodId?: string;
  nombre: string;
  /** Lo que hay que comprar, ya redondeado. */
  cantidad: number;
  unidad: string;
  /** En piezas, para poder decir «8 huevos» y no «440 g de huevo». */
  piezas?: number;
  /** En cuántas comidas de la semana aparece. */
  veces: number;
  /**
   * Sin enlazar al catálogo: no se ha podido sumar con nada ni pasar a crudo,
   * así que se enseña aparte para que ella lo compruebe.
   */
  sinEnlazar?: boolean;
  /** De las que van «al gusto»: verdura, especias. */
  alGusto?: boolean;
}

export interface ListaCompra {
  lineas: LineaCompra[];
  /** Cuántas comidas de la semana han entrado en la cuenta. */
  comidas: number;
}

/** Sube a la unidad que se compra: piezas enteras, y gramos a la decena. */
function redondearCompra(gramos: number, pieza?: number): { cantidad: number; piezas?: number } {
  if (pieza && pieza > 0) {
    const piezas = Math.max(1, Math.ceil(gramos / pieza - 0.05));
    return { cantidad: Math.round(piezas * pieza), piezas };
  }
  if (gramos < 10) return { cantidad: Math.ceil(gramos) };
  return { cantidad: Math.ceil(gramos / 10) * 10 };
}

export function listaDeLaCompra(
  menu: MenuSemana | undefined,
  plan: Plan | undefined,
  recetas: Receta[],
  foods: Alimento[],
): ListaCompra {
  if (!menu || !plan) return { lineas: [], comidas: 0 };

  const porId = new Map(foods.map((f) => [f.id, f]));
  const acumulado = new Map<
    string,
    {
      nombre: string;
      foodId?: string;
      grupo?: string;
      gramos: number;
      veces: number;
      unidad: string;
      sinEnlazar?: boolean;
      alGusto?: boolean;
    }
  >();
  let comidas = 0;

  for (const fecha of diasDeLaSemana(menu.inicio)) {
    const dia = menu.dias?.[fecha];
    if (!dia) continue;

    /**
     * El tipo de día decide las cantidades. Si ella no dijo cuál toca, se usa
     * el primero de su plan: es lo mismo que ve al abrir la app ese día.
     */
    const dayType: DayType | undefined =
      plan.dayTypes.find((d) => d.id === dia.dayTypeId) ?? plan.dayTypes[0];
    if (!dayType) continue;

    for (const [mealId, recetaId] of Object.entries(dia.comidas ?? {})) {
      const receta = recetas.find((r) => r.id === recetaId);
      if (!receta) continue;
      comidas += 1;

      const escalada = scaleRecipe(receta, dayType.grid[mealId] ?? {}, foods);

      for (const ing of escalada.ingredientes) {
        const food = ing.foodId ? porId.get(ing.foodId) : undefined;
        const esVerdura = ing.grupo === 'verduras';
        const sinGramos = ing.cantidad_final == null || !(ing.cantidad_final > 0);

        // La verdura y lo que va «al gusto» se cuentan por veces, no por peso.
        if (esVerdura || sinGramos) {
          const clave = `gusto:${(food?.nombre ?? ing.nombre).toLowerCase()}`;
          const ya = acumulado.get(clave);
          acumulado.set(clave, {
            nombre: food?.nombre ?? ing.nombre,
            foodId: ing.foodId,
            grupo: ing.grupo,
            gramos: 0,
            veces: (ya?.veces ?? 0) + 1,
            unidad: '',
            alGusto: true,
          });
          continue;
        }

        /**
         * De cocido a crudo: la receta habla de lo que se come, la lista de lo
         * que se compra. Sin la equivalencia se deja tal cual, que inventarla
         * sería peor que quedarse corto.
         */
        let gramos = ing.cantidad_final as number;
        if (food?.equivalencia_cocido && food.gramos > 0) {
          const deCocidoACrudo = food.gramos / food.equivalencia_cocido;
          if (deCocidoACrudo > 0 && deCocidoACrudo < 1) gramos *= deCocidoACrudo;
        }

        const clave = food ? `f:${food.id}` : `n:${ing.nombre.trim().toLowerCase()}`;
        const ya = acumulado.get(clave);
        acumulado.set(clave, {
          nombre: food?.nombre ?? ing.nombre,
          foodId: food?.id,
          grupo: ing.grupo,
          gramos: (ya?.gramos ?? 0) + gramos,
          veces: (ya?.veces ?? 0) + 1,
          unidad: ing.unidad || food?.unidad || 'g',
          sinEnlazar: !food,
        });
      }
    }
  }

  const lineas: LineaCompra[] = [...acumulado.entries()].map(([clave, v]) => {
    const food = v.foodId ? porId.get(v.foodId) : undefined;
    const seccion = seccionDe(food?.grupo ?? v.grupo);

    if (v.alGusto)
      return {
        clave,
        seccion,
        foodId: v.foodId,
        nombre: v.nombre,
        cantidad: 0,
        unidad: '',
        veces: v.veces,
        alGusto: true,
      };

    const pieza = food ? gramosPorPieza(food) : undefined;
    const { cantidad, piezas } = redondearCompra(v.gramos, pieza);
    return {
      clave,
      seccion,
      foodId: v.foodId,
      nombre: v.nombre,
      cantidad,
      unidad: v.unidad,
      piezas,
      veces: v.veces,
      sinEnlazar: v.sinEnlazar,
    };
  });

  /*
   * Primero lo que se pesa, luego lo que va al gusto y al final lo que no se
   * ha podido enlazar: eso último es lo que ella tiene que mirar con calma.
   */
  lineas.sort((a, b) => {
    const orden = (l: LineaCompra) => (l.sinEnlazar ? 2 : l.alGusto ? 1 : 0);
    if (orden(a) !== orden(b)) return orden(a) - orden(b);
    if (a.seccion !== b.seccion)
      return SECCIONES.indexOf(a.seccion) - SECCIONES.indexOf(b.seccion);
    return a.nombre.localeCompare(b.nombre);
  });

  return { lineas, comidas };
}

/**
 * Lo mismo leído por receta en vez de por día: «pollo al horno ×3». Es la
 * cabeza del batch cooking, y sale del mismo menú sin guardar nada nuevo.
 */
export function vecesPorReceta(
  menu: MenuSemana | undefined,
  recetas: Receta[],
): { receta: Receta; veces: number }[] {
  if (!menu) return [];
  const cuenta = new Map<string, number>();

  for (const fecha of diasDeLaSemana(menu.inicio))
    for (const recetaId of Object.values(menu.dias?.[fecha]?.comidas ?? {}))
      cuenta.set(recetaId, (cuenta.get(recetaId) ?? 0) + 1);

  return [...cuenta.entries()]
    .map(([id, veces]) => ({ receta: recetas.find((r) => r.id === id), veces }))
    .filter((x): x is { receta: Receta; veces: number } => !!x.receta)
    .sort((a, b) => b.veces - a.veces);
}
