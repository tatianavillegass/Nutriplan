import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * CUANDO EL SERVIDOR NO TIENE LO QUE LA APP ESPERA
 *
 * La columna «recursos» se añadió después, y hasta que no se crea a mano en
 * Supabase no existe. Pidiéndola por su nombre, la consulta entera devolvía un
 * error 400: la app se quedaba sin recetas, sin catálogo y sin plantillas, y
 * como la respuesta venía vacía la trataba igual que una cuenta recién
 * estrenada — recetas de ejemplo y plantillas borradas.
 *
 * Al guardar pasaba lo mismo al revés: el envío fallaba entero, así que nada de
 * lo que tocaba la nutricionista llegaba nunca a sus clientas.
 *
 * Estas pruebas fijan las dos reglas que lo evitan:
 *   · se pide la fila entera, y si falla se falla en alto (no se finge vacío)
 *   · al guardar, si la columna nueva no existe se sube todo lo demás igual
 */

const upserts: { tabla: string; datos: Record<string, unknown> }[] = [];
let falloDeRecursos = true;


const CONSULTAS: Record<string, unknown> = {};

function consulta(resultado: unknown) {
  const p: Record<string, unknown> = {};
  const devolver = () => p;
  p.select = devolver;
  p.eq = devolver;
  p.in = devolver;
  p.not = devolver;
  p.maybeSingle = () => Promise.resolve(resultado);
  p.then = (ok: (v: unknown) => unknown, mal?: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(ok, mal);
  return p;
}

vi.mock('../supabase', () => ({
  hayNube: true,
  puedeSerNutricionista: () => true,
  nube: () => ({
    from: (tabla: string) => ({
      ...consulta(CONSULTAS[tabla] ?? { data: [], error: null }),
      upsert: (datos: Record<string, unknown> | Record<string, unknown>[]) => {
        const fila = Array.isArray(datos) ? datos[0] : datos;
        upserts.push({ tabla, datos: fila });
        // Postgres se queja de la columna que no existe.
        // Se queja de cualquiera de las dos columnas nuevas.
        if (
          tabla === 'nutricionistas' &&
          falloDeRecursos &&
          ('recursos' in fila || 'retos' in fila)
        ) {
          return Promise.resolve({
            error: { message: "column nutricionistas.recursos does not exist" },
          });
        }
        return Promise.resolve({ error: null });
      },
      delete: () => consulta({ data: null, error: null }),
    }),
  }),
}));

const { bajar, subirTodo, olvidarLoEnviado } = await import('../nube');

const PERFIL = {
  rol: 'nutricionista' as const,
  nutriId: 'nutri-1',
  nombre: 'Tats',
  email: 'tats@ejemplo.com',
};

const FOTO = {
  clients: [],
  plans: [],
  recipes: [{ id: 'r1' }] as never,
  foods: [{ id: 'f1' }] as never,
  mediciones: [],
  registros: [],
  plantillas: [{ id: 'pt1' }] as never,
  plantillasDia: [],
    plantillasReparto: [],
    alimentosOmitidos: [],
  recursos: [{ id: 'rc1' }] as never,
  retos: [] as never,
};

beforeEach(() => {
  upserts.length = 0;
  /*
   * La subida se salta lo que no ha cambiado, así que entre pruebas hay que
   * olvidar lo enviado: si no, la segunda llamada con la misma foto no manda
   * nada y parece que falla algo.
   */
  olvidarLoEnviado();
  falloDeRecursos = true;

  CONSULTAS.nutricionistas = {
    data: { recetas: [{ id: 'r1' }], alimentos: [{ id: 'f1' }], plantillas: { comidas: [], dias: [] } },
    error: null,
  };
  CONSULTAS.clientes = { data: [], error: null };
  CONSULTAS.registros = { data: [], error: null };
});

describe('Leer lo compartido', () => {
  it('trae lo que haya aunque falte la columna nueva', async () => {
    const foto = await bajar(PERFIL);
    expect(foto.recipes).toHaveLength(1);
    expect(foto.foods).toHaveLength(1);
    /**
     * Sin columna «recursos» no se dice «no tienes ninguno», se dice «el
     * servidor no sabe de esto»: quien lo recibe se queda con lo suyo. Dándolo
     * por vacío se borraba en el navegador lo que se acababa de crear.
     */
    expect(foto.recursos).toBeUndefined();
  });

  /**
   * Lo importante: un error NO puede parecerse a «no tienes nada». Si se
   * confunden, la app borra el banco de recetas de la pantalla y planta las de
   * ejemplo encima.
   */
  it('si la consulta falla, se falla en alto', async () => {
    CONSULTAS.nutricionistas = {
      data: null,
      error: { message: 'column nutricionistas.recursos does not exist' },
    };
    await expect(bajar(PERFIL)).rejects.toThrow(/no se pudo leer/i);
  });

  it('y si fallan los clientes, también', async () => {
    CONSULTAS.clientes = { data: null, error: { message: 'sin permiso' } };
    await expect(bajar(PERFIL)).rejects.toThrow(/clientes/i);
  });

  it('una cuenta recién creada no es un error: no hay fila y ya', async () => {
    CONSULTAS.nutricionistas = { data: null, error: null };
    const foto = await bajar(PERFIL);
    expect(foto.recipes).toEqual([]);
    expect(foto.recursos).toBeUndefined();
  });
});

describe('Guardar lo compartido', () => {
  it('lo intenta con los recursos', async () => {
    await subirTodo(PERFIL, FOTO);
    expect(upserts[0].tabla).toBe('nutricionistas');
    expect(upserts[0].datos.recursos).toBeDefined();
  });

  /**
   * Que falte la guía de raciones no puede impedir que se guarde un plan: la
   * clienta se queda sin comer, no sin material de consulta.
   *
   * Se quitan de la más nueva a la más vieja, no todas de golpe: si el
   * servidor ya tiene «recursos» y le falta «retos», sería absurdo dejar de
   * guardar los recursos por eso.
   */
  it('y si la columna no existe, sube el resto igual', async () => {
    await subirTodo(PERFIL, FOTO);
    const intentos = upserts.filter((u) => u.tabla === 'nutricionistas');
    const ultimo = intentos[intentos.length - 1];
    expect(ultimo.datos.recursos).toBeUndefined();
    expect(ultimo.datos.recetas).toHaveLength(1);
    expect(ultimo.datos.alimentos).toHaveLength(1);
    expect(ultimo.datos.plantillas).toBeDefined();
  });

  it('quita primero la columna más nueva, no todas de golpe', async () => {
    await subirTodo(PERFIL, FOTO);
    const intentos = upserts.filter((u) => u.tabla === 'nutricionistas');
    // 1º con todo, 2º sin «retos» pero con «recursos», 3º sin ninguna.
    expect(intentos[0].datos.retos).toBeDefined();
    expect(intentos[1].datos.retos).toBeUndefined();
    expect(intentos[1].datos.recursos).toBeDefined();
  });

  it('con las columnas puestas, se sube una sola vez', async () => {
    falloDeRecursos = false;
    await subirTodo(PERFIL, FOTO);
    expect(upserts.filter((u) => u.tabla === 'nutricionistas')).toHaveLength(1);
  });
});
