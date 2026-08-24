import type { Alimento } from '../types/food';
import {
  EXCHANGE_GROUPS,
  type ExchangeGroupId,
  type Familia,
  type MacroBucket,
} from '../data/exchangeGroups';
import type { ExchangeCounts } from './exchanges';
import { exchangesToMacros } from './exchanges';
import { kcalFromMacros, roundPortion, snapHalf } from './macros';
import { gramosPorIntercambio } from './recipeComposition';
import { escalarMedida } from './measures';
import { textoItem, type ItemOpcion, type OpcionEscalada } from './mealOptions';

/**
 * COMBINACIONES
 *
 * Dos reglas, y en este orden:
 *
 *   1. Cada FAMILIA se cumple por separado. Si el desayuno lleva 1 almidón y
 *      1 fruta, la combinación tiene que traer un almidón y una fruta: avena
 *      con cereales no vale por mucho que sumen 2 porciones de carbohidrato.
 *   2. Dentro de una familia manda el tope calórico. Con 2 proteicos
 *      semigrasos + 2 magros (157 kcal) se puede servir todo magro (130 kcal),
 *      pero no todo semigraso (184 kcal).
 */

export interface ObjetivoFamilia {
  familia: Familia;
  bucket: MacroBucket;
  /** Porciones de esa familia que hay que cubrir. */
  porciones: number;
  /** Techo calórico de la familia, para enseñarlo. */
  kcalMaximas: number;
  /** Techo que de verdad limita: gramos de grasa en proteicos, kcal en el resto. */
  topeMaximo: number;
  /** Reparto original por subgrupo. */
  porSubgrupo: [ExchangeGroupId, number][];
}

export interface ObjetivoBucket {
  bucket: MacroBucket;
  porciones: number;
  kcalMaximas: number;
  porSubgrupo: [ExchangeGroupId, number][];
  familias: ObjetivoFamilia[];
}

/** Objetivos de un macro, desglosados por familia. */
export function objetivoDeBucket(
  reparto: ExchangeCounts,
  bucket: MacroBucket,
): ObjetivoBucket | undefined {
  const porSubgrupo = (Object.entries(reparto) as [ExchangeGroupId, number][])
    .filter(
      ([g, n]) => n > 0 && EXCHANGE_GROUPS[g]?.bucket === bucket && !EXCHANGE_GROUPS[g].ilimitado,
    )
    .sort((a, b) => EXCHANGE_GROUPS[a[0]].orden - EXCHANGE_GROUPS[b[0]].orden);

  if (!porSubgrupo.length) return undefined;

  const porFamilia = new Map<Familia, [ExchangeGroupId, number][]>();
  for (const [g, n] of porSubgrupo) {
    const f = EXCHANGE_GROUPS[g].familia;
    porFamilia.set(f, [...(porFamilia.get(f) ?? []), [g, n]]);
  }

  const familias: ObjetivoFamilia[] = [...porFamilia.entries()].map(([familia, subs]) => {
    const counts: ExchangeCounts = {};
    for (const [g, n] of subs) counts[g] = n;
    return {
      familia,
      bucket,
      porciones: subs.reduce((s, [, n]) => s + n, 0),
      kcalMaximas: kcalFromMacros(exchangesToMacros(counts)),
      topeMaximo: costeDeFamilia(familia, counts),
      porSubgrupo: subs,
    };
  });

  return {
    bucket,
    porciones: familias.reduce((s, f) => s + f.porciones, 0),
    kcalMaximas: familias.reduce((s, f) => s + f.kcalMaximas, 0),
    porSubgrupo,
    familias,
  };
}

export interface OpcionesCombo {
  /** Alimentos distintos por familia. */
  maxAlimentos?: number;
  limite?: number;
  /** Margen sobre el techo calórico, en tanto por uno. */
  tolerancia?: number;
  paso?: number;
}

