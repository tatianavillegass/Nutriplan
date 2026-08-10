import { describe, it, expect } from 'vitest';
import {
  calcComposicion,
  calcularEvolucion,
  grasaFaulkner,
  grasaYuhasz,
  imc,
  perimetroCorregido,
  ratioCinturaCadera,
  somatotipo,
} from '../anthropometry';
import { calcularPorcion, sugerirSubgrupo, intercambiosDeGramos } from '../portions';
import { recomendarReparto, distribuirPorComida, proponerGrilla } from '../distribution';
import { evaluarAlimento, evaluarReceta, catalogoPermitido, puntuarPreferencias } from '../restrictions';
import { composicionDesdeIngredientes } from '../recipeComposition';
import { exchangesToMacros } from '../exchanges';
import { kcalFromMacros } from '../macros';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Medicion } from '../../types/anthropometry';
import type { Alimento } from '../../types/food';
import type { Receta } from '../../types/recipe';
import type { Meal } from '../../types/plan';

// ─────────────────────────────────────────── ANTROPOMETRÍA

const MED: Medicion = {
  id: 'm1',
  clientId: 'c1',
  fecha: '2026-01-10',
  peso: 69,
  talla: 185,
  pliegues: {
    triceps: 8,
    subscapular: 10,
    biceps: 4,
    cresta_iliaca: 12,
    supraespinal: 7,
    abdominal: 14,
    muslo: 9,
    medial_pierna: 6,
  },
  perimetros: {
    brazo_relajado: 30,
    brazo_contraido: 33,
    cintura: 78,
    cadera: 96,
    muslo_medio: 54,
    pierna_maximo: 36,
  },
  diametros: { humero: 7, biestiloideo: 5.6, femur: 9.5, tobillo: 7 },
};

describe('Antropometría — índices básicos', () => {
  it('IMC = peso / talla²', () => {
    expect(imc(69, 185)).toBeCloseTo(69 / 1.85 ** 2, 6);
    expect(imc(69, 185)).toBeCloseTo(20.16, 2);
  });

  it('ratio cintura/cadera', () => {
    expect(ratioCinturaCadera(78, 96)).toBeCloseTo(0.8125, 4);
  });

  it('perímetro corregido = perímetro − π × pliegue/10', () => {
    expect(perimetroCorregido(30, 8)).toBeCloseTo(30 - Math.PI * 0.8, 6);
    expect(perimetroCorregido(30, 8)).toBeCloseTo(27.49, 2);
  });

  it('devuelve undefined si falta una medida en vez de inventarla', () => {
    expect(imc(69, undefined)).toBeUndefined();
    expect(ratioCinturaCadera(78, undefined)).toBeUndefined();
    expect(perimetroCorregido(undefined, 8)).toBeUndefined();
  });
});

describe('Antropometría — sumatorios y % graso', () => {
  const c = calcComposicion(MED, 'hombre', 27);

  it('Σ6 y Σ8 suman los pliegues correctos', () => {
    expect(c.suma6).toBe(8 + 10 + 7 + 14 + 9 + 6); // 54
    expect(c.suma8).toBe(54 + 4 + 12); // 70
  });

  it('Faulkner sobre Σ4', () => {
    // Σ4 = 8 + 10 + 7 + 14 = 39 → 39 × 0.153 + 5.783
    expect(grasaFaulkner(MED)).toBeCloseTo(39 * 0.153 + 5.783, 6);
    expect(grasaFaulkner(MED)).toBeCloseTo(11.75, 2);
  });

  it('Yuhasz sobre Σ6, distinto por sexo', () => {
    expect(grasaYuhasz(MED, 'hombre')).toBeCloseTo(54 * 0.1051 + 2.585, 6);
    expect(grasaYuhasz(MED, 'mujer')).toBeCloseTo(54 * 0.1548 + 3.58, 6);
  });

  it('calcula las tres fórmulas y sus kilos de grasa', () => {
    expect(Object.keys(c.grasaPct).sort()).toEqual(['durnin_womersley', 'faulkner', 'yuhasz']);
    for (const k of Object.keys(c.grasaPct) as (keyof typeof c.grasaPct)[]) {
      expect(c.grasaKg[k]).toBeCloseTo((69 * (c.grasaPct[k] as number)) / 100, 6);
      expect((c.grasaKg[k] as number) + (c.masaMagraKg[k] as number)).toBeCloseTo(69, 6);
    }
  });

  it('masa muscular y masa ósea salen cuando hay medidas suficientes', () => {
    expect(c.masaMuscularKg).toBeGreaterThan(20);
    expect(c.masaMuscularKg).toBeLessThan(50);
    expect(c.masaOseaKg).toBeGreaterThan(5);
  });
});

