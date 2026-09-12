import type { MacroGrams } from './calculations';
import type { Alimento } from './food';
import type { Bioimpedancia } from './anthropometry';

/**
 * REGISTRO DIARIO
 *
 * Lo que el cliente hace cada día: qué tipo de día le toca, qué recetas ha
 * cumplido, qué porciones ha marcado y qué se ha tomado fuera del plan.
 * Es también lo que la nutricionista ve en seguimiento.
 */

export interface Extra {
  id: string;
  nombre: string;
  /** Si viene del catálogo, se recalcula desde sus nutrientes. */
  foodId?: string;
  /** Cantidad en gramos o mililitros. */
  cantidad?: number;
  unidad?: string;
  /** Macros del extra completo (no por 100 g). */
  macros: MacroGrams;
  kcal: number;
  momento?: string;
}

/** mealId → foodId → número de porciones marcadas. */
export type PorcionesMarcadas = Record<string, Record<string, number>>;

/**
 * UN BOCADO (FASE 4)
 *
 * Lo que se apunta cuando ya no hay porciones: un alimento y sus gramos, con
 * los macros que salen de ahí. Tiene la misma forma que un extra, pero vive
 * aparte a propósito: un extra es lo que te has comido **de más** sobre el
 * plan, y en fase 4 no hay plan que superar — todo lo que come es el día.
 * Mezclarlos haría que el resumen del desvío contara como exceso la comida
 * entera.
 */
/** Un ingrediente de una receta suya, con lo que echa a la olla. */
export interface IngredientePropio {
  id: string;
  /** Del catálogo o de sus propios alimentos, para leer sus macros. */
  foodId?: string;
  nombre: string;
  gramos: number;
}

/**
 * UNA RECETA SUYA, Y QUÉ SALE DE ELLA
 *
 * Hay dos casos y la app tiene que servir para los dos:
 *
 *  · **Una ración**: el mugcake es lo que se come, entero. Se apunta «uno».
 *  · **Una tanda**: del banana bread salen diez rebanadas, o un kilo del que
 *    mañana se sirve 50 g. Lo que hace falta ahí no es la receta entera, sino
 *    cuánto lleva CADA cien gramos.
 *
 * Con `raciones` se sabe cuánto pesa una; con `gramosFinales`, cuánto lleva
 * cada gramo. Se pueden dar las dos: son la misma receta contada de dos
 * maneras y cada una sirve para un momento distinto.
 */
export interface RecetaPropia {
  id: string;
  nombre: string;
  ingredientes: IngredientePropio[];
  /** Cuántas salen: rebanadas, pancakes, tarritos. */
  raciones?: number;
  /**
   * Lo que pesa el resultado ya hecho. Manda sobre la suma de los
   * ingredientes: al horno se va el agua y el pan pesa menos de lo que entró,
   * así que contar sobre el peso crudo dejaría cada rebanada corta.
   */
  gramosFinales?: number;
  creada: string;
}

/** Lo que tiene pensado comer un día: comida → receta, y qué tipo de día es. */
export interface DiaDelMenu {
  comidas: Record<string, string>;
  /**
   * Qué tipo de día toca. Es lo que hace que las cantidades se adapten solas:
   * la misma receta escalada a un día de entreno o a uno de descanso. Se dice
   * una vez a la semana en vez de cada mañana.
   */
  dayTypeId?: string;
}