function escalar(f: Alimento, porciones: number): ItemOpcion | undefined {
  const gpi = gramosPorIntercambio(f);
  if (!gpi || porciones <= 0) return undefined;
  return {
    foodId: f.id,
    nombre: f.nombre,
    grupo: f.grupo as ExchangeGroupId,
    intercambios: porciones,
    gramos: roundPortion(gpi * porciones),
    unidad: f.unidad ?? 'g',
    medida: escalarMedida(f.medida_casera, porciones),
    gramosCocido: f.equivalencia_cocido
      ? roundPortion(f.equivalencia_cocido * porciones)
      : undefined,
  };
}

/**
 * QUÉ LIMITA A CADA FAMILIA
 *
 * En proteicos manda la GRASA. Lo que se pauta como "1 proteico graso" es un
 * techo: si ese día se come magro, mejor. Y un yogur proteico o un requesón
 * pueden cubrir una porción de magro aunque traigan algo más de proteína,
 * porque lo que no debe subir es la grasa. El hidrato del lácteo se avisa
 * aparte para descontarlo del carbohidrato de esa comida.
 *
 * En el resto de familias manda la caloría, que es lo que las define.
 */
export function limitaLaGrasa(familia: Familia): boolean {
  // En grasas pasa lo mismo con los frutos secos: 1 porción son 5 g de grasa,
  // exactamente los mismos que 1 porción de aceite. Sus 59 kcal frente a 45
  // salen de los 2 g de proteína y 1.5 g de hidrato que trae de más, y por eso
  // medir el tope en calorías dejaba las nueces siempre fuera.
  return familia === 'proteicos' || familia === 'grasas';
}

/** Coste de una selección con el criterio de su familia: grasa o kcal. */
export function costeDeFamilia(familia: Familia, counts: ExchangeCounts): number {
  const m = exchangesToMacros(counts);
  return limitaLaGrasa(familia) ? m.grasa : kcalFromMacros(m);
}

/**
 * MEDIO GRAMO DE GRASA NO ES PASARSE
 *
 * En proteicos y en grasas el techo se mide en gramos de grasa, y ahí un
 * margen del 2 % no significa nada. Si se pauta un lácteo proteico (0 g de
 * grasa) y dos magros (0,5 g cada uno), el techo es 1 g y el 2 % son dos
 * centésimas: cambiar el lácteo por otro magro —que la app ya da por
 * intercambiables, son los mismos 7 g de proteína— sumaba medio gramo y
 * bloqueaba la combinación entera.
 *
 * Por eso, donde manda la grasa, hay además un margen fijo de UN gramo.
 *
 * El número no es redondo por casualidad: **tiene que quedarse por debajo de
 * 1,5 g**, que es lo que cuesta subir una porción de magro a semigraso. Un
 * gramo deja pasar dos cambios de lácteo proteico por magro —nueve calorías—
 * y sigue dejando fuera el salto de nivel de verdad, que es lo único que este
 * tope existe para vigilar. Con gramo y medio se colaba, y con él las
 * calorías de la comida entera.
 */
export const MARGEN_GRASA_G = 1;

/** Margen sobre el techo calórico, en tanto por uno. */
export const TOLERANCIA_KCAL = 0.02;

/**
 * El techo real de una familia: lo pautado, su margen relativo y —donde manda
 * la grasa— el margen fijo en gramos.
 */
export function techoDeFamilia(
  familia: Familia,
  topeMaximo: number,
  tolerancia = TOLERANCIA_KCAL,
): number {
  return (
    topeMaximo * (1 + tolerancia) +
    (limitaLaGrasa(familia) ? MARGEN_GRASA_G : 0) +
    1e-6
  );
}

/**
 * EL MACRO MANDA, NO LA FAMILIA
 *
 * La regla vieja pedía que cada familia se cubriera con lo suyo: si el
 * desayuno pautaba 1 almidón y 1 fruta, la combinación tenía que traer un
 * almidón y una fruta. Pero eso contradice la primera regla del método —lo que
 * tiene que cuadrar son las porciones del macro, de dónde salgan es cosa de la
 * receta— que ya rige en el escalado, en la completitud y en el recomendador.
 *
 * Dos almidones donde había un almidón y una fruta son 28 g de hidrato en vez
 * de 29 y dos calorías de diferencia. Bloquear eso era inventarse una regla
 * que el resto de la app no aplica.
 *
 * Este objetivo junta todas las familias del macro en una sola bolsa. El techo
 * sigue existiendo —por calorías, o por grasa donde manda la grasa— así que se
 * puede cambiar de familia pero no inflar la comida.
 */
