import type { Bioimpedancia, Medicion, Perimetros } from '../types/anthropometry';
import type { MedidasDelDia, RegistroDia } from '../types/diary';

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

export type Medida = MedidasDelDia & {
  fecha: string;
  /**
   * Quién apuntó esa toma. Las primeras se las manda la paciente por correo
   * antes de la primera consulta y las escribe la nutricionista; a partir de
   * ahí las mete ella misma desde su app.
   */
  origen?: 'nutricionista' | 'clienta';
};

/**
 * LOS CAMPOS, CON SU REFERENCIA ESCRITA
 *
 * Son los de la planilla que ella les manda por correo, en su orden. La
 * referencia va en el nombre —«Cintura (mínimo)», «Abdominal (máximo)»— y no
 * en una ayuda escondida: una cinta puesta dos centímetros más arriba inventa
 * una bajada de un centímetro, que es justo la información que esto viene a
 * recoger. Si lo escribe cada semana, lo lee cada semana.
 */
export interface CampoDeMedida {
  id: keyof Omit<MedidasDelDia, 'bioimpedancia' | 'fotos' | 'nota'>;
  nombre: string;
  unidad: string;
  /** La altura se apunta una vez y no cambia de una semana a otra. */
  deVezEnCuando?: boolean;
}

export const CAMPOS: CampoDeMedida[] = [
  { id: 'peso', nombre: 'Peso', unidad: 'kg' },
  { id: 'altura', nombre: 'Altura', unidad: 'cm', deVezEnCuando: true },
  { id: 'brazoRelajado', nombre: 'Brazo relajado', unidad: 'cm' },
  { id: 'brazoContraido', nombre: 'Brazo contraído', unidad: 'cm' },
  { id: 'cintura', nombre: 'Cintura (mínimo)', unidad: 'cm' },
  { id: 'abdominal', nombre: 'Abdominal (máximo)', unidad: 'cm' },
  { id: 'cadera', nombre: 'Cadera (máximo)', unidad: 'cm' },
  { id: 'muslo', nombre: 'Muslo (medio)', unidad: 'cm' },
  { id: 'pierna', nombre: 'Pierna (máximo)', unidad: 'cm' },
];

export const CAMPOS_BIO: { id: keyof Bioimpedancia; nombre: string; unidad: string }[] = [
  { id: 'grasaPct', nombre: 'Grasa', unidad: '%' },
  { id: 'musculoPct', nombre: 'Músculo', unidad: '%' },
  { id: 'aguaPct', nombre: 'Agua', unidad: '%' },
  { id: 'visceral', nombre: 'Grasa visceral', unidad: '' },
];

