import type { Alimento } from '../types/food';
import type { Avituallamiento, TomaPautada } from '../types/plan';
import type { ExchangeCounts } from './exchanges';
import { EXCHANGE_GROUPS } from '../data/exchangeGroups';
import { hcNeto } from './portions';
import { snapHalf } from './macros';

/**
 * EL AVITUALLAMIENTO NO ES UNA COMIDA: ES UN RITMO
 *
 * Lo que se come encima de la bici no se elige como un plato. Se pauta en
 * **gramos de hidrato por hora** —60 con una sola fuente, hasta 90 mezclando
 * glucosa y fructosa— y se reparte a lo largo de la salida, empezando en los
 * primeros veinte minutos.
 *
 * Por eso aquí no hay recetas ni combinaciones cerradas. Hay un objetivo en
 * gramos y las fuentes que ella le monte en la despensa de esa comida: geles,
 * isotónica, dátiles, plátano. La clienta suma unidades reales hasta llegar.
 *
 * DOS FORMAS DE PAUTARLO, Y NO SON LO MISMO
 * =========================================
 * **Total** vale para quien sale hora y media y siempre lo mismo. **Por hora**
 * es lo que hace falta en cuanto la salida se alarga: 60 g para una salida de
 * dos horas y media no es su avituallamiento, son sus primeros cuarenta y cinco
 * minutos. La diferencia entre una amateur y alguien que compite es
 * exactamente ésa, así que se elige persona a persona.
 *
 * NADA DE BLOQUES REDONDOS
 * ========================
 * Un gel son 25 g, un dátil 15, un bidón 30. Partirlo en unidades de 20 obliga
 * a inventar «1,25 geles», que no existe y no se lleva en el bolsillo del
 * maillot.
 */

/** Los gramos de hidrato de todo el avituallamiento. */
export function gramosDelAvituallamiento(a: Avituallamiento | undefined): number {
  if (!a) return 0;
  if (a.modo === 'hora') return Math.round((a.porHora ?? 0) * (a.horas ?? 0));
  return Math.round(a.gramos ?? 0);
}

/** El ritmo, cuando se pautó por horas. Es lo que decide los avisos. */
export function ritmoDelAvituallamiento(a: Avituallamiento | undefined): number | undefined {
  if (!a || a.modo !== 'hora') return undefined;
  return a.porHora ?? 0;
}

/**
 * A partir de aquí hay que mezclar glucosa y fructosa: van por transportadores
 * distintos y una sola fuente se satura alrededor de un gramo por minuto.
 */
export const RITMO_UNA_FUENTE = 60;

/**
 * Y a partir de aquí hace falta intestino entrenado. No se bloquea —hay quien
 * lo hace y es su trabajo decidirlo— pero se dice, porque es lo que separa a
 * quien compite de quien sale los domingos.
 */
export const RITMO_ELITE = 90;

export function avisoDeRitmo(gh: number | undefined): string {
  if (gh === undefined)
    return 'Un total sirve para salidas cortas y constantes. Para las largas, el ritmo evita quedarse corto.';
  if (gh > RITMO_ELITE)
    return `Por encima de ${RITMO_ELITE} g/h hace falta intestino entrenado: es territorio de élite, no de amateur.`;
  if (gh > RITMO_UNA_FUENTE)
    return `Por encima de ${RITMO_UNA_FUENTE} g/h hay que mezclar glucosa y fructosa: van por transportadores distintos.`;
  return `Hasta ${RITMO_UNA_FUENTE} g/h una sola fuente basta. Empezar en los primeros 20 minutos.`;
}

/**
 * LOS GRAMOS SE PAUTAN, PERO EL DÍA SE MIDE EN PORCIONES
 *
 * El avituallamiento cuenta en el día como todo lo demás —150 g de hidrato son
 * 150 g de hidrato, se coman en la mesa o en la bici—, así que al pautarlo se
 * escriben sus porciones en el reparto de esa comida. Si no, el día de bici
 * saldría corto de carbohidrato en pantalla cuando en realidad no lo está.
 *
 * Van a **azúcares**, que es lo que es un intra-entreno: hidrato simple y de
 * absorción rápida. Si ella prefiere repartirlo de otra manera, toca el reparto
 * a mano después y esto no se lo vuelve a pisar.
 */
export function repartoDelAvituallamiento(a: Avituallamiento | undefined): ExchangeCounts {
  const g = gramosDelAvituallamiento(a);
  if (g <= 0) return {};
  const porciones = snapHalf(g / EXCHANGE_GROUPS.azucares.hc);
  return porciones > 0 ? { azucares: porciones } : {};
}

/** Los gramos de hidrato de UNA medida casera del alimento. */
export function hcDeUnaMedida(food: Alimento): number {
  if (!food.nutrientes || !food.gramos) return 0;
  return (hcNeto(food.nutrientes) * food.gramos) / 100;
}

/**
 * Cuántas unidades lleva puestas de ese alimento. Se guarda en porciones —como
 * todo lo que marca— pero se le enseña en unidades: nadie lleva «2,5 geles».
 */
export function unidadesMarcadas(food: Alimento, porciones: number): number {
  const porUnidad = food.intercambios || 1;
  return porUnidad > 0 ? Math.round(porciones / porUnidad) : 0;
}

/** Los gramos de hidrato que suma lo que lleva marcado en esa comida. */
export function gramosMarcados(
  marcado: Record<string, number>,
  foods: Alimento[],
): number {
  return Object.entries(marcado).reduce((s, [foodId, porciones]) => {
    const food = foods.find((f) => f.id === foodId);
    if (!food || !porciones) return s;
    return s + hcDeUnaMedida(food) * unidadesMarcadas(food, porciones);
  }, 0);
}

