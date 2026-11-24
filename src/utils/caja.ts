import type { Client } from '../types/client';
import type { Gasto } from '../types/finanzas';
import { gastosDelMes, mesDe } from './finanzas';

/**
 * EL LIBRO DE CAJA
 * ================
 * «Dice que en noviembre han ingresado 9k pero no me suena que esté bien.»
 *
 * Y con razón: la cifra del mes salía de sumar por dentro todos los pagos de
 * todas las fichas, y **no había ninguna pantalla donde verlos uno a uno**. Un
 * número que no se puede abrir no se puede comprobar, y lo único que se puede
 * hacer con él es creerlo o desconfiar — que es exactamente donde estaba.
 *
 * Esto es la lista: cada movimiento con su fecha, de quién es, cómo pagó y
 * cuánto. Es la planilla que ella ya llevaba aparte.
 *
 * LA SUMA SALE DE AQUÍ, NO AL LADO
 * ================================
 * `ingresosDelMes` suma estos mismos movimientos. Si la lista y el total se
 * calcularan por separado podrían discrepar, y entonces la pregunta pasaría de
 * «¿de dónde salen los 9k?» a «¿cuál de los dos números es el bueno?», que es
 * peor.
 */

export interface Movimiento {
  id: string;
  /** YYYY-MM-DD */
  fecha: string;
  tipo: 'ingreso' | 'gasto';
  /** De quién: la clienta que pagó o a quién se le pagó. */
  nombre: string;
  /** Efectivo, Bizum, transferencia… lo que ella escribió. */
  metodo?: string;
  concepto?: string;
  /** Siempre positivo: el signo lo pone `tipo`. */
  importe: number;
  /** Online o presencial en los ingresos; el tipo de gasto en los gastos. */
  categoria?: string;
  /** Para poder saltar a su ficha desde la línea. */
  clientId?: string;
}

/** Los ingresos de un mes, uno por pago. */
function ingresosComoMovimientos(clientes: Client[], mes: string): Movimiento[] {
  return clientes.flatMap((c) =>
    (c.pagos ?? [])
      .filter((p) => mesDe(p.fecha) === mes)
      .map(
        (p): Movimiento => ({
          id: p.id,
          fecha: p.fecha,
          tipo: 'ingreso',
          nombre: c.nombre,
          metodo: p.metodo,
          concepto: p.concepto,
          importe: p.importe || 0,
          /*
           * La modalidad es de la ficha y no del pago: es «cómo la ve», no
           * «cómo pagó». Sirve para la misma pregunta que en su planilla —de
           * dónde viene el dinero— y es el dato que hay.
           */
          categoria: c.modalidad,
          clientId: c.id,
        }),
      ),
  );
}

/** Los gastos de un mes, contando los fijos que caen en él. */
function gastosComoMovimientos(gastos: Gasto[], mes: string): Movimiento[] {
  return gastosDelMes(gastos, mes).map(
    (g): Movimiento => ({
      id: g.id,
      /*
       * Un gasto fijo se apuntó una vez y cae todos los meses: en el libro se
       * enseña con el día que tenga, dentro del mes que se está mirando. Poner
       * su fecha original lo sacaría del mes y la lista no cuadraría con el
       * total.
       */
      fecha: `${mes}-${g.fecha.slice(8, 10) || '01'}`,
      tipo: 'gasto',
      /* Los gastos no tienen proveedor aparte: el concepto es el nombre. */
      nombre: g.concepto || 'Gasto',
      concepto: g.concepto,
      importe: g.importe || 0,
      categoria: g.categoria,
    }),
  );
}

/**
 * Todos los movimientos de un mes, del día 1 al 31. En orden de fecha, que es
 * como se repasa una caja: de arriba abajo, comprobando contra el banco.
 */
export function movimientosDelMes(
  clientes: Client[],
  gastos: Gasto[],
  mes: string,
): Movimiento[] {
  return [...ingresosComoMovimientos(clientes, mes), ...gastosComoMovimientos(gastos, mes)].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre),
  );
}

/** Lo que entró y lo que salió ese mes, sumando la propia lista. */
export function totalesDelMes(movimientos: Movimiento[]): {
  ingresos: number;
  gastos: number;
  saldo: number;
} {
  const ingresos = movimientos
    .filter((m) => m.tipo === 'ingreso')
    .reduce((s, m) => s + m.importe, 0);
  const gastos = movimientos.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.importe, 0);
  return { ingresos, gastos, saldo: ingresos - gastos };
}

/**
 * COBROS QUE PARECEN EL MISMO DOS VECES
 * =====================================
 * Un pago se puede apuntar desde tres sitios: desde la cita («cobrar»), desde
 * la ficha y desde el bono. Son tres puertas al mismo sitio —y eso está
 * bien— pero si se entra por dos, el mismo dinero se cuenta dos veces y el mes
 * sale inflado sin que nada chirríe.
 *
 * Se marca lo que coincide en **persona, importe y día**. No se borra ni se
 * descuenta nada: puede ser real —dos hermanas con la misma tarifa el mismo
 * día no, pero una clienta que paga dos bonos a la vez sí— y decidir por ella
 * sería inventarse su contabilidad. Se señala y lo mira.
 */
export function cobrosRepetidos(movimientos: Movimiento[]): Set<string> {
  const porClave = new Map<string, string[]>();
  for (const m of movimientos) {
    if (m.tipo !== 'ingreso') continue;
    const clave = `${m.clientId ?? m.nombre}|${m.fecha}|${m.importe}`;
    porClave.set(clave, [...(porClave.get(clave) ?? []), m.id]);
  }
  const out = new Set<string>();
  for (const ids of porClave.values()) if (ids.length > 1) for (const id of ids) out.add(id);
  return out;
}

/** Los meses que tienen algún movimiento, del más nuevo al más viejo. */
export function mesesConMovimiento(clientes: Client[], gastos: Gasto[]): string[] {
  const meses = new Set<string>();
  for (const c of clientes) for (const p of c.pagos ?? []) if (p.fecha) meses.add(mesDe(p.fecha));
  for (const g of gastos) if (g.fecha) meses.add(mesDe(g.fecha));
  return [...meses].sort((a, b) => b.localeCompare(a));
}
