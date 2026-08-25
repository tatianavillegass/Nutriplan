import type { Bono, Client, Modalidad, Sesion } from "../types/client";
import type { CategoriaGasto, Gasto } from "../types/finanzas";
import { gastosDelMes, ingresosDelMes, mesDe, totalGastosDelMes } from "./finanzas";

/**
 * CÓMO VA EL MES
 *
 * La hoja de cálculo que Tats llevaba a mano, calculada sola. Lo importante no
 * es cada número suelto sino la pareja que forman dos de ellos:
 *
 *   · **Cobrado** — lo que entró en caja ese mes.
 *   · **Devengado** — el trabajo que hiciste ese mes.
 *
 * No son lo mismo y confundirlos engaña en las dos direcciones. Si alguien
 * paga 270 € en enero y hace sus tres consultas en enero, febrero y marzo,
 * enero cobra 270 pero sólo devenga 90: enero no fue un mes tan bueno como
 * parece, y marzo no fue tan malo. Un mes de agosto con mucha caja puede ser
 * el peor mes de trabajo del año.
 *
 * El devengado se reparte solo: el precio del bono entre las sesiones que
 * incluye. Un bono de 270 € con 3 consultas y 3 llamadas son 45 € por sesión.
 * Así no hay que escribir ningún precio nuevo — sale de lo que ya se apunta.
 */

/** Lo que vale una sesión de un bono: su precio entre lo que incluye. */
export function valorDeSesion(bono: Bono): number {
  const total = bono.incluye.reduce((s, l) => s + (l.cuantas || 0), 0);
  return total > 0 ? bono.importe / total : 0;
}

/** Lo que se dejó de cobrar en un bono, si llevaba descuento. */
export function descuentoDelBono(bono: Bono): number {
  if (!bono.precioBase || bono.precioBase <= bono.importe) return 0;
  return bono.precioBase - bono.importe;
}

export interface SesionContada {
  client: Client;
  sesion: Sesion;
  /** De qué era: «Consulta», «Llamada»… Sale de la línea del bono. */
  concepto?: string;
  /** El bono del que cuelga, para poder enseñar de dónde sale el valor. */
  bono?: Bono;
  /** La de la sesión si la tiene; si no, la de la ficha. */
  modalidad?: Modalidad;
  /**
   * Lo que devenga: lo que le toca del bono, o el precio que ella le puso si
   * es una consulta suelta.
   */
  valor: number;
  /** Si esa clienta está haciendo un programa (RESET 90). */
  programa: boolean;
}

/** Todas las consultas y llamadas marcadas como hechas en un mes. */
export function sesionesDelMes(clientes: Client[], mes: string): SesionContada[] {
  const out: SesionContada[] = [];
  for (const c of clientes) {
    for (const s of c.sesiones ?? []) {
      if (mesDe(s.fecha) !== mes) continue;
      const bono = (c.bonos ?? []).find((b) => b.id === s.bonoId);
      out.push({
        client: c,
        sesion: s,
        concepto: bono?.incluye.find((l) => l.id === s.lineaId)?.concepto,
        bono,
        modalidad: s.modalidad ?? c.modalidad,
        valor: bono ? valorDeSesion(bono) : (s.importe ?? 0),
        programa: !!c.programa,
      });
    }
  }
  return out;
}

export interface MesDeConsulta {
  mes: string;
  consultas: number;
  online: number;
  presencial: number;
  /** Sin decir si fue online o presencial: ni de la sesión ni de la ficha. */
  sinModalidad: number;
  programa: number;
  /**
   * Consultas que devengan cero: ni cuelgan de un bono ni tienen precio
   * puesto. Se cuentan aparte porque hacen que el «trabajo hecho» salga corto
   * sin que se vea por qué.
   */
  sinValor: number;
  /** El trabajo hecho ese mes. */
  devengado: number;
  /** Lo que entró en caja ese mes. */
  cobrado: number;
  /** Cobrado menos devengado: positivo si cobraste por delante. */
  diferencia: number;
  gastos: number;
  neto: number;
  /** Lo que deja de media cada consulta. Sin consultas, cero. */
  ticket: number;
}