export interface MenuSemana {
  /** El lunes de la semana, en ISO. */
  inicio: string;
  /** fecha ISO → lo de ese día. */
  dias: Record<string, DiaDelMenu>;
  /**
   * FASE 2: CUÁNTAS VECES, NO QUÉ DÍA
   *
   * `mealId → opcionId → veces esta semana`.
   *
   * En fase 2 la clienta no come platos: come combinaciones de alimentos que
   * elige cada día entre las que le salen. Pedirle que diga «el martes
   * huevos» le quita justo la libertad que esa fase existe para darle — y sin
   * saber qué va a comer el jueves no hay lista de la compra.
   *
   * Decir «huevos tres veces» resuelve las dos cosas: la compra sale de una
   * multiplicación y ella sigue eligiendo cada mañana. Son tres o cuatro
   * números por comida en vez de siete casillas por opción, y es como se
   * piensa al hacer la compra.
   *
   * **No es un menú**: la app nunca le dirá «hoy te tocan huevos». Es una
   * lista de la compra, y si el martes le apetece otra cosa no pasa nada.
   */
  veces?: Record<string, Record<string, number>>;
  /**
   * Lo que ya ha echado al carro. Se guarda porque la compra se hace de pie en
   * el pasillo y con una mano: si al bloquear el móvil se destachara todo, la
   * lista no serviría para comprar, sólo para mirarla en casa.
   */
  comprados?: string[];
}

/**
 * Lo que contesta cada dos semanas. Sin nota ni media a propósito: son cinco
 * cosas para hablarlas, no un examen que aprobar.
 */
/**
 * LO QUE SE MIDE ELLA
 *
 * Son los campos de la planilla que Tats les manda por correo: peso, altura y
 * los perímetros con su referencia escrita —cintura por el mínimo, abdominal
 * por el máximo, cadera por el máximo, muslo medio, pierna máxima—. Están así y
 * no «cintura» a secas porque una cinta puesta dos centímetros más arriba
 * inventa una bajada de un centímetro, y esa es exactamente la información que
 * se venía a recoger.
 *
 * A las presenciales las mide ella con el plicómetro y esto no les sale: por
 * eso hay un interruptor en la ficha (`Client.medidas`) en vez de estar para
 * todas.
 *
 * Va en el registro por lo mismo que todo lo que escribe la clienta: es lo
 * único que sube su app. **No entra en `Medicion`**, que es la antropometría
 * que toma la nutricionista: su báscula de casa y unos pliegues medidos en
 * consulta no se mezclan, igual que no se mezclan la bioimpedancia y los
 * pliegues.
 */
export interface MedidasDelDia {
  peso?: number;
  /** cm. Cambia poco, pero en adolescentes y en gente mayor sí cambia. */
  altura?: number;
  brazoRelajado?: number;
  brazoContraido?: number;
  /** Cintura por el punto MÍNIMO. */
  cintura?: number;
  /** Abdominal por el punto MÁXIMO, a la altura del ombligo. */
  abdominal?: number;
  /** Cadera por el punto MÁXIMO. */
  cadera?: number;
  /** Muslo medio. */
  muslo?: number;
  /** Pierna (pantorrilla) por el máximo. */
  pierna?: number;
  /**
   * Lo que marcó su báscula, si usa una de bioimpedancia. Se copia tal cual y
   * no se recalcula nada: su número sale de una fórmula del aparato que no
   * conocemos.
   */
  bioimpedancia?: Bioimpedancia;
  /**
   * Las fotos de ese día, ya encogidas. Son suyas y sólo las ve su
   * nutricionista; todas opcionales, que pedir tres fotos cada semana es la
   * forma más rápida de que se dejen de hacer.
   */
  fotos?: { frente?: string; perfil?: string; espalda?: string };
  /** Lo que quiera apuntar de ese día. */
  nota?: string;
}

export interface CheckIn {
  /**
   * El lunes de la semana sobre la que se pregunta, en ISO. Es lo que
   * identifica un check-in: dos personas que empiezan en meses distintos
   * contestan igual la semana del 8 de septiembre, y así se puede mirar la
   * consulta entera de una semana de una sentada.
   */
  semana?: string;
  /**
   * LO VIEJO: el número de quincena del programa
   *
   * Antes el check-in iba cada catorce días contados desde el inicio del
   * programa, así que se identificaba por «la quincena 1, la 2…». Los ya
   * respondidos se conservan tal cual —no se pueden reescribir desde hoy, y
   * son material de consulta— así que este campo sigue existiendo y ordena por
   * detrás de `semana`.
   */
  numero?: number;
  fecha: string;
  respuestas: {
    energia: number;
    digestion: number;
    sueno: number;
    hambre: number;
    antojos: number;
  };
  /** Lo que quiera contar. Suele ser lo más útil de todo. */
  nota?: string;
}

