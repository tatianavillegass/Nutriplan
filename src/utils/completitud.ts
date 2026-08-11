import type { ExchangeGroupId, Familia } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS, EXCHANGE_GROUP_LIST } from '../data/exchangeGroups';
import type { ExchangeCounts } from './exchanges';
import { exchangesToMacros } from './exchanges';
import { snapHalf } from './macros';

/**
 * ¿ESTÁ LA COMIDA COMPLETA? (§5)
 *
 * Lo pautado se compara con lo que hay en el plato POR FAMILIA, no subgrupo
 * contra subgrupo — la misma regla que usa el escalado. Si el plan pide un
 * proteico magro y el plato trae uno semigraso, la proteína está cubierta;
 * lo que cambia es la grasa, y de eso ya avisa el panel de macros.
 *
 * La cuenta se lleva en el macro que define la familia (su "ancla"): proteína
 * en los proteicos, grasa en las grasas, hidratos en el resto. Así un yogur
 * proteico (10 g de proteína) y una lata de atún (7 g) suman lo que suman de
 * verdad, sin fingir que un intercambio es un intercambio.
 *
 * Las verduras no entran: son ilimitadas (§10.1).
 */

/** Por qué macro se mide cada familia. */
const ANCLA_DE_FAMILIA: Record<Familia, 'hc' | 'proteina' | 'grasa' | null> = {
  verduras: null,
  fruta: 'hc',
  almidones: 'hc',
  legumbres: 'hc',
  azucares: 'hc',
  proteicos: 'proteina',
  grasas: 'grasa',
};

/**
 * Medio intercambio de margen. Por debajo de eso no se avisa: nadie pesa
 * 3 g de más de aceite, y marcar la comida en rojo por eso sólo enseña a
 * ignorar el aviso.
 */
export const TOLERANCIA_INT = 0.25;

export type EstadoFila = 'ok' | 'falta' | 'exceso';
export type EstadoComida = 'completa' | 'incompleta' | 'excedida' | 'sin_pauta';

export interface FilaCompletitud {
  familia: Familia;
  /** Cómo se llama en el checklist: "Proteína", "Fruta", "Grasas"… */
  label: string;
  /** Subgrupo pautado que manda: es el que se sugiere para completar. */
  grupoObjetivo: ExchangeGroupId;
  /** Intercambios pautados, en unidades del grupo objetivo. */
  pautado: number;
  /** Intercambios que hay en el plato, en unidades del grupo objetivo. */
  cubierto: number;
  /** Positivo = falta; negativo = sobra. Ya redondeado a medios. */
  falta: number;
  estado: EstadoFila;
  /** Con qué subgrupos se está cubriendo, si no son los pautados. */
  cubiertoCon: ExchangeGroupId[];
}

export interface ResumenComida {
  filas: FilaCompletitud[];
  estado: EstadoComida;
  /** Cuántas familias pautadas están cuadradas. */
  cuadradas: number;
  total: number;
  /** Frase corta para el badge. */
  mensaje: string;
}

/** Reparte unos intercambios por familia, ignorando las verduras. */
function porFamilia(counts: ExchangeCounts): Map<Familia, ExchangeCounts> {
  const mapa = new Map<Familia, ExchangeCounts>();
  for (const [gid, n] of Object.entries(counts) as [ExchangeGroupId, number][]) {
    const info = EXCHANGE_GROUPS[gid];
    if (!info || !n || info.ilimitado) continue;
    const actual = mapa.get(info.familia) ?? {};
    actual[gid] = (actual[gid] ?? 0) + n;
    mapa.set(info.familia, actual);
  }
  return mapa;
}

/** El subgrupo con más intercambios: el que representa a la familia. */
function dominante(counts: ExchangeCounts): ExchangeGroupId {
  const entradas = Object.entries(counts) as [ExchangeGroupId, number][];
  return entradas.sort((a, b) => b[1] - a[1] || EXCHANGE_GROUPS[a[0]].orden - EXCHANGE_GROUPS[b[0]].orden)[0][0];
}

const LABEL_FAMILIA: Record<Familia, string> = {
  verduras: 'Verduras',
  fruta: 'Fruta',
  almidones: 'Almidones',
  legumbres: 'Legumbres',
  azucares: 'Azúcares',
  proteicos: 'Proteína',
  grasas: 'Grasas',
};

