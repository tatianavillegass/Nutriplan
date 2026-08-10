/**
 * Fotos de receta.
 *
 * La foto se guarda dentro de la propia receta como data URL, igual que el
 * resto de los datos. Para que quepa, antes se reduce y se recomprime: una
 * foto de móvil de 4 MB acaba pesando ~120 KB sin que se note en pantalla.
 */

/** Lado mayor al que se reduce la foto. Suficiente para verla a pantalla completa. */
export const LADO_MAX = 900;
/** Calidad JPEG. 0.82 es el punto donde deja de notarse la pérdida. */
export const CALIDAD = 0.82;
/** Tamaño máximo del archivo original que aceptamos leer. */
export const PESO_MAX_MB = 12;

export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/**
 * Escala manteniendo la proporción, sin agrandar nunca una foto pequeña.
 * Función pura para poder probarla sin navegador.
 */
export function dimensionesDestino(
  ancho: number,
  alto: number,
  ladoMax = LADO_MAX,
): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto);
  if (!mayor || mayor <= ladoMax) return { ancho: Math.round(ancho), alto: Math.round(alto) };
  const f = ladoMax / mayor;
  return { ancho: Math.max(1, Math.round(ancho * f)), alto: Math.max(1, Math.round(alto * f)) };
}

/** Peso aproximado en bytes de una data URL base64. */
export function pesoDataUrl(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const relleno = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - relleno);
}

export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class ErrorImagen extends Error {}

/** Comprueba el archivo antes de tocarlo, para dar un mensaje claro. */
export function validarArchivo(file: File): string | undefined {
  const porTipo = file.type ? file.type.startsWith('image/') : /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!porTipo) return 'Ese archivo no es una imagen. Sube un JPG, PNG o WEBP.';
  if (file.size > PESO_MAX_MB * 1024 * 1024)
    return `La imagen pesa ${pesoLegible(file.size)} y el máximo son ${PESO_MAX_MB} MB.`;
  return undefined;
}

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new ErrorImagen('No se pudo leer el archivo.'));
    fr.readAsDataURL(file);
  });
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ErrorImagen('No se pudo abrir la imagen.'));
    img.src = src;
  });
}

/**
 * Archivo → data URL ya reducida y comprimida, lista para guardar en la receta.
 * Si el navegador no puede dibujar en canvas, devuelve la original tal cual.
 */
export async function prepararFoto(
  file: File,
  ladoMax = LADO_MAX,
  calidad = CALIDAD,
): Promise<string> {
  const error = validarArchivo(file);
  if (error) throw new ErrorImagen(error);

  const original = await leerComoDataUrl(file);
  try {
    const img = await cargarImagen(original);
    const { ancho, alto } = dimensionesDestino(img.naturalWidth, img.naturalHeight, ladoMax);
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, ancho, alto);
    const reducida = canvas.toDataURL('image/jpeg', calidad);
    // Si el recomprimido saliera peor (PNG pequeño, por ejemplo), nos quedamos con el original.
    return pesoDataUrl(reducida) < pesoDataUrl(original) ? reducida : original;
  } catch {
    return original;
  }
}
