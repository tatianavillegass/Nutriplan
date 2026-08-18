import type { ExchangeGroupId, MacroBucket } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS, bucketsDeGrupo } from '../data/exchangeGroups';
import type { Receta, IngredienteEscalado, RecetaEscalada } from '../types/recipe';
import type { Alimento } from '../types/food';
import type { Acompanamiento } from '../types/plan';
import { exchangesToMacros, aporteDeAlimento, type ExchangeCounts } from './exchanges';
import { kcalFromMacros, roundPortion } from './macros';
import { gramosPorPieza, redondearAPiezas } from './measures';
import { gramosPorIntercambio } from './recipeComposition';

/**
 * ESCALADO POR MACRO (§5)
 *
 * La receta se ajusta a lo que tenga pautado esa comida. Lo que se compara no
 * son subgrupos ni familias, sino macros: lo que tiene que cuadrar son las
 * porciones de proteína, carbohidrato y grasa. De dónde salgan es cosa de la
 * receta, que es como se pautaba a mano:
 *
 *   · Si el plan pauta 1 grasa y la receta lleva nueces, las nueces SON esa
 *     grasa: 1 porción son 5 g de grasa igual que el aceite. Antes el factor
 *     salía 0 y las nueces desaparecían del plato.
 *
 *   · Si el plan pauta 1 proteico graso + 1 magro y la receta lleva 2 magros
 *     (o yogur proteico), eso cubre los dos. Lo que no puede es costar más:
 *     por eso, además de cuadrar la proteína, se comprueba que no se pase de
 *     la grasa ni de las calorías pautadas.
 *
 *   · Si el plan pauta 1 almidón y 1 fruta y la receta sólo trae pan, el pan
 *     crece hasta cubrir el hidrato de los dos. No falta nada: son los mismos
 *     gramos de carbohidrato.
 *
 * Dentro de cada macro:
 *   factor = ancla_pautada / ancla_base,  recortado si excede algún tope
 *
 * Las verduras nunca escalan: son ilimitadas (§10.1).
 */

/**
 * Por qué macro se mide cada bloque. Se escala POR MACRO, no por familia: si
 * el desayuno pauta 1 almidón y 1 fruta y la receta sólo trae almidón, el
 * almidón crece hasta cubrir el hidrato de los dos. Es lo que se hacía a mano
 * al pautar: «aquí no hay fruta, no pasa nada, los 2 carbos salen del pan».
 */
const ANCLA_DE_BUCKET: Record<MacroBucket, keyof ReturnType<typeof exchangesToMacros>> = {
  carbohidrato: 'hc',
  proteina: 'proteina',
  grasa: 'grasa',
};

/** Reparte unos intercambios por macro. */
/** Lo que cuesta una porción de un subgrupo, para comparar escalones. */
function kcalPorPorcion(g: ExchangeGroupId): number {
  const i = EXCHANGE_GROUPS[g];
  return i ? kcalFromMacros({ hc: i.hc, proteina: i.proteina, grasa: i.grasa }) : NaN;
}

function porBucket(counts: ExchangeCounts): Map<MacroBucket, ExchangeCounts> {
  const mapa = new Map<MacroBucket, ExchangeCounts>();
  for (const [gid, n] of Object.entries(counts) as [ExchangeGroupId, number][]) {
    const info = EXCHANGE_GROUPS[gid];
    if (!info || !n || info.ilimitado) continue;
    // Una legumbre cae en dos macros: cada uno lee de ella lo suyo.
    for (const bucket of bucketsDeGrupo(gid)) {
      const actual = mapa.get(bucket) ?? {};
      actual[gid] = (actual[gid] ?? 0) + n;
      mapa.set(bucket, actual);
    }
  }
  return mapa;
}

/** Los nombres de unos subgrupos, para explicarlo en castellano. */
function nombres(counts: ExchangeCounts): string {
  return (Object.keys(counts) as ExchangeGroupId[])
    .map((g) => EXCHANGE_GROUPS[g]?.nombre.toLowerCase() ?? g)
    .join(' y ');
}

