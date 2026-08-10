import type { MealSlot } from '../types/food';

/**
 * PLANTILLAS DE PARTIDA
 *
 * Se cargan la primera vez que se abre la app para no empezar con la pantalla
 * en blanco. Son los alimentos que salen en casi cualquier plan: cada una
 * cubre los tres macros, así que el cliente siempre puede completar su comida.
 *
 * Están pensadas para retocarse: se aplican, se quita lo que no encaje y se
 * añade lo suyo. Si las borras, no vuelven a aparecer.
 */

export interface PlantillaComidaInicial {
  nombre: string;
  slot: MealSlot;
  foodIds: string[];
}

export interface PlantillaDiaInicial {
  nombre: string;
  comidas: Partial<Record<MealSlot, string[]>>;
}

const DESAYUNO_DULCE = [
  // Proteína
  'a-queso-fresco-batido-0',
  'a-yogur-proteinas-mercadona',
  'a-skyr-natural',
  'a-queso-cottage',
  'a-clara-de-huevo',
  // Carbohidrato
  'a-avena-copos',
  'a-pan-integral-tajado',
  'a-platano',
  'a-fresas',
  'a-arandanos',
  'a-manzana',
  // Grasa
  'a-aceite-de-oliva-virgen-extra',
  'a-almendras-crudas',
  'a-crema-de-cacahuete-natural',
];

const DESAYUNO_SALADO = [
  'a-huevo',
  'a-clara-de-huevo',
  'a-jamon-york',
  'a-pavo-pechuga-cruda',
  'a-queso-cottage',
  'a-pan-integral-tajado',
  'a-avena-copos',
  'a-manzana',
  'a-platano',
  'a-aceite-de-oliva-virgen-extra',
  'a-aguacate',
];

const COMIDA = [
  'a-pechuga-de-pollo-cruda',
  'a-pavo-pechuga-cruda',
  'a-merluza-cruda',
  'a-atun-en-lata-al-natural',
  'a-ternera-magra-cruda',
  'a-huevo',
  'a-arroz-blanco-crudo',
  'a-quinoa-cruda',
  'a-pasta-integral-seca',
  'a-patata',
  'a-boniato-cocido',
  'a-lentejas-cocidas',
  'a-garbanzos-cocidos',
  'a-aceite-de-oliva-virgen-extra',
  'a-aguacate',
];

const MERIENDA = [
  'a-yogur-proteinas-mercadona',
  'a-skyr-natural',
  'a-queso-fresco-batido-0',
  'a-tortitas-de-arroz',
  'a-pan-integral-tajado',
  'a-manzana',
  'a-platano',
  'a-nueces',
  'a-almendras-crudas',
  'a-crema-de-cacahuete-natural',
];

const CENA = [
  'a-merluza-cruda',
  'a-salmon-crudo',
  'a-gambas-crudas',
  'a-huevo',
  'a-pechuga-de-pollo-cruda',
  'a-patata',
  'a-boniato-cocido',
  'a-arroz-blanco-crudo',
  'a-pan-integral-tajado',
  'a-aceite-de-oliva-virgen-extra',
  'a-aguacate',
];

export const PLANTILLAS_INICIALES: {
  comidas: PlantillaComidaInicial[];
  dias: PlantillaDiaInicial[];
} = {
  comidas: [
    { nombre: 'Desayuno dulce', slot: 'desayuno', foodIds: DESAYUNO_DULCE },
    { nombre: 'Desayuno salado', slot: 'desayuno', foodIds: DESAYUNO_SALADO },
    { nombre: 'Comida', slot: 'comida', foodIds: COMIDA },
    { nombre: 'Merienda', slot: 'merienda', foodIds: MERIENDA },
    { nombre: 'Cena', slot: 'cena', foodIds: CENA },
  ],
  dias: [
    {
      nombre: 'Día base',
      comidas: {
        desayuno: DESAYUNO_DULCE,
        almuerzo: MERIENDA,
        comida: COMIDA,
        merienda: MERIENDA,
        cena: CENA,
      },
    },
    {
      nombre: 'Día salado',
      comidas: {
        desayuno: DESAYUNO_SALADO,
        almuerzo: MERIENDA,
        comida: COMIDA,
        merienda: MERIENDA,
        cena: CENA,
      },
    },
  ],
};
