import type { Pausa, RegistroDia } from '../types/diary';

/**
 * LA PAUSA
 *
 * Un botón que la clienta pulsa cuando le vienen ganas de comer sin hambre, y
 * que la lleva por el árbol de decisión de Tats hasta el ejercicio que le toca.
 *
 * EL NOMBRE NO ES UN DETALLE
 * ==========================
 * No se llama «he tenido un episodio». Un botón que se llama así es una casilla
 * de confesión, y a las once de la noche —que es cuando hace falta— no lo pulsa
 * nadie. Se llama «Pausa» porque es una herramienta que se coge, no un fallo
 * que se confiesa.
 *
 * Y por lo mismo: **aquí no se cuenta nada**. Ni racha, ni «3 esta semana», ni
 * «vas mejorando». Un contador de episodios es un marcador de fracasos, y a
 * quien tiene mala relación con la comida eso le hace daño — es lo mismo que ya
 * se rechazó con el porcentaje de adherencia y con el ranking de peso. Ella ve
 * lo que escribió, para poder releerlo; los números los ve la nutricionista,
 * que es quien sabe qué hacer con ellos.
 *
 * TAMPOCO HAY «RESISTÍ» NI «CAÍ»
 * ==============================
 * Lo que hizo se apunta sin aprobado ni suspenso, porque a veces comer ES la
 * respuesta correcta: tenía hambre de verdad. Poner un aprobado convierte cada
 * pausa en un examen y la comida en algo que se gana.
 */

// ─────────────────────────────────────────────── La rueda de las emociones

export interface FamiliaDeEmocion {
  id: string;
  nombre: string;
  emociones: string[];
}

/**
 * Lo que se siente antes de comer sin hambre, con palabras de verdad. La rueda
 * de la guía, hecha lista: en un móvil se lee mejor.
 *
 * **La alegría está a propósito.** Comer para celebrar es normal y sano, y una
 * lista sólo de emociones feas enseñaría que cualquier comida con emoción
 * detrás es un problema. No lo es.
 */
export const EMOCIONES: FamiliaDeEmocion[] = [
  {
    id: 'ansiedad',
    nombre: 'Ansiedad',
    emociones: ['Ansiedad', 'Nervios', 'Agobio', 'Inquietud', 'Miedo'],
  },
  {
    id: 'estres',
    nombre: 'Estrés',
    emociones: ['Estrés', 'Presión', 'Prisa', 'Saturación'],
  },
  {
    id: 'tristeza',
    nombre: 'Tristeza',
    emociones: ['Tristeza', 'Soledad', 'Desánimo', 'Vacío', 'Nostalgia'],
  },
  {
    id: 'rabia',
    nombre: 'Rabia',
    emociones: ['Enfado', 'Frustración', 'Irritación', 'Impotencia'],
  },
  {
    id: 'cansancio',
    nombre: 'Cansancio',
    emociones: ['Cansancio', 'Agotamiento', 'Sueño', 'Desgana'],
  },
  {
    id: 'aburrimiento',
    nombre: 'Aburrimiento',
    emociones: ['Aburrimiento', 'Apatía', 'Vacío de plan'],
  },
  {
    id: 'alegria',
    nombre: 'Alegría',
    emociones: ['Alegría', 'Celebración', 'Ganas de disfrutar'],
  },
  {
    id: 'culpa',
    nombre: 'Culpa',
    emociones: ['Culpa', 'Vergüenza', 'Arrepentimiento'],
  },
];

export const TODAS_LAS_EMOCIONES = EMOCIONES.flatMap((f) => f.emociones);

/** A qué familia pertenece una emoción, para poder agrupar los patrones. */
export function familiaDe(emocion: string | undefined): string | undefined {
  if (!emocion) return undefined;
  const e = emocion.trim().toLowerCase();
  return EMOCIONES.find((f) => f.emociones.some((x) => x.toLowerCase() === e))?.nombre;
}

// ─────────────────────────────────────────────── El árbol de Tats

export type EjercicioId = 'emocion' | 'pausa' | 'cuerpo' | 'cinco' | 'diario';

export interface Ejercicio {
  id: EjercicioId;
  numero: number;
  nombre: string;
  /** Para qué sirve, en una línea, tal y como lo escribió ella. */
  para: string;
  /** Las preguntas que se le hacen dentro. */
  preguntas: string[];
}

/**
 * Los cinco ejercicios de la guía, dentro de la app. En papel hay que buscar
 * cuál toca; aquí el árbol lo decide solo con dos o tres toques, que es la
 * diferencia entre hacerlo y no hacerlo.
 */
