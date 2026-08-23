import type { Client } from "../types/client";
import { MESES_DE, type Cada, type Gasto } from "../types/finanzas";

/**
 * CÓMO VA LA CONSULTA
 *
 * Los ingresos salen de los pagos apuntados en cada ficha; los gastos, de la
 * lista de la nutricionista. De juntarlos sale el flujo de caja: mes a mes,
 * lo que entró, lo que salió y lo que quedó.
 *
 * DOS COSAS QUE NO SE HACEN, Y SON DECISIONES
 * ===========================================
 *
 * **No se proyecta el futuro.** Se podría: los gastos fijos están
 * comprometidos y se sabe lo que costará noviembre. Pero los ingresos de
 * noviembre no se saben, así que un mes futuro saldría con todos los gastos y
 * ningún ingreso — un agujero inventado. El flujo llega hasta el mes de hoy.
 *
 * **No se calcula lo que le deben.** Es la misma regla que ya rige en la ficha
 * de la clienta: la app no sabe cuántos periodos han pasado ni qué se pactó de
 * palabra, así que un «pendiente» en rojo sería un número que nos hemos
 * inventado.
 */

/** El mes de una fecha ISO: «2026-08-23» → «2026-08». */
export function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

/** «2026-08» → «agosto de 2026», para los títulos. */
export function nombreDelMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const fecha = new Date(a, (m ?? 1) - 1, 1);
  return fecha.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

/** Cuántos meses hay de un mes a otro. Negativo si el segundo es anterior. */
export function mesesEntre(desde: string, hasta: string): number {
  const [a1, m1] = desde.split("-").map(Number);
  const [a2, m2] = hasta.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/** El mes que hay N meses después de otro. */
export function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Si un gasto cae en un mes concreto.
 *
 * Un fijo cuenta en su mes de alta y luego cada N meses, hasta que se da de
 * baja. Un trimestral dado de alta en enero cae en enero, abril, julio y
 * octubre — no los tres meses de cada trimestre: se paga una vez.
 */
export function caeEn(gasto: Gasto, mes: string): boolean {
  const inicio = mesDe(gasto.fecha);
  if (!gasto.cada) return inicio === mes;

  const desdeElAlta = mesesEntre(inicio, mes);
  if (desdeElAlta < 0) return false;
  if (gasto.hasta && mesesEntre(mesDe(gasto.hasta), mes) > 0) return false;

  return desdeElAlta % MESES_DE[gasto.cada] === 0;
}

/** Lo que se paga de un gasto fijo al mes, para poder ordenarlos por peso. */
export function porMes(importe: number, cada?: Cada): number {
  return cada ? importe / MESES_DE[cada] : importe;
}

export function gastosDelMes(gastos: Gasto[], mes: string): Gasto[] {
  return gastos.filter((g) => caeEn(g, mes));
}

export function totalGastosDelMes(gastos: Gasto[], mes: string): number {
  return gastosDelMes(gastos, mes).reduce((s, g) => s + (g.importe || 0), 0);
}

export function ingresosDelMes(clientes: Client[], mes: string): number {
  return clientes.reduce(
    (suma, c) =>
      suma +
      (c.pagos ?? [])
        .filter((p) => mesDe(p.fecha) === mes)
        .reduce((s, p) => s + (p.importe || 0), 0),
    0,
  );
}

/**
 * LA MONEDA DE LA CONSULTA
 *
 * Cada tarifa lleva la suya y los pagos no. Sumar euros con pesos daría un
 * número sin sentido, así que se toma la que más se repite y, si hay más de
 * una, la pantalla lo avisa en vez de callarse.
 */
export function monedaDeLaConsulta(clientes: Client[]): string {
  const cuenta = new Map<string, number>();
  for (const c of clientes) {
    if (!c.tarifa) continue;
    const m = c.tarifa.moneda || "€";
    cuenta.set(m, (cuenta.get(m) ?? 0) + 1);
  }
  let mejor = "€";
  let veces = 0;
  for (const [m, n] of cuenta) if (n > veces) [mejor, veces] = [m, n];
  return mejor;
}

export function hayVariasMonedas(clientes: Client[]): boolean {
  const monedas = new Set(
    clientes.filter((c) => c.tarifa).map((c) => c.tarifa?.moneda || "€"),
  );
  return monedas.size > 1;
}

export interface MesDeCaja {
  mes: string;
  ingresos: number;
  gastos: number;
  /** Lo que quedó ese mes: puede ser negativo, y eso es información. */
  saldo: number;
}

/**
 * El flujo de caja de los últimos meses, del más reciente al más antiguo.
 *
 * Empieza en el primer mes con movimiento —no en el alta de la cuenta— para no
 * enseñar una fila de ceros por cada mes en que la consulta todavía no
 * existía, y termina en el mes de hoy.
 */
export function flujoDeCaja(
  clientes: Client[],
  gastos: Gasto[],
  hoy = new Date(),
  /** Cuántos meses como mucho, para que la tabla no crezca sin fin. */
  tope = 24,
): MesDeCaja[] {
  const mesHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const fechas = [
    ...clientes.flatMap((c) => (c.pagos ?? []).map((p) => mesDe(p.fecha))),
    ...gastos.map((g) => mesDe(g.fecha)),
  ].filter((m) => m && m <= mesHoy);

  if (!fechas.length) return [];

  const primero = fechas.reduce((a, b) => (a < b ? a : b));
  const cuantos = Math.min(mesesEntre(primero, mesHoy) + 1, tope);
  if (cuantos <= 0) return [];

  const meses: MesDeCaja[] = [];
  for (let i = 0; i < cuantos; i++) {
    const mes = sumarMeses(mesHoy, -i);
    const ingresos = ingresosDelMes(clientes, mes);
    const gastosMes = totalGastosDelMes(gastos, mes);
    meses.push({ mes, ingresos, gastos: gastosMes, saldo: ingresos - gastosMes });
  }
  return meses;
}

export interface Resumen {
  ingresos: number;
  gastos: number;
  saldo: number;
}

/** Suma de un puñado de meses, para las cifras grandes de arriba. */
export function sumar(meses: MesDeCaja[]): Resumen {
  return meses.reduce(
    (r, m) => ({
      ingresos: r.ingresos + m.ingresos,
      gastos: r.gastos + m.gastos,
      saldo: r.saldo + m.saldo,
    }),
    { ingresos: 0, gastos: 0, saldo: 0 },
  );
}

/** Los meses de un año concreto, para «lo que llevas en 2026». */
export function delAño(meses: MesDeCaja[], año: number): MesDeCaja[] {
  return meses.filter((m) => m.mes.startsWith(String(año)));
}
