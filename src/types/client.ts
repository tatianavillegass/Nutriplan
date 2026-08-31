import type { Sexo, BmrFormulaId } from './calculations';
import type { Alergeno } from './food';

export type Objetivo = 'perder_peso' | 'mantenimiento' | 'ganancia_muscular';

/** Un programa con fecha de inicio y fin: RESET 90 y los que vengan. */
export interface Programa {
  nombre: string;
  /** Fecha ISO en la que empieza. */
  inicio: string;
  /** Cuántos días dura: 90 en RESET 90. */
  dias: number;
}

export interface Client {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  /**
   * YYYY-MM-DD. Cuando está, la edad se calcula sola y sube ella sola cada
   * cumpleaños: no hay que acordarse de actualizarla al año siguiente.
   */
  fechaNacimiento?: string;
  /** Edad escrita a mano. Sólo se usa si no hay fecha de nacimiento. */
  edad: number;
  /** Fecha de alta: desde cuándo trabaja contigo. */
  fechaAlta?: string;
  /**
   * Hasta cuándo tiene acceso. Sin fecha, el acceso es abierto: se le da de
   * baja poniendo una fecha, y se reactiva quitándola o alargándola.
   */
  accesoHasta?: string;
  peso: number;   // kg
  altura: number; // cm
  sexo: Sexo;
  activityFactorId: string;
  objetivo: Objetivo;
  /** Multiplicador de ajuste elegido por la nutricionista (0.70 – 1.20 o libre). */
  goalMultiplier: number;
  /** Fórmula de TMB elegida; 'media' por defecto. */
  bmrFormula: BmrFormulaId;
  alergias: Alergeno[];
  /** Ids de patologías/condiciones que bloquean alimentos (ver data/patologias.ts). */
  patologias?: string[];
  /** Ids de alimentos que el cliente no quiere comer. */
  aversiones?: string[];
  /** Ids de alimentos que le gustan: suben en el recomendador de recetas. */
  preferidos?: string[];
  preferencias: string[];   // tags que alimentan el matcher de recetas
  /** Fórmula de % graso elegida para los informes de antropometría. */
  formulaGrasa?: 'faulkner' | 'yuhasz' | 'durnin_womersley';
  /**
   * Sobre qué peso se calculan los gramos por kilo: el total, el ajustado o la
   * masa libre de grasa. Ver `utils/pesoReferencia.ts` — pautar 2 g/kg sobre
   * el peso total sobreestima en cuanto hay mucha grasa.
   *
   * Sólo afecta a los g/kg. Las calorías salen del gasto, y el gasto se
   * calcula con el peso real: mover un cuerpo pesa lo que pesa.
   */
  basePeso?: 'total' | 'ajustado' | 'magra';
  /**
   * SÓLO DEL RETO
   *
   * Se marca al dar de alta a alguien que llegó por el enlace público. Por
   * dentro es una clienta como las demás —así hereda acceso, plan, registro y
   * rachas sin inventar nada—, pero no sale en la lista de la consulta: con
   * veinte participantes, la lista de tus clientas dejaba de servir para
   * encontrar a tus clientas.
   *
   * Si alguna se queda de consulta, se le quita la marca y pasa a la lista.
   */
  soloReto?: boolean;
  notas?: string;
  /**
   * RECURSOS HABILITADOS
   *
   * Los recursos se escriben una vez para toda la consulta, pero no todos
   * valen para todo el mundo ni desde el primer día: la guía de raciones se da
   * al empezar y la de comer fuera cuando ya hay costumbre.
   *
   * Sin lista, no ve ninguno. Se abren desde la pestaña de entrega.
   */
  recursos?: string[];
  /** Costumbres que se marcan cada día: 10.000 pasos, 2 l de agua. */
  metas?: Meta[];
  /**
   * EL BOTÓN «PAUSA»
   *
   * Trabajar el hambre emocional no le hace falta a todo el mundo, y a quien no
   * le hace falta, ponerle un botón de emociones al lado de la comida le mete
   * una pregunta que no tenía. Por eso se enciende persona a persona.
   */
  pausa?: boolean;
  /**
   * QUÉ HACER EN VEZ DE COMER
   *
   * La lista de actividades de la guía. Se le ofrecen **tres**, no la lista
   * entera: a las once de la noche y con el impulso encima, veinte opciones es
   * lo mismo que ninguna. Sin lista se usan unas de partida.
   */
  actividades?: string[];
  /**
   * UN RETO CONSIGO MISMA
   *
   * RESET 90 y los que vengan: consulta individual de siempre, pero con un
   * principio, un final y la sensación de estar recorriendo algo. No es un
   * `Reto` —no hay grupo, ni muro, ni recetas compartidas— sino tres datos en
   * su ficha de los que sale todo: el chip para distinguirla en la lista, el
   * contador por meses en su app y los hitos. Ver `utils/programa.ts`.
   */
  programa?: Programa;
  /** La siguiente cita, para que las dos la tengan delante. */
  cita?: Cita;
  /** Lo que tiene contratado. Sólo lo ve la nutricionista. */
  tarifa?: Tarifa;
  /** Lo que ha ido pagando. Sólo lo ve la nutricionista. */
  pagos?: Pago[];
  /**
   * Si la ves online o en el consultorio. Vale para todas sus consultas salvo
   * que en una se diga otra cosa.
   */
  modalidad?: Modalidad;
  /** Los bonos que ha contratado, del más viejo al más nuevo. */
  bonos?: Bono[];
  /** Las consultas y llamadas ya hechas. Se marcan a mano. */
  sesiones?: Sesion[];
  createdAt: string;
  updatedAt: string;
}

