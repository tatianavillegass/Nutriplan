/**
 * RECURSOS PARA EL CLIENTE
 *
 * Lo que la nutricionista quiere tener a mano en el perfil de sus clientas y
 * no cabe en el plan: la guía visual de raciones, marcas que recomienda, cómo
 * leer una etiqueta, un vídeo.
 *
 * Son de la consulta, no de una clienta: se escriben una vez y las ven todas.
 * Si algún día hace falta uno para una persona concreta, se añade un `clientId`
 * opcional y se filtra; hoy no lo necesita y el trabajo de mantenerlos por
 * clienta no compensa.
 */
export interface Recurso {
  id: string;
  titulo: string;
  /** Dos líneas de para qué sirve. Opcional: a veces el título ya lo dice. */
  descripcion?: string;
  /** Enlace externo, si lo hay. */
  url?: string;
  /** Imagen incrustada (dataURL), como las fotos de las recetas. */
  imagen?: string;
  /** Para ordenarlos a mano: menor primero. */
  orden: number;
  createdAt: string;
}

/** Los que se le enseñan a la clienta, en el orden en que se pusieron. */
export function recursosVisibles(recursos: Recurso[]): Recurso[] {
  return [...recursos].sort(
    (a, b) => a.orden - b.orden || a.createdAt.localeCompare(b.createdAt),
  );
}

/** Un recurso vale si tiene título y algo más: texto, enlace o imagen. */
export function recursoUtil(r: Partial<Recurso>): boolean {
  return !!r.titulo?.trim() && !!(r.descripcion?.trim() || r.url?.trim() || r.imagen);
}