describe('Antropometría — somatotipo Heath-Carter', () => {
  const s = somatotipo(MED, perimetroCorregido(30, 8), perimetroCorregido(36, 6))!;

  it('devuelve los tres componentes y la categoría', () => {
    expect(s.endomorfia).toBeGreaterThan(0);
    expect(s.mesomorfia).toBeGreaterThan(0);
    expect(s.ectomorfia).toBeGreaterThan(0);
    expect(s.categoria).toMatch(/morfo/);
  });

  it('las coordenadas de la somatocarta son coherentes', () => {
    expect(s.x).toBeCloseTo(s.ectomorfia - s.endomorfia, 6);
    expect(s.y).toBeCloseTo(2 * s.mesomorfia - (s.endomorfia + s.ectomorfia), 6);
  });

  it('un sujeto alto y delgado sale más ectomorfo que endomorfo', () => {
    expect(s.ectomorfia).toBeGreaterThan(s.endomorfia);
  });
});

describe('Antropometría — seguimiento', () => {
  const m2: Medicion = {
    ...MED,
    id: 'm2',
    fecha: '2026-03-10',
    peso: 72,
    pliegues: { ...MED.pliegues, abdominal: 11, triceps: 7 },
    perimetros: { ...MED.perimetros, cintura: 76, brazo_relajado: 31.5 },
  };

  const ev = calcularEvolucion([MED, m2], 'hombre', 27, 'faulkner');

  it('compara la última medición con la anterior y con la primera', () => {
    const peso = ev.find((e) => e.key === 'peso')!;
    expect(peso.actual).toBe(72);
    expect(peso.deltaPrevio).toBeCloseTo(3, 6);
    expect(peso.deltaInicial).toBeCloseTo(3, 6);
  });

  it('marca la bajada de grasa y de cintura', () => {
    const grasa = ev.find((e) => e.key === 'grasaPct')!;
    expect(grasa.deltaPrevio).toBeLessThan(0);
    expect(grasa.bajarEsMejor).toBe(true);
    const cintura = ev.find((e) => e.key === 'cintura')!;
    expect(cintura.deltaPrevio).toBeCloseTo(-2, 6);
  });

  it('ordena por fecha aunque lleguen desordenadas', () => {
    const ev2 = calcularEvolucion([m2, MED], 'hombre', 27, 'faulkner');
    expect(ev2.find((e) => e.key === 'peso')!.actual).toBe(72);
  });

  it('con una sola medición no hay delta previo', () => {
    const ev1 = calcularEvolucion([MED], 'hombre', 27, 'faulkner');
    expect(ev1.find((e) => e.key === 'peso')!.deltaPrevio).toBeUndefined();
  });
});

// ─────────────────────────────────────────── PORCIONES

