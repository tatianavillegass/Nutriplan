import type { Sexo, BmrFormulaId } from './calculations';
import type { Alergeno } from './food';

export type Objetivo = 'perder_peso' | 'mantenimiento' | 'ganancia_muscular';

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
  /** La siguiente cita, para que las dos la tengan delante. */
  cita?: Cita;
  /** Lo que tiene contratado. Sólo lo ve la nutricionista. */
  tarifa?: Tarifa;
  /** Lo que ha ido pagando. Sólo lo ve la nutricionista. */
  pagos?: Pago[];
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
