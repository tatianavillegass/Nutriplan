import { useAppStore } from "../store/useAppStore";
import { storage } from "./storage";
import { hayNube, nube } from "./supabase";
import {
  bajar,
  bajarPlanDelCliente,
  bajarRegistros,
  subirTodo,
  olvidarLoEnviado,
  subirRegistros,
  type Foto,
  type Perfil,
} from "./nube";
import type { RegistroDia } from "../types/diary";
import {
  guardarPlantillas,
  guardarPlantillasDia,
  leerPlantillas,
  leerPlantillasDia,
  observarPlantillas,
  sinAvisar,
} from "./plantillas";
import {
  guardarOmitidos,
  guardarRepartos,
  leerOmitidos,
  leerRepartos,
} from "./repartos";

/**
 * MANTENER LOS DOS LADOS IGUALES
 *
 * La app no espera al servidor para nada: se trabaja en memoria, se pinta al
 * instante, y por detrás se va subiendo. Si se cae la conexión no se pierde
 * el trabajo — sigue en el navegador — y se sube en cuanto vuelve.
 *
 * Quién escribe qué:
 *   · la nutricionista sube todo lo suyo
 *   · el cliente sólo sube sus registros del día
 *
 * Se espera un momento antes de subir para no mandar veinte veces lo mismo
 * mientras se teclea un nombre o se sube y baja una porción.
 */

const ESPERA_MS = 1500;

let temporizador: ReturnType<typeof setTimeout> | null = null;
let desuscribir: (() => void) | null = null;
let desuscribirPlantillas: (() => void) | null = null;
let perfilActivo: Perfil | null = null;
let pendiente = false;

/** Se avisa a la app de si hay algo por guardar, para poder enseñarlo. */
type Estado = "al-dia" | "guardando" | "error";
let alCambiarEstado: ((e: Estado) => void) | null = null;

export function observarSincronizacion(fn: ((e: Estado) => void) | null): void {
  alCambiarEstado = fn;
}

function avisar(e: Estado) {
  alCambiarEstado?.(e);
}

/**
 * POR QUÉ NO SE PUDO CARGAR
 *
 * «Plan no disponible» no distingue entre «tu nutricionista aún no te lo ha
 * enviado» y «no he podido leer tus datos». Con veinte participantes en un
 * reto, esa diferencia es una hora de llamadas: hay que poder decirle a quien
 * mira la pantalla qué ha pasado y darle un botón para reintentar.
 */
let fallo: string | null = null;
let alFallar: ((m: string | null) => void) | null = null;

export function observarFallo(fn: ((m: string | null) => void) | null): void {
  alFallar = fn;
  fn?.(fallo);
}

export function ultimoFallo(): string | null {
  return fallo;
}

function ponerFallo(m: string | null) {
  fallo = m;
  alFallar?.(m);
}

/** El estado completo, incluidas las plantillas, que viven aparte. */
export function fotoActual(): Foto {
  const s = useAppStore.getState();
  return {
    clients: s.clients,
    plans: s.plans,
    recipes: s.recipes,
    foods: s.foods,
    mediciones: s.mediciones,
    registros: s.registros,
    plantillas: leerPlantillas(),
    plantillasDia: leerPlantillasDia(),
    plantillasReparto: leerRepartos(),
    alimentosOmitidos: leerOmitidos(),
    recursos: s.recursos,
    retos: s.retos,
  };
}

/**
 * De quién es lo que hay guardado en este navegador. Sin esto, una segunda
 * nutricionista que se registrara en el mismo ordenador se llevaría los
 * clientes de la primera a su cuenta.
 */
const DUENO_KEY = "nube_dueno";

/** Deja el navegador como recién estrenado. Se llama al cerrar sesión. */
export function olvidarLocal(): void {
  useAppStore.getState().hidratar({
    clients: [],
    plans: [],
    recipes: [],
    foods: [],
    mediciones: [],
    registros: [],
    recursos: [],
    retos: [],
  });
  sinAvisar(() => {
    guardarPlantillas([]);
    guardarPlantillasDia([]);
    guardarRepartos([]);
    guardarOmitidos([]);
  });
  void storage.remove(DUENO_KEY);
}

/**
 * Al entrar: se trae lo que hay en el servidor y se sustituye lo local.
 * Manda la nube, no el navegador — si no, dos dispositivos se pisarían.
 *
 * La única excepción es la primera vez de todas: una cuenta recién creada no
 * tiene nada arriba y lo que hay en este navegador es suyo, así que se sube
 * en lugar de tirarlo. Sólo si nadie más lo ha reclamado antes.
 */