describe('De nutrientes por 100 g a gramos por intercambio', () => {
  it('la avena: 60 g de HC por 100 g → 25 g por intercambio de almidones', () => {
    const p = calcularPorcion({ kcal: 380, hc: 60, proteina: 13, grasa: 7, fibra: 10 }, 'almidones')!;
    expect(p.gramosExactos).toBeCloseTo((100 * 14) / 60, 6); // 23.33
    expect(p.gramos).toBe(25); // redondeo a múltiplos de 5
    expect(p.ancla).toBe('hc');
  });

  it('la pechuga de pollo se define por la proteína, no por el HC', () => {
    const p = calcularPorcion({ kcal: 110, hc: 0, proteina: 23, grasa: 1.5 }, 'proteicos_magros')!;
    expect(p.ancla).toBe('proteina');
    expect(p.gramosExactos).toBeCloseTo((100 * 7) / 23, 6); // 30.43
    expect(p.gramos).toBe(30);
  });

  it('el aceite se define por la grasa', () => {
    const p = calcularPorcion({ kcal: 900, hc: 0, proteina: 0, grasa: 100 }, 'grasas')!;
    expect(p.gramos).toBe(5);
    expect(p.aporta.kcal).toBeCloseTo(45, 4);
  });

  it('informa de lo que aporta realmente frente al nominal del subgrupo', () => {
    const p = calcularPorcion({ hc: 60, proteina: 13, grasa: 7 }, 'almidones')!;
    expect(p.aporta.hc).toBeCloseTo(15, 4); // 25 g × 60%
    expect(p.nominal.hc).toBe(14);
    expect(p.desviacion.hc).toBeCloseTo((15 - 14) / 14 * 100, 4);
  });

  it('avisa cuando el alimento no encaja en el subgrupo elegido', () => {
    // Un fruto seco metido en almidones: mucha grasa para ese grupo.
    const p = calcularPorcion({ hc: 20, proteina: 20, grasa: 50 }, 'almidones')!;
    expect(p.avisos.length).toBeGreaterThan(0);
  });

  it('devuelve undefined si el macro ancla es cero', () => {
    expect(calcularPorcion({ hc: 0, proteina: 23, grasa: 1 }, 'almidones')).toBeUndefined();
  });

  it('sugiere el subgrupo a partir del perfil de nutrientes', () => {
    expect(sugerirSubgrupo({ hc: 0, proteina: 23, grasa: 1.5 })).toBe('proteicos_magros');
    expect(sugerirSubgrupo({ hc: 0, proteina: 20, grasa: 13 })).toBe('proteicos_grasos');
    expect(sugerirSubgrupo({ hc: 0, proteina: 0, grasa: 100 })).toBe('grasas');
    expect(sugerirSubgrupo({ hc: 60, proteina: 13, grasa: 7, azucar: 1 })).toBe('almidones');
    expect(sugerirSubgrupo({ hc: 12, proteina: 1, grasa: 0.3, azucar: 10 })).toBe('fruta');
    expect(sugerirSubgrupo({ hc: 5, proteina: 3.4, grasa: 0.1 })).toBe('lacteos_desnatados');
    expect(sugerirSubgrupo({ hc: 4, proteina: 10, grasa: 0 })).toBe('lacteos_proteicos');
    expect(sugerirSubgrupo({ hc: 4, proteina: 2, grasa: 0.3, azucar: 2 })).toBe('verduras');
  });

  it('convierte gramos en intercambios', () => {
    const n = { hc: 60, proteina: 13, grasa: 7 };
    expect(intercambiosDeGramos(n, 'almidones', 50)).toBeCloseTo(2, 6); // 50 / 25
  });
});

// ─────────────────────────────────────────── REPARTO RECOMENDADO

describe('Recomendador de porciones — caso de la nutricionista', () => {
  // kcal 1700 · proteína 108 g · carbohidratos 180 g · grasas 60.9 g
  const objetivo = { proteina: 108, hc: 180, grasa: 60.9 };
  const r = recomendarReparto(objetivo);

  it('reproduce el reparto esperado', () => {
    expect(r.intercambios).toEqual({
      verduras: 3,
      fruta: 3,
      almidones: 9,
      proteicos_grasos: 4,
      proteicos_magros: 7.5,
      grasas: 6,
    });
  });

  it('los macros resultantes quedan a menos de 1 g del objetivo', () => {
    expect(Math.abs(r.desviacion.proteina)).toBeLessThan(1);
    expect(Math.abs(r.desviacion.hc)).toBeLessThan(3.5);
    expect(Math.abs(r.desviacion.grasa)).toBeLessThan(1);
  });

  it('las kcal caen dentro del 1% del objetivo', () => {
    const kcalObjetivo = kcalFromMacros(objetivo);
    expect(Math.abs(r.kcal - kcalObjetivo) / kcalObjetivo).toBeLessThan(0.01);
  });

  it('todo sale en medios intercambios', () => {
    for (const v of Object.values(r.intercambios)) {
      expect((v as number) * 2 % 1).toBe(0);
    }
  });

  it('la nutricionista puede cambiar los fijos y el resto se recalcula', () => {
    const conLacteos = recomendarReparto(objetivo, { lacteos: 2, fruta: 2 });
    expect(conLacteos.intercambios.lacteos_desnatados).toBe(2);
    expect(conLacteos.intercambios.fruta).toBe(2);
    // Menos fruta y más lácteos → menos almidones, porque los lácteos traen HC.
    expect(conLacteos.intercambios.almidones).toBeLessThan(9);
    expect(Math.abs(conLacteos.desviacion.proteina)).toBeLessThan(4);
  });

  it('cambiar el reparto magros/grasos mueve las grasas para compensar', () => {
    const magro = recomendarReparto(objetivo, { pctProteicosGrasos: 0 });
    expect(magro.intercambios.proteicos_grasos).toBeUndefined();
    expect(magro.intercambios.grasas).toBeGreaterThan(6);
    expect(Math.abs(magro.desviacion.grasa)).toBeLessThan(1.5);
  });

  it('la grasa nunca se pide, siempre es el residuo (§10.2)', () => {
    const alto = recomendarReparto({ proteina: 150, hc: 300, grasa: 50 });
    const macros = exchangesToMacros(alto.intercambios);
    expect(macros.grasa).toBeLessThanOrEqual(50 + 2.5);
  });
});