export function objetivoUnificado(objetivo: ObjetivoBucket): ObjetivoFamilia {
  const counts = Object.fromEntries(objetivo.porSubgrupo) as ExchangeCounts;
  const m = exchangesToMacros(counts);
  /*
   * El criterio se toma de la primera familia. Hoy no hay ningún macro que
   * mezcle familias de grasa con familias de caloría —los lácteos ya viven
   * dentro de «proteicos»— así que todas las del mismo macro miden igual.
   */
  const referencia = objetivo.familias[0].familia;
  return {
    familia: referencia,
    bucket: objetivo.bucket,
    porciones: objetivo.porciones,
    kcalMaximas: objetivo.kcalMaximas,
    topeMaximo: limitaLaGrasa(referencia) ? m.grasa : kcalFromMacros(m),
    porSubgrupo: objetivo.porSubgrupo,
  };
}

/** Si una familia pertenece al macro que se está cubriendo. */
export function mismoMacro(familia: Familia, bucket: MacroBucket): boolean {
  return Object.values(EXCHANGE_GROUPS).some(
    (g) => g.familia === familia && g.bucket === bucket,
  );
}

/** Gramos del macro de un reparto: es lo que de verdad hay que cubrir. */
export function gramosDelMacro(bucket: MacroBucket, counts: ExchangeCounts): number {
  const m = exchangesToMacros(counts);
  return bucket === 'carbohidrato' ? m.hc : bucket === 'proteina' ? m.proteina : m.grasa;
}

/** Hidratos que arrastran los lácteos de una selección de proteína. */
export function hcDeLosLacteos(counts: ExchangeCounts): number {
  let hc = 0;
  for (const [g, n] of Object.entries(counts) as [ExchangeGroupId, number][]) {
    const info = EXCHANGE_GROUPS[g];
    if (info?.familia === 'proteicos' && info.hc > 0) hc += info.hc * n;
  }
  return hc;
}

const costePorPorcion = (f: Alimento) => {
  const g = f.grupo ? EXCHANGE_GROUPS[f.grupo] : undefined;
  if (!g) return 0;
  return costeDeFamilia(g.familia, { [g.id]: 1 });
};

interface ComboFamilia {
  items: ItemOpcion[];
  kcal: number;
  variedad: number;
}

/** Combinaciones dentro de una sola familia. */
function combosDeFamilia(
  objetivo: ObjetivoFamilia,
  despensa: Alimento[],
  { maxAlimentos = 2, tolerancia = TOLERANCIA_KCAL, paso = 1, limite = 6 }: OpcionesCombo,
  /** Si se pasa, valen los alimentos de cualquiera de esas familias. */
  familiasOk?: Set<Familia>,
): ComboFamilia[] {
  const disponibles = despensa.filter((f) => {
    if (!f.grupo || !gramosPorIntercambio(f)) return false;
    const fam = EXCHANGE_GROUPS[f.grupo]?.familia;
    if (!fam) return false;
    return familiasOk ? familiasOk.has(fam) : fam === objetivo.familia;
  });
  if (!disponibles.length || objetivo.porciones <= 0) return [];

  const techo = techoDeFamilia(objetivo.familia, objetivo.topeMaximo, tolerancia);
  const pasos = Math.round(objetivo.porciones / paso);
  const salida: ComboFamilia[] = [];
  const vistos = new Set<string>();

  const buscar = (
    desde: number,
    restantes: number,
    acumulado: { food: Alimento; porciones: number }[],
    kcal: number,
  ) => {
    if (salida.length >= limite * 8) return;

    if (restantes === 0) {
      if (!acumulado.length) return;
      const clave = acumulado.map((a) => `${a.food.id}:${a.porciones}`).sort().join('|');
      if (vistos.has(clave)) return;
      vistos.add(clave);

      const items = acumulado
        .map((a) => escalar(a.food, a.porciones * paso))
        .filter((x): x is ItemOpcion => !!x);
      if (items.length !== acumulado.length) return;

      salida.push({ items, kcal, variedad: acumulado.length });
      return;
    }

    if (desde >= disponibles.length || acumulado.length >= maxAlimentos) return;

    for (let i = desde; i < disponibles.length; i++) {
      const food = disponibles[i];
      const kcalUnidad = costePorPorcion(food) * paso;
      const maxPorKcal = Math.floor((techo - kcal + 1e-6) / (kcalUnidad || 1e-9));
      const max = Math.min(restantes, maxPorKcal);

      for (let n = max; n >= 1; n--) {
        acumulado.push({ food, porciones: n });
        buscar(i + 1, restantes - n, acumulado, kcal + kcalUnidad * n);
        acumulado.pop();
      }
    }
  };

  buscar(0, pasos, [], 0);

  salida.sort(
    (a, b) =>
      b.kcal - a.kcal ||
      a.variedad - b.variedad ||
      a.items[0].nombre.localeCompare(b.items[0].nombre),
  );
  return salida;
}