/** Los subgrupos de unos intercambios que cumplen una condición. */
function filtrar(
  counts: ExchangeCounts,
  cumple: (g: ExchangeGroupId) => boolean,
): ExchangeCounts {
  const out: ExchangeCounts = {};
  for (const [g, n] of Object.entries(counts) as [ExchangeGroupId, number][]) {
    if (cumple(g)) out[g] = n;
  }
  return out;
}

/**
 * ¿Hay que recortar? Devuelve por cuánto multiplicar para no pasarse, o
 * `undefined` si cabe. En las grasas manda la grasa y no las calorías: una
 * porción de nueces trae 59 kcal frente a las 45 del aceite, y medirlo en
 * calorías las dejaría siempre cortas.
 */
function tope(
  bucket: MacroBucket,
  tiene: ReturnType<typeof exchangesToMacros>,
  pautado: ReturnType<typeof exchangesToMacros>,
): { valor: number; que: string } | undefined {
  const candidatos: { valor: number; que: string }[] = [];
  if (bucket === 'grasa' || bucket === 'proteina') {
    if (tiene.grasa > 0) candidatos.push({ valor: pautado.grasa / tiene.grasa, que: 'grasa' });
  }
  if (bucket !== 'grasa') {
    const k = kcalFromMacros(tiene);
    if (k > 0) candidatos.push({ valor: kcalFromMacros(pautado) / k, que: 'calorías' });
  }
  return candidatos.filter((c) => c.valor < 0.999).sort((a, b) => a.valor - b.valor)[0];
}

/** Los mismos macros, multiplicados. */
function porFactor(
  m: ReturnType<typeof exchangesToMacros>,
  f: number,
): ReturnType<typeof exchangesToMacros> {
  return { hc: m.hc * f, proteina: m.proteina * f, grasa: m.grasa * f };
}

/**
 * Cuánto cabe de la parte flexible sin pasarse, dado lo que ya ocupa la
 * parte fija. Negativo significa que ni con la flexible a cero cabe.
 */
function factorQueCabe(
  bucket: MacroBucket,
  fijo: ReturnType<typeof exchangesToMacros>,
  porUnidad: ReturnType<typeof exchangesToMacros>,
  pautado: ReturnType<typeof exchangesToMacros>,
): number {
  const limites: number[] = [];
  const anotar = (queda: number, cuesta: number) => {
    if (cuesta > 0) limites.push(queda / cuesta);
  };

  if (bucket === 'grasa' || bucket === 'proteina') {
    anotar(pautado.grasa - fijo.grasa, porUnidad.grasa);
  }
  if (bucket !== 'grasa') {
    anotar(kcalFromMacros(pautado) - kcalFromMacros(fijo), kcalFromMacros(porUnidad));
  }

  return limites.length ? Math.min(...limites) : Infinity;
}

/** Solo la parte numérica de la base de la receta. */
function baseNumerica(receta: Receta): ExchangeCounts {
  const out: ExchangeCounts = {};
  for (const [gid, v] of Object.entries(receta.base) as [ExchangeGroupId, number | 'ilimitado'][]) {
    if (v !== 'ilimitado' && v) out[gid] = v;
  }
  return out;
}