describe('Distribución por comida', () => {
  const meals: Meal[] = [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'almuerzo', nombre: 'Almuerzo', slot: 'almuerzo', orden: 2 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 3 },
    { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 4 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 5 },
  ];
  const { grid, reparto } = proponerGrilla({ proteina: 108, hc: 180, grasa: 60.9 }, meals);

  it('reparte el total sin perder ni inventar intercambios', () => {
    for (const [g, total] of Object.entries(reparto.intercambios)) {
      const sumado = meals.reduce((s, m) => s + (grid[m.id]?.[g as never] ?? 0), 0);
      expect(sumado).toBeCloseTo(total as number, 6);
    }
  });

  it('las verduras sólo caen en comida y cena', () => {
    expect(grid.desayuno.verduras).toBeUndefined();
    expect((grid.comida.verduras ?? 0) + (grid.cena.verduras ?? 0)).toBe(3);
  });

  it('la fruta no cae en comida ni cena', () => {
    expect(grid.comida.fruta).toBeUndefined();
    expect(grid.cena.fruta).toBeUndefined();
  });

  it('la comida principal recibe más almidones que el almuerzo', () => {
    expect(grid.comida.almidones ?? 0).toBeGreaterThan(grid.almuerzo?.almidones ?? 0);
  });

  it('con una sola comida todo va a esa comida', () => {
    const uno: Meal[] = [{ id: 'unico', nombre: 'Único', slot: 'comida', orden: 1 }];
    const g = distribuirPorComida({ almidones: 4, proteicos_magros: 3 }, uno);
    expect(g.unico).toEqual({ almidones: 4, proteicos_magros: 3 });
  });
});

// ─────────────────────────────────────────── RESTRICCIONES

const pan: Alimento = {
  id: 'x-pan',
  nombre: 'Pan integral tajado',
  grupo: 'almidones',
  medida_casera: '1 rebanada',
  gramos: 30,
  intercambios: 1,
  comidas_sugeridas: ['desayuno'],
  alergenos: ['gluten'],
  apto: ['vegetariano', 'vegano'],
};
const yogur: Alimento = {
  id: 'x-yogur',
  nombre: 'Yogur natural',
  grupo: 'lacteos_desnatados',
  medida_casera: '1 unidad',
  gramos: 125,
  intercambios: 1,
  comidas_sugeridas: ['desayuno'],
  alergenos: ['lactosa'],
  apto: ['vegetariano'],
};
const pollo: Alimento = {
  id: 'x-pollo',
  nombre: 'Pollo',
  grupo: 'proteicos_magros',
  medida_casera: 'filete',
  gramos: 30,
  intercambios: 1,
  comidas_sugeridas: ['comida'],
  alergenos: [],
  apto: [],
};

