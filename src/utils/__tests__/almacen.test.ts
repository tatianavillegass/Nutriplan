import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * LAS FOTOS, FUERA DE LOS DATOS
 *
 * La foto de cada receta viajaba dentro del texto de los datos, así que la app
 * de una clienta se descargaba el banco entero —con todas las fotos— antes de
 * enseñarle su plan. Ahora se sube como archivo y queda un enlace.
 *
 * Lo que no puede pasar: que una foto se pierda por intentar moverla. Si el
 * almacén todavía no existe, se queda donde estaba.
 */

let falla = false;
const subidas: { ruta: string; tipo: string }[] = [];

vi.mock('../supabase', () => ({
  hayNube: true,
  supabase: {
    storage: {
      from: () => ({
        upload: (ruta: string, blob: Blob) => {
          if (falla) return Promise.resolve({ error: { message: 'no existe el bucket' } });
          subidas.push({ ruta, tipo: blob.type });
          return Promise.resolve({ error: null });
        },
        getPublicUrl: (ruta: string) => ({
          data: { publicUrl: `https://ejemplo.test/${ruta}` },
        }),
      }),
    },
  },
}));

const { esDataUrl, esEnlace, guardarFoto } = await import('../almacen');

/** Un píxel en JPEG, que es lo que devuelve el navegador al reducir una foto. */
const FOTO =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

beforeEach(() => {
  falla = false;
  subidas.length = 0;
});

describe('Reconocer qué es cada cosa', () => {
  it('distingue una foto metida en el texto de un enlace', () => {
    expect(esDataUrl(FOTO)).toBe(true);
    expect(esDataUrl('https://ejemplo.test/x.jpg')).toBe(false);
    expect(esEnlace('https://ejemplo.test/x.jpg')).toBe(true);
    expect(esEnlace(FOTO)).toBe(false);
  });
});

describe('Guardar una foto', () => {
  it('la sube y devuelve su enlace', async () => {
    const enlace = await guardarFoto(FOTO, 'n1', 'r1');

    expect(enlace).toMatch(/^https:\/\/ejemplo\.test\/n1\/r1-\d+\.jpg$/);
    expect(subidas[0].tipo).toBe('image/jpeg');
  });

  /**
   * Si al cambiar la foto de una receta se reutilizara el nombre, el móvil de
   * la clienta seguiría enseñando la vieja durante días.
   */
  it('con un nombre distinto cada vez, para que no se quede la vieja', async () => {
    const uno = await guardarFoto(FOTO, 'n1', 'r1');
    await new Promise((r) => setTimeout(r, 2));
    const dos = await guardarFoto(FOTO, 'n1', 'r1');

    expect(uno).not.toBe(dos);
  });

  /**
   * Mientras no se haya creado el almacén en Supabase, todo tiene que seguir
   * funcionando como hasta ahora: lento, pero sin perder nada.
   */
  it('y si el almacén no está, no dice que sí', async () => {
    falla = true;
    expect(await guardarFoto(FOTO, 'n1', 'r1')).toBeUndefined();
  });
});
