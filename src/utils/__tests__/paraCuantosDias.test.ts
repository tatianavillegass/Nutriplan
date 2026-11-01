import { describe, it, expect } from 'vitest';
import { diasEntre, masDias, menuDelRango, TOPE_DE_DIAS } from '../menuSemana';
import { listaDeLaCompra } from '../listaCompra';
import type { RegistroDia } from '../../types/diary';
import type { Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';

/**
 * DE CUÁNDO A CUÁNDO QUIERE COMPRAR
 *
 * «Quiero comprar para 2 semanas, o para 2 días, o elegir la fecha de cuándo a
 * cuándo.» La lista salía de lunes a domingo porque de ahí sale el menú, pero
 * la semana del calendario no es la del supermercado.
 */

/* Lunes 2 de noviembre de 2026. */
const LUNES = '2026-11-02';
const JUEVES = '2026-11-05';

describe('Los días de un rango', () => {
  it('del jueves al jueves son ocho', () => {
    expect(diasEntre(JUEVES, masDias(JUEVES, 7))).toHaveLength(8);
  });

  it('dos días son hoy y mañana', () => {
    expect(diasEntre(JUEVES, masDias(JUEVES, 1))).toEqual(['2026-11-05', '2026-11-06']);
  });

  it('un solo día es un día', () => {
    expect(diasEntre(JUEVES, JUEVES)).toEqual([JUEVES]);
  });

  /* Un rango al revés es un dedo en la fecha equivocada, no una lista vacía. */
  it('al revés, se queda en el primero', () => {
    expect(diasEntre(JUEVES, LUNES)).toEqual([JUEVES]);
  });

  /* Una lista de dos meses no es una lista: ni la verdura aguanta. */
  it('y hay un tope', () => {
    expect(diasEntre(LUNES, '2027-01-01')).toHaveLength(TOPE_DE_DIAS);
  });
});

const reg = (fecha: string, dias: Record<string, string>): RegistroDia =>
  ({
    id: `r-${fecha}`,
    clientId: 'c',
    fecha,
    recetaElegida: {},
    cumplidas: [],
    porciones: {},
    sustituciones: {},
    extras: [],
    menuSemana: {
      inicio: fecha,
      dias: Object.fromEntries(
        Object.entries(dias).map(([f, r]) => [f, { comidas: { comida: r } }]),
      ),
    },
  }) as unknown as RegistroDia;

describe('El menú de un rango', () => {
  /* Esta semana tiene menú; la que viene, no — como casi siempre. */
  const registros = [
    reg(LUNES, { [LUNES]: 'rc_a', [JUEVES]: 'rc_b' }),
  ];

  it('coge los días que tienen menú', () => {
    const r = menuDelRango(undefined, registros, LUNES, JUEVES);
    expect(Object.keys(r.dias)).toEqual([LUNES, JUEVES]);
    expect(r.dias[JUEVES].comidas.comida).toBe('rc_b');
  });

  /*
   * Lo que hace que «comprar para 2 semanas» sirva de algo: el jueves que
   * viene se compra como este jueves.
   */
  it('y repite el mismo día de la semana en los que no lo tienen', () => {
    const otroJueves = masDias(JUEVES, 7);
    const r = menuDelRango(undefined, registros, LUNES, otroJueves);
    expect(r.dias[otroJueves].comidas.comida).toBe('rc_b');
    expect(r.repetidos).toContain(otroJueves);
  });

  /* Y no copia el lunes en el sábado: quien entrena el sábado come distinto. */
  it('no mezcla unos días con otros', () => {
    const sabado = masDias(LUNES, 12);
    const r = menuDelRango(undefined, registros, LUNES, sabado);
    expect(r.dias[sabado]).toBeUndefined();
    expect(r.vacios).toContain(sabado);
  });

  it('sin repetir, los días sin menú se quedan fuera', () => {
    const otroJueves = masDias(JUEVES, 7);
    const r = menuDelRango(undefined, registros, LUNES, otroJueves, false);
    expect(r.dias[otroJueves]).toBeUndefined();
    expect(r.repetidos).toEqual([]);
    expect(r.vacios).toContain(otroJueves);
  });

  /* Una comida en blanco es una que quitó a propósito: no es «sin menú». */
  it('lo que ella quitó no se rellena con otra cosa', () => {
    const vacio = [reg(LUNES, { [LUNES]: '' })];
    const r = menuDelRango(undefined, vacio, LUNES, LUNES);
    expect(r.dias[LUNES]).toBeUndefined();
    expect(r.vacios).toEqual([LUNES]);
  });
});

/* ───────────────────────── Y la lista sale de esos días ──────────────────── */

const POLLO: Alimento = {
  id: 'a-pollo',
  nombre: 'Pollo',
  grupo: 'proteicos_magros',
  medida_casera: '30 g',
  gramos: 30,
  intercambios: 1,
  nutrientes: { kcal: 165, hc: 0, proteina: 23, grasa: 2 },
  comidas_sugeridas: [],
  alergenos: [],
  apto: [],
};

const PLATO: Receta = {
  id: 'rc_a',
  nombre: 'Pollo al horno',
  categorias: ['comida'],
  tags: [],
  base: { proteicos_magros: 1 },
  ingredientes: [
    {
      id: 'i1',
      nombre: 'Pollo',
      foodId: POLLO.id,
      cantidad_base: 30,
      unidad: 'g',
      grupo: 'proteicos_magros',
      escalable: true,
      opcional: false,
    },
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
} as Receta;

const PLAN: Plan = {
  id: 'p',
  clientId: 'c',
  nombre: 'Plan',
  fase: 1,
  archivado: false,
  createdAt: '',
  updatedAt: '',
  dayTypes: [
    {
      id: 'dt',
      nombre: 'Base',
      proteinaGkg: 2,
      hcGkg: 3,
      meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
      grid: { comida: { proteicos_magros: 4 } },
      notas: {},
    },
  ],
} as unknown as Plan;

describe('La lista de la compra de un rango', () => {
  const registros = [
    reg(LUNES, Object.fromEntries(diasEntre(LUNES, masDias(LUNES, 6)).map((f) => [f, 'rc_a']))),
  ];

  const listaDe = (desde: string, hasta: string) => {
    const r = menuDelRango(undefined, registros, desde, hasta);
    const menu = { inicio: LUNES, dias: r.dias };
    return listaDeLaCompra(menu, PLAN, [PLATO], [POLLO], diasEntre(desde, hasta));
  };

  it('dos días son dos comidas', () => {
    const l = listaDe(LUNES, masDias(LUNES, 1));
    expect(l.comidas).toBe(2);
    expect(l.dias).toBe(2);
  });

  /* Lo que se pedía: el doble de días, el doble de pollo. */
  it('y catorce días compran el doble que siete', () => {
    const semana = listaDe(LUNES, masDias(LUNES, 6));
    const dos = listaDe(LUNES, masDias(LUNES, 13));
    expect(dos.comidas).toBe(semana.comidas * 2);
    const gr = (l: typeof semana) => l.lineas.find((x) => x.foodId === POLLO.id)!.cantidad;
    expect(gr(dos)).toBeCloseTo(gr(semana) * 2, 0);
  });

  /* Sin decir fechas, la semana del menú: quien no lo toque ve lo de siempre. */
  it('sin fechas, sigue siendo la semana', () => {
    const r = menuDelRango(undefined, registros, LUNES, masDias(LUNES, 6));
    const l = listaDeLaCompra({ inicio: LUNES, dias: r.dias }, PLAN, [PLATO], [POLLO]);
    expect(l.comidas).toBe(7);
    expect(l.dias).toBe(7);
  });
});