/**
 * UNA META DIARIA
 *
 * No es comida: es la costumbre de alrededor, que es la mitad del resultado.
 * Se marca con un gesto y no pide número — «2 litros» es la meta, no hay que
 * apuntar cuántos vasos.
 *
 * Las metas hacen racha aparte de las comidas a propósito. Un día de poca agua
 * no puede tirar por tierra veinte días de comer bien, ni al revés: son dos
 * costumbres distintas y mezclarlas sólo sirve para castigar dos veces.
 */
export interface Meta {
  id: string;
  /** Como se la lee la clienta: «Beber 2 litros de agua». */
  texto: string;
  /** Se puede jubilar una meta sin borrar el historial de días cumplidos. */
  activa: boolean;
  createdAt: string;
}

export const MODOS_CITA = ['consulta', 'videollamada', 'llamada'] as const;
export type ModoCita = (typeof MODOS_CITA)[number];

export const LABEL_MODO_CITA: Record<ModoCita, string> = {
  consulta: 'En consulta',
  videollamada: 'Videollamada',
  llamada: 'Llamada',
};

export interface Cita {
  /** YYYY-MM-DD */
  fecha: string;
  /** HH:MM en 24 h. */
  hora?: string;
  /** Cuántos minutos dura, para el archivo de calendario. */
  duracionMin?: number;
  modo: ModoCita;
  /** Dirección si es en consulta, o el enlace si es videollamada. */
  donde?: string;
  nota?: string;
}

export const PERIODICIDADES = ['mensual', 'trimestral', 'sesion', 'paquete'] as const;
export type Periodicidad = (typeof PERIODICIDADES)[number];

export const LABEL_PERIODICIDAD: Record<Periodicidad, string> = {
  mensual: 'Al mes',
  trimestral: 'Al trimestre',
  sesion: 'Por sesión',
  paquete: 'Paquete cerrado',
};

export interface Tarifa {
  nombre: string;
  importe: number;
  periodicidad: Periodicidad;
  /** Símbolo, tal cual se escribe: €, $, COP… */
  moneda?: string;
}

export interface Pago {
  id: string;
  /** YYYY-MM-DD */
  fecha: string;
  importe: number;
  concepto?: string;
  metodo?: string;
  /**
   * De qué bono es este pago. Sin esto sólo se podía sumar lo cobrado en
   * total; con esto se sabe cuánto falta de lo que contrató.
   */
  bonoId?: string;
}

/**
 * UN BONO: LO QUE CONTRATÓ
 *
 * Hasta ahora había una tarifa —cuánto cuesta— y unos pagos sueltos, pero
 * nadie sabía qué había comprado ni cuánto le quedaba. Y ésa es justo la
 * pregunta de la consulta: «¿a ésta cuándo le toca renovar?».
 *
 * ESTO CAMBIA UNA REGLA ANTERIOR, Y A PROPÓSITO
 * =============================================
 * Estaba escrito que la app no calcularía deudas, porque no sabía qué se pactó
 * de palabra y un «debe X» en rojo sería un número inventado. Con un bono ya
 * no lo es: el importe lo escribe ella. «Faltan 90 €» es una resta.
 *
 * La regla vieja sigue valiendo para quien sólo tiene tarifa y pagos sueltos:
 * ahí seguimos sin inventar nada.
 */