const aOpcion = (items: ItemOpcion[], bucket: MacroBucket, unificada: boolean): OpcionEscalada => {
  const cubre: ExchangeCounts = {};
  for (const it of items) cubre[it.grupo] = snapHalf((cubre[it.grupo] ?? 0) + it.intercambios);
  return {
    /*
     * El id se ordena para que «manzana + arroz» y «arroz + manzana» sean la
     * misma opción. Sin esto, la misma combinación salía dos veces en la lista
     * sólo porque los ingredientes venían en otro orden.
     */
    id: items
      .map((i) => `${i.foodId}x${i.intercambios}`)
      .sort()
      .join('+'),
    bucket,
    items,
    texto: items
      .map(textoItem)
      .join(' + '),
    cubre,
    unificada,
  };
};

/**
 * Combinaciones de un macro: se resuelve cada familia por separado y se
 * emparejan los resultados, de forma que toda opción trae lo que toca de
 * cada familia.
 */
export function generarCombinaciones(
  objetivo: ObjetivoBucket,
  despensa: Alimento[],
  opciones: OpcionesCombo = {},
): OpcionEscalada[] {
  const limite = opciones.limite ?? 6;

  const porFamilia = objetivo.familias.map((f) => ({
    objetivo: f,
    combos: combosDeFamilia(f, despensa, opciones),
  }));

  /**
   * Si a alguna familia no le queda ni un candidato —no hay fruta en la
   * despensa— antes no salía NINGUNA opción y la comida se quedaba en blanco.
   * Ahora se pasa directamente a las combinaciones que mezclan familias: el
   * macro se puede cubrir igual con lo que sí hay.
   */
  const todasCubiertas = porFamilia.every((f) => f.combos.length > 0);

  const salida: OpcionEscalada[] = [];
  const protagonistas = new Map<string, number>();
  const vistos = new Set<string>();

  /*
   * Si el macro tiene más de una familia se guardan un par de huecos para las
   * combinaciones que las mezclan —dos almidones donde había almidón y fruta—.
   * Sin reservarlos, las que respetan las familias llenan la lista y las otras
   * no llegan a verse nunca.
   */
  const variasFamilias = objetivo.familias.length > 1;
  const reserva = variasFamilias ? 2 : 0;

  if (todasCubiertas) {
    /** Empareja el i-ésimo combo de cada familia, rotando para dar variedad. */
    const maximo = Math.max(...porFamilia.map((f) => f.combos.length));

    const anadir = (indices: number[]) => {
      const items = porFamilia.flatMap((f, k) => f.combos[indices[k] % f.combos.length].items);
      const unificada =
        porFamilia.length === 1 &&
        items.length === 1 &&
        objetivo.porSubgrupo.length > 1;

      const opcion = aOpcion(items, objetivo.bucket, unificada);
      if (vistos.has(opcion.id)) return;

      const principal = [...items].sort((a, b) => b.intercambios - a.intercambios)[0];
      const usos = protagonistas.get(principal.foodId) ?? 0;
      if (usos >= 2) return;

      vistos.add(opcion.id);
      protagonistas.set(principal.foodId, usos + 1);
      salida.push(opcion);
    };

    for (let i = 0; i < maximo && salida.length < limite - 1 - reserva; i++) {
      anadir(porFamilia.map(() => i));
    }

    /**
     * La opción más ligera siempre entra: es la que deja más margen calórico
     * para el resto del día.
     */
    const ligeras = porFamilia.map((f) =>
      f.combos.reduce((mejor, c) => {
        if (c.kcal < mejor.kcal - 0.01) return c;
        if (Math.abs(c.kcal - mejor.kcal) < 0.01 && c.variedad < mejor.variedad) return c;
        return mejor;
      }, f.combos[0]),
    );
    const itemsLigera = ligeras.flatMap((c) => c.items);
    const opcionLigera = aOpcion(itemsLigera, objetivo.bucket, false);
    if (!vistos.has(opcionLigera.id)) {
      vistos.add(opcionLigera.id);
      salida.push(opcionLigera);
    }
  }

  /*
   * Y por último las que cubren el macro sin respetar las familias. Van al
   * final a propósito: lo que se pautó sigue saliendo primero, y esto es la
   * alternativa. Es el mismo criterio del recomendador, donde una receta con
   * el subgrupo exacto puntúa por encima de la que lo cubre con otro.
   */
  if (variasFamilias || !todasCubiertas) {
    const todas = new Set(objetivo.familias.map((f) => f.familia));
    const mezcladas = combosDeFamilia(
      objetivoUnificado(objetivo),
      despensa,
      opciones,
      todas,
    );
    for (const c of mezcladas) {
      if (salida.length >= limite) break;
      const opcion = aOpcion(c.items, objetivo.bucket, false);
      if (vistos.has(opcion.id)) continue;
      vistos.add(opcion.id);
      salida.push(opcion);
    }
  }

  return salida.slice(0, limite);
}

