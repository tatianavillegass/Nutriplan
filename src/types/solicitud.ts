import type { Sexo } from "./calculations";

/**
 * UNA SOLICITUD DE RETO
 *
 * Lo que rellena alguien que acaba de pagar, desde el enlace público. No es una
 * clienta todavía: es lo que hace falta para poder serlo.
 *
 * EL ORDEN IMPORTA: SE COBRA PRIMERO
 * ==================================
 * Al formulario sólo se llega después de pagar, porque Stripe manda aquí al
 * terminar. Con eso no se acumulan fichas sin pagar ni se pierde nadie que haya
 * pagado: rellenar es el paso siguiente, con la inercia de lo ya hecho.
 *
 * El alta la da la nutricionista a mano, y ese paso no es burocracia: es donde
 * ve un peso que descuadra los g/kg o un antecedente que hay que hablar antes
 * de meter a alguien en un reto de 30 días.
 */
export interface Solicitud {
  id: string;
  retoId: string;
  creada: string;

  // ── Quién eres ──────────────────────────────
  nombre: string;
  email: string;
  telefono?: string;
  /** YYYY-MM-DD */
  fechaNacimiento: string;
  sexo: Sexo;

  // ── Tu cuerpo ───────────────────────────────
  peso: number;
  altura: number;
  /** Con un metro de costura. Dice más de la grasa que importa que la báscula. */
  cintura?: number;
  /** Sólo si tiene báscula que lo mida. */
  grasaPct?: number;

  // ── Tu día ──────────────────────────────────
  /** Cuántas veces come al día: de ahí salen las comidas de su plan. */
  comidasDia: number;
  activityFactorId: string;
  objetivo: "perder_peso" | "mantenimiento" | "ganancia_muscular";

  // ── Antes de empezar ────────────────────────
  embarazoLactancia: boolean;
  antecedenteTca: boolean;
  salud?: string;
  noComo?: string;
}

/** Cuántas comidas se pueden elegir. Menos de 2 o más de 6 no es un plan. */
export const COMIDAS_POSIBLES = [2, 3, 4, 5, 6] as const;

/**
 * Sin esto no se puede calcular nada, así que no se deja enviar. Todo lo demás
 * es opcional: cada campo obligatorio de más es gente que abandona.
 */
export function solicitudCompleta(s: Partial<Solicitud>): boolean {
  return !!(
    s.nombre?.trim() &&
    s.email?.trim().includes("@") &&
    s.fechaNacimiento &&
    s.sexo &&
    s.peso &&
    s.peso > 25 &&
    s.altura &&
    s.altura > 100 &&
    s.comidasDia
  );
}

export type Gravedad = "ojo" | "para";

export interface AvisoSolicitud {
  gravedad: Gravedad;
  texto: string;
}

/**
 * LO QUE HAY QUE MIRAR ANTES DE DAR DE ALTA
 *
 * El paso manual existe por esto. Un reto de 30 días no le va bien a todo el
 * mundo, y un peso muy alto pautado en g/kg de peso total da una proteína que
 * no necesita nadie.
 *
 * «para» es rojo y pide hablarlo antes; «ojo» es ámbar y sólo informa.
 */
export function avisosDeSolicitud(s: Solicitud): AvisoSolicitud[] {
  const avisos: AvisoSolicitud[] = [];

  if (s.antecedenteTca) {
    avisos.push({
      gravedad: "para",
      texto:
        "Ha marcado antecedente de trastorno de la conducta alimentaria. Háblalo antes de darla de alta.",
    });
  }

  if (s.embarazoLactancia) {
    avisos.push({
      gravedad: "para",
      texto:
        "Está embarazada o dando el pecho: el plan del reto no le sirve tal cual.",
    });
  }

  const imc = s.altura > 0 ? s.peso / (s.altura / 100) ** 2 : 0;
  if (imc >= 27) {
    avisos.push({
      gravedad: "ojo",
      texto:
        "Con su peso, los g/kg sobre el total se le irán altos. Se calculará sobre peso ajustado.",
    });
  }
  if (imc > 0 && imc < 18.5) {
    avisos.push({
      gravedad: "para",
      texto:
        "Su peso está por debajo de lo normal para su altura. Merece una conversación antes.",
    });
  }

  if (s.salud?.trim()) {
    avisos.push({ gravedad: "ojo", texto: `Ha escrito: «${s.salud.trim()}»` });
  }

  return avisos;
}

/** ¿Hay algo que obligue a pararse? */
export function hayQueHablarlo(s: Solicitud): boolean {
  return avisosDeSolicitud(s).some((a) => a.gravedad === "para");
}
