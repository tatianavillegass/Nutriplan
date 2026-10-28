import type { ExchangeGroupId, MacroBucket } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS, bucketsDeGrupo } from '../data/exchangeGroups';
import type {
  Ingrediente,
  Receta,
  IngredienteEscalado,
  RecetaEscalada,
} from '../types/recipe';
import { esUnidadMedible, unidadDeIngrediente, type Alimento } from '../types/food';
import type { Acompanamiento, IngredienteAnadido } from '../types/plan';
import { exchangesToMacros, aporteDeAlimento, type ExchangeCounts } from './exchanges';
import { kcalFromMacros, roundPortion } from './macros';
import { gramosPorPieza, redondearAPiezas } from './measures';
import { composicionDesdeIngredientes, gramosPorIntercambio } from './recipeComposition';

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
/**
 * DE QUÉ SE PARTE: DE LOS INGREDIENTES, NO DE LO GUARDADO
 * ======================================================
 * La `base` de una receta se guarda **redondeada a medias porciones**
 * (`snapHalf`), que es como se habla: «2 almidones y medio». Pero esa base
 * redondeada era también de donde partía el escalado, y ahí el redondeo deja
 * de ser una forma de hablar y pasa a ser un error que se arrastra.
 *
 * Un desayuno con 30 g de avena (0,75) y 65 g de plátano (0,5) se guardaba
 * como 1 + 0,5 = 1,5, y con 2 hidratos pautados salía avena 40 / plátano 85
 * cubriendo 1,5 de 2 — media porción perdida, y encima avisando de que la
 * receta no cuadra. Con dos ingredientes que redondean hacia abajo se pierde
 * una porción entera.
 *
 * **Los ingredientes son la receta.** Si están enlazados al catálogo, de ahí
 * sale la composición exacta y el redondeo se queda donde debe estar: en lo
 * que se lee, no en lo que se calcula. Y así se arreglan de golpe las recetas
 * ya guardadas, sin que haya que volver a entrar en ninguna.
 *
 * SÓLO SI SE PUEDE CONTAR LA RECETA ENTERA
 * ========================================
 * Y eso es media receta: si un ingrediente no está enlazado al catálogo
 * —el yogur que se escribió a mano— lo que aporta no se sabe, así que calcular
 * desde los ingredientes lo dejaría fuera y la receta encogería. Con una sola
 * línea sin resolver manda lo guardado, que es lo que ella escribió sabiendo
 * lo que hay en el plato.
 */
/**
 * EN QUÉ SUBGRUPO CAE UN INGREDIENTE: EL DEL ALIMENTO
 * ===================================================
 * Cada línea de una receta lleva un subgrupo escrito, y el alimento del
 * catálogo trae el suyo. Cuando no coinciden —se elige el subgrupo a mano al
 * escribir la receta y luego se enlaza el alimento— había dos verdades, y cada
 * parte del cálculo usaba una: la composición contaba por el del alimento y el
 * escalado aplicaba el factor por el escrito. Resultado: el factor de ese
 * subgrupo no existía, se caía al 1 por defecto y **el ingrediente no
 * escalaba** — 30 g de pollo en una comida de 7 proteínas.
 *
 * Manda el alimento: es el que sabe lo que aporta. Lo escrito sirve cuando no
 * hay alimento detrás, que es lo único que hay entonces.
 */
function grupoDe(ing: Ingrediente, porId: Map<string, Alimento>): ExchangeGroupId {
  const food = ing.foodId ? porId.get(ing.foodId) : undefined;
  return (food?.grupo ?? ing.grupo) as ExchangeGroupId;
}

