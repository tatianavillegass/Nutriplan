import type { ExchangeGroupId, Familia } from '../data/exchangeGroups';
import { EXCHANGE_GROUPS, MIN_VERDURA_G } from '../data/exchangeGroups';
import type { Receta, IngredienteEscalado, RecetaEscalada } from '../types/recipe';
import type { Alimento } from '../types/food';
import { exchangesToMacros, type ExchangeCounts } from './exchanges';
import { kcalFromMacros, roundPortion } from './macros';
import { gramosPorPieza, redondearAPiezas } from './measures';

/**
 * ESCALADO POR FAMILIA (§5)
 *
 * La receta se ajusta a lo que tenga pautado esa comida. Lo que se compara
 * no es subgrupo contra subgrupo, sino familia contra familia — la misma
 * regla que en la fase 3:
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
 * Dentro de cada familia:
 *   factor = ancla_pautada / ancla_base,  recortado si excede algún tope
 *
 * El ancla es lo que define la familia (proteína en los proteicos, grasa en
 * las grasas, hidratos en el resto). Las verduras nunca escalan: son
 * ilimitadas (§10.1).
 */

/** Por qué macro se mide cada familia. */
const ANCLA_DE_FAMILIA: Record<Familia, keyof ReturnType<typeof exchangesToMacros> | null> = {
  verduras: null,
  fruta: 'hc',
  almidones: 'hc',
  legumbres: 'hc',
  azucares: 'hc',
  proteicos: 'proteina',
  grasas: 'grasa',
};

/** Reparte unos intercambios por familia. */
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
  familia: Familia,
  tiene: ReturnType<typeof exchangesToMacros>,
  pautado: ReturnType<typeof exchangesToMacros>,
): { valor: number; que: string } | undefined {
  const candidatos: { valor: number; que: string }[] = [];
  if (familia === 'grasas' || familia === 'proteicos') {
    if (tiene.grasa > 0) candidatos.push({ valor: pautado.grasa / tiene.grasa, que: 'grasa' });
  }
  if (familia !== 'grasas') {
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
  familia: Familia,
  fijo: ReturnType<typeof exchangesToMacros>,
  porUnidad: ReturnType<typeof exchangesToMacros>,
  pautado: ReturnType<typeof exchangesToMacros>,
): number {
  const limites: number[] = [];
  const anotar = (queda: number, cuesta: number) => {
    if (cuesta > 0) limites.push(queda / cuesta);
  };

  if (familia === 'grasas' || familia === 'proteicos') {
    anotar(pautado.grasa - fijo.grasa, porUnidad.grasa);
  }
  if (familia !== 'grasas') {
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
): RecetaEscalada {
  const factores: Partial<Record<ExchangeGroupId, number>> = {};
  const gruposSinCubrir: ExchangeGroupId[] = [];
  const notas: string[] = [];
  const porId = new Map(foods.map((f) => [f.id, f]));

  const base = baseNumerica(receta);
  const deLaReceta = porFamilia(base);
  const delPlan = porFamilia(requeridos);

  for (const [familia, enReceta] of deLaReceta) {
    const ancla = ANCLA_DE_FAMILIA[familia];
    const pautado = delPlan.get(familia) ?? {};

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
    if (familia === 'proteicos') {
      const esLacteo = (g: ExchangeGroupId) => g.startsWith('lacteos_');
      const lacteos = filtrar(enReceta, esLacteo);
      const proteicos = filtrar(enReceta, (g) => !esLacteo(g));

      if (Object.keys(lacteos).length && Object.keys(proteicos).length) {
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

        const sitio = factorQueCabe(familia, ocupado, mLacteos, mReq);
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
        const soloProteico = tope(familia, ocupado, mReq);
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
    if (familia === 'grasas' || familia === 'proteicos') {
      if (mBase.grasa > 0) topes.push({ valor: mReq.grasa / mBase.grasa, que: 'grasa' });
    }
    if (familia !== 'grasas') {
      const kBase = kcalFromMacros(mBase);
      if (kBase > 0) topes.push({ valor: kcalFromMacros(mReq) / kBase, que: 'calorías' });
    }

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
  for (const [familia, pautado] of delPlan) {
    if (deLaReceta.has(familia)) continue;
    for (const gid of Object.keys(pautado) as ExchangeGroupId[]) gruposSinCubrir.push(gid);
  }

  const ingredientes: IngredienteEscalado[] = receta.ingredientes.map((ing) => {
    const esVerdura = ing.grupo === 'verduras';
    const factor =
      ing.escalable && ing.grupo !== 'condimento' && !esVerdura
        ? factores[ing.grupo as ExchangeGroupId] ?? 1
        : 1;

    if (ing.cantidad_base == null || !ing.escalable) {
      return {
        ...ing,
        factor: 1,
        cantidad_final: ing.cantidad_base,
        display: esVerdura
          ? `al gusto (mín. ${MIN_VERDURA_G} g)`
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
  const cubiertos: Partial<Record<ExchangeGroupId, number>> = {};
  for (const [gid, n] of Object.entries(base) as [ExchangeGroupId, number][]) {
    const v = n * (factores[gid] ?? 1);
    if (v > 0.001) cubiertos[gid] = v;
  }

  return { receta, ingredientes, factores, cubiertos, gruposSinCubrir, notas };
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
