import type { ExchangeGroupId, Familia } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS, EXCHANGE_GROUP_LIST, type MacroBucket } from '../data/exchangeGroups';
import type { ExchangeCounts } from './exchanges';
import { exchangesToMacros } from './exchanges';
import { snapHalf } from './macros';

/**
 * ¿ESTÁ LA COMIDA COMPLETA? (§5)
 *
 * SE COMPARA POR MACRO, no por familia ni por subgrupo. Lo que tiene que
 * cuadrar son las porciones de proteína, carbohidrato y grasa; de dónde salgan
 * es cosa de la receta.
 *
 * Antes se comparaba familia a familia y eso llenaba la pantalla de avisos
 * falsos: un desayuno con 1 almidón pautado y una receta que lo cubre con
 * fruta salía como «no cubre fruta» y «te pasas en almidones», cuando son los
 * mismos 15 g de hidrato. Lo mismo con un lácteo proteico y un proteico magro,
 * que desde que valen 7 g los dos son intercambiables de verdad.
 *
 * La cuenta se lleva en el macro que define cada grupo (su "ancla"): proteína
 * en los proteicos, grasa en las grasas, hidratos en el resto. Así un yogur y
 * una lata de atún suman lo que suman, sin fingir que un intercambio es
 * siempre lo mismo.
 *
 * Lo que se pierde por el camino —que una receta ponga la proteína con claras
 * donde había huevos enteros— no desaparece: sale como aviso de grasa aparte,
 * y sólo para la nutricionista. Ver `avisoDeGrasa`.
 *
 * Las verduras no entran: son ilimitadas (§10.1).
 */

/** Cuántos gramos del macro son una porción, para hablar en porciones. */
const POR_PORCION: Record<MacroBucket, number> = {
  carbohidrato: 14,
  proteina: 7,
  grasa: 5,
};

const ANCLA_DE_BUCKET: Record<MacroBucket, 'hc' | 'proteina' | 'grasa'> = {
  carbohidrato: 'hc',
  proteina: 'proteina',
  grasa: 'grasa',
};

