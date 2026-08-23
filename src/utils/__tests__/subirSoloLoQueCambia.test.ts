import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { olvidarLoEnviado, subirTodo } from '../nube';
import type { Foto, Perfil } from '../nube';
import type { Client } from '../../types/client';

/**
 * NO REENVIAR LO QUE NO HA CAMBIADO
 *
 * La app guarda sola cada vez que se deja de teclear, y antes cada guardado
 * mandaba todo: el banco de recetas con las fotos dentro, el catálogo, las
 * plantillas y la ficha de cada clienta. Cambiar un gramo reenviaba varios
 * megas; dar de alta a alguien reenviaba también las fichas de las demás. De
 * ahí que la app fuera lenta al inscribir gente.
 */

const PERFIL: Perfil = {
  rol: 'nutricionista',
  nutriId: 'n1',
  nombre: 'Tats',
  email: 'tats@ejemplo.com',
};

const cliente = (id: string, nombre: string): Client =>
  ({ id, nombre, email: `${id}@ejemplo.com` }) as unknown as Client;

const foto = (clients: Client[], recetas: unknown[] = []): Foto =>
  ({
    clients,
    plans: [],
    recipes: recetas,
    foods: [],
    mediciones: [],
    registros: [],
    recursos: [],
    retos: [],
    gastos: [],
    plantillas: [],
    plantillasDia: [],
    plantillasReparto: [],
    alimentosOmitidos: [],
  }) as unknown as Foto;

/** Un Supabase de mentira que apunta a qué tablas se ha escrito. */
const enviados: { tabla: string; filas: unknown[] }[] = [];

function tabla(nombre: string) {
  const respuesta = { data: null, error: null };
  const api = {
    upsert: (filas: unknown) => {
      enviados.push({ tabla: nombre, filas: Array.isArray(filas) ? filas : [filas] });
      return Promise.resolve(respuesta);
    },
    delete: () => ({
      eq: () => ({
        not: () => Promise.resolve(respuesta),
        then: (f: (r: typeof respuesta) => unknown) => Promise.resolve(respuesta).then(f),
      }),
    }),
  };
  return api;
}

vi.mock('../supabase', () => ({
  hayNube: true,
  supabase: {},
  nube: () => ({ from: (t: string) => tabla(t) }),
  puedeSerNutricionista: () => true,
}));

beforeEach(() => {
  enviados.length = 0;
  olvidarLoEnviado();
});
afterEach(() => olvidarLoEnviado());

const clientesEnviados = () =>
  enviados.filter((e) => e.tabla === 'clientes').flatMap((e) => e.filas as { id: string }[]);

describe('Al guardar', () => {
  it('la primera vez va todo', async () => {
    await subirTodo(PERFIL, foto([cliente('c1', 'Ana'), cliente('c2', 'Bea')]));

    expect(enviados.some((e) => e.tabla === 'nutricionistas')).toBe(true);
    expect(clientesEnviados()).toHaveLength(2);
  });

  it('y si no se ha tocado nada, no se manda nada', async () => {
    const misma = foto([cliente('c1', 'Ana')]);
    await subirTodo(PERFIL, misma);
    enviados.length = 0;

    await subirTodo(PERFIL, misma);
    expect(enviados.filter((e) => e.tabla !== 'retos_publicos')).toHaveLength(0);
  });

  /**
   * Es el caso que la hacía lenta: dar de alta a alguien reenviaba el banco
   * entero con sus fotos y las fichas de todas las demás.
   */
  it('al añadir una clienta sólo viaja ella, no el banco ni las demás', async () => {
    await subirTodo(PERFIL, foto([cliente('c1', 'Ana')], [{ id: 'r1', foto_url: 'x' }]));
    enviados.length = 0;

    await subirTodo(
      PERFIL,
      foto([cliente('c1', 'Ana'), cliente('c2', 'Bea')], [{ id: 'r1', foto_url: 'x' }]),
    );

    expect(enviados.some((e) => e.tabla === 'nutricionistas')).toBe(false);
    expect(clientesEnviados().map((c) => c.id)).toEqual(['c2']);
  });

  it('y al tocar el banco viaja el banco, no las fichas', async () => {
    await subirTodo(PERFIL, foto([cliente('c1', 'Ana')], [{ id: 'r1' }]));
    enviados.length = 0;

    await subirTodo(PERFIL, foto([cliente('c1', 'Ana')], [{ id: 'r1', nombre: 'Cambiada' }]));

    expect(enviados.some((e) => e.tabla === 'nutricionistas')).toBe(true);
    expect(clientesEnviados()).toHaveLength(0);
  });
});
