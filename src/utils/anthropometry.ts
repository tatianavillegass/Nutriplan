import type {
  Composicion,
  DeltaMedicion,
  FormulaGrasaId,
  Medicion,
  PliegueId,
  Somatotipo,
} from '../types/anthropometry';
import {
  PLIEGUE_LABELS,
  SUMA_4_DW,
  SUMA_4_FAULKNER,
  SUMA_6,
  SUMA_8,
} from '../types/anthropometry';
import type { Sexo } from '../types/calculations';

/**
 * CÁLCULOS ANTROPOMÉTRICOS (perfil ISAK)
 *
 * Funciones puras. Cada una devuelve `undefined` si le faltan medidas,
 * en vez de inventar un número: en consulta es habitual medir sólo una parte.
 */

const has = (...v: (number | undefined)[]): boolean =>
  v.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0);

function suma(m: Medicion, ids: PliegueId[]): number | undefined {
  const vals = ids.map((i) => m.pliegues[i]);
  if (!vals.every((v) => has(v))) return undefined;
  return vals.reduce<number>((s, v) => s + (v as number), 0);
}

/** Índice de masa corporal. */
export function imc(peso?: number, tallaCm?: number): number | undefined {
  if (!has(peso, tallaCm)) return undefined;
  const m = (tallaCm as number) / 100;
  return (peso as number) / (m * m);
}

export function categoriaImc(v?: number): string | undefined {
  if (v == null) return undefined;
  if (v < 18.5) return 'Bajo peso';
  if (v < 25) return 'Normopeso';
  if (v < 30) return 'Sobrepeso';
  if (v < 35) return 'Obesidad grado I';
  if (v < 40) return 'Obesidad grado II';
  return 'Obesidad grado III';
}

/** Ratio cintura/cadera. */
export function ratioCinturaCadera(cintura?: number, cadera?: number): number | undefined {
  if (!has(cintura, cadera)) return undefined;
  return (cintura as number) / (cadera as number);
}

/** Umbrales OMS de riesgo cardiometabólico. */
export function riesgoIcc(v: number | undefined, sexo: Sexo): string | undefined {
  if (v == null) return undefined;
  const limite = sexo === 'hombre' ? 0.9 : 0.85;
  return v >= limite ? 'Riesgo elevado' : 'Riesgo bajo';
}

/** Perímetro corregido = perímetro − π × (pliegue en cm). */
export function perimetroCorregido(perimetro?: number, pliegueMm?: number): number | undefined {
  if (!has(perimetro, pliegueMm)) return undefined;
  return (perimetro as number) - Math.PI * ((pliegueMm as number) / 10);
}

// ── % de grasa ──────────────────────────────────────────────

/** Faulkner: %G = Σ4 × 0.153 + 5.783. Σ4 = tríceps + subescapular + supraespinal + abdominal. */
export function grasaFaulkner(m: Medicion): number | undefined {
  const s = suma(m, SUMA_4_FAULKNER);
  return s == null ? undefined : s * 0.153 + 5.783;
}

/** Yuhasz sobre Σ6, con constantes por sexo. */
export function grasaYuhasz(m: Medicion, sexo: Sexo): number | undefined {
  const s = suma(m, SUMA_6);
  if (s == null) return undefined;
  return sexo === 'hombre' ? s * 0.1051 + 2.585 : s * 0.1548 + 3.58;
}

/** Coeficientes de Durnin-Womersley para log10(Σ4) por sexo y franja de edad. */
const DW: Record<Sexo, [number, number, number][]> = {
  // [edadMax, c, m] → densidad = c − m × log10(Σ4)
  hombre: [
    [19, 1.162, 0.063],
    [29, 1.1631, 0.0632],
    [39, 1.1422, 0.0544],
    [49, 1.162, 0.07],
    [200, 1.1715, 0.0779],
  ],
  mujer: [
    [19, 1.1549, 0.0678],
    [29, 1.1599, 0.0717],
    [39, 1.1423, 0.0632],
    [49, 1.1333, 0.0612],
    [200, 1.1339, 0.0645],
  ],
};

/** Durnin-Womersley → densidad corporal → % grasa por Siri. */
export function grasaDurninWomersley(m: Medicion, sexo: Sexo, edad: number): number | undefined {
  const s = suma(m, SUMA_4_DW);
  if (s == null || !has(edad)) return undefined;
  const fila = DW[sexo].find(([max]) => edad <= max) ?? DW[sexo][DW[sexo].length - 1];
  const densidad = fila[1] - fila[2] * Math.log10(s);
  return 495 / densidad - 450; // Siri
}

