import type { MealSlot } from "./food";

/**
 * UN RETO
 *
 * Un grupo de personas que empiezan el mismo día y hacen el mismo camino:
 * UPGRADE 1.0. Es la diferencia con el trabajo de siempre — ahí cada clienta
 * va a su ritmo y con su plan; aquí el calendario es de todas.
 *
 * QUÉ SE COMPARTE Y QUÉ NO
 * ========================
 * Se comparte el **banco de recetas** y los **recursos**: son los mismos para
 * todo el mundo y por eso veinte participantes cuestan casi lo mismo de montar
 * que una.
 *
 * NO se comparten las porciones. Cada una tiene su plan con sus intercambios,
 * calculados de su gasto como cualquier clienta, y las mismas recetas se le
 * escalan a sus números. Un reto no es «todas comiendo lo mismo»: es todas
 * cocinando lo mismo en la cantidad que le toca a cada una.
 *
 * POR QUÉ UNA PARTICIPANTE ES UNA CLIENTA
 * =======================================
 * Porque así hereda el acceso por correo, el plan, el registro del día, las
 * rachas y el seguimiento sin escribir nada nuevo. Una clienta de siempre
 * puede apuntarse al reto sin dejar de ser tu clienta: sigue teniendo su plan
 * y su ficha, y además el reto.
 */
export interface Reto {
  id: string;
  /** «UPGRADE 1.0». */
  nombre: string;
  /** Dos líneas de qué es, para la pantalla de la participante. */
  descripcion?: string;
  /** YYYY-MM-DD. Todas empiezan el mismo día: es lo que lo hace un reto. */
  fechaInicio: string;
  /** 30, 60 o 90. */
  dias: number;
  /** Ids de las clientas apuntadas. */
  participantes: string[];
  /** Recursos que ven todas las participantes, además de los suyos. */
  recursos: string[];
  /** Recetas del reto, con el día en que se abren. */
  recetas: RecetaDeReto[];
  /** Entrenos, con su día de apertura. Opcional: un reto puede no llevarlos. */
  entrenos?: EntrenoDeReto[];
  /**
   * EL GRUPO DE WHATSAPP
   *
   * La charla del día a día vive donde ya están: en WhatsApp. Competir con
   * WhatsApp en charlar es una pelea perdida —sin notificaciones al móvil, un
   * chat dentro de la app se queda mudo en tres días—, así que la app pone el
   * botón para entrar y se quita de en medio.
   */
  whatsapp?: string;
  createdAt: string;
}

/**
 * UN ENTRENO DEL RETO
 *
 * Se abre por días, como las recetas. Lleva el vídeo —que es lo que de verdad
 * enseña a hacerlo— y la lista de ejercicios con sus series: sin ellas hay que
 * mirar el vídeo entero cada vez para saber cuántas vueltas quedan.
 */
export interface EntrenoDeReto {
  id: string;
  nombre: string;
  /** Para qué es y qué hace falta. Dos líneas. */
  descripcion?: string;
  /** El enlace a tu vídeo: YouTube, Drive, donde lo tengas. */
  videoUrl?: string;
  /** Día del reto en que aparece. 1 = el primer día. */
  desdeDia: number;
  ejercicios: EjercicioDeEntreno[];
}

export interface EjercicioDeEntreno {
  id: string;
  nombre: string;
  /** Cuántas series. */
  series?: number;
  /** «10-12», «40 s», «al fallo»: por eso es texto y no un número. */
  repeticiones?: string;
  descanso?: string;
  nota?: string;
}

/**
 * UNA RECETA DENTRO DEL RETO
 *
 * Con su día de apertura: el reto se va abriendo, no se entrega entero el
 * primer día. Diez recetas de golpe se leen como un PDF y se cierran; tres
 * cada semana se cocinan.
 */
export interface RecetaDeReto {
  recetaId: string;
  /** Para qué comida se ofrece. */
  slot: MealSlot;
  /** Día del reto en que aparece. 1 = el primer día. */
  desdeDia: number;
}

export const DURACIONES = [30, 60, 90] as const;

export type EstadoReto = "proximo" | "en-marcha" | "terminado";
