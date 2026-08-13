import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { registroVacio } from '../../types/diary';
import type { RegistroDia } from '../../types/diary';

/**
 * LO QUE LLEGA DE LA CLIENTA MIENTRAS LA APP ESTÁ ABIERTA
 *
 * La nutricionista bajaba los registros una sola vez, al entrar. Si la clienta
 * marcaba sus comidas después, no aparecían: la ficha podía estar abierta toda
 * la mañana sin enterarse. Y peor, al guardar cualquier cosa la nutricionista
 * subía su copia vieja y borraba lo que la clienta acababa de marcar.
 *
 * Ahora el registro que llega del servidor entra en el estado sustituyendo al
 * de ese mismo día, sin tocar nada más.
 */

const registro = (fecha: string, cumplidas: string[]): RegistroDia => ({
  ...registroVacio('cl_tatiana', fecha, `rg_${fecha}`),
  cumplidas,
});

describe('Un registro que llega del servidor', () => {
  beforeEach(() => {
    useAppStore.getState().hidratar({
      clients: [],
      plans: [],
      recipes: [],
      foods: [],
      mediciones: [],
      registros: [],
    });
  });

  it('se añade si es de un día que no teníamos', () => {
    useAppStore.getState().aplicarRegistroRemoto(registro('2026-08-13', ['desayuno']));
    const guardados = useAppStore.getState().registros;
    expect(guardados).toHaveLength(1);
    expect(guardados[0].cumplidas).toEqual(['desayuno']);
  });

  it('sustituye al del mismo día en vez de duplicarlo', () => {
    const store = useAppStore.getState();
    store.aplicarRegistroRemoto(registro('2026-08-13', ['desayuno']));
    store.aplicarRegistroRemoto(registro('2026-08-13', ['desayuno', 'comida', 'cena']));

    const guardados = useAppStore.getState().registros;
    expect(guardados).toHaveLength(1);
    expect(guardados[0].cumplidas).toEqual(['desayuno', 'comida', 'cena']);
  });

  it('no toca los de otros días', () => {
    const store = useAppStore.getState();
    store.aplicarRegistroRemoto(registro('2026-08-12', ['cena']));
    store.aplicarRegistroRemoto(registro('2026-08-13', ['desayuno']));

    const guardados = useAppStore.getState().registros;
    expect(guardados).toHaveLength(2);
    expect(guardados.find((r) => r.fecha === '2026-08-12')?.cumplidas).toEqual(['cena']);
  });

  it('no toca los de otras clientas', () => {
    const store = useAppStore.getState();
    const deOtra: RegistroDia = {
      ...registroVacio('cl_otra', '2026-08-13', 'rg_otra'),
      cumplidas: ['comida'],
    };
    store.aplicarRegistroRemoto(deOtra);
    store.aplicarRegistroRemoto(registro('2026-08-13', ['desayuno']));

    const guardados = useAppStore.getState().registros;
    expect(guardados).toHaveLength(2);
    expect(guardados.find((r) => r.clientId === 'cl_otra')?.cumplidas).toEqual(['comida']);
  });
});