export function mesDeConsulta(
  clientes: Client[],
  gastos: Gasto[],
  mes: string,
): MesDeConsulta {
  const sesiones = sesionesDelMes(clientes, mes);
  const cobrado = ingresosDelMes(clientes, mes);
  const gasto = totalGastosDelMes(gastos, mes);
  const devengado = sesiones.reduce((s, x) => s + x.valor, 0);

  return {
    mes,
    consultas: sesiones.length,
    online: sesiones.filter((s) => s.modalidad === "online").length,
    presencial: sesiones.filter((s) => s.modalidad === "presencial").length,
    sinModalidad: sesiones.filter((s) => !s.modalidad).length,
    programa: sesiones.filter((s) => s.programa).length,
    sinValor: sesiones.filter((s) => s.valor <= 0).length,
    devengado,
    cobrado,
    diferencia: cobrado - devengado,
    gastos: gasto,
    neto: cobrado - gasto,
    /*
     * El ticket medio se calcula sobre lo cobrado, como en su hoja. Sobre el
     * devengado saldría un número más estable pero menos útil: lo que ella
     * mira es cuánto deja de caja cada persona que se sienta delante.
     */
    ticket: sesiones.length ? cobrado / sesiones.length : 0,
  };
}

/**
 * Los meses con algo que contar, del más reciente al más antiguo. Igual que el
 * flujo de caja: no se proyecta el futuro, porque los gastos se saben y los
 * ingresos no.
 */
export function añoDeConsulta(
  clientes: Client[],
  gastos: Gasto[],
  año: number,
  hoy = new Date(),
): MesDeConsulta[] {
  const mesHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const meses: MesDeConsulta[] = [];
  for (let m = 12; m >= 1; m--) {
    const mes = `${año}-${String(m).padStart(2, "0")}`;
    if (mes > mesHoy) continue;
    meses.push(mesDeConsulta(clientes, gastos, mes));
  }
  return meses;
}

/** Suma de varios meses, para la fila de totales. */
export function sumarMeses(meses: MesDeConsulta[]): Omit<MesDeConsulta, "mes"> {
  const cero = {
    consultas: 0, online: 0, presencial: 0, sinModalidad: 0, programa: 0,
    sinValor: 0, devengado: 0, cobrado: 0, diferencia: 0, gastos: 0, neto: 0, ticket: 0,
  };
  const t = meses.reduce((a, m) => ({
    consultas: a.consultas + m.consultas,
    online: a.online + m.online,
    presencial: a.presencial + m.presencial,
    sinModalidad: a.sinModalidad + m.sinModalidad,
    programa: a.programa + m.programa,
    sinValor: a.sinValor + m.sinValor,
    devengado: a.devengado + m.devengado,
    cobrado: a.cobrado + m.cobrado,
    diferencia: a.diferencia + m.diferencia,
    gastos: a.gastos + m.gastos,
    neto: a.neto + m.neto,
    ticket: 0,
  }), cero);
  // El ticket del total no se suma: se recalcula, o saldría doce veces mayor.
  return { ...t, ticket: t.consultas ? t.cobrado / t.consultas : 0 };
}

/**
 * LOS GASTOS, POR CATEGORÍA Y MES
 *
 * Verlos en una sola cifra no dice nada: lo que hace falta es ver que el
 * consultorio sube cuando subes de clientes, y eso sólo se nota comparando el
 * mismo concepto de un mes al siguiente.
 */
export interface FilaDeGasto {
  categoria: CategoriaGasto;
  /** Lo que costó en cada uno de los meses pedidos, en el mismo orden. */
  porMes: number[];
  total: number;
}

export function gastosPorCategoria(gastos: Gasto[], meses: string[]): FilaDeGasto[] {
  const filas = new Map<CategoriaGasto, number[]>();
  meses.forEach((mes, i) => {
    for (const g of gastosDelMes(gastos, mes)) {
      const fila = filas.get(g.categoria) ?? meses.map(() => 0);
      fila[i] += g.importe || 0;
      filas.set(g.categoria, fila);
    }
  });
  return [...filas.entries()]
    .map(([categoria, porMes]) => ({
      categoria,
      porMes,
      total: porMes.reduce((s, n) => s + n, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * CUÁNTAS VIENEN CON DESCUENTO, Y CUÁNTO CUESTA
 *
 * Ella preguntaba cuántas son. El número solo no dice gran cosa; lo que decide
 * si compensa seguir haciéndolos es cuánto has dejado de cobrar.
 */
export interface Descuentos {
  bonos: number;
  clientas: number;
  dejadoDeCobrar: number;
  /** Los motivos que ella escribió, para ver de dónde vienen. */
  motivos: string[];
}

export function descuentos(clientes: Client[]): Descuentos {
  let bonos = 0;
  let dejadoDeCobrar = 0;
  const conDescuento = new Set<string>();
  const motivos = new Set<string>();

  for (const c of clientes) {
    for (const b of c.bonos ?? []) {
      const d = descuentoDelBono(b);
      if (d <= 0) continue;
      bonos++;
      dejadoDeCobrar += d;
      conDescuento.add(c.id);
      if (b.motivoDescuento?.trim()) motivos.add(b.motivoDescuento.trim());
    }
  }

  return {
    bonos,
    clientas: conDescuento.size,
    dejadoDeCobrar,
    motivos: [...motivos],
  };
}