/**
 * LOS TIPOS DE ENTRENO
 *
 * Una lista cerrada y corta, con «otro» al final para escribirlo. Dejarlo todo
 * a texto libre es rapidísimo de montar y no se puede contar nada después:
 * «fuerza», «Fuerza» y «gym» son tres cosas distintas, y entonces «este mes has
 * hecho 6 de fuerza y 4 de correr» —que es lo que se mira en consulta— no se
 * puede decir. Una lista propia por consulta sería otra pantalla que mantener
 * y el primer día estaría vacía.
 */
export const TIPOS_DE_ENTRENO = [
  'fuerza',
  'correr',
  'bici',
  'crossfit',
  'pilates',
  'yoga',
  'natacion',
  'caminar',
  'clase',
  'otro',
] as const;

export type TipoDeEntreno = (typeof TIPOS_DE_ENTRENO)[number];

export const TIPO_DE_ENTRENO_LABELS: Record<TipoDeEntreno, string> = {
  fuerza: 'Fuerza',
  correr: 'Correr',
  bici: 'Bici',
  crossfit: 'CrossFit',
  pilates: 'Pilates',
  yoga: 'Yoga',
  natacion: 'Natación',
  caminar: 'Caminar',
  clase: 'Clase dirigida',
  otro: 'Otro',
};

/**
 * CÓMO SE SINTIÓ
 *
 * Tres, no del uno al diez. Un número invita a puntuarse el entrenamiento y eso
 * lleva al mismo sitio que puntuarse el día: a competir consigo misma en la app
 * donde además apunta lo que come. Flojo no es malo —es información— y por eso
 * ninguno de los tres se pinta en rojo.
 */
export type ComoFue = 'flojo' | 'normal' | 'fuerte';

export const COMO_FUE_LABELS: Record<ComoFue, string> = {
  flojo: 'Flojo',
  normal: 'Normal',
  fuerte: 'Fuerte',
};

/**
 * UN ENTRENO SUYO
 *
 * Qué hizo, cuánto y cómo se sintió. Lo único obligatorio es el tipo: si para
 * apuntar una salida hay que rellenar tres casillas, se deja de apuntar — y un
 * registro a medias sigue contando como entreno, que es lo que se mira.
 *
 * Se llama `Actividad` porque `EntrenoDeReto` ya es otra cosa: los vídeos que
 * ella monta para un reto. Esto es lo que la clienta hace por su cuenta.
 *
 * Vive en el registro del día porque el registro es lo único que sube el
 * cliente: en su ficha se lo pisaría la nutricionista.
 */
export interface Actividad {
  id: string;
  tipo: TipoDeEntreno;
  /** Sólo cuando el tipo es «otro»: padel, escalada, baile. */
  otro?: string;
  /** Minutos. Opcional: hay quien no lo mira y apuntarlo a ojo es peor. */
  minutos?: number;
  comoFue?: ComoFue;
  /** Lo que quiera contar. Suele ser lo más útil en consulta. */
  nota?: string;
  createdAt: string;
}

/**
 * UNA PAUSA
 *
 * Lo que queda cuando la clienta pulsa «Pausa»: qué sentía, qué estaba
 * pasando, qué hizo y cómo quedó. Sale del árbol de decisión y de los cinco
 * ejercicios de la guía de hambre emocional, hechos dentro de la app.
 *
 * **Es el diario de emociones, escrito solo.** El ejercicio 5 pide rellenar una
 * tabla al final de la semana; nadie la rellena. Si cada pausa deja su fila, la
 * tabla existe sin que haya que sentarse a hacerla.
 *
 * Vive en el registro del día porque el registro es lo único que sube el
 * cliente: en su ficha se lo pisaría la nutricionista.
 */
