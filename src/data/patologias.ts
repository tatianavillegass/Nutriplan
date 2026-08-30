import type { Alergeno, EjeClinico } from '../types/food';

/**
 * PATOLOGÍAS Y CONDICIONES
 *
 * Cada condición hace dos cosas distintas, y la diferencia importa:
 *
 *  · **Bloquea** una lista de alérgenos. Es sí o no: un miligramo de gluten
 *    importa. El alimento desaparece del catálogo de esa paciente y de las
 *    recetas que lo lleven.
 *  · **Vigila** un eje clínico. FODMAP, histamina, níquel, fructosa: ahí la
 *    pregunta no es «¿puede?» sino «¿cuánto?». El alimento NO desaparece; sale
 *    marcado con lo que carga y con la porción segura, y decide ella.
 *
 * Bloquearlo todo sería más simple y parece más seguro, pero no lo es: una
 * paciente de SIBO con todo lo alto bloqueado se queda con arroz y pollo, se
 * aburre a la semana y abandona; y la nutricionista acaba levantando
 * excepciones a mano una por una, que es el trabajo que la app venía a quitar.
 * La dieta baja en FODMAP no es una lista de prohibidos: es de cantidades.
 */

export interface Patologia {
  id: string;
  nombre: string;
  descripcion: string;
  /** Alérgenos que esta condición veta. Sí o no, sin porción segura. */
  bloquea: Alergeno[];
  /** Ejes que hay que vigilar. Marcan en ámbar, no bloquean. */
  vigila?: EjeClinico[];
  /** Grupo para agrupar el selector. */
  categoria: 'intolerancia' | 'digestivo' | 'metabolico' | 'preferencia';
}

export const PATOLOGIAS: Patologia[] = [
  {
    id: 'celiaquia',
    nombre: 'Celiaquía',
    descripcion: 'Bloquea todo alimento con gluten. Ojo con las trazas: la etiqueta manda.',
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
    descripcion:
      'Bloquea la lactosa. Los quesos curados y los sin lactosa siguen valiendo: llevan proteína de leche, no azúcar.',
    bloquea: ['lactosa'],
    categoria: 'intolerancia',
  },
  {
    /**
     * NO ES LO MISMO QUE LA LACTOSA, Y CONFUNDIRLAS HACE DAÑO
     *
     * La lactosa es el azúcar; la proteína son la caseína y el suero. Una leche
     * sin lactosa está llena de caseína. Antes las dos condiciones bloqueaban
     * la misma etiqueta y por eso a una APLV se le colaba todo lo «sin
     * lactosa», que es justo lo que no puede tomar.
     */
    id: 'aplv',
    nombre: 'Alergia a la proteína de la leche (APLV)',
    descripcion:
      'Bloquea caseína y suero. Los «sin lactosa» NO valen: les han quitado el azúcar, no la proteína.',
    bloquea: ['proteina_leche', 'lactosa'],
    categoria: 'intolerancia',
  },
  {
    id: 'sii_fodmap',
    nombre: 'SII / SIBO — baja en FODMAP',
    descripcion:
      'Vigila los FODMAP y bloquea la lactosa. No esconde alimentos: marca cuánto cargan y con qué porción.',
    bloquea: ['lactosa'],
    vigila: ['fodmap'],
    categoria: 'digestivo',
  },
  {
    id: 'histamina',
    nombre: 'Intolerancia a la histamina (DAO)',
    descripcion:
      'Vigila la histamina y los liberadores. El estado del alimento manda: fresco no es lo mismo que en conserva.',
    bloquea: [],
    vigila: ['histamina'],
    categoria: 'digestivo',
  },
  {
    id: 'intolerancia_fructosa',
    nombre: 'Intolerancia a la fructosa',
    descripcion:
      'Vigila la fructosa y el sorbitol. Lo que decide no es cuánta lleva sino si lleva más fructosa que glucosa.',
    bloquea: [],
    vigila: ['fructosa'],
    categoria: 'digestivo',
  },
  {
    id: 'alergia_niquel',
    nombre: 'Alergia sistémica al níquel (SNAS)',
    descripcion:
      'Vigila el níquel. Recuérdale también el cacharro: cocinar ácido en acero inoxidable suelta níquel.',
    bloquea: [],
    vigila: ['niquel'],
    categoria: 'digestivo',
  },
  {
    id: 'alergia_frutos_secos',
    nombre: 'Alergia a frutos secos',
    descripcion: 'Bloquea frutos de cáscara y sus cremas.',
    bloquea: ['frutos_secos'],
    categoria: 'intolerancia',
  },
  {
    id: 'alergia_cacahuete',
    nombre: 'Alergia al cacahuete',
    descripcion: 'Es una legumbre, no un fruto seco: se marca aparte porque se tolera aparte.',
    bloquea: ['cacahuete'],
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
    nombre: 'Alergia al pescado',
    descripcion: 'Sólo pescado. Los crustáceos y los moluscos van aparte.',
    bloquea: ['pescado'],
    categoria: 'intolerancia',
  },
  {
    id: 'alergia_marisco',
    nombre: 'Alergia al marisco',
    descripcion: 'Crustáceos y moluscos.',
    bloquea: ['crustaceos', 'moluscos'],
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
    id: 'alergia_sesamo',
    nombre: 'Alergia al sésamo',
    descripcion: 'Sésamo y tahini.',
    bloquea: ['sesamo'],
    categoria: 'intolerancia',
  },
  {
    id: 'sulfitos',
    nombre: 'Sensibilidad a los sulfitos',
    descripcion: 'Conservas, vino, frutos secos tratados y desecados.',
    bloquea: ['sulfitos'],
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
