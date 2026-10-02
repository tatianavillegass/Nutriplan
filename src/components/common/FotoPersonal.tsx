import { useEffect, useState } from 'react';
import { enlaceDeFoto, esRutaGuardada } from '../../utils/almacen';

interface Props {
  /** La ruta en el almacén, o una foto vieja todavía metida en el texto. */
  foto?: string;
  alt: string;
  className?: string;
}

/**
 * UNA FOTO QUE VIVE EN UN SITIO CERRADO
 *
 * Las de progreso no son públicas: para verlas hay que pedir un enlace
 * firmado, y ese enlace caduca. Por eso en los datos se guarda **dónde está**
 * y no un enlace — guardar el enlace sería guardar algo que mañana no sirve.
 *
 * Aquí se pide al pintarla y ya. Todo lo que sigue siendo del formato viejo
 * —la foto escrita dentro del texto— se pinta tal cual, así que las que
 * todavía no se han movido se ven igual que siempre.
 */
export function FotoPersonal({ foto, alt, className }: Props) {
  const [src, setSrc] = useState<string | undefined>(
    esRutaGuardada(foto) ? undefined : foto,
  );

  useEffect(() => {
    let vivo = true;
    if (!foto) {
      setSrc(undefined);
      return;
    }
    if (!esRutaGuardada(foto)) {
      setSrc(foto);
      return;
    }
    setSrc(undefined);
    void enlaceDeFoto(foto).then((url) => {
      if (vivo) setSrc(url);
    });
    return () => {
      vivo = false;
    };
  }, [foto]);

  if (!foto) return null;

  /*
   * Mientras llega el enlace se deja el hueco en gris en vez de no pintar
   * nada: si no, al cambiar de ángulo en el comparador las dos fotos saltan y
   * la pantalla baila.
   */
  if (!src) return <div className={`animate-pulse bg-slate-100 ${className ?? ''}`} />;

  return <img src={src} alt={alt} loading="lazy" className={className} />;
}
