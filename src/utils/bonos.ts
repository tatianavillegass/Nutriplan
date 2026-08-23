import type { Bono, Client, LineaDeBono, Pago, Sesion } from "../types/client";

/**
 * CÓMO VA UN BONO
 *
 * Dos preguntas, y son las dos que se hacen en consulta:
 *
 *   · **¿cuánto ha pagado de lo que contrató?** → 180 de 270, faltan 90
 *   · **¿cuántas consultas lleva?**             → 2 de 3
 *
 * Y de las dos sale la tercera, que es la que de verdad importa: **cuándo le
 * toca renovar**. Es lo primero que se acaba, las sesiones o el plazo.
 *
 * POR QUÉ AQUÍ SÍ SE DICE LO QUE FALTA
 * ====================================
 * En los pagos sueltos no se calcula ninguna deuda: la app no sabe qué se
 * pactó de palabra y un número en rojo sería inventado. En un bono el importe
 * lo escribió ella, así que «faltan 90» es una resta, no una suposición. La
 * regla vieja sigue valiendo donde no hay bono.
 */

export function pagosDelBono(pagos: Pago[] | undefined, bonoId: string): Pago[] {
  return (pagos ?? []).filter((p) => p.bonoId === bonoId);
}

export function pagadoDelBono(pagos: Pago[] | undefined, bonoId: string): number {
  return pagosDelBono(pagos, bonoId).reduce((s, p) => s + (p.importe || 0), 0);
}

export interface ComoVaLinea {
  linea: LineaDeBono;
  hechas: number;
  quedan: number;
}

export function comoVanLasSesiones(
  bono: Bono,
  sesiones: Sesion[] | undefined,
): ComoVaLinea[] {
  return bono.incluye.map((linea) => {
    const hechas = (sesiones ?? []).filter(
      (s) => s.bonoId === bono.id && s.lineaId === linea.id,
    ).length;
    /*
     * `quedan` no baja de cero aunque se hayan hecho más de las contratadas:
     * un «quedan -1» no significa nada. Que se haya pasado se ve en el «4 de
     * 3», que es donde ella lo va a mirar.
     */
    return { linea, hechas, quedan: Math.max(0, linea.cuantas - hechas) };
  });
}

export type Estado = "al-dia" | "por-terminar" | "terminado" | "vencido" | "cerrado";

export interface ComoVaElBono {
  bono: Bono;
  importe: number;
  pagado: number;
  /** Lo que falta por cobrar. Nunca negativo: si pagó de más, es cero. */
  pendiente: number;
  lineas: ComoVaLinea[];
  sesionesHechas: number;
  sesionesTotales: number;
  estado: Estado;
  /** Días que faltan para que venza, si tiene plazo. Negativo si ya pasó. */
  diasParaVencer?: number;
}

const diasEntre = (desde: Date, hasta: string): number =>
  Math.round(
    (new Date(`${hasta}T23:59:59`).getTime() - desde.getTime()) / 86_400_000,
  );

export function comoVaElBono(
  bono: Bono,
  client: Pick<Client, "pagos" | "sesiones">,
  hoy = new Date(),
): ComoVaElBono {
  const pagado = pagadoDelBono(client.pagos, bono.id);
  const lineas = comoVanLasSesiones(bono, client.sesiones);
  const sesionesHechas = lineas.reduce((s, l) => s + l.hechas, 0);
  const sesionesTotales = lineas.reduce((s, l) => s + l.linea.cuantas, 0);
  const diasParaVencer = bono.vence ? diasEntre(hoy, bono.vence) : undefined;

  /*
   * El orden importa. Cerrado a mano manda sobre todo lo demás: si ella lo dio
   * por terminado, no hay nada más que decir. Después el plazo, porque un bono
   * de tres meses caduca aunque queden sesiones. Y sólo entonces las sesiones.
   */
  const estado: Estado = bono.cerrado
    ? "cerrado"
    : diasParaVencer !== undefined && diasParaVencer < 0
      ? "vencido"
      : sesionesTotales > 0 && sesionesHechas >= sesionesTotales
        ? "terminado"
        : (sesionesTotales > 0 && sesionesHechas >= sesionesTotales - 1) ||
            (diasParaVencer !== undefined && diasParaVencer <= 15)
          ? "por-terminar"
          : "al-dia";

  return {
    bono,
    importe: bono.importe,
    pagado,
    pendiente: Math.max(0, bono.importe - pagado),
    lineas,
    sesionesHechas,
    sesionesTotales,
    estado,
    diasParaVencer,
  };
}

/** El bono que está en marcha: el último que no se ha cerrado ni vencido. */
export function bonoVigente(
  client: Pick<Client, "bonos" | "pagos" | "sesiones">,
  hoy = new Date(),
): ComoVaElBono | undefined {
  const bonos = [...(client.bonos ?? [])].sort((a, b) =>
    b.inicio.localeCompare(a.inicio),
  );
  const vivos = bonos
    .map((b) => comoVaElBono(b, client, hoy))
    .filter((c) => c.estado !== "cerrado" && c.estado !== "vencido");
  /*
   * Si están todos terminados o vencidos, se devuelve el más reciente igual:
   * «se le acabó el bono» es justo lo que hace falta ver, y devolver nada lo
   * escondería.
   */
  return vivos[0] ?? (bonos[0] ? comoVaElBono(bonos[0], client, hoy) : undefined);
}

/**
 * A quién hay que llamar para renovar: se le acabaron las sesiones, se le
 * pasó el plazo, o le queda una de las dos cosas.
 */
export function tocaRenovar(
  client: Pick<Client, "bonos" | "pagos" | "sesiones">,
  hoy = new Date(),
): boolean {
  const c = bonoVigente(client, hoy);
  if (!c || c.bono.cerrado) return false;
  return (
    c.estado === "terminado" || c.estado === "vencido" || c.estado === "por-terminar"
  );
}

/** Lo que se le debe de todos sus bonos abiertos. */
export function pendienteDeCobro(
  client: Pick<Client, "bonos" | "pagos" | "sesiones">,
): number {
  return (client.bonos ?? [])
    .filter((b) => !b.cerrado)
    .reduce((s, b) => s + Math.max(0, b.importe - pagadoDelBono(client.pagos, b.id)), 0);
}

/** «2 de 3 consultas · 1 de 3 llamadas», para una línea de resumen. */
export function resumenDeSesiones(c: ComoVaElBono): string {
  return c.lineas
    .map((l) => `${l.hechas} de ${l.linea.cuantas} ${l.linea.concepto.toLowerCase()}`)
    .join(" · ");
}