/** kcal reales de una combinación. */
export function kcalDeOpcion(opcion: OpcionEscalada): number {
  const counts: ExchangeCounts = {};
  for (const i of opcion.items) counts[i.grupo] = (counts[i.grupo] ?? 0) + i.intercambios;
  return kcalFromMacros(exchangesToMacros(counts));
}

/** Porciones que cubre una combinación, por familia. */
export function porcionesPorFamilia(items: { grupo: ExchangeGroupId; intercambios: number }[]) {
  const out = new Map<Familia, number>();
  for (const i of items) {
    const f = EXCHANGE_GROUPS[i.grupo]?.familia;
    if (!f) continue;
    out.set(f, (out.get(f) ?? 0) + i.intercambios);
  }
  return out;
}

export interface ValidacionCombo {
  valida: boolean;
  kcal: number;
  kcalMaximas: number;
  /** Problemas legibles para la nutricionista. */
  avisos: string[];
  porFamilia: {
    familia: Familia;
    pide: number;
    lleva: number;
    ok: boolean;
  }[];
  /** Hidrato que traen los lácteos por encima de lo pautado. No invalida. */
  hcDeLacteos?: number;
  /** Aviso informativo, para mostrarlo en otro tono que los errores. */
  nota?: string;
}

/** Comprueba a mano una combinación contra el objetivo del macro. */
export function validarCombo(
  objetivo: ObjetivoBucket,
  items: { grupo: ExchangeGroupId; intercambios: number }[],
): ValidacionCombo {
  const lleva = porcionesPorFamilia(items);
  const avisos: string[] = [];
  const notas: string[] = [];

  const porFamilia = objetivo.familias.map((f) => {
    const n = lleva.get(f.familia) ?? 0;
    return { familia: f.familia, pide: f.porciones, lleva: n, ok: Math.abs(n - f.porciones) < 0.01 };
  });

  /*
   * Una familia de OTRO macro sí sigue siendo un error: poner una grasa donde
   * se pautaba carbohidrato no es cambiar de familia, es cambiar de comida. Y
   * no cuenta para las porciones, que si no taparía el hueco que deja.
   */
  const ajenas: Familia[] = [];
  for (const [familia, n] of lleva) {
    if (n <= 0 || objetivo.familias.some((f) => f.familia === familia)) continue;
    porFamilia.push({ familia, pide: 0, lleva: n, ok: false });
    if (!mismoMacro(familia, objetivo.bucket)) {
      ajenas.push(familia);
      avisos.push(`${familia} no entra en esta comida`);
    }
  }

  const counts: ExchangeCounts = {};
  for (const i of items) counts[i.grupo] = (counts[i.grupo] ?? 0) + i.intercambios;

  const kcal = kcalFromMacros(exchangesToMacros(counts));

  /*
   * LO QUE TIENE QUE CUADRAR SON LAS PORCIONES DEL MACRO
   *
   * No de qué familia salgan. Antes se exigía familia a familia y eso dejaba
   * fuera dos almidones donde había un almidón y una fruta: 28 g de hidrato en
   * vez de 29 y dos calorías de diferencia. La primera regla del método ya
   * dice lo contrario, y así lo hacen el escalado, la completitud y el
   * recomendador.
   */
  const total = [...lleva.entries()]
    .filter(([familia]) => !ajenas.includes(familia))
    .reduce((s, [, n]) => s + n, 0);
  if (Math.abs(total - objetivo.porciones) >= 0.01) {
    const dif = Math.abs(total - objetivo.porciones);
    avisos.push(
      total < objetivo.porciones
        ? `Faltan ${dif.toFixed(dif % 1 ? 1 : 0)} porciones de ${objetivo.bucket}`
        : `Sobran ${dif.toFixed(dif % 1 ? 1 : 0)} porciones de ${objetivo.bucket}`,
    );
  }

  /*
   * El techo sí es del macro entero: se puede cambiar de familia, pero no
   * inflar la comida. Se mide en grasa donde manda la grasa y en calorías en
   * el resto.
   */
  const unificado = objetivoUnificado(objetivo);
  const coste = costeDeFamilia(unificado.familia, counts);
  if (coste > techoDeFamilia(unificado.familia, unificado.topeMaximo)) {
    avisos.push(
      limitaLaGrasa(unificado.familia)
        ? `Se pasa ${(coste - unificado.topeMaximo).toFixed(1)} g de grasa del máximo (${unificado.topeMaximo.toFixed(1)} g)`
        : `Se pasa ${Math.round(coste - unificado.topeMaximo)} kcal del máximo (${Math.round(unificado.topeMaximo)})`,
    );
  }

  /*
   * Y si una familia pautada se ha cubierto con otra cosa, se dice —con los
   * gramos del macro— pero no se bloquea. Es información para ella: ese
   * desayuno se quedó sin fruta, y conviene verlo.
   */
  const cambiadas = porFamilia.filter((f) => f.pide > 0 && f.lleva < f.pide - 0.01);
  if (cambiadas.length) {
    const pautados = gramosDelMacro(
      objetivo.bucket,
      Object.fromEntries(objetivo.porSubgrupo) as ExchangeCounts,
    );
    const servidos = gramosDelMacro(objetivo.bucket, counts);
    notas.push(
      `Cubre ${cambiadas.map((f) => f.familia).join(' y ')} con otra familia: ` +
        `${Math.round(servidos)} g de ${objetivo.bucket} en vez de ${Math.round(pautados)}.`,
    );
  }

  // El lácteo trae hidrato: no invalida, pero conviene descontarlo.
  const hcExtra = objetivo.bucket === 'proteina' ? hcDeLosLacteos(counts) : 0;
  const hcPautado = hcDeLosLacteos(
    Object.fromEntries(objetivo.porSubgrupo) as ExchangeCounts,
  );
  const hcSinPautar = hcExtra - hcPautado;

  if (hcSinPautar > 0.5) {
    notas.push(
      `El lácteo suma ${Math.round(hcSinPautar)} g de hidrato: descuéntalo del carbohidrato de esta comida.`,
    );
  }
  const nota = notas.length ? notas.join(' · ') : undefined;

  return {
    valida: avisos.length === 0,
    kcal,
    kcalMaximas: objetivo.kcalMaximas,
    avisos,
    porFamilia,
    hcDeLacteos: hcSinPautar > 0.5 ? hcSinPautar : undefined,
    nota,
  };
}