describe('Restricciones por patología, aversión y preferencia', () => {
  it('la celiaquía bloquea el gluten', () => {
    const ev = evaluarAlimento(pan, { patologias: ['celiaquia'], alergias: [], aversiones: [] });
    expect(ev.bloqueado).toBe(true);
    expect(ev.clinico).toBe(true);
    expect(ev.motivos[0]).toMatch(/gluten/i);
  });

  it('el protocolo FODMAP bloquea también la lactosa', () => {
    const ev = evaluarAlimento(yogur, { patologias: ['sii_fodmap'], alergias: [], aversiones: [] });
    expect(ev.bloqueado).toBe(true);
  });

  it('una aversión bloquea el alimento pero no es motivo clínico', () => {
    const ev = evaluarAlimento(pollo, { patologias: [], alergias: [], aversiones: ['x-pollo'] });
    expect(ev.bloqueado).toBe(true);
    expect(ev.clinico).toBe(false);
  });

  it('ser vegano exige la etiqueta apta, no basta con no tener alérgenos', () => {
    expect(evaluarAlimento(pollo, { patologias: ['vegano'], alergias: [], aversiones: [] }).bloqueado).toBe(true);
    expect(evaluarAlimento(pan, { patologias: ['vegano'], alergias: [], aversiones: [] }).bloqueado).toBe(false);
  });

  it('sin restricciones no se bloquea nada', () => {
    const libre = { patologias: [], alergias: [], aversiones: [] };
    expect(catalogoPermitido([pan, yogur, pollo], libre)).toHaveLength(3);
    expect(catalogoPermitido(FOOD_CATALOG, libre)).toHaveLength(FOOD_CATALOG.length);
  });

  it('el catálogo se reduce con la celiaquía', () => {
    const conGluten = FOOD_CATALOG.filter((f) => f.alergenos.includes('gluten')).length;
    const filtrado = catalogoPermitido(FOOD_CATALOG, {
      patologias: ['celiaquia'],
      alergias: [],
      aversiones: [],
    });
    expect(conGluten).toBeGreaterThan(0);
    expect(filtrado).toHaveLength(FOOD_CATALOG.length - conGluten);
  });
});

describe('Bloqueo de recetas', () => {
  const receta: Receta = {
    id: 'r1',
    nombre: 'Tostada con pollo',
    categorias: ['desayuno'],
    tags: ['rápido'],
    base: { almidones: 1, proteicos_magros: 1 },
    ingredientes: [
      { id: 'i1', nombre: 'Pan integral tajado', foodId: 'x-pan', cantidad_base: 30, unidad: 'g', grupo: 'almidones', escalable: true, opcional: false },
      { id: 'i2', nombre: 'Pollo', foodId: 'x-pollo', cantidad_base: 30, unidad: 'g', grupo: 'proteicos_magros', escalable: true, opcional: false },
      { id: 'i3', nombre: 'Yogur para untar', foodId: 'x-yogur', cantidad_base: 20, unidad: 'g', grupo: 'lacteos_desnatados', escalable: false, opcional: true },
    ],
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  };
  const foods = [pan, yogur, pollo];

  it('un ingrediente obligatorio bloqueado tumba la receta', () => {
    const ev = evaluarReceta(receta, { patologias: ['celiaquia'], alergias: [], aversiones: [] }, foods);
    expect(ev.bloqueado).toBe(true);
    expect(ev.motivos.join(' ')).toMatch(/Pan integral/);
  });

  it('un ingrediente opcional bloqueado sólo se quita', () => {
    const ev = evaluarReceta(
      receta,
      { patologias: ['intolerancia_lactosa'], alergias: [], aversiones: [] },
      foods,
    );
    expect(ev.bloqueado).toBe(false);
    expect(ev.ingredientesAQuitar).toEqual(['i3']);
  });

  it('sin restricciones la receta pasa entera', () => {
    const ev = evaluarReceta(receta, { patologias: [], alergias: [], aversiones: [] }, foods);
    expect(ev.bloqueado).toBe(false);
    expect(ev.ingredientesAQuitar).toHaveLength(0);
  });

  it('los alimentos preferidos suben la puntuación de la receta', () => {
    expect(puntuarPreferencias(receta, { preferidos: ['x-pollo'], preferencias: [] })).toBe(2);
    expect(puntuarPreferencias(receta, { preferidos: [], preferencias: ['rápido'] })).toBe(1);
    expect(puntuarPreferencias(receta, { preferidos: [], preferencias: [] })).toBe(0);
  });
});

// ─────────────────────────────────────────── RECETAS DESDE EL CATÁLOGO

