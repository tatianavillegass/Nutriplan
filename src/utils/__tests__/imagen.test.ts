import { describe, it, expect } from 'vitest';
import {
  dimensionesDestino,
  pesoDataUrl,
  pesoLegible,
  validarArchivo,
  LADO_MAX,
  PESO_MAX_MB,
} from '../imagen';

describe('Reducción de la foto de receta', () => {
  it('una foto de móvil apaisada baja a 900 px de lado mayor', () => {
    expect(dimensionesDestino(4032, 3024)).toEqual({ ancho: 900, alto: 675 });
  });

  it('una foto vertical se reduce por el alto', () => {
    expect(dimensionesDestino(3024, 4032)).toEqual({ ancho: 675, alto: 900 });
  });

  it('mantiene la proporción con cuatro decimales de margen', () => {
    const { ancho, alto } = dimensionesDestino(1600, 900);
    expect(ancho / alto).toBeCloseTo(1600 / 900, 2);
  });

  it('nunca agranda una foto pequeña', () => {
    expect(dimensionesDestino(400, 300)).toEqual({ ancho: 400, alto: 300 });
    expect(dimensionesDestino(LADO_MAX, 100)).toEqual({ ancho: LADO_MAX, alto: 100 });
  });

  it('una imagen cuadrada gigante sale cuadrada', () => {
    expect(dimensionesDestino(5000, 5000)).toEqual({ ancho: 900, alto: 900 });
  });
});

describe('Peso de la imagen guardada', () => {
  it('calcula los bytes reales desde el base64', () => {
    // "hola" en base64 son 4 caracteres → 3 bytes
    expect(pesoDataUrl('data:image/jpeg;base64,aG9sYQ==')).toBe(4);
  });

  it('lo enseña en unidades legibles', () => {
    expect(pesoLegible(800)).toBe('800 B');
    expect(pesoLegible(2048)).toBe('2 KB');
    expect(pesoLegible(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('Validación del archivo antes de subirlo', () => {
  const archivo = (nombre: string, tipo: string, mb: number) =>
    new File([new Uint8Array(Math.round(mb * 1024 * 1024))], nombre, { type: tipo });

  it('acepta un JPG normal', () => {
    expect(validarArchivo(archivo('cena.jpg', 'image/jpeg', 3))).toBeUndefined();
  });

  it('rechaza un PDF con un mensaje claro', () => {
    expect(validarArchivo(archivo('plan.pdf', 'application/pdf', 1))).toMatch(/no es una imagen/i);
  });

  it('rechaza lo que pase del máximo', () => {
    const msg = validarArchivo(archivo('enorme.jpg', 'image/jpeg', PESO_MAX_MB + 2));
    expect(msg).toMatch(new RegExp(`${PESO_MAX_MB} MB`));
  });

  it('si el navegador no da el tipo, se fía de la extensión', () => {
    expect(validarArchivo(archivo('foto.HEIC', '', 2))).toBeUndefined();
    expect(validarArchivo(archivo('notas.txt', '', 1))).toMatch(/no es una imagen/i);
  });
});