export const EJERCICIOS: Record<EjercicioId, Ejercicio> = {
  emocion: {
    id: 'emocion',
    numero: 1,
    nombre: 'Conecta con tu emoción',
    para: 'Reconocer qué estás sintiendo de verdad',
    preguntas: [
      'Respira hondo y mira hacia dentro. ¿Qué está pasando?',
      '¿Qué pasó justo antes?',
    ],
  },
  pausa: {
    id: 'pausa',
    numero: 2,
    nombre: 'Pausa y pregunta',
    para: 'Meter un espacio entre el impulso y la acción',
    preguntas: [
      '¿Qué estoy sintiendo ahora mismo?',
      '¿Qué necesidad real hay detrás de este impulso?',
      '¿Comer esto me va a hacer sentir mejor… o peor después?',
      'Si no como esto ahora, ¿qué podría hacer para cuidarme igual?',
    ],
  },
  cuerpo: {
    id: 'cuerpo',
    numero: 3,
    nombre: 'Mindfulness del cuerpo',
    para: 'Distinguir el hambre física del impulso',
    preguntas: [
      'Recorre el cuerpo de la cabeza a los pies. ¿Dónde notas algo?',
      '¿Eso que notas tiene que ver con el hambre?',
      '¿Qué necesitas de verdad?',
    ],
  },
  cinco: {
    id: 'cinco',
    numero: 4,
    nombre: '5 minutos de reflexión',
    para: 'Parar antes de decidir en caliente',
    preguntas: ['¿Cómo estás ahora, después de los cinco minutos?'],
  },
  diario: {
    id: 'diario',
    numero: 5,
    nombre: 'Diario de emociones',
    para: 'Ver los patrones cuando ya ha pasado',
    preguntas: [
      '¿Qué estabas sintiendo?',
      '¿Qué estaba pasando?',
      '¿Cómo te sentiste después?',
    ],
  },
};

export interface Respuestas {
  /** Ya ha comido: entonces no hay pausa que hacer, hay algo que anotar. */
  yaComio?: boolean;
  sabeQueSiente?: boolean;
  esIntensa?: boolean;
  dudaSiEsHambre?: boolean;
  aPuntoDeComer?: boolean;
}

/**
 * El árbol de decisión de la guía, tal cual. Devuelve `undefined` mientras
 * falte por preguntar algo: así la pantalla sabe si seguir preguntando o si ya
 * puede abrir el ejercicio.
 */
export function queEjercicio(r: Respuestas): EjercicioId | undefined {
  // Si ya comió no hay nada que interrumpir: se anota y ya está.
  if (r.yaComio) return 'diario';
  if (r.sabeQueSiente === undefined) return undefined;
  if (!r.sabeQueSiente) return 'emocion';
  if (r.esIntensa === undefined) return undefined;
  if (r.esIntensa) return 'pausa';
  if (r.dudaSiEsHambre === undefined) return undefined;
  if (r.dudaSiEsHambre) return 'cuerpo';
  if (r.aPuntoDeComer === undefined) return undefined;
  if (r.aPuntoDeComer) return 'cinco';
  return 'diario';
}

/** La pregunta que toca ahora, en el orden del árbol. */
export function siguientePregunta(r: Respuestas): { campo: keyof Respuestas; texto: string } | undefined {
  if (r.yaComio) return undefined;
  if (r.sabeQueSiente === undefined)
    return { campo: 'sabeQueSiente', texto: '¿Sabes qué estás sintiendo?' };
  if (!r.sabeQueSiente) return undefined;
  if (r.esIntensa === undefined)
    return { campo: 'esIntensa', texto: '¿Es una emoción fuerte?' };
  if (r.esIntensa) return undefined;
  if (r.dudaSiEsHambre === undefined)
    return { campo: 'dudaSiEsHambre', texto: '¿Dudas si es hambre de verdad?' };
  if (r.dudaSiEsHambre) return undefined;
  if (r.aPuntoDeComer === undefined)
    return { campo: 'aPuntoDeComer', texto: '¿Estás a punto de comer?' };
  return undefined;
}

// ─────────────────────────────────────────────── Qué hizo, sin aprobado

export const QUE_HIZO = ['comi', 'se-paso', 'otra-cosa', 'sigo'] as const;
export type QueHizo = (typeof QUE_HIZO)[number];

/**
 * Sin «resistí» ni «caí». A veces comer es lo correcto —tenía hambre— y poner
 * un aprobado convertiría cada pausa en un examen.
 */
export const QUE_HIZO_LABELS: Record<QueHizo, string> = {
  comi: 'Comí',
  'se-paso': 'Se me pasó',
  'otra-cosa': 'Hice otra cosa',
  sigo: 'Sigo con las ganas',
};

// ─────────────────────────────────────────────── Señales, sólo para ella

export interface Senal {
  id: string;
  /** Cómo se le pregunta a la clienta: en primera persona y sin juicio. */
  texto: string;
  /** Qué significa para la nutricionista. Nunca se le enseña a la clienta. */
  paraTats: string;
}

/**
 * LO QUE HAY QUE VER PRONTO
 *
 * Esto roza el terreno de los TCA, y hay cuatro cosas que conviene que la
 * nutricionista sepa antes que tarde. Se preguntan **en primera persona y sin
 * juicio**, son opcionales, y **sólo las ve ella**: en la pantalla de la
 * clienta no salen marcadas ni contadas ni de ningún otro modo.
 *
 * La app no diagnostica ni dice nada. Enseña lo que la clienta escribió, para
 * que se hable en consulta, que es donde se habla.
 */