export interface Bono {
  id: string;
  /** Como se lo vende: «Online trimestral». */
  nombre: string;
  /**
   * Lo que le cobra de verdad. Lo pagado sale de los pagos con este `bonoId`.
   */
  importe: number;
  /**
   * EL DESCUENTO VIVE EN EL BONO, NO EN LA CLIENTA
   *
   * Su tarifa normal, cuando este bono va rebajado. La misma persona puede
   * entrar con descuento por una derivación y renovar al precio de siempre, así
   * que marcar la ficha entera se quedaría corto y además mentiría al año
   * siguiente. Con el precio de lista aquí se sabe cuántos bonos llevan
   * descuento y **cuánto has dejado de cobrar**, que es el dato que falta.
   */
  precioBase?: number;
  /** Por qué se le hizo: «derivación de Marta». */
  motivoDescuento?: string;
  moneda?: string;
  /** Cuándo lo contrató. */
  inicio: string; // YYYY-MM-DD
  /**
   * Hasta cuándo vale, si se pactó un plazo. Un bono de tres meses caduca
   * aunque queden sesiones: lo que llegue antes es lo que manda.
   */
  vence?: string; // YYYY-MM-DD
  /**
   * Qué incluye, en las líneas que ella quiera: «3 consultas», «3 llamadas».
   * No hay una lista cerrada de tipos porque cada quien vende lo suyo.
   */
  incluye: LineaDeBono[];
  /** Se cierra a mano cuando se da por terminado, aunque sobre algo. */
  cerrado?: boolean;
  nota?: string;
}

export interface LineaDeBono {
  id: string;
  /** «Consulta», «Llamada», «Revisión de analítica»… */
  concepto: string;
  /** Cuántas incluye el bono. */
  cuantas: number;
}

/**
 * UNA SESIÓN HECHA
 *
 * Se marca a mano, al colgar. Se pensó en darla por consumida cuando pasara la
 * fecha de la cita, pero entonces una cita anulada o movida contaría igual y
 * el «2 de 3» mentiría — que es justo lo único que este contador no se puede
 * permitir.
 */
export type Modalidad = 'online' | 'presencial';

export const LABEL_MODALIDAD: Record<Modalidad, string> = {
  online: 'Online',
  presencial: 'Presencial',
};

export interface Sesion {
  id: string;
  /** YYYY-MM-DD */
  fecha: string;
  /**
   * Sólo cuando esa consulta fue distinta de lo habitual de la clienta. Casi
   * nadie alterna, así que preguntarlo en cada sesión era un clic de más que
   * se acaba dejando sin pulsar; lo normal se hereda de su ficha.
   */
  modalidad?: Modalidad;
  /** De qué bono se descuenta. Sin bono, es una sesión suelta. */
  bonoId?: string;
  /**
   * Lo que vale, cuando no cuelga de ningún bono: una primera visita, una
   * revisión, alguien que paga por sesión. En un bono no hace falta —el precio
   * se reparte solo— pero una consulta suelta valía cero y salía como si no
   * hubieras trabajado, que es justo lo contrario de la verdad.
   */
  importe?: number;
  /** Cuál de las líneas del bono consume. */
  lineaId?: string;
  nota?: string;
}

/** Las metas que hay que marcar hoy: las jubiladas no cuentan. */
export function metasActivas(client: Pick<Client, 'metas'>): Meta[] {
  return (client.metas ?? []).filter((m) => m.activa && m.texto.trim());
}

/** Los recursos habilitados a esta clienta. Sin lista, ninguno. */
export function recursosDeCliente(client: Pick<Client, 'recursos'>): string[] {
  return client.recursos ?? [];
}

/** Años cumplidos a una fecha. Cuenta el mes y el día, no sólo el año. */
export function edadEn(fechaNacimiento: string, hoy = new Date()): number | undefined {
  const n = new Date(fechaNacimiento);
  if (Number.isNaN(n.getTime())) return undefined;
  let años = hoy.getFullYear() - n.getFullYear();
  const mes = hoy.getMonth() - n.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < n.getDate())) años--;
  return años >= 0 && años < 130 ? años : undefined;
}

/**
 * La edad que se usa en todos los cálculos: la de la fecha de nacimiento si
 * la hay, y si no la que se escribió a mano.
 */
export function edadDe(
  client: Pick<Client, 'fechaNacimiento' | 'edad'>,
  hoy = new Date(),
): number {
  const calculada = client.fechaNacimiento ? edadEn(client.fechaNacimiento, hoy) : undefined;
  return calculada ?? client.edad;
}

export type EstadoAcceso = 'activo' | 'termina_pronto' | 'caducado';

/** Cómo está el acceso del cliente hoy. Sin fecha de fin, siempre activo. */
export function estadoAcceso(
  client: Pick<Client, 'accesoHasta'>,
  hoy = new Date(),
): { estado: EstadoAcceso; diasRestantes?: number } {
  if (!client.accesoHasta) return { estado: 'activo' };
  const fin = new Date(`${client.accesoHasta}T23:59:59`);
  if (Number.isNaN(fin.getTime())) return { estado: 'activo' };
  // Días enteros que quedan: el 14 visto el 9 son 5 días, no 6.
  const dias = Math.floor((fin.getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return { estado: 'caducado', diasRestantes: dias };
  return { estado: dias <= 7 ? 'termina_pronto' : 'activo', diasRestantes: dias };
}

export const OBJETIVO_LABELS: Record<Objetivo, string> = {
  perder_peso: 'Perder peso',
  mantenimiento: 'Mantenimiento',
  ganancia_muscular: 'Ganancia de masa muscular',
};