export async function cargarDesdeNube(perfil: Perfil): Promise<void> {
  if (!hayNube) return;
  avisar("guardando");

  try {
    const foto = await bajar(perfil);
    const arribaVacio =
      !foto.clients.length && !foto.recipes.length && !foto.foods.length;
    const dueno = storage.getSync<string>(DUENO_KEY);
    const heredable = !dueno || dueno === perfil.nutriId;

    if (arribaVacio && perfil.rol === "nutricionista" && heredable) {
      // Primera vez: lo que hay en este navegador pasa a ser lo de la cuenta.
      void storage.set(DUENO_KEY, perfil.nutriId);
      await subirTodo(perfil, fotoActual());
    } else {
      if (arribaVacio && !heredable) olvidarLocal();
      void storage.set(DUENO_KEY, perfil.nutriId);
      useAppStore.getState().hidratar(foto);
      // Lo que acaba de bajar ya está arriba: guardarlo no es un cambio.
      sinAvisar(() => {
        guardarPlantillas(foto.plantillas);
        guardarPlantillasDia(foto.plantillasDia);
        guardarRepartos(foto.plantillasReparto);
        guardarOmitidos(foto.alimentosOmitidos);
      });
    }
    ponerFallo(null);
    avisar("al-dia");
  } catch (e) {
    console.error("[nube] no se pudo cargar", e);
    ponerFallo(e instanceof Error ? e.message : String(e));
    avisar("error");
  }
}

/**
 * SEGUIMIENTO EN VIVO
 *
 * La nutricionista se queda escuchando la tabla de registros: en cuanto una
 * clienta marca una comida en su móvil, el cambio entra en la app sin recargar.
 * Antes los datos se bajaban una sola vez al entrar, así que aunque la clienta
 * marcara todo el día, en la pantalla de la nutricionista no aparecía nada.
 */
let canal: { unsubscribe: () => void } | null = null;
let repaso: ReturnType<typeof setInterval> | null = null;
let repasoDelPlan: ReturnType<typeof setInterval> | null = null;
let alLlegarRegistro: ((r: RegistroDia) => void) | null = null;
/** Lo que llega del servidor no debe disparar una subida de vuelta. */
let aplicandoRemoto = false;

/** Cada cuánto se pregunta por si el aviso en directo no llega. */
const REPASO_MS = 20_000;

export type EstadoVivo = "conectando" | "en-directo" | "preguntando";
let estadoVivo: EstadoVivo = "conectando";
let alCambiarVivo: ((e: EstadoVivo) => void) | null = null;

export function observarRegistrosEnVivo(
  fn: ((r: RegistroDia) => void) | null,
): void {
  alLlegarRegistro = fn;
}

export function observarEstadoVivo(fn: ((e: EstadoVivo) => void) | null): void {
  alCambiarVivo = fn;
  fn?.(estadoVivo);
}

function ponerEstadoVivo(e: EstadoVivo) {
  estadoVivo = e;
  alCambiarVivo?.(e);
}

/** Mete el registro en el estado sin que eso dispare una subida. */
function aplicar(registro: RegistroDia): void {
  if (!registro?.clientId) return;
  aplicandoRemoto = true;
  try {
    useAppStore.getState().aplicarRegistroRemoto(registro);
  } finally {
    aplicandoRemoto = false;
  }
  alLlegarRegistro?.(registro);
}

function escucharRegistros(perfil: Perfil): void {
  if (!hayNube || perfil.rol !== "nutricionista") return;
  const sb = nube();
  ponerEstadoVivo("conectando");

  /**
   * La conexión en directo tiene que ir firmada con la sesión de quien mira.
   * Sin esto conectaba igual y decía «SUBSCRIBED», pero el servidor no sabía
   * quién era y las reglas de la tabla no le dejaban ver ninguna fila: no
   * llegaba ni un aviso, y sin ningún error de por medio.
   */
  void sb.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token;
    if (token) sb.realtime.setAuth(token);

    canal = sb
      .channel("registros-en-vivo")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registros" },
        (payload: {
          new?: { datos?: RegistroDia };
          old?: { datos?: RegistroDia };
        }) => {
          const registro = payload.new?.datos ?? payload.old?.datos;
          if (registro) aplicar(registro);
        },
      )
      .subscribe((estado: string) => {
        ponerEstadoVivo(estado === "SUBSCRIBED" ? "en-directo" : "preguntando");
      });
  });

  /**
   * Y por si el directo se cae sin avisar —se duerme el portátil, cambia el
   * wifi, Supabase corta el socket—, cada poco se pregunta igualmente. Es una
   * consulta pequeña y evita que el seguimiento se quede mudo sin que nadie
   * se entere, que es lo que pasaba.
   */
  repaso = setInterval(() => {
    void bajarRegistros(perfil)
      .then((rs) => rs.forEach(aplicar))
      .catch(() => ponerEstadoVivo("preguntando"));
  }, REPASO_MS);
}

