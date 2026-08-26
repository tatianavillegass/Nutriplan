import type { Client } from '../types/client';
import type { Plan } from '../types/plan';

const now = '2026-01-01T00:00:00.000Z';

/**
 * DATOS DE EJEMPLO — se cargan sólo la primera vez que se abre la app
 * (si no hay ningún cliente guardado). Reproducen el caso de referencia:
 * hombre, 27 años, 69 kg, 185 cm, factor 1.5, superávit ×1.2.
 *
 * Se pueden borrar desde la lista de clientes sin efectos secundarios.
 */
export const DEMO_CLIENT: Client = {
  id: 'cl_demo',
  nombre: 'Caso de referencia (ejemplo)',
  email: '',
  edad: 27,
  peso: 69,
  altura: 185,
  sexo: 'hombre',
  activityFactorId: 'sed_5', // 1.50
  objetivo: 'ganancia_muscular',
  goalMultiplier: 1.2,
  bmrFormula: 'media',
  alergias: [],
  preferencias: ['pollo', 'batch cooking'],
  notas:
    'Cliente de ejemplo para probar la app. TMB media 1682 (1686 con Harris-Benedict de 1919), GET 2775 y objetivo 3330 kcal.',
  createdAt: now,
  updatedAt: now,
};

export const DEMO_PLAN: Plan = {
  id: 'pl_demo',
  clientId: 'cl_demo',
  nombre: 'Planificación 1',
  fase: 2,
  fecha: now,
  envio: { fecha: now, mensaje: 'Este es el plan de ejemplo para ver cómo funciona la app.' },
  createdAt: now,
  updatedAt: now,
  /*
   * Los platos son los mismos entrene o no: lo que cambia son las cantidades,
   * que salen del reparto de cada día. El almuerzo sólo existe el día de
   * entreno, y por eso sólo ese día lleva intercambios repartidos ahí.
   */
  recetasAsignadas: {
    comida: ['rc_wok_pollo', 'rc_lentejas'],
    cena: ['rc_bowl_salmon'],
  },
  dayTypes: [
    {
      id: 'dt_demo_entreno',
      nombre: 'Día entreno',
      proteinaGkg: 2,
      hcGkg: 4.5,
      meals: [
        { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
        { id: 'almuerzo', nombre: 'Almuerzo', slot: 'almuerzo', orden: 2 },
        { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 3 },
        { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 4 },
        { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 5 },
      ],
      grid: {
        desayuno: { proteicos_magros: 3, almidones: 3, fruta: 1, grasas: 1 },
        almuerzo: { proteicos_magros: 1, fruta: 1, grasas: 1 },
        comida: { proteicos_magros: 5, almidones: 4, grasas: 2, verduras: 2 },
        merienda: { proteicos_magros: 2, almidones: 2, grasas: 1 },
        cena: { proteicos_semigrasos: 4, almidones: 3, grasas: 1, verduras: 2 },
      },
      notas: {
        comida: 'Verdura ilimitada, mínimo ½ plato (200 g).',
        cena: 'Verdura ilimitada, mínimo ½ plato (200 g).',
      },
      postre: '1 onza de chocolate negro 85% o una infusión.',
    },
    {
      id: 'dt_demo_descanso',
      nombre: 'Día descanso',
      proteinaGkg: 2,
      hcGkg: 3,
      meals: [
        { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
        { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
        { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 3 },
        { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 4 },
      ],
      grid: {
        desayuno: { proteicos_magros: 3, almidones: 2, fruta: 1, grasas: 1 },
        comida: { proteicos_magros: 5, almidones: 3, grasas: 2, verduras: 2 },
        merienda: { proteicos_magros: 2, fruta: 1, grasas: 1 },
        cena: { proteicos_semigrasos: 4, almidones: 2, grasas: 1, verduras: 2 },
      },
      notas: {},
      postre: '',
    },
  ],
};
