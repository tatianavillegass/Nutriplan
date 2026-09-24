// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ErrorImagen, prepararFoto } from '../imagen';

afterEach(() => vi.unstubAllGlobals());

/**
 * EL HEIC DEL IPHONE
 *
 * Antes, lo que el navegador no sabía abrir se guardaba **tal cual**: cuatro
 * megas metidos en los datos y una foto que luego no se ve, porque Chrome no
 * pinta HEIC. Ahora se dice que no ha entrado y qué hacer.
 */
describe('Una foto que el navegador no sabe abrir', () => {
  const conImagenQueFalla = () => {
    class ImagenRota {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_v: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    vi.stubGlobal('Image', ImagenRota);
  };

  it('no se guarda: se explica qué hacer con ella', async () => {
    conImagenQueFalla();
    const heic = new File(['loquesea'], 'IMG_0001.HEIC', { type: 'image/heic' });
    await expect(prepararFoto(heic)).rejects.toBeInstanceOf(ErrorImagen);
    await expect(prepararFoto(heic)).rejects.toThrow(/captura de pantalla/i);
  });
});
