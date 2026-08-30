import type { Alimento, Alergeno, Carga, CargaDeEje, EjeClinico } from '../types/food';
import {
  ALERGENO_LABELS,
  CARGA_LABELS,
  EJE_LABELS,
  TIPO_FODMAP_LABELS,
} from '../types/food';
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
  /**
   * LO QUE HAY QUE VIGILAR, QUE NO ES LO MISMO QUE BLOQUEAR
   *
   * Carga alta o moderada en un eje que ella le ha activado. NO esconde el
   * alimento: lo marca en ámbar con la porción segura si la hay. Media aguacate
   * cuadra en una dieta baja en FODMAP y uno entero no, así que aquí la
   * decisión sigue siendo suya.
   */
  avisos?: AvisoDeCarga[];
  /**
   * Ejes activos que este alimento tiene **sin revisar**. Sin dato no es sin
   * problema: es que nadie lo ha mirado, y decirlo es la diferencia entre
   * ayudar y mentir.
   */
  sinDatos?: EjeClinico[];
}

export interface AvisoDeCarga {
  eje: EjeClinico;
  nivel: Carga;
  /** «Alto en FODMAP (fructanos) · bajo hasta 40 g» */
  texto: string;
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

/** Ejes clínicos que hay que vigilarle, por sus patologías. */
export function ejesVigilados(client: Pick<Client, 'patologias'>): EjeClinico[] {
  const set = new Set<EjeClinico>();
  for (const id of client.patologias ?? []) {
    for (const e of PATOLOGIAS_POR_ID[id]?.vigila ?? []) set.add(e);
  }
  return [...set];
}

/** «Alto en FODMAP (fructanos) · bajo hasta 40 g» */
export function describeCarga(eje: EjeClinico, c: CargaDeEje): string {
  const partes = [`${CARGA_LABELS[c.nivel]} en ${EJE_LABELS[eje].toLowerCase()}`];
  if (c.tipos?.length) {
    partes[0] += ` (${c.tipos.map((t) => TIPO_FODMAP_LABELS[t].toLowerCase()).join(', ')})`;
  }
  if (c.liberador) partes.push('liberador de histamina');
  if (c.porcionSegura) partes.push(`bajo hasta ${c.porcionSegura} g`);
  if (c.nota) partes.push(c.nota);
  return partes.join(' · ');
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

  /*
   * Las cargas se miran SIEMPRE, esté bloqueado o no, y nunca bloquean. Un
   * alimento vetado por gluten que además es alto en fructanos sigue siendo
   * las dos cosas, y a ella le sirve saberlo.
   */
  const avisos: AvisoDeCarga[] = [];
  const sinDatos: EjeClinico[] = [];
  for (const eje of ejesVigilados(client)) {
    const c = food.cargas?.[eje];
    if (!c) {
      sinDatos.push(eje);
      continue;
    }
    if (c.nivel === 'bajo') continue;
    avisos.push({ eje, nivel: c.nivel, texto: describeCarga(eje, c) });
  }

  const extra = {
    ...(avisos.length ? { avisos } : {}),
    ...(sinDatos.length ? { sinDatos } : {}),
  };

  return motivos.length
    ? { bloqueado: true, motivos, clinico, ...extra }
    : { ...LIBRE, ...extra };
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

  /*
   * UNA RECETA CARGA LO QUE CARGUE SU PEOR INGREDIENTE
   *
   * Si lleva cebolla, es alta en fructanos aunque todo lo demás sea bajo. Así
   * las recetas se etiquetan solas desde sus ingredientes y no hay que
   * marcarlas a mano una por una.
   */
  const peor = new Map<EjeClinico, AvisoDeCarga>();
  const sinDatos = new Set<EjeClinico>();
  const anotar = (ev: Bloqueo) => {
    for (const a of ev.avisos ?? []) {
      const ya = peor.get(a.eje);
      if (!ya || (ya.nivel === 'moderado' && a.nivel === 'alto')) peor.set(a.eje, a);
    }
    for (const e of ev.sinDatos ?? []) sinDatos.add(e);
  };

  for (const ing of receta.ingredientes) {
    const food = ing.foodId ? porId.get(ing.foodId) : undefined;
    if (!food) continue;
    const ev = evaluarAlimento(food, client);
    // Lo que se quita no carga: por eso los avisos sólo cuentan si se queda.
    if (!ing.opcional || !ev.bloqueado) anotar(ev);
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

  return {
    bloqueado,
    motivos: [...new Set(motivos)],
    clinico,
    ingredientesAQuitar,
    ...(peor.size ? { avisos: [...peor.values()] } : {}),
    ...(sinDatos.size ? { sinDatos: [...sinDatos] } : {}),
  };
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