export interface Pausa {
  id: string;
  /** Cuándo fue. Es la mitad del patrón: casi siempre hay una franja. */
  hora: string;
  /** Antes de comer o cuando ya había comido. El tono cambia. */
  momento: 'antes' | 'despues';
  /** Cuál de los cinco ejercicios le tocó según el árbol. */
  ejercicio?: string;
  emocion?: string;
  /** Del 1 al 10, como en el ejercicio 1. */
  intensidad?: number;
  /** La situación: «discutí con mi pareja», «plazos en el trabajo». */
  contexto?: string;
  /** Si llegó a distinguirlo. «No lo sé» es una respuesta legítima. */
  hambre?: 'fisica' | 'emocional' | 'no-lo-se';
  /** Qué necesitaba de verdad, del ejercicio 2. */
  necesidad?: string;
  /** Sin aprobado ni suspenso: ver `QUE_HIZO`. */
  queHizo?: string;
  /** Lo que hizo en vez de comer, si eligió otra cosa. */
  actividad?: string;
  /** Cómo se sintió después. */
  despues?: string;
  /** Si esperó los cinco minutos de verdad (el temporizador los cuenta). */
  espero?: boolean;
  /**
   * Ids de `SENALES`. **Sólo las ve la nutricionista**: en la pantalla de la
   * clienta no salen ni marcadas ni contadas. La app no diagnostica; se lo
   * enseña a quien sabe qué hacer con ello.
   */
  senales?: string[];
  nota?: string;
}

export interface Bocado {
  id: string;
  nombre: string;
  /** Si viene del catálogo, para poder recalcularlo. */
  foodId?: string;
  /** Gramos o mililitros de lo que se ha comido. */
  cantidad: number;
  unidad?: string;
  /** Macros de esa cantidad, no por 100 g. */
  macros: MacroGrams;
  kcal: number;
  /**
   * En qué comida se lo comió. El día se sigue juzgando entero —lo que manda
   * es el total—, pero apuntar «a secas» obliga a recordar qué has metido ya:
   * por comidas se lee de un vistazo si falta la cena.
   */
  momento?: string;
  /** Hora a la que se apuntó, sólo para ordenarlo. */
  hora?: string;
}

/**
 * UNA COMIDA QUE SE REPITE
 *
 * «Mis pancakes de avena». Quien come casi siempre lo mismo estaba apuntando
 * cinco alimentos con sus gramos cada mañana; con esto son dos toques y, si un
 * día cambia la cantidad, la retoca.
 *
 * Guarda las dos formas de decir lo mismo porque las dos fases apuntan
 * distinto: en fase 4 son gramos (`bocados`) y en fase 3 son porciones
 * marcadas (`porciones`). Se ofrece sólo en la fase en la que se guardó, que
 * es donde significa algo.
 *
 * Se lleva también los alimentos que ella se calculó con la etiqueta: viven en
 * el registro de un día concreto, así que sin esta copia la comida guardada
 * apuntaría a algo que mañana ya no existe.
 */
export interface ComidaGuardada {
  id: string;
  nombre: string;
  /** La comida en la que se guardó: es donde se vuelve a ofrecer. */
  mealId: string;
  bocados?: Bocado[];
  /** foodId → porciones marcadas. */
  porciones?: Record<string, number>;
  alimentos?: Alimento[];
  creada: string;
}

