import type { RegistroDia } from '../types/diary';

/**
 * PREPARARSE ANTES DE EMPEZAR
 *
 * Entre que se apunta y que arranca el reto pasan días, y ese hueco es donde
 * se pierde la gente. Una lista corta de cosas que hacer —tres— convierte la
 * espera en algo que se puede terminar, y de paso deja el punto de partida
 * tomado: sin foto ni cintura del primer día, el día 30 no hay con qué
 * comparar y sólo queda el peso, que es lo que peor cuenta lo que ha pasado.
 *
 * NO SE LE PIDE EL PESO
 * =====================
 * Se toma en consulta o lo apunta ella en su seguimiento. Abrir la app por
 * primera vez con una báscula por delante marca el tono equivocado para
 * treinta días.
 *
 * DÓNDE VIVE
 * ==========
 * En el registro del día en que lo hizo, como todo lo que escribe la clienta:
 * es lo único que sube su app. La lista se junta leyendo sus días.
 */

export type PasoId = 'medidas' | 'foto' | 'guia';

export interface Paso {
  id: PasoId;
  titulo: string;
  detalle: string;
}

export const PASOS_DE_PREPARACION: Paso[] = [
  {
    id: 'medidas',
    titulo: 'Mídete la cintura y la cadera',
    detalle: 'Con una cinta, en ayunas. Es lo que se mueve cuando el peso no se mueve.',
  },
  {
    id: 'foto',
    titulo: 'Hazte la foto del primer día',
    detalle: 'La comparación que más motiva al final. Puedes guardarla tú o subirla aquí.',
  },
  {
    id: 'guia',
    titulo: 'Lee la guía de raciones',
    detalle: 'Diez minutos que te ahorran las dudas de la primera semana.',
  },
];

export interface Preparacion {
  hechos: PasoId[];
  cintura?: number;
  cadera?: number;
  /** Sólo si ella ha querido subirla: el paso se puede dar por hecho sin foto. */
  foto?: string;
  /** Cuándo se completó cada paso, para no perder el orden al juntar días. */
  fecha?: string;
}

/** Todo lo que haya ido marcando, junto: cada paso pudo ser un día distinto. */
export function preparacionDe(registros: RegistroDia[]): Preparacion {
  const ordenados = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const out: Preparacion = { hechos: [] };

  for (const r of ordenados) {
    const p = r.preparacion;
    if (!p) continue;
    for (const paso of p.hechos ?? []) if (!out.hechos.includes(paso)) out.hechos.push(paso);
    if (p.cintura) out.cintura = p.cintura;
    if (p.cadera) out.cadera = p.cadera;
    if (p.foto) out.foto = p.foto;
    out.fecha = r.fecha;
  }
  return out;
}

export function preparacionCompleta(p: Preparacion): boolean {
  return PASOS_DE_PREPARACION.every((paso) => p.hechos.includes(paso.id));
}