/** Trae los registros ahora mismo, sin esperar al siguiente repaso. */
export async function refrescarRegistros(): Promise<void> {
  const perfil = perfilActivo;
  if (!perfil || !hayNube) return;
  const rs = await bajarRegistros(perfil);
  rs.forEach(aplicar);
}

/**
 * EL CLIENTE TAMBIÉN TIENE QUE ENTERARSE
 *
 * Sus datos se leían UNA sola vez, al abrir sesión. La nutricionista le
 * cambiaba la fase, se guardaba bien en el servidor, y él seguía viendo lo de
 * antes hasta que cerraba la app y volvía a entrar — que en un móvil puede ser
 * nunca, porque la pestaña se queda abierta días.
 *
 * Se vuelve a mirar al recuperar el foco (que es cuando desbloquea el móvil) y
 * cada pocos minutos. **No se tocan los registros**: los del servidor pueden ir
 * por detrás de lo que acaba de marcar, y traerlos le borraría el día.
 */
const REPASO_DEL_PLAN_MS = 5 * 60_000;

async function repasarPlan(): Promise<void> {
  const perfil = perfilActivo;
  if (!perfil || perfil.rol !== "cliente") return;
  try {
    const suyo = await bajarPlanDelCliente(perfil);
    if (suyo)
      useAppStore.getState().aplicarPlanRemoto(suyo.clients, suyo.plans);
  } catch (e) {
    console.warn("[nube] no se pudo repasar el plan", e);
  }
}

function alVolverAlaApp() {
  if (document.visibilityState === "visible") void repasarPlan();
}

/** A partir de aquí, cada cambio se sube solo. */
export function arrancarSincronizacion(perfil: Perfil): void {
  /*
   * Lo que se recuerda como «ya enviado» es de la sesión anterior: al entrar
   * otra persona —o la misma tras cerrar— hay que mandar todo de nuevo.
   */
  olvidarLoEnviado();
  if (!hayNube) return;
  pararSincronizacion();
  perfilActivo = perfil;
  escucharRegistros(perfil);

  if (perfil.rol === "cliente" && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", alVolverAlaApp);
    repasoDelPlan = setInterval(() => void repasarPlan(), REPASO_DEL_PLAN_MS);
  }

  desuscribir = useAppStore.subscribe(() => {
    // Lo que acaba de llegar del servidor ya está arriba: subirlo otra vez
    // sólo daría vueltas.
    if (aplicandoRemoto) return;
    programarSubida();
  });

  /**
   * Las plantillas de despensa y de día no viven en el estado de la app, así
   * que hay que escucharlas aparte. Sin esto se guardaban sólo en el navegador
   * y al volver a entrar las borraba lo que había en el servidor.
   */
  desuscribirPlantillas = observarPlantillas(programarSubida);

  // Si se cierra la pestaña con algo a medias, se intenta un último envío.
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", alSalirDeLaPagina);
  }
}

export function pararSincronizacion(): void {
  olvidarLoEnviado();
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  desuscribir?.();
  desuscribir = null;
  desuscribirPlantillas?.();
  desuscribirPlantillas = null;
  canal?.unsubscribe();
  canal = null;
  if (repaso) clearInterval(repaso);
  repaso = null;
  if (repasoDelPlan) clearInterval(repasoDelPlan);
  repasoDelPlan = null;
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", alVolverAlaApp);
  }
  perfilActivo = null;
  pendiente = false;
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeunload", alSalirDeLaPagina);
  }
}

function alSalirDeLaPagina() {
  if (pendiente) void empujar();
}

/** Apunta que hay algo que subir y lo manda en cuanto se deje de teclear. */
function programarSubida(): void {
  pendiente = true;
  avisar("guardando");
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => void empujar(), ESPERA_MS);
}

/** Sube lo que toque según quién esté dentro. */
export async function empujar(): Promise<void> {
  const perfil = perfilActivo;
  if (!perfil || !hayNube) return;
  pendiente = false;

  try {
    if (perfil.rol === "cliente") {
      const mios = useAppStore
        .getState()
        .registros.filter((r) => r.clientId === perfil.clientId);
      await subirRegistros(mios);
    } else {
      await subirTodo(perfil, fotoActual());
    }
    avisar("al-dia");
  } catch (e) {
    console.error("[nube] no se pudo guardar", e);
    pendiente = true;
    avisar("error");
  }
}
