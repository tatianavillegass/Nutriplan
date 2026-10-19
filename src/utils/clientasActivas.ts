import { estadoAcceso, type Client } from "../types/client";
import { ingresosDelMes, mesDe } from "./finanzas";

/**
 * CUÁNTAS ESTÁN ACTIVAS, Y CUÁNTO DEJA CADA UNA
 *
 * La lista decía «24 clientes» y ese número no sirve para decidir nada: dentro
 * están las de esta semana y las que se fueron en marzo. Lo que ella necesita
 * saber es a cuántas personas está atendiendo ahora y cuánto le deja cada una,
 * porque es la cuenta que decide si suben los precios o si caben más clientas.
 *
 * ACTIVA ES «TIENE EL ACCESO VIGENTE»
 * ===================================
 * De las tres formas posibles se eligió ésta porque es la única que ella ya
 * mantiene al día: el acceso se alarga al renovar y se deja caducar cuando
 * alguien lo deja, así que el número sale solo y no hay un campo nuevo que
 * acordarse de rellenar. Sin `accesoHasta` el acceso es abierto, y eso cuenta
 * como activa — es lo que ya dice `estadoAcceso`, y tener dos definiciones de
 * «activa» en la misma app sería peor que cualquiera de las dos.
 *
 * Las otras dos se descartaron por lo que esconden: «con bono abierto» deja
 * fuera a quien paga por sesión, y «con movimiento en los últimos 60 días»
 * se hunde en agosto sin que nadie se haya ido.
 *
 * EL € POR CLIENTA ES DEL MES, Y SE DIVIDE POR LAS DE HOY
 * ======================================================
 * Lo cobrado este mes entre las activas de hoy. **Es una aproximación y hay
 * que decirlo**: lo honesto del todo sería contar las que estaban activas en
 * cada día del mes, pero `accesoHasta` sólo guarda el final, así que de un
 * mes pasado no se puede reconstruir quién lo estaba. Para el mes en curso
 * —que es el que mira— las de hoy y las del mes son casi las mismas.
 *
 * Por eso tampoco se pinta esta cifra de meses viejos: el divisor sería el de
 * hoy y el dividendo el de entonces, y eso es un número que miente.
 */

/** Las que tienen el acceso vigente hoy: ni caducado ni dado de baja. */
export function activas(clientes: Client[], hoy = new Date()): Client[] {
  return clientes.filter((c) => estadoAcceso(c, hoy).estado !== "caducado");
}

/** A cuántas se les acabó el acceso. El resto de «24 clientes». */
export function inactivas(clientes: Client[], hoy = new Date()): number {
  return clientes.length - activas(clientes, hoy).length;
}

export interface PorClienta {
  /** Cuántas están activas hoy. */
  activas: number;
  /** Lo cobrado en ese mes, de todas: también de las que ya no están. */
  cobrado: number;
  /**
   * Lo cobrado entre las activas. **Cero activas da cero**, no infinito ni un
   * hueco: si no hay a quién atender, no hay media que sacar.
   */
  porClienta: number;
  /** El mes del que habla, «2026-10». */
  mes: string;
}

/**
 * Lo que deja de media cada clienta activa este mes.
 *
 * Es distinto del ticket medio que ya existe en el resumen de la consulta:
 * aquél divide por consultas —cuánto deja cada visita— y éste por personas.
 * Con bonos trimestrales las dos cifras se separan mucho, y la que contesta
 * «¿cuánto me deja una clienta?» es ésta.
 */
export function porClientaDelMes(
  clientes: Client[],
  mes: string,
  hoy = new Date(),
): PorClienta {
  const cuantas = activas(clientes, hoy).length;
  const cobrado = ingresosDelMes(clientes, mes);
  return {
    activas: cuantas,
    cobrado,
    porClienta: cuantas ? cobrado / cuantas : 0,
    mes,
  };
}

/** El mes de hoy, que es el que mira la lista de clientes. */
export function mesDeHoy(hoy = new Date()): string {
  return mesDe(hoy.toISOString().slice(0, 10));
}
