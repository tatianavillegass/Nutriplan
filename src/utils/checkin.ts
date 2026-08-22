import type { CheckIn, RegistroDia } from '../types/diary';
import type { DondeVa } from './programa';

/**
 * EL CHECK-IN DE CADA DOS SEMANAS
 *
 * Cinco preguntas y una línea libre. Para ella son treinta segundos; para la
 * nutricionista es el material de la próxima consulta ya escrito, y con
 * histórico: «llevas tres quincenas diciendo que duermes mal» es una
 * conversación distinta a «¿qué tal el sueño?».
 *
 * CADA DOS SEMANAS, NO CADA MES
 * =============================
 * Un mes es demasiado tiempo para enterarse de que algo no va: si el hambre se
 * disparó la segunda semana, saberlo el día 30 es tarde. Y no es tan a menudo
 * como para cansar.
 *
 * NO ES UN EXAMEN
 * ===============
 * No hay nota, ni puntuación, ni media. Son cinco cosas que ella siente y que
 * sólo sirven para hablarlas: ponerles un número global las convertiría en algo
 * que aprobar, y eso ya se rechazó con la adherencia del día.
 *
 * SE PUEDE SALTAR
 * ===============
 * Aparece cuando toca y se queda disponible hasta el siguiente, pero no bloquea
 * nada ni insiste. Una app que persigue a alguien con una encuesta se cierra.
 */

export const DIAS_ENTRE_CHECKINS = 14;

export interface Pregunta {
  id: keyof CheckIn['respuestas'];
  texto: string;
  /** Qué significa el 1 y qué el 5, que si no un número no dice nada. */
  poco: string;
  mucho: string;
}

export const PREGUNTAS: Pregunta[] = [
  { id: 'energia', texto: '¿Cómo has estado de energía?', poco: 'Baja', mucho: 'Alta' },
  { id: 'digestion', texto: '¿Y de digestiones?', poco: 'Pesadas', mucho: 'Ligeras' },
  { id: 'sueno', texto: '¿Has dormido bien?', poco: 'Mal', mucho: 'Bien' },
  { id: 'hambre', texto: '¿Has pasado hambre entre horas?', poco: 'Mucha', mucho: 'Ninguna' },
  { id: 'antojos', texto: '¿Has tenido antojos?', poco: 'Muchos', mucho: 'Ninguno' },
];

/**
 * Qué check-in toca hoy: el 1 el día 14, el 2 el día 28… Devuelve `undefined`
 * antes del primero, que preguntarle qué tal la quincena el día 3 no informa
 * de nada.
 */
export function checkInQueToca(donde: DondeVa | undefined): number | undefined {
  if (!donde || donde.terminado) return undefined;
  const numero = Math.floor(donde.dia / DIAS_ENTRE_CHECKINS);
  return numero >= 1 ? numero : undefined;
}

/** Todos los que ha respondido, leyendo sus días. */
export function checkInsDe(registros: RegistroDia[]): CheckIn[] {
  return registros
    .flatMap((r) => r.checkins ?? [])
    .sort((a, b) => a.numero - b.numero || a.fecha.localeCompare(b.fecha));
}

/** Si el de esta quincena está pendiente. */
export function checkInPendiente(
  donde: DondeVa | undefined,
  registros: RegistroDia[],
): number | undefined {
  const toca = checkInQueToca(donde);
  if (!toca) return undefined;
  return checkInsDe(registros).some((c) => c.numero === toca) ? undefined : toca;
}

export interface Tendencia {
  id: Pregunta['id'];
  texto: string;
  ahora: number;
  antes?: number;
  /** Sube, baja o sigue igual. Sin nota ni media: sólo la dirección. */
  cambio: 'sube' | 'baja' | 'igual';
}

/**
 * El último check-in comparado con el anterior. Lo que importa en consulta no
 * es el número suelto sino hacia dónde va: un 3 después de un 1 es una buena
 * noticia, y después de un 5 es una conversación.
 */
export function comoVaCambiando(registros: RegistroDia[]): Tendencia[] {
  const todos = checkInsDe(registros);
  const ultimo = todos[todos.length - 1];
  if (!ultimo) return [];
  const anterior = todos[todos.length - 2];

  return PREGUNTAS.map(({ id, texto }) => {
    const ahora = ultimo.respuestas[id];
    const antes = anterior?.respuestas[id];
    const cambio =
      antes == null || ahora === antes ? 'igual' : ahora > antes ? 'sube' : 'baja';
    return { id, texto, ahora, antes, cambio };
  }).filter((t) => t.ahora != null) as Tendencia[];
}
