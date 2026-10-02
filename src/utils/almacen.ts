import { hayNube, supabase } from './supabase';

/**
 * LAS FOTOS, FUERA DE LOS DATOS
 *
 * Hasta ahora la foto de cada receta viajaba DENTRO de los datos, escrita como
 * texto. Eso tenía dos precios:
 *
 *  · Cada guardado reenviaba todas las fotos, aunque sólo se hubiera cambiado
 *    un gramo.
 *  · Y sobre todo: cuando una clienta entraba por primera vez, su móvil se
 *    descargaba el banco entero —con las fotos de todas las recetas— ANTES de
 *    poder enseñarle nada. De ahí los segundos en blanco.
 *
 * Ahora la foto se sube una vez como archivo y en los datos queda un enlace.
 * Los datos pasan de megas a kilobytes, la primera pantalla aparece enseguida
 * y las fotos entran solas mientras ella lee, sólo las que se ven.
 *
 * SI EL ALMACÉN NO ESTÁ, NO SE ROMPE NADA
 * =======================================
 * Hace falta crear el sitio donde guardarlas (`supabase/esquema.sql`). Mientras
 * no exista, la subida falla y la foto se queda como estaba: dentro de los
 * datos, como hasta hoy. Lento, pero entero. Nunca se pierde una foto por
 * intentar moverla.
 */

export const BUCKET_FOTOS = 'recetas';

/**
 * LAS PERSONALES VAN APARTE Y CERRADAS
 *
 * Las de progreso y las de antropometría seguían dentro del registro, en
 * texto, porque el almacén de recetas es público y éstas no pueden serlo. El
 * precio de dejarlas ahí lo pagaba todo lo demás: viajaban en cada consulta
 * del seguimiento y se copiaban en cada guardado.
 *
 * Así que tienen su propio sitio, **privado**. Lo que se guarda en los datos
 * no es un enlace sino la **ruta** (`cl_a1b2/frente-1730…jpg`): un enlace a un
 * sitio cerrado caduca, así que guardarlo sería guardar algo que mañana no
 * sirve. Para verla se pide un enlace firmado en ese momento.
 */
export const BUCKET_PROGRESO = 'progreso';

/** Cuánto vale un enlace firmado. Una hora sobra para mirar unas fotos. */
const VALE_SEGUNDOS = 60 * 60;

/** Una foto recién hecha viene así: «data:image/jpeg;base64,…». */
export function esDataUrl(valor: string | undefined): boolean {
  return !!valor && valor.startsWith('data:');
}

/** Ya está guardada como archivo: es un enlace, no una foto metida en el texto. */
export function esEnlace(valor: string | undefined): boolean {
  return !!valor && /^https?:\/\//.test(valor);
}

/** De «data:image/jpeg;base64,…» a un archivo de verdad. */
function aBlob(dataUrl: string): { blob: Blob; extension: string } {
  const [cabecera, datos] = dataUrl.split(',');
  const tipo = /data:([^;]+)/.exec(cabecera)?.[1] ?? 'image/jpeg';
  const binario = atob(datos);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return {
    blob: new Blob([bytes], { type: tipo }),
    extension: tipo.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg',
  };
}

/**
 * Sube la foto y devuelve su enlace. Si no se puede —el almacén todavía no
 * existe, no hay conexión— devuelve `undefined` y quien llama se queda con lo
 * que tenía.
 */
export async function guardarFoto(
  dataUrl: string,
  nutriId: string,
  nombre: string,
): Promise<string | undefined> {
  if (!hayNube || !supabase || !esDataUrl(dataUrl)) return undefined;

  try {
    const { blob, extension } = aBlob(dataUrl);
    /*
     * El nombre lleva la marca de tiempo para que al cambiar la foto de una
     * receta no se quede la vieja en la caché del móvil de nadie.
     */
    const ruta = `${nutriId}/${nombre}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(ruta, blob, { contentType: blob.type, upsert: true });
    if (error) {
      console.warn('[almacen] no se pudo subir la foto', error.message);
      return undefined;
    }

    return supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl;
  } catch (e) {
    console.warn('[almacen] no se pudo subir la foto', e);
    return undefined;
  }
}

/** Una foto personal ya guardada: no es un enlace, es dónde está. */
export function esRutaGuardada(valor: string | undefined): valor is string {
  return !!valor && !esDataUrl(valor) && !esEnlace(valor) && valor.includes('/');
}

/**
 * GUARDA UNA FOTO PERSONAL Y DEVUELVE SU RUTA
 *
 * La carpeta es el id de la clienta, que es lo que mira la regla del servidor
 * para decidir quién puede verla. Si no se puede subir —el almacén todavía no
 * existe, no hay conexión— devuelve `undefined` y quien llama se queda con la
 * foto que tenía: **nunca se pierde una por intentar moverla**.
 */
export async function guardarFotoPersonal(
  dataUrl: string,
  clientId: string,
  nombre: string,
): Promise<string | undefined> {
  if (!hayNube || !supabase || !esDataUrl(dataUrl) || !clientId) return undefined;

  try {
    const { blob, extension } = aBlob(dataUrl);
    const ruta = `${clientId}/${nombre}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage
      .from(BUCKET_PROGRESO)
      .upload(ruta, blob, { contentType: blob.type, upsert: true });
    if (error) {
      console.warn('[almacen] no se pudo subir la foto personal', error.message);
      return undefined;
    }
    return ruta;
  } catch (e) {
    console.warn('[almacen] no se pudo subir la foto personal', e);
    return undefined;
  }
}

/**
 * EL ENLACE SE PIDE AL MIRARLA, Y SE GUARDA UN RATO
 *
 * Firmar cuesta una consulta, y el comparador de fotos vuelve a pintar las
 * mismas dos cada vez que se cambia de ángulo. Se recuerda lo firmado hasta
 * poco antes de que caduque, así que moverse por las fotos de una clienta no
 * son veinte consultas sino dos.
 */
const firmados = new Map<string, { url: string; hasta: number }>();

export async function enlaceDeFoto(ruta: string): Promise<string | undefined> {
  if (esDataUrl(ruta) || esEnlace(ruta)) return ruta; // lo viejo sigue valiendo
  if (!hayNube || !supabase || !ruta) return undefined;

  const guardado = firmados.get(ruta);
  if (guardado && guardado.hasta > Date.now()) return guardado.url;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_PROGRESO)
      .createSignedUrl(ruta, VALE_SEGUNDOS);
    if (error || !data?.signedUrl) return undefined;
    firmados.set(ruta, {
      url: data.signedUrl,
      // Un minuto de margen: con el enlace al límite la foto sale rota.
      hasta: Date.now() + (VALE_SEGUNDOS - 60) * 1000,
    });
    return data.signedUrl;
  } catch {
    return undefined;
  }
}

/** Al cerrar sesión, lo firmado para otra persona no vale. */
export function olvidarEnlaces(): void {
  firmados.clear();
}
