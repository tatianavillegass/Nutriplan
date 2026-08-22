// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * CUANDO EL SERVIDOR TARDA, NO ES QUE NO HAYA WIFI
 *
 * El plan gratuito duerme el servidor y despertarlo cuesta veinte o treinta
 * segundos. En ese rato pasaban dos cosas malas:
 *
 *  · el guardado sale 1,5 segundos después de dejar de teclear, así que
 *    escribir un nombre despacio lanzaba cinco envíos a la vez, todos con los
 *    mismos datos, peleándose por el mismo servidor;
 *  · y en cuanto uno fallaba, arriba ponía «Sin conexión», que con buen wifi
 *    delante es mentira y manda a mirar el router.
 */

const subidas: number[] = [];
let falla = false;
let sueltaLaSubida: (() => void) | null = null;

const canal = {
  on: () => canal,
  subscribe: () => canal,
  unsubscribe: () => {},
};

vi.mock('../supabase', () => ({
  hayNube: true,
  supabase: {},
  puedeSerNutricionista: () => true,
  nube: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    realtime: { setAuth: () => {} },
    channel: () => canal,
  }),
}));

vi.mock('../nube', () => ({
  olvidarLoEnviado: () => {},
  subirRegistros: () => Promise.resolve(),
  bajar: () => Promise.resolve({}),
  bajarRegistros: () => Promise.resolve([]),
  bajarPlanDelCliente: () => Promise.resolve(null),
  subirTodo: () => {
    subidas.push(Date.now());
    if (falla) return Promise.reject(new Error('tarda demasiado'));
    return new Promise<void>((r) => {
      sueltaLaSubida = () => r();
    });
  },
}));

vi.mock('../plantillas', () => ({
  guardarPlantillas: () => {},
  guardarPlantillasDia: () => {},
  leerPlantillas: () => [],
  leerPlantillasDia: () => [],
  observarPlantillas: () => () => {},
  sinAvisar: (f: () => void) => f(),
}));

vi.mock('../repartos', () => ({
  guardarOmitidos: () => {},
  guardarRepartos: () => {},
  leerOmitidos: () => [],
  leerRepartos: () => [],
}));

const {
  arrancarSincronizacion,
  pararSincronizacion,
  empujar,
  observarSincronizacion,
} = await import('../sincronizacion');

const PERFIL = {
  rol: 'nutricionista' as const,
  nutriId: 'n1',
  nombre: 'Tats',
  email: 'tats@ejemplo.com',
};

const avisos: string[] = [];

beforeEach(() => {
  subidas.length = 0;
  avisos.length = 0;
  falla = false;
  sueltaLaSubida = null;
  observarSincronizacion((e) => avisos.push(e));
  arrancarSincronizacion(PERFIL);
});

afterEach(() => {
  pararSincronizacion();
  observarSincronizacion(null);
});

describe('Mientras un guardado está en camino', () => {
  it('no se lanza otro encima', async () => {
    void empujar();
    await Promise.resolve();
    void empujar();
    void empujar();
    await Promise.resolve();

    expect(subidas).toHaveLength(1);
  });

  /** Lo que ella tocó mientras subía no se pierde: sale detrás. */
  it('y lo de mientras tanto sale en cuanto termina el anterior', async () => {
    void empujar();
    await Promise.resolve();
    void empujar();

    sueltaLaSubida?.();
    await new Promise((r) => setTimeout(r, 0));

    expect(subidas).toHaveLength(2);
  });
});

describe('Si el servidor dice que no', () => {
  it('con wifi no se dice «sin conexión», se dice que se reintenta', async () => {
    falla = true;
    await empujar();

    expect(avisos.at(-1)).toBe('reintentando');
  });

  it('y sólo tras varios intentos se pone el aviso serio', async () => {
    falla = true;
    await empujar();
    await empujar();
    await empujar();

    expect(avisos.at(-1)).toBe('error');
  });

  it('pero sin red de verdad sí es sin conexión', async () => {
    falla = true;
    const antes = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await empujar();
    expect(avisos.at(-1)).toBe('sin-red');

    if (antes) Object.defineProperty(navigator, 'onLine', antes);
  });
});
