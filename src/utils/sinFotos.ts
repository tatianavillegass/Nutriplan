import type { Medicion } from '../types/anthropometry';
import type { RegistroDia } from '../types/diary';

/**
 * LAS FOTOS NO CABEN EN EL NAVEGADOR
 *
 * El navegador guarda una copia de los datos para poder abrir la app sin red.
 * Ahí caben unos pocos megas — y las fotos de progreso viven **dentro** del
 * registro del día, en texto: cada sesión de fotos son medio mega, y cuarenta
 * clientas durante medio año son cientos.
 *
 * Eso tenía dos consecuencias, las dos invisibles. El guardado fallaba por
 * falta de sitio y el fallo se tragaba, así que la copia del navegador llevaba
 * meses sin servir para nada; y aun así se pagaba el precio entero de armarla
 * —convertir medio giga a texto— **en cada cambio**, con la pantalla parada
 * mientras tanto. Un día cualquiera, con una clienta marcando el desayuno,
 * eso se hacía otra vez. Es lo que acababa reventando la pestaña.
 *
 * Así que al navegador va todo menos las fotos. No se pierde nada: las fotos
 * sólo se miran al comparar dos tomas, y eso se hace con la app conectada.
 * Siguen enteras en el servidor y en la copia de seguridad.
 */
export function registrosSinFotos(registros: RegistroDia[]): RegistroDia[] {
  return registros.map((r) => {
    if (!r.medidas?.fotos && !r.preparacion?.foto) return r;
    const copia: RegistroDia = { ...r };
    if (copia.medidas?.fotos) {
      const { fotos: _fotos, ...resto } = copia.medidas;
      copia.medidas = resto;
    }
    if (copia.preparacion?.foto) {
      const { foto: _foto, ...resto } = copia.preparacion;
      copia.preparacion = resto;
    }
    return copia;
  });
}

export function medicionesSinFotos(mediciones: Medicion[]): Medicion[] {
  return mediciones.map((m) => {
    if (!m.foto && !m.fotos) return m;
    const { foto: _foto, fotos: _fotos, ...resto } = m;
    return resto as Medicion;
  });
}

/**
 * Lo mismo con cualquier foto metida en texto: la de un recurso o la de una
 * receta que todavía no se haya movido al almacén.
 */
export function esDataUrl(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('data:');
}

export function sinLaImagen<T extends { imagen?: string }>(cosas: T[]): T[] {
  return cosas.map((c) => (esDataUrl(c.imagen) ? { ...c, imagen: undefined } : c));
}

export function sinLaFoto<T extends { foto_url?: string }>(cosas: T[]): T[] {
  return cosas.map((c) => (esDataUrl(c.foto_url) ? { ...c, foto_url: undefined } : c));
}
