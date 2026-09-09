import type { CheckIn, RegistroDia } from '../types/diary';

/**
 * LA ENCUESTA DE CADA SEMANA
 *
 * Cinco preguntas y una línea libre. Para ella son treinta segundos; para la
 * nutricionista es el material de la próxima consulta ya escrito, y con
 * histórico: «llevas tres semanas diciendo que duermes mal» es una conversación
 * distinta a «¿qué tal el sueño?».
 *
 * SEMANAL Y PARA TODAS, NO QUINCENAL Y SÓLO CON PROGRAMA
 * ======================================================
 * Iba cada catorce días contados desde el inicio de un `Programa`, así que a
 * una clienta de consulta normal —que es la mayoría— no le salía nunca. Y el
 * seguimiento no es cosa de los programas: es la pregunta que ella hace igual
 * por WhatsApp todas las semanas. Ahora sale a cualquiera que tenga plan
 * enviado.
 *
 * TODAS LA MISMA SEMANA, NO CADA UNA LA SUYA
 * ==========================================
 * Un check-in es de una SEMANA (`semana`, el lunes en ISO), no del día siete de
 * cada una. Contándolo desde que cada una empieza, las respuestas llegan
 * repartidas por los siete días y revisarlas es perseguirlas de una en una;
 * ancladas a la semana natural, se abren todas el domingo y se leen el lunes de
 * una sentada.
 *
 * SE PREGUNTA POR LA SEMANA QUE ACABA
 * ===================================
 * Aparece el **domingo** y pregunta por la semana que se cierra ese día. Una
 * semana a medias se contesta peor: el miércoles todavía no se sabe si has
 * pasado hambre. Se queda disponible hasta el domingo siguiente, porque
 * perseguir a alguien con una encuesta no funciona pero hacerla desaparecer
 * por un día tampoco.
 *
 * NO ES UN EXAMEN
 * ===============
 * No hay nota, ni puntuación, ni media. Son cinco cosas que ella siente y que
 * sólo sirven para hablarlas: ponerles un número global las convertiría en algo
 * que aprobar, y eso ya se rechazó con la adherencia del día.
 */

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

const DIA = 86_400_000;

/** El lunes de la semana de una fecha, en ISO. Las semanas empiezan en lunes. */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  // getDay(): 0 es domingo, así que el domingo pertenece a la semana anterior.
  const desdeElLunes = (d.getDay() + 6) % 7;
  return new Date(d.getTime() - desdeElLunes * DIA).toISOString().slice(0, 10);
}

/**
 * La semana por la que se pregunta hoy: la que cerró el último domingo.
 *
 * El domingo mismo cuenta —ese día se cierra su semana y es cuando se abre la
 * encuesta— y de lunes a sábado se sigue preguntando por esa misma, que es la
 * que acaba de terminar.
 */
export function semanaQueToca(fecha: string): string {
  const lunes = lunesDe(fecha);
  const esDomingo = new Date(`${fecha}T12:00:00`).getDay() === 0;
  return esDomingo ? lunes : new Date(new Date(`${lunes}T12:00:00`).getTime() - 7 * DIA)
    .toISOString()
    .slice(0, 10);
}

/** Todos los que ha respondido, leyendo sus días. */
export function checkInsDe(registros: RegistroDia[]): CheckIn[] {
  return registros
    .flatMap((r) => r.checkins ?? [])
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Qué semana tiene pendiente, o `undefined` si no hay nada que preguntar.
 *
 * `desde` es la fecha en que se le envió el plan: sin eso preguntaríamos por
 * una semana en la que todavía no comía lo que le pautamos, y eso no informa
 * de nada. La semana entera tiene que haber ido por detrás del envío.
 */
export function checkInPendiente(
  fecha: string,
  registros: RegistroDia[],
  desde?: string,
): string | undefined {
  const semana = semanaQueToca(fecha);
  /*
   * El lunes de esa semana tiene que caer en el envío o después. Comparando
   * contra el lunes del envío, a quien recibe el plan un jueves se le
   * preguntaba por una semana de la que sólo vivió tres días con él.
   */
  if (desde && semana < desde.slice(0, 10)) return undefined;
  return checkInsDe(registros).some((c) => c.semana === semana) ? undefined : semana;
}

/** «Semana del 8 de septiembre», para decir de qué se le pregunta. */
export function nombreDeLaSemana(semana: string): string {
  return new Date(`${semana}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });
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

/**
 * Cómo llamar a un check-in en la tabla del histórico. Los viejos no tienen
 * semana —iban por quincenas del programa— y se siguen enseñando por su número.
 */
export function etiquetaDeCheckIn(c: CheckIn): string {
  if (c.semana) return nombreDeLaSemana(c.semana);
  return c.numero ? `Quincena ${c.numero}` : nombreDeLaSemana(c.fecha.slice(0, 10));
}
