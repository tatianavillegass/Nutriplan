import type { Alergeno } from '../types/food';

/**
 * PATOLOGÍAS Y CONDICIONES QUE BLOQUEAN ALIMENTOS
 *
 * Cada condición se traduce a una lista de alérgenos/etiquetas que quedan
 * vetadas. Al pautar, cualquier alimento o receta que contenga uno de ellos
 * desaparece de las opciones del cliente.
 */

export interface Patologia {
  id: string;
  nombre: string;
  descripcion: string;
  /** Alérgenos o etiquetas que esta condición bloquea. */
  bloquea: Alergeno[];
  /** Grupo para agrupar el selector. */
  categoria: 'intolerancia' | 'digestivo' | 'metabolico' | 'preferencia';
}

export const PATOLOGIAS: Patologia[] = [
  {
    id: 'celiaquia',
    nombre: 'Celiaquía',
    descripcion: 'Bloquea todo alimento con gluten.',
    bloquea: ['gluten'],
    categoria: 'intolerancia',
  },
  {
    id: 'sensibilidad_gluten',
    nombre: 'Sensibilidad al gluten no celíaca',
    descripcion: 'Bloquea el gluten sin ser celiaquía.',
    bloquea: ['gluten'],
    categoria: 'intolerancia',
  },
  {
    id: 'intolerancia_lactosa',
    nombre: 'Intolerancia a la lactosa',
    descripcion: 'Bloquea lácteos con lactosa.',
    bloquea: ['lactosa'],
    categoria: 'intolerancia',
  },
  {
    id: 'sii_fodmap',
    nombre: 'Síndrome de intestino irritable (bajo en FODMAP)',
    descripcion: 'Bloquea alimentos altos en FODMAP, lactosa incluida.',
    bloquea: ['fodmap', 'lactosa'],
    categoria: 'digestivo',
  },
  {
    id: 'alergia_frutos_secos',
    nombre: 'Alergia a frutos secos',
    descripcion: 'Bloquea frutos secos y sus cremas.',
    bloquea: ['frutos_secos'],
    categoria: 'intolerancia',
  },
  {
    id: 'alergia_huevo',
    nombre: 'Alergia al huevo',
    descripcion: 'Bloquea huevo y derivados.',
    bloquea: ['huevo'],
    categoria: 'intolerancia',
  },
  {
    id: 'alergia_pescado',
    nombre: 'Alergia a pescado y marisco',
    descripcion: 'Bloquea pescado y marisco.',
    bloquea: ['pescado', 'marisco'],
    categoria: 'intolerancia',
  },
  {
    id: 'alergia_soja',
    nombre: 'Alergia a la soja',
    descripcion: 'Bloquea soja y derivados como el tofu.',
    bloquea: ['soja'],
    categoria: 'intolerancia',
  },
  {
    id: 'vegetariano',
    nombre: 'Vegetariano',
    descripcion: 'Sin carne ni pescado. Se filtra por la etiqueta "apto vegetariano".',
    bloquea: [],
    categoria: 'preferencia',
  },
  {
    id: 'vegano',
    nombre: 'Vegano',
    descripcion: 'Sin ningún producto de origen animal.',
    bloquea: [],
    categoria: 'preferencia',
  },
];

export const PATOLOGIAS_POR_ID = Object.fromEntries(PATOLOGIAS.map((p) => [p.id, p]));

export const CATEGORIA_PATOLOGIA_LABELS: Record<Patologia['categoria'], string> = {
  intolerancia: 'Alergias e intolerancias',
  digestivo: 'Digestivo',
  metabolico: 'Metabólico',
  preferencia: 'Preferencias dietéticas',
};

/** Las condiciones que exigen una etiqueta "apto", no un alérgeno vetado. */
export const PATOLOGIA_EXIGE_APTO: Record<string, 'vegetariano' | 'vegano'> = {
  vegetariano: 'vegetariano',
  vegano: 'vegano',
};
