import type { RegistroDia } from '../types/diary';

/**
 * LO QUE SE MIDE ELLA
 *
 * En consulta la báscula la pone la nutricionista; en un reto online, no hay
 * consulta. Así que la participante apunta lo suyo y va en su registro, que es
 * lo único que sube su app.
 *
 * TODO ES OPCIONAL, Y ESO ES PARTE DEL DISEÑO
 * ===========================================
 * Pesarse a diario le va bien a quien no le da importancia y le hace daño a
 * quien se la da. No se pide, no se recuerda y no rompe ninguna racha: está
 * ahí para quien quiera usarlo.
 *
 * POR QUÉ LA MEDIA DE LA SEMANA Y NO EL PESO DE HOY
 * ================================================
 * El peso de un día son dos kilos de agua, sal y lo que quedó de la cena. La
 * media semanal quita ese ruido: comparando una media con otra se ve la
 * tendencia de verdad, que es lo único que puede orientar un cambio de plan.
 * Por eso hacen falta dos semanas antes de decir nada.
 */

export interface Medida {
  fecha: string;
  peso?: number;
  cintura?: number;
  cadera?: number;
}

export interface SemanaDePeso {
  /** Lunes de esa semana, en ISO. */
  desde: string;
  media: number;
  dias: number;
}

/** Todo lo que ha apuntado, de lo más antiguo a lo más nuevo. */
export function medidasDe(registros: RegistroDia[]): Medida[] {
  return registros
    .filter((r) => r.medidas && (r.medidas.peso || r.medidas.cintura || r.medidas.cadera))
    .map((r) => ({ fecha: r.fecha, ...r.medidas }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** El lunes de la semana de una fecha ISO. */
export function lunesDe(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  // getUTCDay: 0 es domingo. Se retrocede hasta el lunes.
  const dia = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - dia);
  return fecha.toISOString().slice(0, 10);
}

/** La media de peso de cada semana, de la más antigua a la más nueva. */
export function semanasDePeso(medidas: Medida[]): SemanaDePeso[] {
  const porSemana = new Map<string, number[]>();
  for (const m of medidas) {
    if (!m.peso) continue;
    const clave = lunesDe(m.fecha);
    porSemana.set(clave, [...(porSemana.get(clave) ?? []), m.peso]);
  }

  return [...porSemana.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([desde, pesos]) => ({
      desde,
      dias: pesos.length,
      media: pesos.reduce((s, p) => s + p, 0) / pesos.length,
    }));
}

export interface Tendencia {
  /** Kilos por semana. Negativo es bajada. */
  porSemana: number;
  /** Con una sola semana no hay con qué comparar. */
  semanas: number;
}

/**
 * Cuánto se mueve por semana, comparando la media de la última semana con la
 * anterior. Con menos de dos semanas no se dice nada: un número sacado de tres
 * días no es una tendencia, es el desayuno de ayer.
 */
export function tendenciaDePeso(medidas: Medida[]): Tendencia | undefined {
  const semanas = semanasDePeso(medidas);
  if (semanas.length < 2) return undefined;
  const ultima = semanas[semanas.length - 1];
  const anterior = semanas[semanas.length - 2];
  return { porSemana: ultima.media - anterior.media, semanas: semanas.length };
}

/** Lo último que apuntó de cada cosa, aunque fuera en días distintos. */
export function ultimasMedidas(medidas: Medida[]): Medida {
  const out: Medida = { fecha: '' };
  for (const m of medidas) {
    if (m.peso) {
      out.peso = m.peso;
      out.fecha = m.fecha;
    }
    if (m.cintura) out.cintura = m.cintura;
    if (m.cadera) out.cadera = m.cadera;
  }
  return out;
}
