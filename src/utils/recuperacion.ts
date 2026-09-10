/**
 * EL ENLACE DE «SE ME OLVIDÓ LA CONTRASEÑA»
 *
 * Le llegaba el correo, pulsaba el enlace y la app la dejaba dentro sin
 * enseñarle nunca dónde escribir la contraseña nueva — o directamente la
 * echaba fuera. Tres cosas a la vez, y todas por la almohadilla.
 *
 * 1. LA ALMOHADILLA SE COMÍA EL TOKEN
 * ===================================
 * La app usa rutas con almohadilla (`#/clientes/...`). El enlace volvía a
 * `https://…/#/`, así que Supabase colgaba su `?code=…` DETRÁS de la
 * almohadilla: `https://…/#/?code=abc`. Para el navegador eso no es un
 * parámetro, es texto dentro del ancla, así que `location.search` salía vacío
 * y la librería no encontraba nada que canjear. Nunca había sesión, y sin
 * sesión no hay contraseña que cambiar. Ahora se vuelve a la raíz limpia
 * (`https://…/?recuperar=1`) y el `&code=` cae donde tiene que caer.
 *
 * 2. NADIE AVISABA DE QUE ERA UNA RECUPERACIÓN
 * ============================================
 * La app esperaba el evento `PASSWORD_RECOVERY`, que es el del formato viejo.
 * Con el flujo nuevo (PKCE) lo que llega es un `SIGNED_IN` normal: el aviso de
 * que esto venía de un enlace de contraseña se pierde por el camino. Por eso
 * lo decimos nosotros con `?recuperar=1`, que viaja en el propio enlace y no
 * depende de qué evento emita la librería ni de cuándo se registre el oyente.
 *
 * 3. Y SE CERRABA LA SESIÓN RECIÉN ABIERTA
 * ========================================
 * Al arrancar, la app resuelve el perfil y, si algo falla, cierra la sesión —
 * que está bien, porque una sesión que no lleva a ningún sitio es peor que
 * ninguna. Pero durante una recuperación eso mata la única ventana que hay
 * para escribir la contraseña. Ahora se mira esto antes.
 *
 * Se lee de la URL y no del estado porque tiene que saberse en el primer
 * milisegundo, antes de que arranque nada.
 */

/** El parámetro que ponemos nosotros en el enlace. */
export const MARCA = 'recuperar';

/** A dónde vuelve el enlace del correo. Sin almohadilla, y ese es el arreglo. */
export function destinoDelEnlace(location: {
  origin: string;
  pathname: string;
}): string {
  return `${location.origin}${location.pathname}?${MARCA}=1`;
}

/**
 * Si esta carga de la app viene del enlace del correo.
 *
 * Se aceptan los dos formatos: el nuestro (`?recuperar=1`) y el viejo de
 * Supabase (`#access_token=…&type=recovery`), porque los correos que ya se
 * enviaron llevan el de antes y esas personas siguen esperando poder entrar.
 */
export function vieneDeUnEnlace(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.searchParams.get(MARCA) === '1') return true;
  /*
   * Y también con el código a secas, sin nuestra marca.
   *
   * Supabase sólo respeta la dirección de vuelta si está en su lista de
   * permitidas; si no, se la salta y manda al «Site URL» del proyecto, con el
   * código pero sin nada de lo que le pidamos. Pasó de verdad: el proyecto
   * seguía apuntando al dominio viejo de Vercel, así que el enlace la sacaba
   * a otro dominio —donde no está la llave que guardó su navegador al pedir el
   * cambio— y se encontraba la pantalla de entrar diciéndole que la contraseña
   * era incorrecta, sin más explicación.
   *
   * Eso se arregla en la configuración del servidor, no aquí. Pero si vuelve a
   * pasar, con esto al menos se le dice lo que ha ocurrido en vez de dejarla
   * mirando un formulario que no va a aceptarle nada.
   */
  if (url.searchParams.has('code')) return true;
  // El formato viejo: todo detrás de la almohadilla.
  return /(^|[#&?])type=recovery(&|$)/.test(url.hash);
}

/**
 * Quita de la barra de direcciones el código ya usado.
 *
 * Un código de estos se canjea UNA vez. Si se queda escrito en la URL y ella
 * recarga la página —o la guarda en favoritos—, el segundo intento falla con
 * un error en inglés que no dice nada. Se borra en cuanto se ha usado.
 */
export function urlLimpia(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  for (const p of [MARCA, 'code', 'error', 'error_code', 'error_description']) {
    url.searchParams.delete(p);
  }
  if (/access_token|type=recovery/.test(url.hash)) url.hash = '';
  return url.toString();
}
