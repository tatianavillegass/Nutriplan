import type { Alimento, Alergeno } from '../types/food';
import { ALERGENO_LABELS } from '../types/food';
import type { Receta } from '../types/recipe';
import type { Client } from '../types/client';
import { PATOLOGIAS_POR_ID, PATOLOGIA_EXIGE_APTO } from '../data/patologias';

/**
 * RESTRICCIONES DEL CLIENTE
 *
 * Tres capas, de más a menos rígida:
 *   1. Patologías  → bloquean por alérgeno/etiqueta. No se pueden saltar.
 *   2. Aversiones  → alimentos concretos que el cliente no quiere.
 *   3. Preferidos  → no bloquean nada; suben posiciones en el recomendador.
 */

export interface Bloqueo {
  bloqueado: boolean;
  /** Motivos legibles, para mostrarlos en la interfaz. */
  motivos: string[];
  /** true si el motivo es clínico (patología) y no una simple preferencia. */
  clinico: boolean;
}

const LIBRE: Bloqueo = { bloqueado: false, motivos: [], clinico: false };

/** Alérgenos vetados por las patologías del cliente. */
export function alergenosBloqueados(client: Pick<Client, 'patologias' | 'alergias'>): Alergeno[] {
  const set = new Set<Alergeno>(client.alergias ?? []);
  for (const id of client.patologias ?? []) {
    for (const a of PATOLOGIAS_POR_ID[id]?.bloquea ?? []) set.add(a);
  }
  return [...set];
}

/** Etiquetas "apto" que el cliente exige (vegetariano, vegano). */
export function aptosExigidos(client: Pick<Client, 'patologias'>): ('vegetariano' | 'vegano')[] {
  const out = new Set<'vegetariano' | 'vegano'>();
  for (const id of client.patologias ?? []) {
    const a = PATOLOGIA_EXIGE_APTO[id];
    if (a) out.add(a);
  }
  return [...out];
}

export function evaluarAlimento(
  food: Alimento,
  client: Pick<Client, 'patologias' | 'alergias' | 'aversiones'>,
): Bloqueo {
  const motivos: string[] = [];
  let clinico = false;

  const vetados = alergenosBloqueados(client);
  for (const a of food.alergenos ?? []) {
    if (vetados.includes(a)) {
      motivos.push(`Contiene ${ALERGENO_LABELS[a].toLowerCase()}`);
      clinico = true;
    }
  }

  for (const apto of aptosExigidos(client)) {
    if (!(food.apto ?? []).includes(apto)) {
      motivos.push(`No apto ${apto}`);
      clinico = true;
    }
  }

  if ((client.aversiones ?? []).includes(food.id)) {
    motivos.push('En su lista de alimentos que no quiere');
  }

  return motivos.length ? { bloqueado: true, motivos, clinico } : LIBRE;
}

/** Catálogo ya filtrado para un cliente concreto. */
export function catalogoPermitido(
  foods: Alimento[],
  client: Pick<Client, 'patologias' | 'alergias' | 'aversiones'>,
): Alimento[] {
  return foods.filter((f) => !evaluarAlimento(f, client).bloqueado);
}

/**
 * Una receta queda bloqueada si alguno de sus ingredientes obligatorios lo está.
 * Un ingrediente opcional bloqueado no tumba la receta: se avisa y se quita.
 */
export function evaluarReceta(
  receta: Receta,
  client: Pick<Client, 'patologias' | 'alergias' | 'aversiones'>,
  foods: Alimento[],
): Bloqueo & { ingredientesAQuitar: string[] } {
  const motivos: string[] = [];
  const ingredientesAQuitar: string[] = [];
  let clinico = false;
  let bloqueado = false;

  const porId = new Map(foods.map((f) => [f.id, f]));

  for (const ing of receta.ingredientes) {
    const food = ing.foodId ? porId.get(ing.foodId) : undefined;
    if (!food) continue;
    const ev = evaluarAlimento(food, client);
    if (!ev.bloqueado) continue;

    if (ing.opcional) {
      ingredientesAQuitar.push(ing.id);
      continue;
    }
    bloqueado = true;
    clinico = clinico || ev.clinico;
    motivos.push(`${ing.nombre}: ${ev.motivos.join(' · ').toLowerCase()}`);
  }

  // Etiquetas declaradas a mano en la receta (por si no tiene ingredientes enlazados).
  const vetados = alergenosBloqueados(client);
  for (const a of receta.alergenos ?? []) {
    if (vetados.includes(a)) {
      bloqueado = true;
      clinico = true;
      motivos.push(`La receta contiene ${ALERGENO_LABELS[a].toLowerCase()}`);
    }
  }

  return { bloqueado, motivos: [...new Set(motivos)], clinico, ingredientesAQuitar };
}

/**
 * Puntúa cuánto encaja una receta con los gustos del cliente.
 * 0 = neutra. Positivo = contiene alimentos o etiquetas preferidas.
 */
export function puntuarPreferencias(
  receta: Receta,
  client: Pick<Client, 'preferidos' | 'preferencias'>,
): number {
  let p = 0;
  const preferidos = client.preferidos ?? [];
  for (const ing of receta.ingredientes) {
    if (ing.foodId && preferidos.includes(ing.foodId)) p += 2;
  }
  const tags = (receta.tags ?? []).map((t) => t.toLowerCase());
  for (const pref of client.preferencias ?? []) {
    if (tags.includes(pref.toLowerCase())) p += 1;
  }
  return p;
}
