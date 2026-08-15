import type {
  EntrenoDeReto,
  EstadoReto,
  RecetaDeReto,
  Reto,
} from "../types/reto";
import type { MealSlot } from "../types/food";
import { diaAnterior } from "./racha";

/**
 * EL CALENDARIO DEL RETO
 *
 * Todo gira alrededor de una sola cuenta: en qué día vamos. De ahí salen las
 * recetas que están abiertas, lo que queda y el texto que ve la participante.
 *
 * El primer día es el 1, no el 0: nadie dice «hoy es el día cero del reto».
 */

/** Días enteros entre dos fechas ISO, sin líos de zona horaria. */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(
    Number(desde.slice(0, 4)),
    Number(desde.slice(5, 7)) - 1,
    Number(desde.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(hasta.slice(0, 4)),
    Number(hasta.slice(5, 7)) - 1,
    Number(hasta.slice(8, 10)),
  );
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * En qué día del reto estamos. Antes de empezar da 0; pasado el último, da un
 * número mayor que la duración. Quien lo use decide qué hacer con eso.
 */
export function diaDelReto(reto: Reto, hoy: string): number {
  if (!reto.fechaInicio) return 0;
  return diasEntre(reto.fechaInicio, hoy) + 1;
}

export function estadoDelReto(reto: Reto, hoy: string): EstadoReto {
  const dia = diaDelReto(reto, hoy);
  if (dia < 1) return "proximo";
  return dia > reto.dias ? "terminado" : "en-marcha";
}

/** El último día, para poder enseñarlo al apuntarse. */
export function fechaFinal(reto: Reto): string {
  if (!reto.fechaInicio || reto.dias < 1) return reto.fechaInicio;
  const [a, m, d] = reto.fechaInicio.split("-").map(Number);
  const fin = new Date(Date.UTC(a, m - 1, d));
  fin.setUTCDate(fin.getUTCDate() + reto.dias - 1);
  return fin.toISOString().slice(0, 10);
}

/** Cuántos días quedan, contando hoy. Terminado o sin empezar, 0. */
export function diasQueQuedan(reto: Reto, hoy: string): number {
  const dia = diaDelReto(reto, hoy);
  if (dia < 1 || dia > reto.dias) return 0;
  return reto.dias - dia + 1;
}

/**
 * LAS RECETAS ABIERTAS HOY
 *
 * Todo lo que se abrió hasta hoy sigue abierto: el reto suma, no rota. Quien
 * encontró su desayuno la primera semana puede repetirlo el día 28.
 *
 * Antes de empezar no hay ninguna: el reto empieza el día que empieza.
 */
export function recetasAbiertas(reto: Reto, hoy: string): RecetaDeReto[] {
  const dia = diaDelReto(reto, hoy);
  if (dia < 1) return [];
  return reto.recetas.filter((r) => r.desdeDia <= dia);
}

/** Las de una comida concreta, que es como se piden en la pantalla. */
export function recetasAbiertasDe(
  reto: Reto,
  hoy: string,
  slot: MealSlot,
): RecetaDeReto[] {
  return recetasAbiertas(reto, hoy).filter((r) => r.slot === slot);
}

/** Los entrenos abiertos hoy. Misma regla que las recetas: lo abierto suma. */
export function entrenosAbiertos(reto: Reto, hoy: string): EntrenoDeReto[] {
  const dia = diaDelReto(reto, hoy);
  if (dia < 1) return [];
  return (reto.entrenos ?? [])
    .filter((e) => e.desdeDia <= dia)
    .sort((a, b) => a.desdeDia - b.desdeDia);
}

/** Las que se abren mañana, para poder decir «el lunes tienes tres nuevas». */
export function proximaApertura(
  reto: Reto,
  hoy: string,
): { dia: number; cuantas: number } | undefined {
  const dia = Math.max(1, diaDelReto(reto, hoy));
  const siguientes = reto.recetas
    .filter((r) => r.desdeDia > dia)
    .sort((a, b) => a.desdeDia - b.desdeDia);
  if (!siguientes.length) return undefined;
  const proximo = siguientes[0].desdeDia;
  return {
    dia: proximo,
    cuantas: siguientes.filter((r) => r.desdeDia === proximo).length,
  };
}

/** El reto en el que está una persona, si está en alguno en marcha. */
export function retoDe(
  retos: Reto[],
  clientId: string,
  hoy: string,
): Reto | undefined {
  const suyos = retos.filter((r) => r.participantes.includes(clientId));
  return (
    suyos.find((r) => estadoDelReto(r, hoy) === "en-marcha") ??
    suyos.find((r) => estadoDelReto(r, hoy) === "proximo")
  );
}

/** «Día 5 de 30», o lo que toque según el estado. */
export function textoDelDia(reto: Reto, hoy: string): string {
  const estado = estadoDelReto(reto, hoy);
  if (estado === "proximo") {
    const faltan = diasEntre(hoy, reto.fechaInicio);
    if (faltan === 1) return "Empieza mañana";
    return faltan <= 0 ? "Empieza hoy" : `Empieza en ${faltan} días`;
  }
  if (estado === "terminado") return `Terminado · ${reto.dias} días`;
  return `Día ${diaDelReto(reto, hoy)} de ${reto.dias}`;
}

/** El día anterior, reexportado: lo usan las pantallas del reto. */
export { diaAnterior };
