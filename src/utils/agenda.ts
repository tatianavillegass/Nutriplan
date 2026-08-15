import type { Cita, Pago, Tarifa } from "../types/client";
import { LABEL_MODO_CITA } from "../types/client";

/**
 * CITAS Y PAGOS
 *
 * Lo administrativo de una consulta: cuándo es la próxima, qué tiene
 * contratado y qué ha ido pagando. No toca nada del plan ni de la comida.
 *
 * El calendario se resuelve con un archivo .ics, que es el formato que
 * entienden Google, Apple y Outlook por igual. Conectar la cuenta de Google
 * pediría permisos, claves y una pantalla de conexión para ahorrar dos clics:
 * no compensa mientras sean cuatro citas al mes.
 */

const DURACION_POR_DEFECTO = 60;

/** Fecha y hora de una cita como objeto Date, en la hora local de quien mira. */
export function momentoDeCita(cita: Cita): Date | undefined {
  if (!cita.fecha) return undefined;
  const [a, m, d] = cita.fecha.split("-").map(Number);
  const [hh, mm] = (cita.hora ?? "00:00").split(":").map(Number);
  const fecha = new Date(a, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

/** ¿Ya pasó? Sirve para dejar de enseñarla y recordar poner la siguiente. */
export function citaPasada(cita: Cita, ahora = new Date()): boolean {
  const cuando = momentoDeCita(cita);
  if (!cuando) return false;
  const fin = new Date(
    cuando.getTime() + (cita.duracionMin ?? DURACION_POR_DEFECTO) * 60000,
  );
  return fin < ahora;
}

/** «martes 19 de agosto a las 17:30» */
export function citaLegible(cita: Cita): string {
  const cuando = momentoDeCita(cita);
  if (!cuando) return "";
  const dia = cuando.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return cita.hora ? `${dia} a las ${cita.hora}` : dia;
}

/** Escapa lo que exige el formato: comas, puntos y comas y saltos de línea. */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/[,;]/g, (c) => `\\${c}`)
    .replace(/\n/g, "\\n");
}

function comoUTC(fecha: Date): string {
  return fecha
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * El archivo de calendario. Se descarga y al abrirlo lo recoge la aplicación
 * que la persona ya use: Google, Apple o el correo del trabajo.
 */
export function citaComoIcs(cita: Cita, titulo: string): string {
  const inicio = momentoDeCita(cita);
  if (!inicio) return "";
  const fin = new Date(
    inicio.getTime() + (cita.duracionMin ?? DURACION_POR_DEFECTO) * 60000,
  );

  const lugar =
    cita.donde ?? (cita.modo === "consulta" ? "" : LABEL_MODO_CITA[cita.modo]);
  const descripcion = [LABEL_MODO_CITA[cita.modo], cita.nota]
    .filter(Boolean)
    .join(" · ");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NutriPlan//ES",
    "BEGIN:VEVENT",
    `UID:${comoUTC(inicio)}-nutriplan@local`,
    `DTSTAMP:${comoUTC(new Date())}`,
    `DTSTART:${comoUTC(inicio)}`,
    `DTEND:${comoUTC(fin)}`,
    `SUMMARY:${escapar(titulo)}`,
    lugar ? `LOCATION:${escapar(lugar)}` : "",
    descripcion ? `DESCRIPTION:${escapar(descripcion)}` : "",
    // Un aviso el día antes: es cuando aún se puede mover.
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapar(titulo)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/** Para poner en un enlace de descarga sin tocar el disco. */
export function icsComoEnlace(ics: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export interface ResumenPagos {
  total: number;
  ultimo?: Pago;
  /** Lo que costaría un periodo, para comparar de un vistazo. */
  tarifa?: number;
  moneda: string;
}

/**
 * Se suma y se enseña el último, y nada más. Aquí no se calculan deudas: la
 * app no sabe cuántos periodos han pasado ni qué se pactó de palabra, y un
 * número inventado en rojo sería peor que no poner nada.
 */
export function resumenDePagos(
  pagos: Pago[] = [],
  tarifa?: Tarifa,
): ResumenPagos {
  const ordenados = [...pagos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    total: pagos.reduce((s, p) => s + (p.importe || 0), 0),
    ultimo: ordenados[ordenados.length - 1],
    tarifa: tarifa?.importe,
    moneda: tarifa?.moneda?.trim() || "€",
  };
}