export function scaleRecipe(
  receta: Receta,
  requeridos: ExchangeCounts,
  /** El catálogo, para saber qué se cuenta por piezas y qué se pesa. */
  foods: Alimento[] = [],
  /**
   * Gramos fijados a mano por la nutricionista para esta clienta
   * (ingredienteId → gramos). Mandan sobre el cálculo: la app propone y ella
   * dispone. Ver `DayType.ajustesReceta`.
   */
  ajustes: Record<string, number> = {},
  /**
   * Lo que la nutricionista le ha puesto al lado para tapar un hueco de macro:
   * un yogur, una fruta, un café. Entran como un ingrediente más —con sus
   * gramos fijos, sin escalar— para que cuenten en todo lo que viene después
   * sin tener que enterarse cada pantalla por separado.
   */
  acompanamientos: Acompanamiento[] = [],
): RecetaEscalada {
  const factores: Partial<Record<ExchangeGroupId, number>> = {};
  const gruposSinCubrir: ExchangeGroupId[] = [];
  const notas: string[] = [];
  const porId = new Map(foods.map((f) => [f.id, f]));

  const base = baseNumerica(receta);
  const deLaReceta = porBucket(base);
  const delPlan = porBucket(requeridos);

  for (const [bucket, enReceta] of deLaReceta) {
    const ancla = ANCLA_DE_BUCKET[bucket];
    const pautado = delPlan.get(bucket) ?? {};

    const mBase = exchangesToMacros(enReceta);
    const mReq = exchangesToMacros(pautado);

    // Sin ancla (verduras) o sin nada de qué partir: la receta manda.
    if (!ancla || !mBase[ancla]) {
      for (const gid of Object.keys(enReceta) as ExchangeGroupId[]) factores[gid] = 1;
      continue;
    }

    let factor = mReq[ancla] / mBase[ancla];

    /**
     * LA PROTEÍNA VIENE DEL PROTEICO; EL LÁCTEO REMATA
     *
     * En un plato con pollo y un yogur, la proteína pautada la pone el pollo:
     * el yogur va de complemento, nunca de fuente principal. Así que el pollo
     * cuadra la proteína del día y el yogur se queda con el sitio que sobre.
     * Si no sobra sitio, lo que se recorta es el yogur, no el pollo.
     */
    if (bucket === 'proteina') {
      const esLacteo = (g: ExchangeGroupId) => g.startsWith('lacteos_');
      const lacteos = filtrar(enReceta, esLacteo);
      const proteicos = filtrar(enReceta, (g) => !esLacteo(g));

      /**
       * SÓLO SI HAY LÁCTEO PAUTADO
       *
       * Cuando el plan pauta un lácteo, el lácteo cubre el suyo y el proteico
       * el resto: es el plato de pollo con un yogur de postre.
       *
       * Cuando NO hay lácteo pautado, los dos son fuentes de proteína y se
       * reparten lo pautado en la proporción que traiga la receta. Antes el
       * proteico se estiraba hasta cubrirlo todo él solo y el lácteo sumaba
       * encima: en un bol de avena con yogur y whey salían 5 porciones de
       * proteína donde había 4 pautadas.
       */
      const hayLacteoPautado = Object.keys(filtrar(pautado, esLacteo)).length > 0;

      if (hayLacteoPautado && Object.keys(lacteos).length && Object.keys(proteicos).length) {
        const mLacteos = exchangesToMacros(lacteos);
        const mProteicos = exchangesToMacros(proteicos);

        /**
         * El lácteo sólo cubre el lácteo que esté pautado. Si no hay ninguno
         * pautado, entra de complemento con el sitio que sobre — pero nunca
         * quita proteína al proteico, que es de donde tiene que venir.
         */
        const lacteoPautado = exchangesToMacros(filtrar(pautado, esLacteo)).proteina;
        const paraElProteico = Math.max(0, mReq.proteina - lacteoPautado);

        let fProteico = mProteicos.proteina > 0 ? paraElProteico / mProteicos.proteina : 0;
        const ocupado = porFactor(mProteicos, fProteico);

        const sitio = factorQueCabe(bucket, ocupado, mLacteos, mReq);
        const suyo = lacteoPautado > 0 ? lacteoPautado / mLacteos.proteina : 1;
        let fLacteo = Math.min(suyo, Math.max(0, sitio));

        if (sitio <= 0.001) {
          fLacteo = 0;
          notas.push(
            `Con lo pautado no queda sitio para ${nombres(lacteos)}: pauta un lácteo o quítalo del plato.`,
          );
        } else if (fLacteo < suyo - 0.001) {
          notas.push(
            `${nombres(lacteos)} se ha reducido: la proteína pautada la cubre ${nombres(proteicos)}.`,
          );
        }

        // Sólo si ni el proteico solo cabe se le toca a él.
        const soloProteico = tope(bucket, ocupado, mReq);
        if (fLacteo === 0 && soloProteico) {
          fProteico *= soloProteico.valor;
          notas.push(`Se ha recortado ${nombres(proteicos)} para no pasarse de lo pautado.`);
        }

        for (const g of Object.keys(lacteos) as ExchangeGroupId[]) factores[g] = fLacteo;
        for (const g of Object.keys(proteicos) as ExchangeGroupId[]) factores[g] = fProteico;
        continue;
      }
    }

    /**
     * Topes. En las grasas manda la grasa y no las calorías: una porción de
     * nueces trae 59 kcal frente a las 45 del aceite, y medirlo en calorías
     * dejaría las nueces siempre cortas. En los proteicos se miran las dos,
     * porque un lácteo arrastra hidratos que un filete no tiene.
     */
    const topes: { valor: number; que: string }[] = [];
    if (bucket === 'grasa' || bucket === 'proteina') {
      if (mBase.grasa > 0) topes.push({ valor: mReq.grasa / mBase.grasa, que: 'grasa' });
    }
    if (bucket !== 'grasa') {
      const kBase = kcalFromMacros(mBase);
      if (kBase > 0) topes.push({ valor: kcalFromMacros(mReq) / kBase, que: 'calorías' });
    }

    /**
     * BAJAR DE ESCALÓN SIGUE SIENDO LIBRE
     *
     * Los topes existen para que nadie cambie pollo por queso curado y se
     * pase de calorías. Pero cuando la receta usa algo MÁS barato que lo
     * pautado, recortarlo es al revés de lo que se quiere.
     *
     * El caso que lo destapó: pautados 3 lácteos proteicos (0 g de grasa) y
     * una avena trasnochada que pone la proteína con whey. El tope de grasa
     * salía 0 entre algo, así que la whey se escalaba a CERO gramos y el
     * desayuno se quedaba sin proteína, en silencio. Y la whey cuesta 32 kcal
     * por porción frente a las 56 del lácteo: es una bajada de escalón, de las
     * que tu plan permite sin avisar siquiera.
     */
    const masBaratoPautado = Math.min(
      ...Object.keys(pautado).map((g) => kcalPorPorcion(g as ExchangeGroupId)),
    );
    const masCaroDeLaReceta = Math.max(
      ...Object.keys(enReceta).map((g) => kcalPorPorcion(g as ExchangeGroupId)),
    );
    // Medio kcal de margen para que dos grupos iguales no se descarten por un
    // redondeo de la tabla.
    const esBajada =
      Number.isFinite(masBaratoPautado) &&
      Number.isFinite(masCaroDeLaReceta) &&
      masCaroDeLaReceta <= masBaratoPautado + 0.5;
    if (esBajada) topes.length = 0;

    const recorte = topes.filter((t) => t.valor < factor - 0.001).sort((a, b) => a.valor - b.valor)[0];
    if (recorte) {
      notas.push(
        `Se ha recortado ${nombres(enReceta)} para no pasarse de la ${recorte.que} pautada.`,
      );
      factor = recorte.valor;
    }

    // ¿La receta cubre esa familia con otros subgrupos de los pautados?
    const mismos =
      Object.keys(enReceta).length === Object.keys(pautado).length &&
      Object.keys(enReceta).every((g) => (pautado as Record<string, number>)[g] != null);
    if (!mismos && Object.keys(pautado).length > 0) {
      notas.push(
        `El plan pauta ${nombres(pautado)} y la receta lo cubre con ${nombres(enReceta)}.`,
      );
    }

    for (const gid of Object.keys(enReceta) as ExchangeGroupId[]) {
      factores[gid] = Number.isFinite(factor) ? Math.max(0, factor) : 0;
    }
  }

  // Familias que el reparto pide y la receta no trae de ninguna manera.
  for (const [bucket, pautado] of delPlan) {
    if (deLaReceta.has(bucket)) continue;
    for (const gid of Object.keys(pautado) as ExchangeGroupId[]) gruposSinCubrir.push(gid);
  }

  const ingredientes: IngredienteEscalado[] = receta.ingredientes.map((ing) => {
    const esVerdura = ing.grupo === 'verduras';

    /**
     * Lo que Tats haya escrito a mano gana al cálculo. Se marca como
     * `ajustado` para poder enseñarlo distinto y para saber que ese gramaje
     * no se recalcula si cambia la pauta.
     */
    const aMano = ajustes[ing.id];
    if (aMano != null && aMano >= 0) {
      return {
        ...ing,
        factor: ing.cantidad_base ? aMano / ing.cantidad_base : 1,
        cantidad_final: aMano,
        display: `${aMano} ${ing.unidad}`,
        ajustado: true,
      };
    }

    const factor =
      ing.escalable && ing.grupo !== 'condimento' && !esVerdura
        ? factores[ing.grupo as ExchangeGroupId] ?? 1
        : 1;

    if (ing.cantidad_base == null || !ing.escalable) {
      return {
        ...ing,
        factor: 1,
        cantidad_final: ing.cantidad_base,
        /**
         * La verdura va «al gusto» y punto. El mínimo de medio plato es una
         * regla del esquema, no de cada receta: repetido en cada línea de cada
         * plato acababa siendo ruido y nadie lo leía.
         */
        display: esVerdura
          ? 'al gusto'
          : ing.cantidad_base == null
            ? ing.unidad || 'al gusto'
            : `${ing.cantidad_base} ${ing.unidad}`,
      };
    }

    const bruto = ing.cantidad_base * factor;

    /**
     * Un huevo pesa 55 g y no se puede partir en 1,5. Si el ingrediente está
     * enlazado a un alimento que se cuenta por piezas, el gramaje se ajusta
     * al número entero de piezas más cercano.
     */
    const alimento = ing.foodId ? porId.get(ing.foodId) : undefined;
    const pieza = alimento ? gramosPorPieza(alimento) : undefined;
    const final = pieza ? redondearAPiezas(bruto, pieza) : roundPortion(bruto);

    return {
      ...ing,
      factor,
      cantidad_final: final,
      // Sólo los gramos: la medida casera tiene su propio interruptor y
      // mezclar las dos en la misma línea era justo lo que confundía.
      display: `${final} ${ing.unidad}`,
    };
  });

  /**
   * Lo que la receta cubre de verdad: su base por el factor con el que se ha
   * escalado. Si el yogur se ha recortado a 0 porque no había sitio, aquí
   * sale 0 — y por eso la comida aparecerá incompleta en vez de fingir que
   * está cuadrada.
   */
  /**
   * LO QUE CUBRE SALE DE LOS GRAMOS QUE HAY EN EL PLATO
   *
   * No del factor con el que se calcularon. Son lo mismo mientras nadie toque
   * nada, pero dejan de serlo en cuanto Tats escribe un gramaje a mano o el
   * ingrediente se redondea a piezas enteras: poner 150 g de salmón donde el
   * cálculo había dejado 90 y seguir viendo «falta proteína» es la app
   * contradiciendo lo que tiene delante.
   *
   * Sólo se recalcula el grupo donde ella ha tocado algo. El redondeo a piezas
   * enteras también separa los gramos del factor, pero ahí la diferencia es de
   * medio huevo y darla por buena movería los intercambios de todas las
   * recetas: lo que manda aquí es que un gramaje escrito a mano se respete.
   *
   * Se compara gramo a gramo y se pondera por el tamaño de cada ingrediente,
   * así que mezclar ml y g en un mismo grupo (aceite y nueces) no desvía nada
   * apreciable.
   */
  const enElPlato = new Map<ExchangeGroupId, { base: number; final: number }>();
  const aMano = new Set<ExchangeGroupId>();
  for (const ing of ingredientes) {
    const gid = ing.grupo as ExchangeGroupId;
    if (!gid || gid === 'verduras' || (ing.grupo as string) === 'condimento') continue;
    if (!ing.cantidad_base || ing.cantidad_final == null) continue;
    if (ing.ajustado) aMano.add(gid);
    const s = enElPlato.get(gid) ?? { base: 0, final: 0 };
    s.base += ing.cantidad_base;
    s.final += ing.cantidad_final;
    enElPlato.set(gid, s);
  }

  const cubiertos: Partial<Record<ExchangeGroupId, number>> = {};
  for (const [gid, n] of Object.entries(base) as [ExchangeGroupId, number][]) {
    const real = aMano.has(gid) ? enElPlato.get(gid) : undefined;
    const factor = real && real.base > 0 ? real.final / real.base : factores[gid] ?? 1;
    const v = n * factor;
    if (v > 0.001) cubiertos[gid] = v;
  }

  /**
   * Los acompañamientos suman a lo cubierto: para eso se ponen. Sus gramos no
   * escalan —son los que se han escrito— y se traducen a intercambios con los
   * gramos por intercambio de su alimento.
   */
  for (const a of acompanamientos) {
    const food = porId.get(a.foodId);
    if (!food || !a.gramos) continue;

    /*
     * Lo que no gasta intercambios —una gelatina, la bebida de almendras, un
     * café— se pone igual y suma cero. Antes se descartaba sin más y ni
     * siquiera aparecía en la lista: la clienta no veía lo que se iba a tomar.
     */
    const gpi = food.grupo ? gramosPorIntercambio(food) : 0;
    if (food.grupo && gpi) {
      const aporte = aporteDeAlimento(food, a.gramos / gpi);
      for (const [gid, n] of Object.entries(aporte) as [ExchangeGroupId, number][]) {
        if (!n || EXCHANGE_GROUPS[gid]?.ilimitado) continue;
        cubiertos[gid] = (cubiertos[gid] ?? 0) + n;
      }
    }

    ingredientes.push({
      id: a.id,
      nombre: a.nombre,
      foodId: a.foodId,
      cantidad_base: a.gramos,
      cantidad_final: a.gramos,
      unidad: a.unidad ?? food.unidad ?? 'g',
      // Sin subgrupo es un alimento libre: cuenta como condimento, o sea, cero.
      grupo: food.grupo ?? 'condimento',
      escalable: false,
      opcional: false,
      factor: 1,
      display: `${a.gramos} ${a.unidad ?? food.unidad ?? 'g'}`,
      acompanamiento: a.tipo,
      deReceta: a.deReceta,
    });
  }

  /**
   * Con un acompañamiento puesto, un macro puede dejar de faltar: si se añade
   * un yogur para cubrir la proteína que no traía la receta, ya no hay nada
   * que completar aparte.
   */
  const cubiertoAhora = new Set(
    (Object.keys(cubiertos) as ExchangeGroupId[]).map((g) => EXCHANGE_GROUPS[g]?.bucket),
  );
  const faltanDeVerdad = gruposSinCubrir.filter(
    (g) => !cubiertoAhora.has(EXCHANGE_GROUPS[g]?.bucket),
  );

  return { receta, ingredientes, factores, cubiertos, gruposSinCubrir: faltanDeVerdad, notas };
}

