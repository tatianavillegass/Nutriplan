import {
  PERIMETRO_LABELS,
  PLIEGUE_LABELS,
  type FormulaGrasaId,
  type Medicion,
  type PerimetroId,
  type PliegueId,
  type Sexo,
} from '../types/anthropometry';
import { calcComposicion, ordenarMediciones } from './anthropometry';
import { CAMPOS, type Medida } from './misMedidas';
import type {
  ColumnaDeToma,
  FilaDeSeguimiento,
  GrupoDeFilas,
} from '../components/common/TablaDeSeguimiento';

/**
 * LO QUE SE COMPARA, Y EN QUÉ ORDEN
 * =================================
 * Las dos tablas —la de quien sólo tiene perímetros y la de quien tiene
 * antropometría— salen de aquí, para que una medida no se llame de dos maneras
 * ni se ordene distinto según la pantalla.
 *
 * El orden es el de su planilla, que es el orden en que se mide: de arriba
 * abajo. No es cosmético: comparar dos tomas es recorrer la columna con el
 * dedo, y si el muslo está en otro sitio cada vez, no se recorre.
 *
 * QUÉ ES «MEJOR» Y QUÉ NO SE DICE
 * ===============================
 * Sólo se marca dirección donde la hay sin discutir: la grasa y la cintura
 * bajando. El resto va **sin color**: un muslo que sube puede ser músculo
 * ganado y pintarlo de ámbar sería que la app opine de algo que no sabe. Lo
 * que significa se habla en consulta.
 */

/** Perímetros que se leen como grasa central: ahí bajar sí es la dirección. */
const BAJAR_ES_MEJOR: PerimetroId[] = ['cintura', 'abdominal'];

/** Las filas que no tienen nada de qué sobrar: sólo se enseñan si hay dato. */
function conAlgo(filas: FilaDeSeguimiento[]): FilaDeSeguimiento[] {
  return filas.filter((f) => f.valores.some((v) => v != null));
}

// ── Quien sólo manda perímetros ─────────────────────────────

/**
 * La tabla de quien se mide en casa con la cinta. Las tomas son las suyas y
 * las que su nutricionista le apuntó, ya mezcladas en una línea del tiempo
 * (`historialDeMedidas`).
 */
export function tablaDeMedidas(medidas: Medida[]): {
  columnas: ColumnaDeToma[];
  grupos: GrupoDeFilas[];
} {
  const columnas = medidas.map((m, i) => ({ fecha: m.fecha, etiqueta: String(i) }));

  const peso: FilaDeSeguimiento = {
    key: 'peso',
    label: 'Peso',
    unidad: 'kg',
    decimales: 1,
    valores: medidas.map((m) => m.peso),
  };

  /* La talla no se compara consigo misma: cambia cada varios años, no cada mes. */
  const altura: FilaDeSeguimiento = {
    key: 'altura',
    label: 'Talla',
    unidad: 'cm',
    decimales: 0,
    sinDiferencia: true,
    valores: medidas.map((m) => m.altura),
  };

  const perimetros = CAMPOS.filter((c) => c.id !== 'peso' && c.id !== 'altura').map(
    (c): FilaDeSeguimiento => ({
      key: c.id,
      label: c.nombre,
      unidad: c.unidad,
      decimales: 1,
      bajarEsMejor:
        c.id === 'cintura' || c.id === 'abdominal' ? true : undefined,
      valores: medidas.map((m) => m[c.id]),
    }),
  );

  const bio: FilaDeSeguimiento[] = [
    {
      key: 'grasaPct',
      label: 'Grasa (su báscula)',
      unidad: '%',
      decimales: 1,
      bajarEsMejor: true,
      valores: medidas.map((m) => m.bioimpedancia?.grasaPct),
    },
    {
      key: 'musculoPct',
      label: 'Músculo (su báscula)',
      unidad: '%',
      decimales: 1,
      valores: medidas.map((m) => m.bioimpedancia?.musculoPct),
    },
  ];

  return {
    columnas,
    grupos: [
      { filas: conAlgo([peso, altura]) },
      { titulo: 'Perímetros', filas: conAlgo(perimetros) },
      { titulo: 'Su báscula', filas: conAlgo(bio) },
    ],
  };
}