describe('Composición de receta calculada desde la base de alimentos', () => {
  const avena: Alimento = {
    id: 'f-avena',
    nombre: 'Avena copos',
    grupo: 'almidones',
    medida_casera: '1/4 taza',
    gramos: 25,
    intercambios: 1,
    nutrientes: { kcal: 380, hc: 60, proteina: 13, grasa: 7, fibra: 10 },
    comidas_sugeridas: ['desayuno'],
    alergenos: ['gluten'],
    apto: ['vegetariano', 'vegano'],
  };
  const clara: Alimento = {
    id: 'f-clara',
    nombre: 'Clara de huevo',
    grupo: 'proteicos_magros',
    medida_casera: '2 claras',
    gramos: 60,
    intercambios: 1,
    nutrientes: { kcal: 48, hc: 0.7, proteina: 11, grasa: 0.2 },
    comidas_sugeridas: ['desayuno'],
    alergenos: ['huevo'],
    apto: ['vegetariano'],
  };
  const foods = [avena, clara];

  const tortitas: Receta = {
    id: 'r-tortitas',
    nombre: 'Tortitas de avena',
    categorias: ['desayuno'],
    tags: [],
    base: {},
    ingredientes: [
      { id: 'i1', nombre: 'Avena copos', foodId: 'f-avena', cantidad_base: 50, unidad: 'g', grupo: 'almidones', escalable: true, opcional: false },
      { id: 'i2', nombre: 'Clara de huevo', foodId: 'f-clara', cantidad_base: 120, unidad: 'g', grupo: 'proteicos_magros', escalable: true, opcional: false },
      { id: 'i3', nombre: 'Canela', cantidad_base: null, unidad: 'al gusto', grupo: 'condimento', escalable: false, opcional: true },
    ],
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  };

  const c = composicionDesdeIngredientes(tortitas, foods);

  it('clasifica cada ingrediente en su grupo y cuenta los intercambios', () => {
    // avena: porción guardada 25 g → 50 g = 2 intercambios
    expect(c.exacto.almidones).toBeCloseTo(2, 6);
    // clara: la porción guardada en el catálogo (60 g) manda → 120/60 = 2
    expect(c.exacto.proteicos_magros).toBeCloseTo(2, 6);
  });

  it('la porción guardada manda sobre la que saldría de los nutrientes', () => {
    // Por sus 11 g de proteína/100 g la porción calculada sería de 65 g,
    // pero el catálogo guarda 60 g y ésa es la que ve el cliente.
    const calculada = calcularPorcion(clara.nutrientes!, 'proteicos_magros')!;
    expect(calculada.gramos).toBe(65);
    expect(clara.gramos).toBe(60);
    expect(c.exacto.proteicos_magros).toBeCloseTo(120 / 60, 6);
  });

  it('sin porción guardada se deduce de los nutrientes', () => {
    const sinGramos: Alimento = { ...clara, id: 'f-clara2', gramos: 0, intercambios: 0 };
    const receta = {
      ingredientes: [
        { id: 'i1', nombre: 'Clara', foodId: 'f-clara2', cantidad_base: 130, unidad: 'g', grupo: 'proteicos_magros' as const, escalable: true, opcional: false },
      ],
    };
    const r = composicionDesdeIngredientes(receta, [sinGramos]);
    expect(r.exacto.proteicos_magros).toBeCloseTo(130 / 65, 6);
  });

  it('la base se guarda en medios intercambios', () => {
    expect(c.base.almidones).toBe(2);
    expect(c.base.proteicos_magros).toBe(2);
  });

  it('los condimentos no aportan intercambios', () => {
    expect(c.aportes.find((a) => a.nombre === 'Canela')!.libre).toBe(true);
  });

  it('los macros de la receta salen de la tabla de intercambios', () => {
    expect(c.macros.hc).toBeCloseTo(2 * EXCHANGE_GROUPS.almidones.hc, 4);
    expect(c.kcal).toBeCloseTo(kcalFromMacros(c.macros), 6);
  });

  it('las verduras presentes quedan marcadas como ilimitadas', () => {
    const conVerdura = composicionDesdeIngredientes(
      {
        ingredientes: [
          { id: 'v', nombre: 'Espinaca', cantidad_base: null, unidad: 'al gusto', grupo: 'verduras', escalable: false, opcional: true },
        ],
      },
      foods,
    );
    expect(conVerdura.base.verduras).toBe('ilimitado');
  });
});