/** Si ese día apuntó algo, de lo que sea. */
export function tieneAlgo(m: MedidasDelDia | undefined): boolean {
  if (!m) return false;
  if (CAMPOS.some((c) => m[c.id] != null)) return true;
  if (m.bioimpedancia && CAMPOS_BIO.some((c) => m.bioimpedancia?.[c.id] != null)) return true;
  return !!(m.fotos?.frente || m.fotos?.perfil || m.fotos?.espalda || m.nota);
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
    .filter((r) => tieneAlgo(r.medidas))
    .map((r): Medida => ({ fecha: r.fecha, ...r.medidas, origen: 'clienta' }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * UNA TOMA DE LA NUTRICIONISTA, EN EL MISMO FORMATO
 *
 * Los perímetros de la antropometría se llaman distinto por dentro
 * (`muslo_medio`, `pierna_maximo`) porque vienen del perfil ISAK. Aquí se
 * traducen a los mismos nombres que usa la clienta, para que las dos cosas
 * quepan en una sola línea del tiempo.
 */
export function deLaMedicion(m: Medicion): Medida {
  const p = m.perimetros ?? {};
  return {
    fecha: m.fecha.slice(0, 10),
    origen: 'nutricionista',
    peso: m.peso,
    altura: m.talla,
    brazoRelajado: p.brazo_relajado,
    brazoContraido: p.brazo_contraido,
    cintura: p.cintura,
    abdominal: p.abdominal,
    cadera: p.cadera,
    muslo: p.muslo_medio,
    pierna: p.pierna_maximo,
    bioimpedancia: m.bioimpedancia,
    // `foto` es la de antes: una sola. Se lee como la de frente para no perderla.
    fotos: m.fotos ?? (m.foto ? { frente: m.foto } : undefined),
    nota: m.notas,
  };
}

/**
 * TODO EN UNA SOLA LÍNEA DEL TIEMPO
 *
 * Las primeras medidas las escribe la nutricionista —se las manda la paciente
 * antes de la primera consulta— y las siguientes las mete ella desde su app.
 * Son la misma cinta y la misma persona midiendo, así que compararlas no es
 * mezclar métodos: es el seguimiento que ella lleva en su planilla de siempre.
 *
 * Esto **no vale para los pliegues**, que sí los toma la nutricionista con su
 * plicómetro y siguen viviendo aparte, en la antropometría.
 *
 * Si dos tomas caen el mismo día, manda la de la clienta: si ha apuntado algo
 * hoy es porque acaba de medirse.
 */
export function historialDeMedidas(
  mediciones: Medicion[],
  registros: RegistroDia[],
): Medida[] {
  const porFecha = new Map<string, Medida>();
  for (const m of mediciones) {
    const t = deLaMedicion(m);
    if (tieneAlgo(t)) porFecha.set(t.fecha, t);
  }
  for (const t of medidasDe(registros)) porFecha.set(t.fecha, t);
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
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
    for (const c of CAMPOS) {
      if (m[c.id] != null) {
        out[c.id] = m[c.id];
        if (c.id === 'peso') out.fecha = m.fecha;
      }
    }
    for (const c of CAMPOS_BIO) {
      if (m.bioimpedancia?.[c.id] != null) {
        out.bioimpedancia = { ...out.bioimpedancia, [c.id]: m.bioimpedancia[c.id] };
      }
    }
  }
  if (!out.fecha) out.fecha = medidas[medidas.length - 1]?.fecha ?? '';
  return out;
}

export interface Evolucion {
  campo: CampoDeMedida;
  /** Lo último apuntado. */
  ahora: number;
  /** Lo anterior a eso, si lo hay. */
  antes?: number;
  /** Lo primero de todo, que es contra lo que se mide un trimestre. */
  primero?: number;
}

/**
 * CADA MEDIDA CONTRA LO ANTERIOR Y CONTRA EL DÍA UNO
 *
 * Es la columna «Diferencia» de su planilla, que es lo que de verdad se mira:
 * el número suelto no dice nada, y dos referencias cuentan cosas distintas
 * —«esta semana ha subido medio kilo» y «desde que empezamos van cuatro
 * menos»—. Un mal día se ve en la primera y no toca la segunda.
 *
 * Sólo entran los campos que ha llegado a apuntar: una fila con guiones en una
 * hoja de seguimiento sólo dice que el trabajo está a medias.
 */
export function evolucionDe(medidas: Medida[]): Evolucion[] {
  return CAMPOS.map((campo): Evolucion | undefined => {
    const valores = medidas
      .map((m) => m[campo.id])
      .filter((v): v is number => v != null);
    if (!valores.length) return undefined;
    return {
      campo,
      ahora: valores[valores.length - 1],
      antes: valores.length > 1 ? valores[valores.length - 2] : undefined,
      primero: valores.length > 1 ? valores[0] : undefined,
    };
  }).filter((e): e is Evolucion => !!e);
}

/** Las fotos que ha subido, de la más nueva a la más vieja. */
export function fotosDe(medidas: Medida[]): Medida[] {
  return medidas
    .filter((m) => m.fotos?.frente || m.fotos?.perfil || m.fotos?.espalda)
    .reverse();
}

/** Las tomas que traen alguna foto, en orden, de la más vieja a la más nueva. */
export function tomasConFoto(medidas: Medida[]): Medida[] {
  return medidas.filter((m) => m.fotos?.frente || m.fotos?.perfil || m.fotos?.espalda);
}

/**
 * Cómo se llama cada campo en la antropometría, para poder escribirlo.
 * La traducción de vuelta de `deLaMedicion`.
 */
export const A_PERIMETRO: Partial<Record<CampoDeMedida['id'], keyof Perimetros>> = {
  brazoRelajado: 'brazo_relajado',
  brazoContraido: 'brazo_contraido',
  cintura: 'cintura',
  abdominal: 'abdominal',
  cadera: 'cadera',
  muslo: 'muslo_medio',
  pierna: 'pierna_maximo',
};

export interface Punto {
  fecha: string;
  valor: number;
}

/**
 * Los puntos de una medida para pintarla.
 *
 * Sólo las fechas en que ESA medida se apuntó: uniendo un punto de enero con
 * otro de marzo porque en febrero no se midió la cintura, la línea diría que
 * bajó en línea recta durante dos meses, y eso no se sabe.
 */
export function serieDe(medidas: Medida[], campo: CampoDeMedida['id']): Punto[] {
  return medidas
    .filter((m) => m[campo] != null)
    .map((m) => ({ fecha: m.fecha, valor: m[campo] as number }));
}

/** Las medidas que tienen al menos dos puntos: con uno no hay nada que pintar. */
export function camposConHistorial(medidas: Medida[]): CampoDeMedida[] {
  return CAMPOS.filter((c) => serieDe(medidas, c.id).length >= 2);
}