/**
 * Sustitución de un ingrediente por uno de su lista de `sustitutos` (§5).
 * La equivalencia se resuelve dentro del MISMO grupo, así que los intercambios
 * —y por tanto los macros— no cambian (regla §10.4).
 */
export interface Sustitucion {
  ingredienteId: string;
  sustitutoNombre: string;
  /** g del sustituto por cada intercambio del grupo, si difiere del original. */
  gramosPorIntercambio?: number;
}

export function applySubstitutions(
  escalada: RecetaEscalada,
  sustituciones: Sustitucion[],
  intercambiosPorGrupo: ExchangeCounts,
): RecetaEscalada {
  const map = new Map(sustituciones.map((s) => [s.ingredienteId, s]));

  const ingredientes = escalada.ingredientes.map((ing) => {
    const s = map.get(ing.id);
    if (!s) return ing;

    if (s.gramosPorIntercambio != null && ing.grupo !== 'condimento') {
      const n = intercambiosPorGrupo[ing.grupo as ExchangeGroupId] ?? 0;
      const final = roundPortion(s.gramosPorIntercambio * n);
      return { ...ing, nombre: s.sustitutoNombre, cantidad_final: final, display: `${final} ${ing.unidad}` };
    }
    // Mismo grupo y misma densidad de intercambio → mismo gramaje.
    return { ...ing, nombre: s.sustitutoNombre };
  });

  return { ...escalada, ingredientes };
}

/** Reglas de edición del cliente (§5). */
export function canRemoveIngredient(ing: { escalable: boolean; opcional: boolean; grupo: string }): {
  allowed: boolean;
  reason?: string;
} {
  if (ing.grupo === 'condimento' || ing.grupo === 'verduras' || ing.opcional) {
    return { allowed: true };
  }
  if (ing.escalable) {
    return { allowed: false, reason: 'Esto cambiaría la composición de tu plan' };
  }
  return { allowed: true };
}
