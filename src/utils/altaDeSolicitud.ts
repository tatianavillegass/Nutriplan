import type { Client } from "../types/client";
import type { Meal } from "../types/plan";
import type { Solicitud } from "../types/solicitud";
import { pesoAjustado, pesoIdeal } from "./pesoReferencia";

/**
 * DE SOLICITUD A CLIENTA
 *
 * Una participante es una clienta más: con eso hereda el acceso por correo, el
 * plan, el registro del día, las rachas y el seguimiento sin escribir nada
 * nuevo. Aquí se traduce lo que rellenó en la ficha que espera la app.
 */

/** Las comidas del día según cuántas veces come. Es lo que pesa en el plan. */
export function comidasDelPlan(cuantas: number): Meal[] {
  const posibles: Meal[] = [
    { id: "desayuno", nombre: "Desayuno", slot: "desayuno", orden: 1 },
    { id: "almuerzo", nombre: "Almuerzo", slot: "almuerzo", orden: 2 },
    { id: "comida", nombre: "Comida", slot: "comida", orden: 3 },
    { id: "merienda", nombre: "Merienda", slot: "merienda", orden: 4 },
    { id: "cena", nombre: "Cena", slot: "cena", orden: 5 },
    { id: "recena", nombre: "Recena", slot: "extra", orden: 6 },
  ];

  /**
   * Qué se quita al bajar de comidas: primero los picoteos, y las tres grandes
   * se quedan siempre. Con dos comidas se va la cena, no el desayuno: quien
   * come dos veces al día casi siempre hace desayuno y comida.
   */
  const porCuantas: Record<number, string[]> = {
    2: ["desayuno", "comida"],
    3: ["desayuno", "comida", "cena"],
    4: ["desayuno", "comida", "merienda", "cena"],
    5: ["desayuno", "almuerzo", "comida", "merienda", "cena"],
    6: ["desayuno", "almuerzo", "comida", "merienda", "cena", "recena"],
  };

  const ids =
    porCuantas[Math.min(6, Math.max(2, Math.round(cuantas)))] ?? porCuantas[4];
  return posibles
    .filter((m) => ids.includes(m.id))
    .map((m, i) => ({ ...m, orden: i + 1 }));
}

/**
 * La ficha que se crea al dar de alta. El peso de referencia se decide aquí:
 * si su IMC está alto, sobre peso ajustado — no porque lo diga la app, sino
 * porque 2 g/kg de peso total le darían una proteína que no necesita.
 */
export function clienteDeSolicitud(
  s: Solicitud,
): Omit<Client, "id" | "createdAt" | "updatedAt"> {
  const imc = s.altura > 0 ? s.peso / (s.altura / 100) ** 2 : 0;
  const puedeAjustarse = (pesoAjustado(s.peso, s.altura) ?? s.peso) < s.peso;

  return {
    nombre: s.nombre.trim(),
    email: s.email.trim().toLowerCase(),
    telefono: s.telefono?.trim() || undefined,
    fechaNacimiento: s.fechaNacimiento,
    edad: 0, // sale de la fecha de nacimiento
    fechaAlta: s.creada.slice(0, 10),
    peso: s.peso,
    altura: s.altura,
    sexo: s.sexo,
    activityFactorId: s.activityFactorId,
    objetivo: s.objetivo,
    goalMultiplier: 1,
    bmrFormula: "media",
    alergias: [],
    preferencias: [],
    basePeso: imc >= 27 && puedeAjustarse ? "ajustado" : "total",
    /**
     * Llegó por el enlace del reto, así que vive en la pantalla del reto y no
     * en la lista de la consulta. Es una clienta por dentro —hereda todo— pero
     * mezclarla con las de siempre deja esa lista inservible.
     */
    soloReto: true,
    notas: notasDeSolicitud(s),
  };
}

/**
 * Lo que escribió en el formulario, guardado en sus notas. No se tira: es lo
 * único que sabemos de ella antes de la primera conversación.
 */
export function notasDeSolicitud(s: Solicitud): string {
  const lineas = [
    `Se apuntó por el enlace del reto el ${s.creada.slice(0, 10)}.`,
    `Come ${s.comidasDia} veces al día.`,
  ];

  if (s.cintura) lineas.push(`Cintura declarada: ${s.cintura} cm.`);
  if (s.grasaPct) lineas.push(`% de grasa de su báscula: ${s.grasaPct} %.`);
  if (s.salud?.trim()) lineas.push(`Salud: ${s.salud.trim()}`);
  if (s.noComo?.trim()) lineas.push(`No come: ${s.noComo.trim()}`);
  if (s.embarazoLactancia) lineas.push("Marcó embarazo o lactancia.");
  if (s.antecedenteTca)
    lineas.push("Marcó antecedente de trastorno alimentario.");

  const ideal = pesoIdeal(s.altura);
  const ajustado = pesoAjustado(s.peso, s.altura);
  if (ideal && ajustado && ajustado < s.peso) {
    lineas.push(
      `Los g/kg se calculan sobre peso ajustado: ${Math.round(s.peso)} → ${Math.round(ajustado)} kg.`,
    );
  }

  return lineas.join("\n");
}
