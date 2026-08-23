/**
 * LOS GASTOS DE LA CONSULTA
 *
 * Los ingresos ya estaban: son los pagos que se apuntan en la ficha de cada
 * clienta. Lo que faltaba era el otro lado, y sin él «cuánto he facturado» no
 * dice si el mes ha ido bien.
 *
 * Dos clases de gasto, porque se apuntan de maneras distintas:
 *
 *   · **Sueltos** — una báscula, un curso, la imprenta. Se apuntan cuando
 *     pasan.
 *   · **Fijos** — Supabase, el dominio, la cuota de autónoma. Se apuntan UNA
 *     vez con cada cuánto se pagan y se cuentan solos todos los meses.
 *
 * Sin los fijos, el flujo de caja sería mentira: son justo los que nadie se
 * acuerda de teclear, y son los que están todos los meses.
 *
 * **No hay IVA ni retenciones a propósito.** Aquí se apunta lo que entra y lo
 * que sale, que es lo que hace falta para saber cómo va el mes. Los números
 * para Hacienda salen de las facturas de verdad y los hace quien sabe.
 */

export const CATEGORIAS_GASTO = [
  "herramientas",
  "cuota",
  "formacion",
  "material",
  "local",
  "marketing",
  "otros",
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

export const LABEL_CATEGORIA: Record<CategoriaGasto, string> = {
  herramientas: "Herramientas y programas",
  cuota: "Cuotas y seguros",
  formacion: "Formación",
  material: "Material",
  local: "Local y suministros",
  marketing: "Marketing",
  otros: "Otros",
};

/** Cada cuánto se paga un gasto fijo. */
export type Cada = "mes" | "trimestre" | "año";

export const LABEL_CADA: Record<Cada, string> = {
  mes: "Cada mes",
  trimestre: "Cada trimestre",
  año: "Cada año",
};

/** Cuántos meses pasan entre dos pagos de un gasto fijo. */
export const MESES_DE: Record<Cada, number> = {
  mes: 1,
  trimestre: 3,
  año: 12,
};

export interface Gasto {
  id: string;
  /**
   * Cuándo se pagó, si es suelto. Si es fijo, **desde cuándo** se paga: es el
   * primer mes en el que cuenta.
   */
  fecha: string; // YYYY-MM-DD
  concepto: string;
  importe: number;
  categoria: CategoriaGasto;
  /**
   * Si se repite, cada cuánto. Sin esto es un gasto suelto y cuenta una vez.
   */
  cada?: Cada;
  /**
   * Cuándo se dejó de pagar. Sin fecha, sigue vigente. Se da de baja en vez de
   * borrarlo: borrarlo se lleva por delante los meses en que sí se pagó, y el
   * flujo de caja del año pasado dejaría de cuadrar.
   */
  hasta?: string; // YYYY-MM-DD
}

export function gastoVacio(id: string, fecha: string): Gasto {
  return { id, fecha, concepto: "", importe: 0, categoria: "otros" };
}
