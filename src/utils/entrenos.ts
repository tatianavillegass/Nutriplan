import type { Actividad, RegistroDia, TipoDeEntreno } from '../types/diary';
import { TIPO_DE_ENTRENO_LABELS } from '../types/diary';
import { diasDeLaSemana, lunesDe } from './menuSemana';

/**
 * LOS ENTRENOS SE CUENTAN, NO SE APRUEBAN
 *
 * Varias clientas pedían llevar la cuenta de lo que entrenan, y la tentación es
 * copiar las metas: un objetivo semanal, un anillo y una racha. Aquí no vale.
 *
 * Una meta —dos litros de agua— se cumple o no se cumple, y el día se cierra.
 * Un entrenamiento no: tres a la semana es mucho para quien venía de cero y
 * poco para quien prepara una carrera, y quien está lesionada o con la regla o
 * con una semana imposible no ha fallado nada. Un «2 de 4» en rojo el jueves no
 * enseña a moverse más; sólo le dice que va tarde, en la misma app donde
 * además apunta lo que come. Así que **no hay objetivo, ni racha de entrenos,
 * ni color**: hay una cuenta y lo que ella escriba.
 *
 * Lo que sí hace falta es que se pueda **mirar hacia atrás**: cuántos por
 * semana, de qué tipo y cómo se sintió. Eso es material de consulta, y es lo
 * que estas funciones sacan.
 */

/** El nombre que se enseña: el del tipo, o lo que escribió en «otro». */
export function nombreDelEntreno(e: Actividad): string {
  if (e.tipo === 'otro') return e.otro?.trim() || 'Otro';
  return TIPO_DE_ENTRENO_LABELS[e.tipo];
}

/** Todos sus entrenos con la fecha del día en que los apuntó, del más nuevo. */
export function entrenosDe(
  registros: RegistroDia[],
  desde?: string,
): { fecha: string; entreno: Actividad }[] {
  return registros
    .filter((r) => (desde ? r.fecha >= desde : true))
    .flatMap((r) => (r.actividad ?? []).map((entreno) => ({ fecha: r.fecha, entreno })))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export interface DiaDeEntreno {
  fecha: string;
  entrenos: Actividad[];
  /**
   * Los días que todavía no han llegado no están vacíos, están por venir. Sin
   * esto, el lunes la semana se ve como seis huecos sin rellenar — que es
   * exactamente el tono que esto no quiere tener.
   */
  futuro: boolean;
}

/** La semana de esa fecha, de lunes a domingo. */
export function semanaDeEntrenos(
  registros: RegistroDia[],
  fecha: string,
): DiaDeEntreno[] {
  const porFecha = new Map(registros.map((r) => [r.fecha, r]));
  return diasDeLaSemana(lunesDe(fecha)).map((dia) => ({
    fecha: dia,
    entrenos: porFecha.get(dia)?.actividad ?? [],
    futuro: dia > fecha,
  }));
}

/** Cuántos lleva en la semana de esa fecha. */
export function cuantosEstaSemana(registros: RegistroDia[], fecha: string): number {
  return semanaDeEntrenos(registros, fecha).reduce((s, d) => s + d.entrenos.length, 0);
}

/**
 * Las últimas semanas, de la más reciente a la más antigua. Es lo que se mira
 * en consulta: no cuántos hizo ayer, sino si la cosa se sostiene.
 */
export function porSemana(
  registros: RegistroDia[],
  fecha: string,
  cuantas = 8,
): { lunes: string; veces: number; minutos: number }[] {
  const cuenta = new Map<string, { veces: number; minutos: number }>();
  const desde = restarSemanas(lunesDe(fecha), cuantas - 1);

  for (const r of registros) {
    if (r.fecha < desde || r.fecha > fecha) continue;
    const lunes = lunesDe(r.fecha);
    const ya = cuenta.get(lunes) ?? { veces: 0, minutos: 0 };
    for (const e of r.actividad ?? []) {
      ya.veces += 1;
      ya.minutos += e.minutos ?? 0;
    }
    cuenta.set(lunes, ya);
  }

  /* Las semanas sin nada también salen: un hueco es información. */
  return Array.from({ length: cuantas }, (_, i) => {
    const lunes = restarSemanas(lunesDe(fecha), i);
    return { lunes, ...(cuenta.get(lunes) ?? { veces: 0, minutos: 0 }) };
  });
}

function restarSemanas(lunes: string, cuantas: number): string {
  const d = new Date(`${lunes}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - cuantas * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * De qué entrena, ordenado por lo que más repite. En consulta esto vale más que
 * el total: alguien que hace cinco clases dirigidas y nada de fuerza tiene una
 * conversación pendiente que un «5 esta semana» no enseña.
 */
export function porTipo(
  registros: RegistroDia[],
  desde?: string,
): { tipo: TipoDeEntreno; nombre: string; veces: number; minutos: number }[] {
  const cuenta = new Map<string, { tipo: TipoDeEntreno; nombre: string; veces: number; minutos: number }>();

  for (const { entreno } of entrenosDe(registros, desde)) {
    /* «Otro: padel» y «Otro: escalada» son dos cosas, así que agrupan aparte. */
    const nombre = nombreDelEntreno(entreno);
    const clave = entreno.tipo === 'otro' ? `otro:${nombre.toLowerCase()}` : entreno.tipo;
    const ya = cuenta.get(clave) ?? { tipo: entreno.tipo, nombre, veces: 0, minutos: 0 };
    ya.veces += 1;
    ya.minutos += entreno.minutos ?? 0;
    cuenta.set(clave, ya);
  }

  return [...cuenta.values()].sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre));
}

/**
 * La media de las semanas **completas**: la de esta semana siempre iría baja
 * —es martes— y una media que baja sola cada lunes no dice nada de nadie.
 */
export function mediaPorSemana(registros: RegistroDia[], fecha: string, cuantas = 4): number {
  const semanas = porSemana(registros, fecha, cuantas + 1).slice(1);
  if (!semanas.length) return 0;
  const total = semanas.reduce((s, x) => s + x.veces, 0);
  return Math.round((total / semanas.length) * 10) / 10;
}

/** «45 min», «1 h 15». Los minutos sueltos no se leen en una semana entera. */
export function duracionLegible(minutos: number | undefined): string | undefined {
  if (!minutos || minutos <= 0) return undefined;
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}