// ── Quien tiene antropometría ───────────────────────────────

/**
 * LOS MILÍMETROS DE CADA PUNTO, NO SÓLO LA SUMA
 * =============================================
 * La tabla de evolución enseñaba las sumas, la cintura y la cadera, y nada
 * más: «me deja ver la suma de pliegues pero no puedo comparar los mm de grasa
 * en cada punto ni las medidas, y eso me interesa». Con razón — dos tomas con
 * la misma suma pueden ser una persona que ha bajado abdomen y subido tríceps,
 * y eso cambia lo que se hace después.
 *
 * Así que salen los ocho pliegues, los siete perímetros y, al final, el bloque
 * de composición que ella ya calcula aparte: suma de 6, de 8, los dos
 * porcentajes de grasa y la masa muscular.
 */
export function tablaDeAntropometria(
  mediciones: Medicion[],
  sexo: Sexo,
  edad: number,
  formula: FormulaGrasaId,
): { columnas: ColumnaDeToma[]; grupos: GrupoDeFilas[] } {
  const orden = ordenarMediciones(mediciones);
  const columnas = orden.map((m, i) => ({ fecha: m.fecha, etiqueta: String(i) }));
  const comp = orden.map((m) => calcComposicion(m, sexo, edad));

  const peso: FilaDeSeguimiento = {
    key: 'peso',
    label: 'Peso',
    unidad: 'kg',
    decimales: 1,
    valores: orden.map((m) => m.peso),
  };
  const talla: FilaDeSeguimiento = {
    key: 'talla',
    label: 'Talla',
    unidad: 'cm',
    decimales: 0,
    sinDiferencia: true,
    valores: orden.map((m) => m.talla),
  };

  const pliegues = (Object.keys(PLIEGUE_LABELS) as PliegueId[]).map(
    (id): FilaDeSeguimiento => ({
      key: `pl-${id}`,
      label: PLIEGUE_LABELS[id],
      unidad: 'mm',
      decimales: 1,
      /* Un pliegue es grasa subcutánea: ahí bajar sí es la dirección. */
      bajarEsMejor: true,
      valores: orden.map((m) => m.pliegues?.[id]),
    }),
  );

  const perimetros = (Object.keys(PERIMETRO_LABELS) as PerimetroId[]).map(
    (id): FilaDeSeguimiento => ({
      key: `pr-${id}`,
      label: PERIMETRO_LABELS[id],
      unidad: 'cm',
      decimales: 1,
      bajarEsMejor: BAJAR_ES_MEJOR.includes(id) ? true : undefined,
      valores: orden.map((m) => m.perimetros?.[id]),
    }),
  );

  const composicion: FilaDeSeguimiento[] = [
    {
      key: 'suma6',
      label: 'Σ 6 pliegues',
      unidad: 'mm',
      decimales: 1,
      bajarEsMejor: true,
      valores: comp.map((c) => c.suma6),
    },
    {
      key: 'suma8',
      label: 'Σ 8 pliegues',
      unidad: 'mm',
      decimales: 1,
      bajarEsMejor: true,
      valores: comp.map((c) => c.suma8),
    },
    {
      key: 'grasaPct',
      label: 'Grasa',
      unidad: '%',
      decimales: 2,
      bajarEsMejor: true,
      valores: comp.map((c) => c.grasaPct[formula]),
    },
    {
      key: 'grasaKg',
      label: 'Masa grasa',
      unidad: 'kg',
      decimales: 1,
      bajarEsMejor: true,
      valores: comp.map((c) => c.grasaKg[formula]),
    },
    {
      key: 'muscKg',
      label: 'Masa muscular',
      unidad: 'kg',
      decimales: 1,
      valores: comp.map((c) => c.masaMuscularKg),
    },
    {
      key: 'icc',
      label: 'Cintura / cadera',
      decimales: 2,
      bajarEsMejor: true,
      valores: comp.map((c) => c.ratioCinturaCadera),
    },
  ];

  return {
    columnas,
    grupos: [
      { filas: conAlgo([peso, talla]) },
      { titulo: 'Pliegues', filas: conAlgo(pliegues) },
      { titulo: 'Perímetros', filas: conAlgo(perimetros) },
      { titulo: 'Composición', filas: conAlgo(composicion) },
    ],
  };
}
