import type { MacroGrams } from './calculations';

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
  };
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
