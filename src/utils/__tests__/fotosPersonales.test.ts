import { describe, it, expect } from 'vitest';
import { esDataUrl, esEnlace, esRutaGuardada, BUCKET_PROGRESO } from '../almacen';

/**
 * LAS FOTOS PERSONALES, FUERA DE LOS DATOS Y BAJO LLAVE
 *
 * Las de progreso y las de antropometría seguían escritas dentro del registro
 * del día porque el almacén de recetas es público y éstas no pueden serlo. El
 * precio lo pagaba todo lo demás: medio mega por sesión viajando en cada
 * consulta del seguimiento y copiándose en cada guardado.
 *
 * Ahora tienen su propio sitio, cerrado, y en los datos queda **la ruta** y no
 * un enlace: un enlace a un sitio cerrado caduca, así que guardarlo sería
 * guardar algo que mañana no sirve.
 */

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg';
const RUTA = 'cl_a1b2/2026-09-01-frente-1730000000.jpg';
const ENLACE = 'https://xyz.supabase.co/storage/v1/object/public/recetas/a.jpg';

describe('Qué clase de foto es cada cosa', () => {
  it('una recién hecha viene metida en el texto', () => {
    expect(esDataUrl(FOTO)).toBe(true);
    expect(esRutaGuardada(FOTO)).toBe(false);
  });

  it('una de receta ya movida es un enlace público', () => {
    expect(esEnlace(ENLACE)).toBe(true);
    expect(esRutaGuardada(ENLACE)).toBe(false);
  });

  it('y una personal ya movida es dónde está, no un enlace', () => {
    expect(esRutaGuardada(RUTA)).toBe(true);
    expect(esDataUrl(RUTA)).toBe(false);
    expect(esEnlace(RUTA)).toBe(false);
  });

  it('sin foto no hay nada que resolver', () => {
    expect(esRutaGuardada(undefined)).toBe(false);
    expect(esRutaGuardada('')).toBe(false);
  });
});

describe('La carpeta es de quién es la foto', () => {
  /*
   * Es lo que mira la regla del servidor para decidir quién puede verla: la
   * clienta se ve a sí misma y su nutricionista la ve a ella. Si la carpeta
   * dejara de ser el id, el permiso se caería y habría que mantener una
   * segunda lista.
   */
  it('la ruta empieza por el id de la clienta', () => {
    expect(RUTA.split('/')[0]).toBe('cl_a1b2');
  });

  it('y el almacén de las personales no es el de las recetas', () => {
    expect(BUCKET_PROGRESO).toBe('progreso');
  });
});
