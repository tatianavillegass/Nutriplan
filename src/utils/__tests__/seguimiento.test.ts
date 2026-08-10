import { describe, it, expect } from 'vitest';
import {
  evolucionCorporal,
  fechaMenos,
  resumenAdherencia,
  resumenDelPlan,
  usoDeAlimentos,
} from '../seguimiento';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Meal, Plan } from '../../types/plan';
import type { RegistroDia } from '../../types/diary';
import type { Medicion } from '../../types/anthropometry';

const MEALS: Meal[] = [
  { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
  { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
  { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 3 },
];

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: MEALS,
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 2, grasas: 1 },
    comida: { proteicos_magros: 4, almidones: 3, grasas: 2, verduras: 2 },
    cena: { proteicos_magros: 3, almidones: 2, grasas: 1, verduras: 2 },
  },
  despensa: {
    desayuno: { seleccion: ['a-huevo', 'a-avena-copos', 'a-aceite-de-oliva-virgen-extra'] },
  },
  notas: {},
};

const PLAN: Plan = {
  id: 'pl',
  clientId: 'c1',
  nombre: 'Planificación 2',
  fase: 3,
  dayTypes: [DIA],
  fecha: '2026-05-01T00:00:00.000Z',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

const HOY = new Date('2026-08-08T12:00:00Z');

const registro = (fecha: string, extra: Partial<RegistroDia> = {}): RegistroDia => ({
  id: `r-${fecha}`,
  clientId: 'c1',
  fecha,
  dayTypeId: 'dt',
  recetaElegida: {},
  cumplidas: [],
  porciones: {},
  sustituciones: {},
  extras: [],
  ...extra,
});

describe('Ventana de los últimos 30 días', () => {
  it('cuenta hacia atrás desde hoy', () => {
    expect(fechaMenos(0, HOY)).toBe('2026-08-08');
    expect(fechaMenos(1, HOY)).toBe('2026-08-07');
    expect(fechaMenos(30, HOY)).toBe('2026-07-09');
  });

  it('devuelve un hueco por día, del más antiguo al de hoy', () => {
    const r = resumenAdherencia(PLAN, [], 30, HOY);
    expect(r.dias).toHaveLength(30);
    expect(r.dias[0].fecha).toBe('2026-07-10');
    expect(r.dias[29].fecha).toBe('2026-08-08');
  });
});

describe('Adherencia', () => {
  const registros = [
    registro('2026-08-08', { cumplidas: ['desayuno', 'comida', 'cena'] }), // 100 %
    registro('2026-08-07', { cumplidas: ['desayuno'] }), // 33 %
    registro('2026-08-06', { cumplidas: ['desayuno', 'comida'] }), // 67 %
  ];

  const r = resumenAdherencia(PLAN, registros, 30, HOY);

  it('la media sólo mira los días apuntados', () => {
    expect(r.registrados).toBe(3);
    expect(r.totalDias).toBe(30);
    expect(r.media).toBeCloseTo((100 + 33 + 67) / 3, 0);
  });

  it('un día sin registro queda en blanco, no en cero', () => {
    const hueco = r.dias.find((d) => d.fecha === '2026-08-01')!;
    expect(hueco.porcentaje).toBeUndefined();
  });

  it('cuenta los días completos', () => {
    expect(r.completos).toBe(1);
  });

  it('sin ningún registro no inventa una media', () => {
    const vacio = resumenAdherencia(PLAN, [], 30, HOY);
    expect(vacio.media).toBeUndefined();
    expect(vacio.registrados).toBe(0);
  });

  it('los extras suman kcal por día', () => {
    const conExtras = resumenAdherencia(
      PLAN,
      [
        registro('2026-08-08', {
          cumplidas: ['desayuno'],
          extras: [
            {
              id: 'e1',
              nombre: 'Cerveza',
              macros: { hc: 10, proteina: 0, grasa: 0 },
              kcal: 150,
            },
          ],
        }),
      ],
      30,
      HOY,
    );
    expect(conExtras.kcalExtrasDia).toBeCloseTo(150, 4);
  });
});

describe('Qué elige el cliente', () => {
  const registros = [
    registro('2026-08-08', {
      porciones: { desayuno: { 'a-huevo': 2, 'a-avena-copos': 1 }, comida: { 'a-huevo': 1 } },
    }),
    registro('2026-08-07', { porciones: { desayuno: { 'a-huevo': 2 } } }),
  ];

  const uso = usoDeAlimentos(registros, [DIA], FOOD_CATALOG);

  it('suma las porciones de todas las comidas y días', () => {
    const huevo = uso.elegidos.find((u) => u.foodId === 'a-huevo')!;
    expect(huevo.porciones).toBe(5);
    expect(huevo.dias).toBe(2);
  });

  it('ordena por lo más repetido', () => {
    expect(uso.elegidos[0].foodId).toBe('a-huevo');
  });

  it('avisa de lo que le ofreces y no toca', () => {
    expect(uso.sinTocar.map((u) => u.foodId)).toEqual(['a-aceite-de-oliva-virgen-extra']);
  });

  it('sin registros no hay nada elegido ni conclusiones raras', () => {
    const vacio = usoDeAlimentos([], [DIA], FOOD_CATALOG);
    expect(vacio.elegidos).toEqual([]);
    expect(vacio.sinTocar).toHaveLength(3);
  });
});

describe('Evolución corporal', () => {
  const medicion = (fecha: string, peso: number, triceps: number): Medicion => ({
    id: `m-${fecha}`,
    clientId: 'c1',
    fecha,
    peso,
    talla: 170,
    pliegues: {
      triceps,
      subscapular: 12,
      biceps: 5,
      cresta_iliaca: 14,
      supraespinal: 9,
      abdominal: 16,
      muslo: 12,
      medial_pierna: 8,
    },
    perimetros: { brazo_relajado: 28, brazo_contraido: 30, cintura: 74, cadera: 96, muslo_medio: 52, pierna_maximo: 34 },
    diametros: { humero: 6.5, biestiloideo: 5.2, femur: 9, tobillo: 6.5 },
  });

  const puntos = evolucionCorporal(
    [medicion('2026-06-01', 68, 14), medicion('2026-04-01', 71, 18)],
    'mujer',
    35,
  );

  it('ordena por fecha aunque lleguen al revés', () => {
    expect(puntos.map((p) => p.fecha)).toEqual(['2026-04-01', '2026-06-01']);
  });

  it('trae peso, % graso y masa muscular de cada medición', () => {
    expect(puntos[1].peso).toBe(68);
    expect(puntos[1].grasaPct).toBeGreaterThan(0);
    expect(puntos[1].masaMuscularKg).toBeGreaterThan(0);
  });

  it('menos pliegues significa menos porcentaje graso', () => {
    expect(puntos[1].grasaPct!).toBeLessThan(puntos[0].grasaPct!);
  });

  it('sin mediciones devuelve una serie vacía', () => {
    expect(evolucionCorporal([], 'mujer', 35)).toEqual([]);
  });
});

describe('Tarjeta de la planificación', () => {
  const r = resumenDelPlan(PLAN)!;

  it('las kcal salen de la grilla pautada', () => {
    expect(r.kcal).toBeGreaterThan(1000);
    expect(r.dias).toBe(1);
  });

  it('los tres porcentajes suman 100', () => {
    expect(r.pct.hc + r.pct.proteina + r.pct.grasa).toBeCloseTo(100, 4);
  });

  it('un plan sin tipos de día no revienta', () => {
    expect(resumenDelPlan({ ...PLAN, dayTypes: [] })).toBeUndefined();
  });
});