const LABEL_BUCKET: Record<MacroBucket, string> = {
  proteina: 'Proteína',
  carbohidrato: 'Carbohidrato',
  grasa: 'Grasa',
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
  /** El macro que se está midiendo: es la unidad de comparación. */
  bucket: MacroBucket;
  /** Se conserva la familia dominante para poder sugerir con qué completar. */
  familia: Familia;
  /** Cómo se llama en el checklist: "Proteína", "Carbohidrato", "Grasa". */
  label: string;
  /** Subgrupo pautado que manda: es el que se sugiere para completar. */
  grupoObjetivo: ExchangeGroupId;
  /** Porciones pautadas de ese macro. */
  pautado: number;
  /** Porciones que hay en el plato. */
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

/** Reparte unos intercambios por macro, ignorando las verduras. */
function porBucket(counts: ExchangeCounts): Map<MacroBucket, ExchangeCounts> {
  const mapa = new Map<MacroBucket, ExchangeCounts>();
  for (const [gid, n] of Object.entries(counts) as [ExchangeGroupId, number][]) {
    const info = EXCHANGE_GROUPS[gid];
    if (!info || !n || info.ilimitado) continue;
    const actual = mapa.get(info.bucket) ?? {};
    actual[gid] = (actual[gid] ?? 0) + n;
    mapa.set(info.bucket, actual);
  }
  return mapa;
}

/**
 * LA GRASA QUE SE ESCONDE EN LA PROTEÍNA
 *
 * Contando por macro, dos claras y dos huevos enteros son lo mismo: dos
 * porciones de proteína. Pero los huevos traen 9 g más de grasa, y ésa es
 * justamente la diferencia que la nutricionista pautó a propósito cuando puso
 * «2 grasos y 2 magros».
 *
 * No es una alerta: la comida está bien de macros. Es un dato para quien
 * pauta, y por eso sólo se enseña con `paraNutricionista`.
 *
 * Devuelve los gramos de grasa que la receta se deja (negativo) o se pasa
 * (positivo) respecto de lo pautado, mirando sólo la familia de los proteicos.
 * Por debajo de una porción de grasa (5 g) no se dice nada: son cambios que
 * no mueven el plan.
 */
export const UMBRAL_AVISO_GRASA = 5;

export function avisoDeGrasa(
  pautado: ExchangeCounts,
  enPlato: ExchangeCounts,
): { gramos: number; texto: string } | undefined {
  const deProteicos = (c: ExchangeCounts) =>
    (Object.entries(c) as [ExchangeGroupId, number][]).reduce(
      (s, [g, n]) =>
        EXCHANGE_GROUPS[g]?.familia === 'proteicos' ? s + (EXCHANGE_GROUPS[g].grasa ?? 0) * n : s,
      0,
    );

  const diferencia = deProteicos(enPlato) - deProteicos(pautado);
  if (Math.abs(diferencia) < UMBRAL_AVISO_GRASA) return undefined;

  const g = Math.round(Math.abs(diferencia));
  return {
    gramos: diferencia,
    texto:
      diferencia < 0
        ? `La proteína de esta receta es más magra que la pautada: ${g} g de grasa menos.`
        : `La proteína de esta receta es más grasa que la pautada: ${g} g de grasa de más.`,
  };
}

/** El subgrupo con más intercambios: el que representa a la familia. */
function dominante(counts: ExchangeCounts): ExchangeGroupId {
  const entradas = Object.entries(counts) as [ExchangeGroupId, number][];
  return entradas.sort((a, b) => b[1] - a[1] || EXCHANGE_GROUPS[a[0]].orden - EXCHANGE_GROUPS[b[0]].orden)[0][0];
}

/**
 * Compara lo pautado con lo que hay en el plato.
 *
 * @param pautado  Intercambios que la nutricionista asignó a esta comida.
 * @param enPlato  Lo que cubre la receta ya escalada + lo añadido que cuenta.
 */
export function estadoComida(pautado: ExchangeCounts, enPlato: ExchangeCounts): ResumenComida {
  const delPlan = porBucket(pautado);
  const delPlato = porBucket(enPlato);

  const filas: FilaCompletitud[] = [];
  const buckets: MacroBucket[] = ['proteina', 'carbohidrato', 'grasa'];

  for (const bucket of buckets) {
    const pautadoB = delPlan.get(bucket) ?? {};
    const enPlatoB = delPlato.get(bucket) ?? {};
    const hayPauta = Object.keys(pautadoB).length > 0;
    const hayPlato = Object.keys(enPlatoB).length > 0;
    if (!hayPauta && !hayPlato) continue;

    const ancla = ANCLA_DE_BUCKET[bucket];
    const porPorcion = POR_PORCION[bucket];

    /**
     * Las porciones salen de los gramos del macro, no de contar intercambios.
     * Así una fruta (15 g de hidrato) y un almidón (14 g) valen casi lo mismo,
     * que es la realidad, en vez de fingir que son cosas distintas.
     */
    const pautadoInt = exchangesToMacros(pautadoB)[ancla] / porPorcion;
    const cubiertoInt = exchangesToMacros(enPlatoB)[ancla] / porPorcion;
    const diff = pautadoInt - cubiertoInt;

    // Lo que no se pautó y aparece en el plato sólo cuenta si es apreciable.
    if (!hayPauta && cubiertoInt <= TOLERANCIA_INT) continue;

    const objetivo = dominante(hayPauta ? pautadoB : enPlatoB);
    const familia = EXCHANGE_GROUPS[objetivo].familia;

    filas.push({
      bucket,
      familia,
      label: LABEL_BUCKET[bucket],
      grupoObjetivo: objetivo,
      pautado: snapHalf(pautadoInt),
      cubierto: snapHalf(cubiertoInt),
      falta: snapHalf(diff),
      estado: Math.abs(diff) <= TOLERANCIA_INT ? 'ok' : diff > 0 ? 'falta' : 'exceso',
      cubiertoCon: (Object.keys(enPlatoB) as ExchangeGroupId[]).filter((g) => g !== objetivo),
    });
  }

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
