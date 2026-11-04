import { describe, it, expect } from 'vitest';
import { matchRecipes } from '../recipeMatcher';
import { catalogoPermitido, evaluarReceta } from '../restrictions';
import { slotDelNombre, slotsSegunElNombre } from '../../types/plan';
import type { Alimento } from '../../types/food';
import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';

/**
 * EL SALMÓN TIENE QUE SALIR BLOQUEADO
 *
 * Sus palabras: «si digo que no come salmón me deben aparecer todas las
 * recetas que tienen salmón bloqueadas, para acordarme de que no quiere comer
 * eso. Pueden haber excepciones, pero yo tengo que saber que hay un
 * ingrediente de esa receta que no quiere comer.»
 *
 * No pasaba, y el motivo no estaba en las restricciones sino en lo que se les
 * daba para mirar: a la pantalla de pautar le llegaba **el catálogo ya
 * filtrado**, sin el salmón. `evaluarReceta` busca el salmón de la receta en
 * esa lista para saber que está vetado, y en una lista sin salmón no lo
 * encontraba: ninguna receta salía bloqueada. Filtrar el catálogo era
 * exactamente lo que desactivaba el aviso.
 */

const SALMON: Alimento = {
  id: 'a-salmon',
  nombre: 'Salmón',
  grupo: 'proteicos_grasos',
  medida_casera: '100 g',
  gramos: 100,
  intercambios: 1,
  nutrientes: { kcal: 208, hc: 0, proteina: 20, grasa: 13 },
  comidas_sugeridas: ['comida'],
  alergenos: [],
  apto: [],
};

const ARROZ: Alimento = {
  ...SALMON,
  id: 'a-arroz',
  nombre: 'Arroz',
  grupo: 'almidones',
  gramos: 20,
  nutrientes: { kcal: 350, hc: 78, proteina: 7, grasa: 1 },
};

const FOODS = [SALMON, ARROZ];

const ing = (id: string, nombre: string, foodId: string, grupo: string, cantidad: number) =>
  ({
    id,
    nombre,
    foodId,
    cantidad_base: cantidad,
    unidad: 'g',
    grupo,
    escalable: true,
    opcional: false,
  }) as Receta['ingredientes'][number];

const PLATO: Receta = {
  id: 'rc_salmon',
  nombre: 'Salmón con arroz',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_grasos: 1, almidones: 1 },
  ingredientes: [
    ing('i1', 'Salmón', SALMON.id, 'proteicos_grasos', 100),
    ing('i2', 'Arroz', ARROZ.id, 'almidones', 20),
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
} as Receta;

/**
 * «No come salmón»: una aversión, no una alergia. Se guardan por **id** del
 * alimento, que es lo que marca en su ficha.
 */
const CLIENTE = {
  id: 'c',
  nombre: 'Luis',
  patologias: [],
  alergias: [],
  aversiones: [SALMON.id],
} as unknown as Client;

const PAUTA = { proteicos_grasos: 1, almidones: 1 };

describe('Con el catálogo completo', () => {
  it('la receta sale bloqueada y dice por qué', () => {
    const ev = evaluarReceta(PLATO, CLIENTE, FOODS);
    expect(ev.bloqueado).toBe(true);
    expect(ev.motivos.join(' ').toLowerCase()).toContain('salmón');
  });

  it('y el recomendador la marca, sin esconderla', () => {
    const [r] = matchRecipes([PLATO], PAUTA, {
      slot: 'comida',
      client: CLIENTE,
      foods: FOODS,
      incluirBloqueadas: true,
    });
    expect(r.bloqueada).toBe(true);
    expect(r.motivosBloqueo?.join(' ').toLowerCase()).toContain('salmón');
  });
});

/**
 * EL BUG, TAL Y COMO ERA
 *
 * Con el catálogo filtrado —el salmón ya no está— nadie puede saber que la
 * receta lleva salmón. Este test deja constancia de por qué no se le puede
 * pasar la lista filtrada a nada que evalúe recetas.
 */
