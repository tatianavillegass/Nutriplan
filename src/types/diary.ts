import type { MacroGrams } from './calculations';
import type { Alimento } from './food';

/**
 * REGISTRO DIARIO
 *
 * Lo que el cliente hace cada día: qué tipo de día le toca, qué recetas ha
 * cumplido, qué porciones ha marcado y qué se ha tomado fuera del plan.
 * Es también lo que la nutricionista ve en seguimiento.
 */

export interface Extra {
  id: string;
  nombre: string;
  /** Si viene del catálogo, se recalcula desde sus nutrientes. */
  foodId?: string;
  /** Cantidad en gramos o mililitros. */
  cantidad?: number;
  unidad?: string;
  /** Macros del extra completo (no por 100 g). */
  macros: MacroGrams;
  kcal: number;
  momento?: string;
}

/** mealId → foodId → número de porciones marcadas. */
export type PorcionesMarcadas = Record<string, Record<string, number>>;

/**
 * UN BOCADO (FASE 4)
 *
 * Lo que se apunta cuando ya no hay porciones: un alimento y sus gramos, con
 * los macros que salen de ahí. Tiene la misma forma que un extra, pero vive
 * aparte a propósito: un extra es lo que te has comido **de más** sobre el
 * plan, y en fase 4 no hay plan que superar — todo lo que come es el día.
 * Mezclarlos haría que el resumen del desvío contara como exceso la comida
 * entera.
 */
export interface Bocado {
  id: string;
  nombre: string;
  /** Si viene del catálogo, para poder recalcularlo. */
  foodId?: string;
  /** Gramos o mililitros de lo que se ha comido. */
  cantidad: number;
  unidad?: string;
  /** Macros de esa cantidad, no por 100 g. */
  macros: MacroGrams;
  kcal: number;
  /**
   * En qué comida se lo comió. El día se sigue juzgando entero —lo que manda
   * es el total—, pero apuntar «a secas» obliga a recordar qué has metido ya:
   * por comidas se lee de un vistazo si falta la cena.
   */
  momento?: string;
  /** Hora a la que se apuntó, sólo para ordenarlo. */
  hora?: string;
}

/**
 * UNA COMIDA QUE SE REPITE
 *
 * «Mis pancakes de avena». Quien come casi siempre lo mismo estaba apuntando
 * cinco alimentos con sus gramos cada mañana; con esto son dos toques y, si un
 * día cambia la cantidad, la retoca.
 *
 * Guarda las dos formas de decir lo mismo porque las dos fases apuntan
 * distinto: en fase 4 son gramos (`bocados`) y en fase 3 son porciones
 * marcadas (`porciones`). Se ofrece sólo en la fase en la que se guardó, que
 * es donde significa algo.
 *
 * Se lleva también los alimentos que ella se calculó con la etiqueta: viven en
 * el registro de un día concreto, así que sin esta copia la comida guardada
 * apuntaría a algo que mañana ya no existe.
 */
export interface ComidaGuardada {
  id: string;
  nombre: string;
  /** La comida en la que se guardó: es donde se vuelve a ofrecer. */
  mealId: string;
  bocados?: Bocado[];
  /** foodId → porciones marcadas. */
  porciones?: Record<string, number>;
  alimentos?: Alimento[];
  creada: string;
}

export interface RegistroDia {
  id: string;
  clientId: string;
  /** YYYY-MM-DD */
  fecha: string;
  /** Tipo de día que el cliente ha elegido para esa fecha. */
  dayTypeId?: string;
  /** Fase 1: receta elegida por comida. */
  recetaElegida: Record<string, string>;
  /** Comidas marcadas como hechas. */
  cumplidas: string[];
  /** Fase 3: porciones marcadas, por comida y alimento. */
  porciones: PorcionesMarcadas;
  /** Fase 1: ingredientes cambiados por su equivalente. mealId → ingredienteId → foodId */
  sustituciones: Record<string, Record<string, string>>;
  extras: Extra[];
  /**
   * COMIDAS LIBRES
   *
   * Comer fuera no se mide. Poner un número a una hamburguesa que no has
   * cocinado tú no informa de nada: sólo da sensación de control, y a quien
   * tiene mala relación con la comida esa sensación es justo lo que le hace
   * daño. Lo que sí sirve es la frecuencia, y eso se apunta con un botón.
   *
   * mealId → nota opcional de la clienta. Sin macros, sin calorías, sin
   * puntuarse. Si quiere contar algo, escribe; si no, marca y ya.
   */
  libres?: Record<string, { nota?: string }>;
  /**
   * Metas diarias cumplidas: ids de `Client.metas`. Van aquí y no en la ficha
   * porque son de ese día concreto, como las comidas hechas.
   */
  metas?: string[];
  /**
   * Alimentos que la clienta ha definido con la calculadora: la granola del
   * armario que no está en su despensa. Viven aquí y no en el catálogo de la
   * nutricionista porque son de ese día y de esa persona. Se pasan junto al
   * catálogo a todo lo que cuenta porciones, así que funcionan igual que
   * cualquier otro alimento sin tocar ni una cuenta.
   */
  alimentosPropios?: Alimento[];
  /**
   * Fase 4: lo que ha comido hoy, en gramos. No hay comidas ni porciones que
   * marcar, así que esta lista es el día entero.
   */
  bocados?: Bocado[];
  /**
   * SUS COMIDAS HABITUALES
   *
   * Van en el registro del día en que las guardó porque el registro es lo
   * único que sube el cliente: metidas en su ficha, la nutricionista se las
   * pisaría al guardar cualquier otra cosa. La lista se junta leyendo todos
   * sus días, y borrar una se apunta como tal —`comidasBorradas`— porque el
   * día que la creó no se puede reescribir desde hoy.
   */
  comidasGuardadas?: ComidaGuardada[];
  comidasBorradas?: string[];
  /**
   * Reto: lo que hizo antes de empezar —medirse, la foto, leerse la guía—. Va
   * aquí por lo mismo que todo lo demás que escribe ella: el registro es lo
   * único que sube su app. Se junta leyendo sus días.
   */
  /** Reto: entrenos que ha dado por hechos. */
  entrenos?: string[];
  preparacion?: {
    hechos: ('medidas' | 'foto' | 'guia')[];
    cintura?: number;
    cadera?: number;
    foto?: string;
  };
  notas?: string;
}

export function registroVacio(clientId: string, fecha: string, id: string): RegistroDia {
  return {
    id,
    clientId,
    fecha,
    recetaElegida: {},
    cumplidas: [],
    porciones: {},
    sustituciones: {},
    extras: [],
    libres: {},
    metas: [],
  };
}

/** ¿Esta comida se la ha tomado libre? */
export function esComidaLibre(registro: RegistroDia | undefined, mealId: string): boolean {
  return !!registro?.libres?.[mealId];
}

/** Cuántas comidas libres hay en un puñado de días. Es el dato que importa. */
export function contarLibres(registros: RegistroDia[]): number {
  return registros.reduce((s, r) => s + Object.keys(r.libres ?? {}).length, 0);
}

export const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
export const DIAS_LARGOS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Fecha local en formato YYYY-MM-DD, sin líos de zona horaria. */
export function claveFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function desdeClave(clave: string): Date {
  const [y, m, d] = clave.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function sumarDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Lunes de la semana a la que pertenece una fecha. */
export function inicioSemana(d: Date): Date {
  const x = new Date(d);
  const dia = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dia);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function fechaLegible(clave: string): string {
  const d = desdeClave(clave);
  return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
