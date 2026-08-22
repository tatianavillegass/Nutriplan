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