/**
 * Compara lo pautado con lo que hay en el plato.
 *
 * @param pautado  Intercambios que la nutricionista asignó a esta comida.
 * @param enPlato  Lo que cubre la receta ya escalada + lo añadido que cuenta.
 */
export function estadoComida(pautado: ExchangeCounts, enPlato: ExchangeCounts): ResumenComida {
  const delPlan = porFamilia(pautado);
  const delPlato = porFamilia(enPlato);

  const filas: FilaCompletitud[] = [];

  for (const [familia, pautadoFam] of delPlan) {
    const ancla = ANCLA_DE_FAMILIA[familia];
    if (!ancla) continue;

    const objetivo = dominante(pautadoFam);
    /** Cuánto ancla vale 1 intercambio del subgrupo que manda. */
    const porInt = EXCHANGE_GROUPS[objetivo][ancla] || 1;

    const enPlatoFam = delPlato.get(familia) ?? {};
    const gPautado = exchangesToMacros(pautadoFam)[ancla];
    const gPlato = exchangesToMacros(enPlatoFam)[ancla];

    const pautadoInt = gPautado / porInt;
    const cubiertoInt = gPlato / porInt;
    const diff = pautadoInt - cubiertoInt;

    filas.push({
      familia,
      label: LABEL_FAMILIA[familia],
      grupoObjetivo: objetivo,
      pautado: snapHalf(pautadoInt),
      cubierto: snapHalf(cubiertoInt),
      falta: snapHalf(diff),
      estado: Math.abs(diff) <= TOLERANCIA_INT ? 'ok' : diff > 0 ? 'falta' : 'exceso',
      cubiertoCon: (Object.keys(enPlatoFam) as ExchangeGroupId[]).filter((g) => g !== objetivo),
    });
  }

  /**
   * Lo que hay en el plato y NADIE pautó. No es un error —un café con leche
   * marcado como "cuenta" cae aquí— pero sí hay que enseñarlo: son calorías
   * que el plan no tenía previstas.
   */
  for (const [familia, enPlatoFam] of delPlato) {
    if (delPlan.has(familia)) continue;
    const ancla = ANCLA_DE_FAMILIA[familia];
    if (!ancla) continue;

    const objetivo = dominante(enPlatoFam);
    const porInt = EXCHANGE_GROUPS[objetivo][ancla] || 1;
    const cubiertoInt = exchangesToMacros(enPlatoFam)[ancla] / porInt;
    if (cubiertoInt <= TOLERANCIA_INT) continue;

    filas.push({
      familia,
      label: LABEL_FAMILIA[familia],
      grupoObjetivo: objetivo,
      pautado: 0,
      cubierto: snapHalf(cubiertoInt),
      falta: snapHalf(-cubiertoInt),
      estado: 'exceso',
      cubiertoCon: [],
    });
  }

  filas.sort(
    (a, b) => EXCHANGE_GROUPS[a.grupoObjetivo].orden - EXCHANGE_GROUPS[b.grupoObjetivo].orden,
  );

  const total = filas.length;
  const cuadradas = filas.filter((f) => f.estado === 'ok').length;
  const faltan = filas.filter((f) => f.estado === 'falta');
  const sobran = filas.filter((f) => f.estado === 'exceso');

  let estado: EstadoComida;
  if (!total) estado = 'sin_pauta';
  else if (faltan.length) estado = 'incompleta';
  else if (sobran.length) estado = 'excedida';
  else estado = 'completa';

  const mensaje =
    estado === 'sin_pauta'
      ? 'Sin intercambios pautados en esta comida'
      : estado === 'completa'
        ? 'Comida completa'
        : estado === 'incompleta'
          ? `Falta ${faltan.map((f) => f.label.toLowerCase()).join(' y ')}`
          : `Te pasas en ${sobran.map((f) => f.label.toLowerCase()).join(' y ')}`;

  return { filas, estado, cuadradas, total, mensaje };
}

/** Los huecos que quedan por tapar, de mayor a menor. */
export function huecos(resumen: ResumenComida): FilaCompletitud[] {
  return resumen.filas.filter((f) => f.estado === 'falta').sort((a, b) => b.falta - a.falta);
}

/** Nombre del subgrupo, para textos. */
export function nombreGrupo(g: ExchangeGroupId): string {
  return EXCHANGE_GROUPS[g]?.nombre ?? g;
}

/** Todos los grupos con alimentos, por si hace falta un desplegable. */
export const GRUPOS_ORDENADOS = EXCHANGE_GROUP_LIST.map((g) => g.id);