function baseNumerica(receta: Receta, foods: Alimento[] = []): ExchangeCounts {
  if (foods.length && receta.ingredientes.some((i) => i.foodId)) {
    const comp = composicionDesdeIngredientes(receta, foods);
    if (!comp.sinResolver.length && Object.keys(comp.exacto).length) {
      return { ...comp.exacto } as ExchangeCounts;
    }
  }

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
  /**
   * Ingredientes que esta clienta no se come (ingredienteId). No le gusta el
   * pimentón, es alérgica al fruto seco, no tiene en casa el queso feta: la
   * receta del banco es la misma para todas y el plato de ella no.
   *
   * **Se quita, no se pone a cero.** Un ingrediente con «0 g» sigue en la
   * lista de la compra mental de quien cocina y en la hoja que se cuelga en la
   * nevera, y leer «pimentón: 0 g» es peor que no leer nada.
   *
   * **Y lo que el plato cubre se recalcula sin él**, igual que con un gramaje
   * escrito a mano: si lo que se quita era el salmón, esa receta deja de
   * traer la proteína y hay que verlo — callarlo sería enviar un plan que no
   * cuadra. Lo que NO pasa es que el resto crezca para compensar: quitar el
   * pimentón no engorda el arroz.
   */
  quitados: string[] = [],
  /**
   * Ingredientes que ella le ha metido a la receta para esta clienta: la
   * zanahoria que va donde estaba el pimentón. Entran **en la lista de
   * ingredientes**, no bajo «Además», porque forman parte del plato: se pican
   * y se cocinan con lo demás. No escalan —son los gramos que ella escribió— y
   * cuentan en lo que el plato cubre, como los acompañamientos.
   */
  anadidos: IngredienteAnadido[] = [],
): RecetaEscalada {
  const factores: Partial<Record<ExchangeGroupId, number>> = {};
  const gruposSinCubrir: ExchangeGroupId[] = [];
  const notas: string[] = [];
  const porId = new Map(foods.map((f) => [f.id, f]));

  /**
   * LOS QUE REMATAN EL PLATO
   *
   * El queso feta, el parmesano, el yogur griego: marcados en el catálogo
   * (`Alimento.remate`). Se guarda su SUBGRUPO porque el escalado reparte por
   * subgrupo, no ingrediente a ingrediente — en la práctica el queso y el
   * pollo caen en subgrupos distintos, que es lo que hace que funcione.
   */
  const gruposRemate = new Set<ExchangeGroupId>();
  /** El factor en el que puede moverse cada remate, según su rango en gramos. */
  const rangoDelGrupo = new Map<ExchangeGroupId, { min?: number; max?: number }>();
  for (const ing of receta.ingredientes) {
    const f = ing.foodId ? porId.get(ing.foodId) : undefined;
    if (!f?.remate) continue;
    const g = (f.grupo ?? ing.grupo) as ExchangeGroupId;
    gruposRemate.add(g);
    /*
     * El rango viene en gramos y el escalado trabaja en factores: lo que
     * multiplica la cantidad de la receta. Sin cantidad base no hay factor que
     * acotar, y entonces manda el rango del catálogo tal cual no se puede
     * aplicar — se deja pasar.
     */
    const b = ing.cantidad_base;
    if (!b || b <= 0) continue;
    const ya = rangoDelGrupo.get(g) ?? {};
    const min = f.remateMin != null ? f.remateMin / b : undefined;
    const max = f.remateMax != null ? f.remateMax / b : undefined;
    rangoDelGrupo.set(g, {
      min: min != null ? Math.max(ya.min ?? min, min) : ya.min,
      max: max != null ? Math.min(ya.max ?? max, max) : ya.max,
    });
  }

  const base = baseNumerica(receta, foods);
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
      /*
       * Rematan los marcados en el catálogo y los lácteos de siempre: el yogur
       * ya se comportaba así antes de que esto existiera y no hay motivo para
       * obligar a marcarlo uno por uno.
       */
      const esRemate = (g: ExchangeGroupId) => gruposRemate.has(g) || esLacteo(g);
      const lacteos = filtrar(enReceta, esRemate);
      const proteicos = filtrar(enReceta, (g) => !esRemate(g));

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
      /*
       * Un remate marcado a mano no necesita estar pautado para portarse como
       * remate: ése es justo el caso del feta en un plato de pollo, donde no
       * hay ningún proteico graso pautado y aun así el feta no puede crecer.
       * Para los lácteos sin marcar se mantiene la condición de antes.
       */
      const hayMarcado = Object.keys(lacteos).some((g) =>
        gruposRemate.has(g as ExchangeGroupId),
      );

      if (
        (hayLacteoPautado || hayMarcado) &&
        Object.keys(lacteos).length &&
        Object.keys(proteicos).length
      ) {
        const mLacteos = exchangesToMacros(lacteos);
        const mProteicos = exchangesToMacros(proteicos);

        /**
         * El lácteo sólo cubre el lácteo que esté pautado. Si no hay ninguno
         * pautado, entra de complemento con el sitio que sobre — pero nunca
         * quita proteína al proteico, que es de donde tiene que venir.
         */
        const lacteoPautado = exchangesToMacros(filtrar(pautado, esRemate)).proteina;
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

        for (const g of Object.keys(lacteos) as ExchangeGroupId[]) {
          /*
           * EL RANGO, LO ÚLTIMO
           * Primero se calcula lo que le tocaría y después se le pone el
           * techo: así el rango acota, que es lo que se le pide. El mínimo
           * sólo se respeta si cabe —`sitio` es lo que queda de kcal y de
           * grasa— porque forzarlo pasándose sería romper la pauta para
           * cumplir una preferencia.
           */
          const rango = rangoDelGrupo.get(g);
          const comoQuien = nombres({ [g]: 1 } as ExchangeCounts);
          let f = fLacteo;

          if (rango?.max != null && f > rango.max + 0.001) {
            f = rango.max;
            notas.push(`${comoQuien} se ha dejado en su máximo.`);
          }

          if (rango?.min != null && f < rango.min - 0.001) {
            /*
             * El mínimo sólo se respeta si cabe: forzarlo pasándose sería
             * romper la pauta para cumplir una preferencia. Y cuando NO cabe
             * se dice, porque una cantidad ridícula callada es justo lo que
             * hay que ir a buscar receta por receta.
             */
            const cabe = Math.max(0, sitio);
            if (cabe >= rango.min - 0.001) {
              f = rango.min;
              notas.push(`${comoQuien} se ha subido a su mínimo.`);
            } else {
              f = Math.max(f, Math.min(rango.min, cabe));
              notas.push(
                `${comoQuien} se queda por debajo de su mínimo: con lo pautado aquí no cabe más.`,
              );
            }
          }

          factores[g] = f;
        }
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

  const fuera = new Set(quitados);

  const ingredientes: IngredienteEscalado[] = receta.ingredientes
    .filter((ing) => !fuera.has(ing.id))
    .map((ing) => {
    const esVerdura = ing.grupo === 'verduras';
    /*
     * La unidad la dice el catálogo cuando hay alimento detrás: el chocolate
     * salía en mililitros porque la línea llevaba «ml» escrito a mano, y
     * pedirle que repase receta a receta las que ya tiene no es una solución.
     * Ver `unidadDeIngrediente`.
     */
    const suyo = ing.foodId ? porId.get(ing.foodId) : undefined;
    const unidad = unidadDeIngrediente(ing.unidad, suyo);

    /**
     * Lo que Tats haya escrito a mano gana al cálculo. Se marca como
     * `ajustado` para poder enseñarlo distinto y para saber que ese gramaje
     * no se recalcula si cambia la pauta.
     */
    const aMano = ajustes[ing.id];
    if (aMano != null && aMano >= 0) {
      /*
       * La verdura lleva «al gusto» escrito en la unidad, que está bien
       * mientras no haya cantidad: con una puesta, «150 al gusto» no se puede
       * leer. Ahí la unidad sale del alimento, o son gramos.
       */
      const suUnidad = esUnidadMedible(unidad) ? unidad : (suyo?.unidad ?? 'g');
      return {
        ...ing,
        factor: ing.cantidad_base ? aMano / ing.cantidad_base : 1,
        cantidad_final: aMano,
        unidad: suUnidad,
        display: `${aMano} ${suUnidad}`,
        ajustado: true,
      };
    }

    const factor =
      ing.escalable && ing.grupo !== 'condimento' && !esVerdura
        ? factores[grupoDe(ing, porId)] ?? 1
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
        unidad,
        display: esVerdura
          ? 'al gusto'
          : ing.cantidad_base == null
            ? ing.unidad || 'al gusto'
            : `${ing.cantidad_base} ${unidad}`,
      };
    }

    const bruto = ing.cantidad_base * factor;

    /**
     * Un huevo pesa 55 g y no se puede partir en 1,5. Si el ingrediente está
     * enlazado a un alimento que se cuenta por piezas, el gramaje se ajusta
     * al número entero de piezas más cercano.
     */
    const pieza = suyo ? gramosPorPieza(suyo) : undefined;
    const final = pieza ? redondearAPiezas(bruto, pieza) : roundPortion(bruto);

    return {
      ...ing,
      factor,
      cantidad_final: final,
      unidad,
      // Sólo los gramos: la medida casera tiene su propio interruptor y
      // mezclar las dos en la misma línea era justo lo que confundía.
      display: `${final} ${unidad}`,
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

  /*
   * Lo quitado entra en esta cuenta con sus gramos de base y cero en el plato:
   * es exactamente lo mismo que escribir a mano un gramaje, sólo que el
   * gramaje es ninguno. Así el «cubre 2 de 3» de la tarjeta y el «falta
   * proteína» de la ficha salen de lo que de verdad queda en el plato.
   */
  for (const ing of receta.ingredientes) {
    if (!fuera.has(ing.id)) continue;
    const gid = grupoDe(ing, porId);
    if (!gid || gid === 'verduras' || (ing.grupo as string) === 'condimento') continue;
    if (!ing.cantidad_base) continue;
    aMano.add(gid);
    const s = enElPlato.get(gid) ?? { base: 0, final: 0 };
    s.base += ing.cantidad_base;
    enElPlato.set(gid, s);
  }

  for (const ing of ingredientes) {
    const gid = grupoDe(ing, porId);
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
    /*
     * Si al quitar un ingrediente ese grupo se queda en nada, la receta ya no
     * lo trae y hay que decirlo: es lo que hace que salga «falta proteína» y
     * que ella le ponga algo al lado. Sólo con quitados: sin ellos, un grupo
     * en cero viene de un recorte del cálculo y eso ya se avisa con su nota.
     */
    else if (quitados.length) gruposSinCubrir.push(gid);
  }

  /**
   * LO QUE ELLA LE METIÓ A LA RECETA
   *
   * Va delante de los acompañamientos y sin marca de acompañamiento, así que
   * sale en la lista de ingredientes como uno más: es parte del plato. Suma a
   * lo cubierto igual que todo lo que se come.
   */
  for (const a of anadidos) {
    const food = a.foodId ? porId.get(a.foodId) : undefined;
    const gpi = food?.grupo ? gramosPorIntercambio(food) : 0;
    if (food?.grupo && gpi && a.gramos) {
      const aporte = aporteDeAlimento(food, a.gramos / gpi);
      for (const [gid, n] of Object.entries(aporte) as [ExchangeGroupId, number][]) {
        if (!n || EXCHANGE_GROUPS[gid]?.ilimitado) continue;
        cubiertos[gid] = (cubiertos[gid] ?? 0) + n;
      }
    }

    const unidad = a.unidad ?? food?.unidad ?? 'g';

    ingredientes.push({
      id: a.id,
      nombre: a.nombre,
      foodId: a.foodId,
      cantidad_base: a.gramos || null,
      cantidad_final: a.gramos || null,
      unidad,
      /* Sin subgrupo es un alimento libre —una especia, un chorro de limón—:
         entra en la lista y suma cero, que es lo que aporta. */
      grupo: food?.grupo ?? 'condimento',
      /* No escala: son los gramos que ella escribió para esta clienta. */
      escalable: false,
      opcional: false,
      factor: 1,
      display: a.gramos ? `${a.gramos} ${unidad}` : 'al gusto',
      anadido: true,
    });
  }

  /**
   * Los acompañamientos suman a lo cubierto: para eso se ponen. Sus gramos no
   * escalan —son los que se han escrito— y se traducen a intercambios con los
   * gramos por intercambio de su alimento.
   */
  for (const a of acompanamientos) {
    const food = a.foodId ? porId.get(a.foodId) : undefined;

    /*
     * Lo que no gasta intercambios —una gelatina, la bebida de almendras, un
     * café— se pone igual y suma cero. Antes se descartaba sin más y ni
     * siquiera aparecía en la lista: la clienta no veía lo que se iba a tomar.
     */
    const gpi = food?.grupo ? gramosPorIntercambio(food) : 0;
    if (food?.grupo && gpi && a.gramos) {
      const aporte = aporteDeAlimento(food, a.gramos / gpi);
      for (const [gid, n] of Object.entries(aporte) as [ExchangeGroupId, number][]) {
        if (!n || EXCHANGE_GROUPS[gid]?.ilimitado) continue;
        cubiertos[gid] = (cubiertos[gid] ?? 0) + n;
      }
    }

    const unidad = a.unidad ?? food?.unidad ?? 'g';

    ingredientes.push({
      id: a.id,
      nombre: a.nombre,
      foodId: a.foodId,
      cantidad_base: a.gramos || null,
      cantidad_final: a.gramos || null,
      unidad,
      // Sin subgrupo es un alimento libre: cuenta como condimento, o sea, cero.
      grupo: food?.grupo ?? 'condimento',
      escalable: false,
      opcional: false,
      factor: 1,
      // La sal y el eneldo van «al gusto»: ponerles gramos sería inventárselos.
      display: a.gramos ? `${a.gramos} ${unidad}` : 'al gusto',
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