describe('Con el catálogo ya filtrado', () => {
  const filtrado = catalogoPermitido(FOODS, CLIENTE);

  it('el salmón no está en la lista', () => {
    expect(filtrado.some((f) => f.id === SALMON.id)).toBe(false);
  });

  it('y por eso no se bloqueaba nada: era el catálogo, no la regla', () => {
    expect(evaluarReceta(PLATO, CLIENTE, filtrado).bloqueado).toBe(false);
  });
});

/*
 * Y puede haber excepciones: bloqueada no es escondida. Se ve, con el motivo,
 * y ella decide si le cambia el ingrediente o se salta la receta.
 */
describe('Pero se puede elegir igual', () => {
  it('sigue estando en la lista, marcada', () => {
    const r = matchRecipes([PLATO], PAUTA, {
      slot: 'comida',
      client: CLIENTE,
      foods: FOODS,
      incluirBloqueadas: true,
    });
    expect(r).toHaveLength(1);
  });
});

/* ──────────── Camarones en el desayuno: el nombre manda ─────────────────── */

/**
 * «En desayuno me están apareciendo también algunas comidas de la comida
 * (camarones).»
 *
 * El `slot` es lo que filtra las recetas del banco, y renombrar una comida no
 * lo cambiaba: una «Comida» renombrada a «Desayuno» seguía ofreciendo las
 * recetas de la comida.
 */
describe('El slot sale del nombre', () => {
  it('reconoce las cinco comidas', () => {
    expect(slotDelNombre('Desayuno')).toBe('desayuno');
    expect(slotDelNombre('  CENA ')).toBe('cena');
    expect(slotDelNombre('Merienda')).toBe('merienda');
  });

  /* «Desayuno 2» es un desayuno; lo que acompaña no cambia qué comida es. */
  it('y aguanta tildes, mayúsculas y lo que lleve detrás', () => {
    expect(slotDelNombre('Comída 1')).toBe('comida');
    expect(slotDelNombre('Cena (tarde)')).toBe('cena');
    expect(slotDelNombre('Comida del finde')).toBe('comida');
  });

  /* «Pre-entreno» no es ninguna de las cinco: ahí se respeta la que tenga. */
  it('lo que no nombra una comida no decide nada', () => {
    expect(slotDelNombre('Pre-entreno')).toBeUndefined();
    expect(slotDelNombre('')).toBeUndefined();
  });
});

describe('Al cargar un plan ya renombrado', () => {
  const roto = {
    id: 'p',
    dayTypes: [
      {
        id: 'dt',
        meals: [
          /* Era la comida y la renombró «Desayuno»: el slot se quedó atrás. */
          { id: 'comida', nombre: 'Desayuno', slot: 'comida', orden: 1 },
          { id: 'm_pre', nombre: 'Pre-entreno', slot: 'merienda', orden: 2 },
        ],
      },
    ],
  } as unknown as Plan;

  const arreglado = slotsSegunElNombre(roto);
  const meals = arreglado.dayTypes[0].meals;

  it('el desayuno pasa a ser un desayuno', () => {
    expect(meals[0].slot).toBe('desayuno');
  });

  /* Cambiarle el slot la dejaría sin recetas que ofrecer: peor que estaba. */
  it('y el pre-entreno se queda con el suyo', () => {
    expect(meals[1].slot).toBe('merienda');
  });

  it('un plan que ya está bien no se toca', () => {
    expect(slotsSegunElNombre(arreglado)).toBe(arreglado);
  });
});

/* Y lo que de verdad se pedía: que el desayuno no ofrezca camarones. */
describe('Lo que se ofrece en cada comida', () => {
  const CAMARONES: Receta = { ...PLATO, id: 'rc_cam', nombre: 'Camarones', categorias: ['comida'] };

  it('una receta de comida no sale en el desayuno', () => {
    const r = matchRecipes([CAMARONES], PAUTA, { slot: 'desayuno', foods: FOODS });
    expect(r).toHaveLength(0);
  });

  it('y sí en la comida', () => {
    expect(matchRecipes([CAMARONES], PAUTA, { slot: 'comida', foods: FOODS })).toHaveLength(1);
  });
});
