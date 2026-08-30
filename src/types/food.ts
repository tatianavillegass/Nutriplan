import type { ExchangeGroupId, MacroBucket } from '../data/exchangeGroups';

export type MealSlot =
  | 'desayuno'
  | 'almuerzo'
  | 'comida'
  | 'merienda'
  | 'cena'
  | 'extra';

/**
 * LOS CATORCE DEL REGLAMENTO EUROPEO
 *
 * Son los que la ley (UE 1169/2011) obliga a declarar en cualquier etiqueta, y
 * por eso son éstos y no otros: así la app habla el mismo idioma que el envase
 * del súper y no hay que traducir nada al leerlo.
 *
 * LA LECHE SON DOS COSAS
 * ======================
 * La lactosa es el azúcar; la proteína son la caseína y el suero. Un queso
 * curado es bajo en lactosa y está lleno de caseína, y una leche sin lactosa es
 * veneno para quien tiene alergia a la proteína de la leche. Tratarlas como la
 * misma etiqueta —que es lo que se hacía— es un error clínico, no un detalle:
 * a una APLV se le colaban todos los sin lactosa.
 *
 * Y el marisco tampoco es uno: la ley separa crustáceos (gamba, langostino) de
 * moluscos (mejillón, calamar), porque hay quien tolera unos y no los otros.
 */
export type Alergeno =
  | 'gluten'
  | 'lactosa'
  | 'proteina_leche'
  | 'frutos_secos'
  | 'cacahuete'
  | 'huevo'
  | 'soja'
  | 'pescado'
  | 'crustaceos'
  | 'moluscos'
  | 'apio'
  | 'mostaza'
  | 'sesamo'
  | 'sulfitos'
  | 'altramuz';

export type Apto = 'vegetariano' | 'vegano' | 'sin_gluten' | 'sin_lactosa';

/** Datos de la etiqueta o de la tabla de composición, por 100 g de alimento. */
export interface Nutrientes100 {
  kcal?: number;
  hc: number;
  proteina: number;
  grasa: number;
  fibra?: number;
  azucar?: number;
}

export interface Alimento {
  id: string;
  nombre: string;
  /** Grupo macro: proteína, carbohidrato o grasa. Se deriva del subgrupo. */
  bucket?: MacroBucket;
  /**
   * Subgrupo de intercambio: almidones, fruta, lácteos, proteicos magros…
   * Sin subgrupo el alimento es "libre": no se pauta por porciones y sólo
   * aparece para registrarlo como extra (bebidas, refrescos, alcohol).
   */
  grupo?: ExchangeGroupId;
  /** "1/4 taza", "2 lonchas", "1 cdta"… */
  medida_casera: string;
  /** Gramos (o ml) que corresponden a esa medida casera. */
  gramos: number;
  unidad?: 'g' | 'ml';
  /** Gramos en cocido, si el gramaje base es en crudo. */
  equivalencia_cocido?: number;
  /**
   * SE COCINA EN TANDA
   *
   * Lo que se pone al fuego una vez y se guarda: arroz, pasta, patata,
   * legumbre, pollo, verduras al horno. El huevo revuelto y el queso feta no,
   * aunque sean del mismo subgrupo: no hay nada que adelantar.
   *
   * Sin decir nada se decide sola (`seCocinaEnTanda`), pero se puede fijar aquí
   * porque lo que se cocina o no depende de cada cocina y de cada producto.
   */
  batch?: boolean;
  /** Cuántos intercambios de su grupo aporta esa medida. */
  intercambios: number;
  /**
   * ALIMENTOS QUE GASTAN DOS COSAS A LA VEZ
   *
   * Lo que consume UNA medida casera, repartido por grupos. Es para los
   * productos que no caben en un solo grupo: una medida de mezcla de tortitas
   * proteicas son 2 almidones Y 2 proteicos magros, los dos enteros. Meterla a
   * la fuerza en un grupo mentiría siempre en el otro.
   *
   * Cuando está, manda sobre `grupo` para las cuentas: al marcar la porción se
   * descuenta de todos los grupos que lista. `grupo` se sigue usando para
   * ordenar y para saber bajo qué epígrafe enseñarlo.
   *
   * Regla para decidir si un alimento lo necesita: pasa cada macro de una
   * medida real a porciones; si el segundo no llega a media porción, se ignora
   * como se ignoran los 2 g de proteína de cualquier almidón.
   */
  equivale?: Partial<Record<ExchangeGroupId, number>>;
  /** Composición por 100 g. Si está, la porción se calcula sola. */
  nutrientes?: Nutrientes100;
  comidas_sugeridas: MealSlot[];
  alergenos: Alergeno[];
  /**
   * Cuánto carga en cada eje clínico. Un eje que no está aquí es un eje **sin
   * revisar**, no un eje bajo: ver `Carga`.
   */
  cargas?: Partial<Record<EjeClinico, CargaDeEje>>;
  apto: Apto[];
  /** Alimentos añadidos por la nutricionista desde la interfaz. */
  custom?: boolean;
  /** Aporta grasa + proteína a la vez (bloque "Grasa Prot" de merienda). */
  grasa_prot?: boolean;
  notas?: string;
}

