// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  borrarPlantilla,
  guardarPlantilla,
  guardarPlantillaDia,
  guardarPlantillas,
  guardarPlantillasDia,
  leerPlantillas,
  observarPlantillas,
  sinAvisar,
} from '../plantillas';

/**
 * LAS PLANTILLAS TIENEN QUE AVISAR DE QUE HAN CAMBIADO
 *
 * Viven en el navegador por su cuenta, fuera del estado de la app, y la subida
 * automática escucha ese estado. Sin este aviso, guardar una plantilla no subía
 * nada: se veía mientras la pestaña estuviera abierta y al volver a entrar la
 * borraba lo que había en el servidor, que nunca la recibió.
 *
 * Se salvaba de rebote si después se tocaba cualquier otra cosa, y por eso unas
 * veces se guardaban y otras no.
 */
describe('Guardar una plantilla avisa de que hay algo que subir', () => {
  let avisos: number;
  let dejarDeEscuchar: () => void;

  beforeEach(() => {
    localStorage.clear();
    avisos = 0;
    dejarDeEscuchar?.();
    dejarDeEscuchar = observarPlantillas(() => {
      avisos += 1;
    });
  });

  it('una plantilla de comida nueva', () => {
    guardarPlantilla([], 'Mi desayuno', ['f1', 'f2'], 'desayuno');
    expect(avisos).toBe(1);
  });

  it('una plantilla de día nueva', () => {
    guardarPlantillaDia([], 'Low carb', { desayuno: ['f1'] });
    expect(avisos).toBe(1);
  });

  it('y borrarla también, que también hay que subirlo', () => {
    const lista = guardarPlantilla([], 'Mi desayuno', ['f1'], 'desayuno');
    borrarPlantilla(lista, lista[0].id);
    expect(avisos).toBe(2);
  });

  it('lo que se guarda queda escrito, no sólo avisado', () => {
    guardarPlantilla([], 'Mi desayuno', ['f1', 'f2'], 'desayuno');
    expect(leerPlantillas().map((p) => p.nombre)).toContain('Mi desayuno');
  });

  it('quien deja de escuchar deja de enterarse', () => {
    dejarDeEscuchar();
    guardarPlantilla([], 'Mi desayuno', ['f1'], 'desayuno');
    expect(avisos).toBe(0);
  });

  /**
   * Al entrar se escribe en el navegador lo que acaba de bajar del servidor.
   * Eso no es un cambio: subirlo otra vez sólo daría vueltas, y al cerrar
   * sesión llegaría a borrar las plantillas buenas de la nube.
   */
  it('escribir lo que acaba de bajar no cuenta como cambio', () => {
    sinAvisar(() => {
      guardarPlantillas([]);
      guardarPlantillasDia([]);
    });
    expect(avisos).toBe(0);
  });

  it('y después de eso se vuelve a avisar con normalidad', () => {
    sinAvisar(() => guardarPlantillas([]));
    guardarPlantilla([], 'Mi cena', ['f1'], 'cena');
    expect(avisos).toBe(1);
  });

  it('si una escucha revienta no se pierde el guardado', () => {
    const rota = observarPlantillas(() => {
      throw new Error('vaya');
    });
    expect(() => guardarPlantilla([], 'Mi comida', ['f1'], 'comida')).toThrow();
    // Lo importante: el dato ya estaba escrito antes de avisar a nadie.
    expect(leerPlantillas().map((p) => p.nombre)).toContain('Mi comida');
    rota();
  });
});

describe('El aviso llega una vez por guardado, no por alimento', () => {
  it('añadir tres alimentos de golpe es un solo aviso', () => {
    localStorage.clear();
    const espia = vi.fn();
    const parar = observarPlantillas(espia);
    guardarPlantilla([], 'Mi merienda', ['f1', 'f2', 'f3'], 'merienda');
    expect(espia).toHaveBeenCalledTimes(1);
    parar();
  });
});