export interface RegistroDia {
  id: string;
  clientId: string;
  /** YYYY-MM-DD */
  fecha: string;
  /** Tipo de día que el cliente ha elegido para esa fecha. */
  dayTypeId?: string;
  /** Fase 1: receta elegida por comida. */
  recetaElegida: Record<string, string>;
  /** Comidas marcadas como hechas. */
  cumplidas: string[];
  /** Fase 3: porciones marcadas, por comida y alimento. */
  porciones: PorcionesMarcadas;
  /** Fase 1: ingredientes cambiados por su equivalente. mealId → ingredienteId → foodId */
  sustituciones: Record<string, Record<string, string>>;
  extras: Extra[];
  /**
   * COMIDAS LIBRES
   *
   * Comer fuera no se mide. Poner un número a una hamburguesa que no has
   * cocinado tú no informa de nada: sólo da sensación de control, y a quien
   * tiene mala relación con la comida esa sensación es justo lo que le hace
   * daño. Lo que sí sirve es la frecuencia, y eso se apunta con un botón.
   *
   * mealId → nota opcional de la clienta. Sin macros, sin calorías, sin
   * puntuarse. Si quiere contar algo, escribe; si no, marca y ya.
   */
  libres?: Record<string, { nota?: string }>;
  /**
   * Metas diarias cumplidas: ids de `Client.metas`. Van aquí y no en la ficha
   * porque son de ese día concreto, como las comidas hechas.
   */
  metas?: string[];
  /**
   * Lo que entrenó ese día. Pueden ser varios: hay quien corre por la mañana y
   * va a pilates por la tarde, y juntarlos en uno perdería los dos.
   *
   * **Se llama `actividad` y no `entrenos` porque `entrenos` ya existe** ahí
   * abajo y es otra cosa: los vídeos de entreno de un reto que ella ha dado por
   * hechos. Esto es lo que hace por su cuenta —su clase de pilates, su carrera—
   * y no hay ninguna lista de la que marcar. En pantalla los dos se llaman
   * entrenos, que es como se llaman. Ver `utils/entrenos.ts` y
   * `Client.entrenos`.
   */
  actividad?: Actividad[];
  /**
   * Las veces que pulsó «Pausa» ese día. Se guardan todas —también las de
   * después de comer— y **no se cuentan en ninguna pantalla suya**: ver
   * `utils/hambreEmocional.ts`.
   */
  pausas?: Pausa[];
  /**
   * Alimentos que la clienta ha definido con la calculadora: la granola del
   * armario que no está en su despensa. Viven aquí y no en el catálogo de la
   * nutricionista porque son de ese día y de esa persona. Se pasan junto al
   * catálogo a todo lo que cuenta porciones, así que funcionan igual que
   * cualquier otro alimento sin tocar ni una cuenta.
   */
  alimentosPropios?: Alimento[];
  /**
   * Fase 4: lo que ha comido hoy, en gramos. No hay comidas ni porciones que
   * marcar, así que esta lista es el día entero.
   */
  bocados?: Bocado[];
  /**
   * SUS COMIDAS HABITUALES
   *
   * Van en el registro del día en que las guardó porque el registro es lo
   * único que sube el cliente: metidas en su ficha, la nutricionista se las
   * pisaría al guardar cualquier otra cosa. La lista se junta leyendo todos
   * sus días, y borrar una se apunta como tal —`comidasBorradas`— porque el
   * día que la creó no se puede reescribir desde hoy.
   */
  comidasGuardadas?: ComidaGuardada[];
  comidasBorradas?: string[];
  /**
   * SUS RECETAS, CON LO QUE SALE DE ELLAS
   *
   * En fase 4 mucha gente cocina lo suyo: un mugcake que es una ración, o un
   * banana bread del que se sirve 50 g cada mañana. Los dos casos son la misma
   * receta con un rendimiento distinto, y por eso se guarda qué sale de ella
   * —raciones, gramos finales o las dos cosas— y no sólo los ingredientes.
   *
   * Viven aquí por lo mismo que las comidas guardadas: el registro es lo único
   * que sube el cliente.
   */
  recetasPropias?: RecetaPropia[];
  recetasBorradas?: string[];
  /**
   * CAMBIAR UNA COMIDA POR UN POSTRE
   *
   * En fase 1 no hay porciones que gastar, así que la única forma de que un
   * postre no se sume encima del día es dejarse otra cosa: la merienda por el
   * bizcocho. Aquí se apunta qué comida cambió y por cuál —mealId → recetaId—,
   * y el día deja de contar esa comida.
   *
   * No es lo mismo que marcarla libre ni que no marcarla: no comerse la
   * merienda porque se ha comido un postre es una decisión, y decirlo permite
   * que las cuentas del día sigan siendo verdad.
   */
  cambiadasPorPostre?: Record<string, string>;
  /**
   * EL MENÚ DE LA SEMANA
   *
   * Vive en el registro del LUNES de esa semana. Sin saber qué va a comer el
   * jueves no hay lista de la compra ni forma de cocinar una vez para tres
   * días, y en fase 1 y 2 eso no se sabe hasta que llega el jueves.
   *
   * Es una propuesta, no un contrato: si ese día le apetece otra cosa, cambia
   * la receta y no pasa nada. Ver `utils/menuSemana.ts`.
   */
  menuSemana?: MenuSemana;
  /**
   * EL CHECK-IN DE CADA DOS SEMANAS
   *
   * Cinco cosas que ella siente —energía, digestión, sueño, hambre, antojos— y
   * una línea libre. Treinta segundos para ella y el material de la próxima
   * consulta para la nutricionista, con histórico.
   *
   * Va en el registro por lo mismo que todo lo que escribe ella: es lo único
   * que sube su app. Se juntan leyendo sus días. Ver `utils/checkin.ts`.
   */
  checkins?: CheckIn[];
  /**
   * Reto: lo que hizo antes de empezar —medirse, la foto, leerse la guía—. Va
   * aquí por lo mismo que todo lo demás que escribe ella: el registro es lo
   * único que sube su app. Se junta leyendo sus días.
   */
  /**
   * El mensaje de la nutricionista que ya ha leído, marcado por la fecha del
   * envío. Se guarda para que no vuelva a salir mañana: un aviso que no se
   * puede cerrar deja de ser un aviso y pasa a ser un cartel.
   */
  avisoLeido?: string;
  /** Reto: entrenos que ha dado por hechos. */
  entrenos?: string[];
  /**
   * Lo que se mide ella. En consulta la báscula la pone la nutricionista; en un
   * reto online no hay consulta, así que lo apunta aquí. Todo opcional: pesarse
   * a diario le va bien a quien no le da importancia y le hace daño a quien se
   * la da, así que no se pide ni rompe ninguna racha.
   */
  medidas?: MedidasDelDia;
  preparacion?: {
    hechos: ('medidas' | 'foto' | 'guia')[];
    cintura?: number;
    cadera?: number;
    foto?: string;
  };
  notas?: string;
}

export function registroVacio(clientId: string, fecha: string, id: string): RegistroDia {
  return {
    id,
    clientId,
    fecha,
    recetaElegida: {},
    cumplidas: [],
    porciones: {},
    sustituciones: {},
    extras: [],
    libres: {},
    metas: [],
  };
}

/** ¿Esta comida se la ha tomado libre? */
export function esComidaLibre(registro: RegistroDia | undefined, mealId: string): boolean {
  return !!registro?.libres?.[mealId];
}

/** Cuántas comidas libres hay en un puñado de días. Es el dato que importa. */
export function contarLibres(registros: RegistroDia[]): number {
  return registros.reduce((s, r) => s + Object.keys(r.libres ?? {}).length, 0);
}

export const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
export const DIAS_LARGOS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Fecha local en formato YYYY-MM-DD, sin líos de zona horaria. */
export function claveFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function desdeClave(clave: string): Date {
  const [y, m, d] = clave.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function sumarDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Lunes de la semana a la que pertenece una fecha. */
export function inicioSemana(d: Date): Date {
  const x = new Date(d);
  const dia = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dia);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function fechaLegible(clave: string): string {
  const d = desdeClave(clave);
  return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