/**
 * Masa muscular esquelética — Lee (2000):
 *   MM = talla_m × (0.00744·PCB² + 0.00088·PCM² + 0.00441·PCP²)
 *        + 2.4·sexo − 0.048·edad + etnia + 7.8
 * sexo: 1 hombre / 0 mujer · etnia 0 para caucásico.
 * PC* = perímetros corregidos de brazo, muslo y pierna.
 */
export function masaMuscularLee(
  m: Medicion,
  sexo: Sexo,
  edad: number,
  pcBrazo?: number,
  pcMuslo?: number,
  pcPierna?: number,
): number | undefined {
  if (!has(m.talla, edad, pcBrazo, pcMuslo, pcPierna)) return undefined;
  const t = (m.talla as number) / 100;
  return (
    t * (0.00744 * (pcBrazo as number) ** 2 + 0.00088 * (pcMuslo as number) ** 2 + 0.00441 * (pcPierna as number) ** 2) +
    2.4 * (sexo === 'hombre' ? 1 : 0) -
    0.048 * edad +
    7.8
  );
}

/** Masa ósea — Rocha (1975). */
export function masaOseaRocha(m: Medicion): number | undefined {
  const { humero, femur } = m.diametros;
  if (!has(m.talla, humero, femur)) return undefined;
  const t = (m.talla as number) / 100;
  const v = t * t * ((humero as number) / 100) * ((femur as number) / 100) * 400;
  return 3.02 * Math.pow(v, 0.712);
}

/**
 * Somatotipo Heath-Carter.
 * Endomorfia sobre Σ3 (tríceps + subescapular + supraespinal) corregida por talla.
 */
export function somatotipo(m: Medicion, pcBrazo?: number, pcPierna?: number): Somatotipo | undefined {
  const s3 = suma(m, ['triceps', 'subscapular', 'supraespinal']);
  const { humero, femur } = m.diametros;
  if (s3 == null || !has(m.talla, m.peso, humero, femur, pcBrazo, pcPierna)) return undefined;

  const talla = m.talla as number;
  const peso = m.peso as number;
  const x = s3 * (170.18 / talla);
  const endomorfia = -0.7182 + 0.1451 * x - 0.00068 * x ** 2 + 0.0000014 * x ** 3;

  const mesomorfia =
    0.858 * (humero as number) +
    0.601 * (femur as number) +
    0.188 * (pcBrazo as number) +
    0.161 * (pcPierna as number) -
    0.131 * talla +
    4.5;

  const ip = talla / Math.cbrt(peso);
  const ectomorfia = ip >= 40.75 ? 0.732 * ip - 28.58 : ip > 38.25 ? 0.463 * ip - 17.63 : 0.1;

  const xc = ectomorfia - endomorfia;
  const yc = 2 * mesomorfia - (endomorfia + ectomorfia);

  return {
    endomorfia,
    mesomorfia,
    ectomorfia,
    x: xc,
    y: yc,
    categoria: categoriaSomatotipo(endomorfia, mesomorfia, ectomorfia),
  };
}

function categoriaSomatotipo(en: number, me: number, ec: number): string {
  const max = Math.max(en, me, ec);
  const dom = max === en ? 'Endomorfo' : max === me ? 'Mesomorfo' : 'Ectomorfo';
  const resto = [
    ['endomorfia', en],
    ['mesomorfia', me],
    ['ectomorfia', ec],
  ]
    .filter(([, v]) => v !== max)
    .sort((a, b) => (b[1] as number) - (a[1] as number));
  const seg = resto[0][0] as string;
  const nombres: Record<string, string> = {
    endomorfia: 'endomorfo',
    mesomorfia: 'mesomorfo',
    ectomorfia: 'ectomorfo',
  };
  return `${dom} ${nombres[seg]}`;
}

// ── Composición completa ────────────────────────────────────