/**
 * Si a este ritmo conviene recordarle que mezcle. Se mira lo que ha elegido:
 * si ninguna de sus fuentes aporta fructosa, se lo dice.
 *
 * **Es un recordatorio, no una alarma.** No sabemos la composición exacta de
 * cada gel del mercado: `Alimento.conFructosa` lo marca ella en los productos
 * que da de alta, y sin ninguno marcado el recordatorio sigue siendo válido
 * —«que alguna lleve fructosa»— porque a ese ritmo siempre lo es.
 */
export function convieneMezclar(
  gh: number | undefined,
  marcado: Record<string, number>,
  foods: Alimento[],
): boolean {
  if (!gh || gh <= RITMO_UNA_FUENTE) return false;
  const elegidas = Object.entries(marcado)
    .filter(([, n]) => n > 0)
    .map(([foodId]) => foods.find((f) => f.id === foodId))
    .filter(Boolean) as Alimento[];
  if (!elegidas.length) return false;
  return !elegidas.some((f) => f.conFructosa);
}

/** El margen con el que se da por bueno, el mismo que el del resto del día. */
export const MARGEN = 0.1;

export function comoVa(
  llevaG: number,
  objetivoG: number,
): 'corto' | 'bien' | 'pasado' {
  if (objetivoG <= 0) return 'bien';
  if (llevaG > objetivoG * (1 + MARGEN)) return 'pasado';
  if (llevaG >= objetivoG * (1 - MARGEN)) return 'bien';
  return 'corto';
}

/**
 * EL RELOJ: QUÉ Y CUÁNDO
 *
 * En bici se elige sobre la marcha. Corriendo no: quien no lleva pautado el
 * cuándo o se toma los tres geles en la última media hora o no se toma
 * ninguno. Por eso una pauta es una lista de minutos con su producto.
 *
 * Es opcional a propósito. Sin ella, la clienta sigue sumando lo que quiera
 * hasta llegar a los gramos — que es lo que hace falta encima de una bici.
 */

/** Cuánto dura la sesión en minutos, si se sabe. */
export function minutosDeLaSesion(a: Avituallamiento | undefined): number | undefined {
  const h = a?.horas;
  return h && h > 0 ? Math.round(h * 60) : undefined;
}

/** «0:30», «1:05». Los minutos sueltos no se leen en una salida larga. */
export function minutoLegible(minuto: number): string {
  const h = Math.floor(minuto / 60);
  const m = minuto % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * REPARTIR LAS TOMAS SOLAS
 *
 * Con los gramos pautados y lo que aporta una medida ya está todo: 90 g con
 * geles de 25 son cuatro tomas. Lo que faltaba era el cuándo, y eso es una
 * división — el trabajo que ella hacía con la calculadora.
 *
 * Se reparten en `duración / (n+1)`, así que la primera cae pronto —en una
 * salida de hora y media con cuatro geles, a los veinte minutos— y la última
 * no queda pegada al final. Empezar en los primeros veinte minutos es la
 * recomendación de siempre, y llegar con el último gel a meta no sirve de nada.
 *
 * Redondeado a cinco minutos: nadie mira el reloj para tomarse un gel en el
 * minuto 18.
 */
export function proponerPauta(
  a: Avituallamiento | undefined,
  food: Alimento,
  unidadesPorToma = 1,
): TomaPautada[] {
  const total = gramosDelAvituallamiento(a);
  const minutos = minutosDeLaSesion(a);
  const porToma = hcDeUnaMedida(food) * unidadesPorToma;
  if (!total || !minutos || porToma <= 0) return [];

  const cuantas = Math.max(1, Math.round(total / porToma));
  const cada = minutos / (cuantas + 1);
  return Array.from({ length: cuantas }, (_, i) => ({
    minuto: Math.max(5, Math.round(((i + 1) * cada) / 5) * 5),
    foodId: food.id,
    unidades: unidadesPorToma,
  }));
}

/** Lo que suma la pauta entera, para comprobarla contra lo pautado. */
export function gramosDeLaPauta(pauta: TomaPautada[], foods: Alimento[]): number {
  return pauta.reduce((s, t) => {
    const f = foods.find((x) => x.id === t.foodId);
    return f ? s + hcDeUnaMedida(f) * t.unidades : s;
  }, 0);
}

/**
 * CUÁLES DE LAS TOMAS YA SE HAN HECHO
 *
 * No se guarda «la toma del minuto 30 está hecha»: se guarda lo que ha marcado,
 * como en todo lo demás de la app. Dos geles iguales son dos geles iguales, así
 * que las tomas de ese producto se van dando por hechas **en orden**.
 *
 * Guardar cuál en concreto obligaría a inventar un sitio nuevo donde escribirlo
 * y a que dos pantallas dijeran lo mismo con dos números. Y en gramos —que es
 * lo que importa— da igual cuál de los dos geles se tomó.
 */
export function tomasHechas(
  pauta: TomaPautada[],
  marcado: Record<string, number>,
  foods: Alimento[],
): boolean[] {
  /** Unidades marcadas de cada alimento, que se van gastando por orden. */
  const quedan = new Map<string, number>();
  for (const f of foods) {
    const u = unidadesMarcadas(f, marcado[f.id] ?? 0);
    if (u > 0) quedan.set(f.id, u);
  }

  return pauta.map((t) => {
    const disponibles = quedan.get(t.foodId) ?? 0;
    if (disponibles < t.unidades) return false;
    quedan.set(t.foodId, disponibles - t.unidades);
    return true;
  });
}