export const SENALES: Senal[] = [
  {
    id: 'sin-control',
    texto: 'Sentí que no podía parar',
    paraTats: 'Pérdida de control: es el criterio que define el atracón',
  },
  {
    id: 'a-solas',
    texto: 'Lo hice a solas para que nadie lo viera',
    paraTats: 'Comer a escondidas por vergüenza',
  },
  {
    id: 'culpa-alta',
    texto: 'Después me sentí muy mal conmigo',
    paraTats: 'Culpa intensa: alimenta el ciclo restricción-atracón',
  },
  {
    id: 'compense',
    texto: 'Después intenté compensarlo',
    paraTats: 'Conducta compensatoria: saltarse comidas, ejercicio de castigo, purga',
  },
];

export const SENALES_POR_ID = Object.fromEntries(SENALES.map((s) => [s.id, s]));

// ─────────────────────────────────────────────── Leer el historial

/** Todas sus pausas, de la más reciente a la más antigua. */
export function pausasDe(registros: RegistroDia[]): Pausa[] {
  return registros
    .flatMap((r) => r.pausas ?? [])
    .sort((a, b) => (b.hora ?? '').localeCompare(a.hora ?? ''));
}

/** Las de los últimos N días, para mirar cómo va últimamente. */
export function pausasDesde(registros: RegistroDia[], dias: number, hoy = new Date()): Pausa[] {
  const corte = new Date(hoy);
  corte.setDate(corte.getDate() - dias);
  const desde = corte.toISOString();
  return pausasDe(registros).filter((p) => (p.hora ?? '') >= desde);
}

export interface Cuenta {
  que: string;
  veces: number;
}

const contar = (valores: (string | undefined)[]): Cuenta[] => {
  const m = new Map<string, number>();
  for (const v of valores) {
    const k = v?.trim();
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([que, veces]) => ({ que, veces }))
    .sort((a, b) => b.veces - a.veces || a.que.localeCompare(b.que));
};

/** En qué franja del día cae una hora. Es lo que más se repite en consulta. */
export function franjaDe(hora: string | undefined): string | undefined {
  if (!hora) return undefined;
  const h = new Date(hora).getHours();
  if (Number.isNaN(h)) return undefined;
  if (h < 12) return 'Por la mañana';
  if (h < 17) return 'Por la tarde';
  if (h < 21) return 'A media tarde';
  return 'Por la noche';
}

export interface Patrones {
  total: number;
  /** Qué emociones se repiten, de más a menos. */
  emociones: Cuenta[];
  /** A qué hora del día. */
  franjas: Cuenta[];
  /** Qué situaciones escribió. */
  situaciones: Cuenta[];
  /**
   * LO QUE LE FUNCIONÓ
   *
   * Lo más útil de todo el panel: las actividades que escribió las veces que
   * eligió hacer otra cosa. En consulta se le puede devolver — «cuando saliste
   * a andar, se te pasó»— y eso es material, no un reproche.
   */
  loQueFunciono: Cuenta[];
  /** Cuántas veces marcó cada señal. Sólo para la nutricionista. */
  senales: { id: string; texto: string; paraTats: string; veces: number }[];
}

/**
 * QUÉ SE VE, Y QUÉ NO
 *
 * Aquí sí hay números, porque esto es la pantalla de la nutricionista y saber
 * si van a más o a menos es su trabajo. En la de la clienta no aparece ninguno.
 */
export function patronesDe(pausas: Pausa[]): Patrones {
  const senales = SENALES.map((s) => ({
    ...s,
    veces: pausas.filter((p) => (p.senales ?? []).includes(s.id)).length,
  })).filter((s) => s.veces > 0);

  return {
    total: pausas.length,
    emociones: contar(pausas.map((p) => p.emocion)),
    franjas: contar(pausas.map((p) => franjaDe(p.hora))),
    situaciones: contar(pausas.map((p) => p.contexto)),
    loQueFunciono: contar(
      pausas.filter((p) => p.queHizo === 'otra-cosa' || p.queHizo === 'se-paso').map((p) => p.actividad),
    ),
    senales,
  };
}

/**
 * Actividades que proponerle en el momento: las que escribió su nutricionista,
 * y si no ha escrito ninguna, unas cuantas de partida.
 *
 * Se le enseñan **tres, no la lista entera**: a las once de la noche, con el
 * impulso encima, veinte opciones es lo mismo que ninguna.
 */
export const ACTIVIDADES_POR_DEFECTO = [
  'Salir a andar diez minutos',
  'Llamar a alguien',
  'Ducha o baño caliente',
  'Estirar o respirar cinco minutos',
  'Poner música y no hacer nada más',
  'Escribir cómo me siento',
  'Salir de la cocina y cambiar de habitación',
  'Beber agua o una infusión',
];

export function tresActividades(suyas: string[] | undefined, semilla = 0): string[] {
  const lista = (suyas ?? []).map((a) => a.trim()).filter(Boolean);
  const fuente = lista.length ? lista : ACTIVIDADES_POR_DEFECTO;
  if (fuente.length <= 3) return fuente;
  // Rotan con la semilla para que no salgan siempre las mismas tres.
  return Array.from({ length: 3 }, (_, i) => fuente[(semilla + i) % fuente.length]);
}