export function calcComposicion(m: Medicion, sexo: Sexo, edad: number): Composicion {
  const faltan: string[] = [];
  const marcar = (cond: boolean, etiqueta: string) => {
    if (cond) faltan.push(etiqueta);
  };

  const bmi = imc(m.peso, m.talla);
  marcar(bmi == null, 'peso y talla');

  const icc = ratioCinturaCadera(m.perimetros.cintura, m.perimetros.cadera);
  marcar(icc == null, 'cintura y cadera');

  const s6 = suma(m, SUMA_6);
  const s8 = suma(m, SUMA_8);
  marcar(s8 == null, `pliegues (${SUMA_8.filter((p) => !m.pliegues[p]).map((p) => PLIEGUE_LABELS[p].toLowerCase()).join(', ')})`);

  const pcBrazo = perimetroCorregido(m.perimetros.brazo_relajado, m.pliegues.triceps);
  const pcMuslo = perimetroCorregido(m.perimetros.muslo_medio, m.pliegues.muslo);
  const pcPierna = perimetroCorregido(m.perimetros.pierna_maximo, m.pliegues.medial_pierna);

  const grasaPct: Partial<Record<FormulaGrasaId, number>> = {};
  const fa = grasaFaulkner(m);
  const yu = grasaYuhasz(m, sexo);
  const dw = grasaDurninWomersley(m, sexo, edad);
  if (fa != null) grasaPct.faulkner = fa;
  if (yu != null) grasaPct.yuhasz = yu;
  if (dw != null) grasaPct.durnin_womersley = dw;

  const grasaKg: Partial<Record<FormulaGrasaId, number>> = {};
  const masaMagraKg: Partial<Record<FormulaGrasaId, number>> = {};
  if (has(m.peso)) {
    for (const [k, v] of Object.entries(grasaPct) as [FormulaGrasaId, number][]) {
      grasaKg[k] = ((m.peso as number) * v) / 100;
      masaMagraKg[k] = (m.peso as number) - (grasaKg[k] as number);
    }
  }

  const mm = masaMuscularLee(m, sexo, edad, pcBrazo, pcMuslo, pcPierna);
  const so = somatotipo(m, pcBrazo, pcPierna);
  marcar(so == null, 'diámetros de húmero y fémur');

  return {
    imc: bmi,
    categoriaImc: categoriaImc(bmi),
    ratioCinturaCadera: icc,
    riesgoIcc: riesgoIcc(icc, sexo),
    suma6: s6,
    suma8: s8,
    perimetroCorregidoBrazo: pcBrazo,
    perimetroCorregidoMuslo: pcMuslo,
    perimetroCorregidoPierna: pcPierna,
    grasaPct,
    grasaKg,
    masaMagraKg,
    masaMuscularKg: mm,
    masaMuscularPct: mm != null && has(m.peso) ? (mm * 100) / (m.peso as number) : undefined,
    masaOseaKg: masaOseaRocha(m),
    somatotipo: so,
    faltan,
  };
}

// ── Seguimiento ─────────────────────────────────────────────

/** Ordena mediciones de más antigua a más reciente. */
export function ordenarMediciones(ms: Medicion[]): Medicion[] {
  return [...ms].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Tabla de evolución: valor actual, cambio respecto a la medición anterior
 * y respecto a la primera.
 */
export function calcularEvolucion(
  mediciones: Medicion[],
  sexo: Sexo,
  edad: number,
  formulaGrasa: FormulaGrasaId,
): DeltaMedicion[] {
  const orden = ordenarMediciones(mediciones);
  if (!orden.length) return [];

  const at = (m: Medicion) => {
    const c = calcComposicion(m, sexo, edad);
    return {
      peso: m.peso,
      imc: c.imc,
      grasaPct: c.grasaPct[formulaGrasa],
      grasaKg: c.grasaKg[formulaGrasa],
      masaMagraKg: c.masaMagraKg[formulaGrasa],
      masaMuscularKg: c.masaMuscularKg,
      suma6: c.suma6,
      suma8: c.suma8,
      cintura: m.perimetros.cintura,
      cadera: m.perimetros.cadera,
      icc: c.ratioCinturaCadera,
      brazoCorregido: c.perimetroCorregidoBrazo,
    };
  };

  const ultima = at(orden[orden.length - 1]);
  const previa = orden.length > 1 ? at(orden[orden.length - 2]) : undefined;
  const primera = at(orden[0]);

  const filas: [keyof typeof ultima, string, number, string, boolean?][] = [
    ['peso', 'Peso', 1, 'kg'],
    ['imc', 'IMC', 1, ''],
    ['grasaPct', 'Grasa', 1, '%', true],
    ['grasaKg', 'Masa grasa', 1, 'kg', true],
    ['masaMagraKg', 'Masa magra', 1, 'kg'],
    ['masaMuscularKg', 'Masa muscular', 1, 'kg'],
    ['suma6', 'Σ 6 pliegues', 1, 'mm', true],
    ['suma8', 'Σ 8 pliegues', 1, 'mm', true],
    ['cintura', 'Cintura', 1, 'cm', true],
    ['cadera', 'Cadera', 1, 'cm'],
    ['icc', 'Cintura / cadera', 2, '', true],
    ['brazoCorregido', 'Brazo corregido', 1, 'cm'],
  ];

  return filas
    .map(([k, label, decimales, unidad, bajarEsMejor]) => {
      const actual = ultima[k];
      const prev = previa?.[k];
      const ini = primera[k];
      return {
        key: k as string,
        label,
        actual,
        previo: prev,
        inicial: ini,
        deltaPrevio: actual != null && prev != null ? actual - prev : undefined,
        deltaInicial: actual != null && ini != null ? actual - ini : undefined,
        decimales,
        unidad,
        bajarEsMejor,
      };
    })
    .filter((f) => f.actual != null);
}
