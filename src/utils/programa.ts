import type { Programa } from '../types/client';
import type { RegistroDia } from '../types/diary';
import { diaCerrado } from './racha';
import type { DayType } from '../types/plan';

/**
 * UN RETO CONSIGO MISMA
 *
 * RESET 90 no es un grupo: es una clienta de consulta con un principio, un
 * final y la sensación de estar recorriendo algo. Por dentro no hace falta
 * nada nuevo —su plan, su registro y sus rachas son los de siempre—, sólo
 * saber cuándo empezó y cuánto dura.
 *
 * SE CUENTA POR MESES, NO POR NOVENTA DÍAS
 * ========================================
 * «Día 1 de 90» el primer día dice *te quedan 89*, que es justo lo contrario
 * de lo que hace falta al empezar. Por meses el horizonte es corto y
 * alcanzable —«mes 1, día 12»— y el total sólo aparece cuando es buena
 * noticia: al cambiar de mes.
 *
 * Y nunca una cuenta atrás. Recordarle cuánto le falta no ayuda a nadie a
 * comer mejor.
 */

/** Cuántos días tiene un mes del programa. */
export const DIAS_POR_MES = 30;

export interface DondeVa {
  /** Días transcurridos, empezando en 1 el primer día. */
  dia: number;
  /** En qué mes está, empezando en 1. */
  mes: number;
  /** Cuántos meses tiene el programa entero. */
  meses: number;
  /** Qué día de ESE mes es: 1 a 30. */
  diaDelMes: number;
  /** Las fechas de ese mes, para pintar la tira. */
  diasDelMes: string[];
  /** Ya ha terminado: el programa se cierra, no se alarga solo. */
  terminado: boolean;
  /** Hoy empieza un mes nuevo (y no es el primer día de todos). */
  estrenaMes: boolean;
}

/** Suma días a una fecha ISO sin líos de zona horaria. */
function masDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Por dónde va hoy. Devuelve `undefined` si no tiene programa o si todavía no
 * ha empezado: enseñarle «día 0» antes de tiempo no dice nada.
 */
export function dondeVa(programa: Programa | undefined, hoy: string): DondeVa | undefined {
  if (!programa?.inicio || !programa.dias) return undefined;

  const transcurridos = diasEntre(programa.inicio, hoy);
  if (transcurridos < 0) return undefined;

  const dia = transcurridos + 1;
  const meses = Math.max(1, Math.ceil(programa.dias / DIAS_POR_MES));
  const mes = Math.min(meses, Math.floor(transcurridos / DIAS_POR_MES) + 1);
  const diaDelMes = transcurridos - (mes - 1) * DIAS_POR_MES + 1;

  const primeroDelMes = masDias(programa.inicio, (mes - 1) * DIAS_POR_MES);
  const cuantos = Math.min(DIAS_POR_MES, programa.dias - (mes - 1) * DIAS_POR_MES);
  const diasDelMes = Array.from({ length: cuantos }, (_, i) => masDias(primeroDelMes, i));

  return {
    dia,
    mes,
    meses,
    diaDelMes,
    diasDelMes,
    terminado: dia > programa.dias,
    estrenaMes: diaDelMes === 1 && mes > 1,
  };
}

export interface ComoVaElMes {
  cerrados: number;
  /** De cuántos días que ya han pasado: no se cuenta el futuro como fallado. */
  posibles: number;
}

/**
 * Cómo va el mes: días cerrados de los que ya han pasado. Los que quedan por
 * venir no cuentan como fallados —eso sería marcarle en rojo el futuro—.
 */
export function comoVaElMes(
  donde: DondeVa | undefined,
  registros: RegistroDia[],
  hoy: string,
  /** Para saber si el día está cerrado hace falta saber qué se pautó. */
  tipoDelDia: (r: RegistroDia) => DayType | undefined,
): ComoVaElMes {
  if (!donde) return { cerrados: 0, posibles: 0 };

  const pasados = donde.diasDelMes.filter((f) => f <= hoy);
  const porFecha = new Map(registros.map((r) => [r.fecha, r]));

  const cerrados = pasados.filter((f) => {
    const r = porFecha.get(f);
    return r ? diaCerrado(r, tipoDelDia(r)) : false;
  }).length;

  return { cerrados, posibles: pasados.length };
}

/**
 * El mensaje al estrenar mes. Celebra lo que hizo —días cerrados, su mejor
 * racha— y nunca lo que pesa: si el mensaje felicita por kilos, el mes que no
 * baje se lee como un suspenso.
 */
export function felicitacionDeMes(mes: number, cerrados: number, mejorRacha: number): string {
  const cierre =
    mes === 1
      ? 'Ya llevas un mes.'
      : `Empiezas el mes ${mes}.`;

  const logro =
    cerrados > 0
      ? ` Has cerrado ${cerrados} ${cerrados === 1 ? 'día' : 'días'}`
      : '';
  const racha = mejorRacha > 1 ? `, y tu mejor racha han sido ${mejorRacha} seguidos` : '';

  return `${cierre}${logro}${racha}${logro ? '.' : ''}`;
}