/** Texto que se imprime en la lista "escoge X" de Fase 2. */
export function formatFoodOption(a: Alimento): string {
  const u = a.unidad ?? 'g';
  const cantidad = a.equivalencia_cocido
    ? `${a.medida_casera} (${a.gramos} ${u} crudo / ${a.equivalencia_cocido} ${u} cocido)`
    : `${a.medida_casera} (${a.gramos} ${u})`;
  return `${a.nombre} — ${cantidad}`;
}

export const ALERGENO_LABELS: Record<Alergeno, string> = {
  gluten: 'Gluten',
  lactosa: 'Lactosa',
  proteina_leche: 'Proteína de la leche',
  frutos_secos: 'Frutos secos',
  cacahuete: 'Cacahuete',
  huevo: 'Huevo',
  soja: 'Soja',
  pescado: 'Pescado',
  crustaceos: 'Crustáceos',
  moluscos: 'Moluscos',
  apio: 'Apio',
  mostaza: 'Mostaza',
  sesamo: 'Sésamo',
  sulfitos: 'Sulfitos',
  altramuz: 'Altramuz',
};

/**
 * LAS CARGAS: NO ES SI PUEDE, ES CUÁNTO
 *
 * Un alérgeno es sí o no —un miligramo de gluten importa—. Pero media aguacate
 * cuadra en una dieta baja en FODMAP y uno entero no, y un tomate fresco no es
 * el mismo problema que uno de bote para quien tiene histamina. En clínica la
 * pregunta casi nunca es «¿puede?» sino «¿cuánto?».
 *
 * Por eso las cargas NO bloquean: se marcan, con la porción a partir de la
 * cual el alimento deja de ser bajo, y decide la nutricionista.
 */
export const EJES_CLINICOS = [
  'fodmap',
  'histamina',
  'niquel',
  'fructosa',
  /*
   * Preparados pero sin rellenar: litiasis renal, gota y salicilatos son las
   * tres que más se echan de menos después y el mecanismo es idéntico, así que
   * dejar el hueco hecho no cuesta nada.
   */
  'oxalatos',
  'purinas',
  'salicilatos',
] as const;

export type EjeClinico = (typeof EJES_CLINICOS)[number];

export const EJE_LABELS: Record<EjeClinico, string> = {
  fodmap: 'FODMAP',
  histamina: 'Histamina',
  niquel: 'Níquel',
  fructosa: 'Fructosa',
  oxalatos: 'Oxalatos',
  purinas: 'Purinas',
  salicilatos: 'Salicilatos',
};

/**
 * Cuánto carga un alimento en un eje.
 *
 * **Que no esté no quiere decir que sea bajo: quiere decir que nadie lo ha
 * mirado.** Con 281 alimentos y siete ejes, la mayoría de las casillas van a
 * estar vacías durante meses, y pintar en verde lo que no se ha revisado es
 * mentir. Sin dato se dice «sin datos», en gris.
 */
export type Carga = 'alto' | 'moderado' | 'bajo';

export const CARGA_LABELS: Record<Carga, string> = {
  alto: 'Alto',
  moderado: 'Moderado',
  bajo: 'Bajo',
};

/**
 * QUÉ FODMAP TRAE, QUE ES LO QUE HACE POSIBLE LA REINTRODUCCIÓN
 *
 * «Alto en FODMAP» no sirve para reintroducir: hay que saber cuál. El
 * protocolo es probar un subtipo por semana con un alimento que lleve ese y
 * sólo ese —el garbanzo para los GOS, el pan de trigo para los fructanos— y
 * eso sin esta lista no se puede hacer.
 */
export const TIPOS_FODMAP = [
  'fructanos',
  'gos',
  'lactosa',
  'fructosa',
  'sorbitol',
  'manitol',
] as const;

export type TipoFodmap = (typeof TIPOS_FODMAP)[number];

export const TIPO_FODMAP_LABELS: Record<TipoFodmap, string> = {
  fructanos: 'Fructanos',
  gos: 'GOS (galactanos)',
  lactosa: 'Lactosa',
  fructosa: 'Fructosa',
  sorbitol: 'Sorbitol',
  manitol: 'Manitol',
};

/** Lo que se sabe de un alimento en un eje clínico. */
export interface CargaDeEje {
  nivel: Carga;
  /**
   * Hasta cuántos gramos se considera bajo. Es *el* dato de la dieta FODMAP:
   * sin él, «alto» sólo sirve para prohibir, que es lo que no queremos.
   */
  porcionSegura?: number;
  /** Qué FODMAP concretos trae. Sólo tiene sentido en el eje `fodmap`. */
  tipos?: TipoFodmap[];
  /**
   * Sólo en histamina: no lleva histamina, la suelta (fresa, clara de huevo,
   * cítricos, chocolate). Hay quien tolera una cosa y no la otra.
   */
  liberador?: boolean;
  /** De dónde salió el dato o qué matiz tiene: «en conserva sí, fresco no». */
  nota?: string;
}
