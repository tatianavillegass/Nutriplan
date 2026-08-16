import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import type { Reto } from '../../types/reto';

const RETO: Reto = {
  id: 'rt1',
  nombre: 'UPGRADE 1.0',
  fechaInicio: '2026-09-01',
  dias: 30,
  participantes: [],
  recursos: [],
  recetas: [],
  createdAt: '2026-08-01',
};

const vacio = {
  clients: [],
  plans: [],
  recipes: [],
  foods: [],
  mediciones: [],
  registros: [],
};

beforeEach(() => {
  useAppStore.setState({ retos: [RETO], recursos: [] });
});

/**
 * UNA COLUMNA QUE NO EXISTE NO ES «NO TIENES NADA»
 *
 * Mientras la columna no está creada en Supabase, la fila que baja no trae la
 * clave. Dándolo por una lista vacía se borraba lo que había en el navegador:
 * se creaba un reto, se subía —el envío ya sabe guardarse sin esa columna—, y
 * al recargar volvía sin retos y se llevaba por delante el recién creado.
 */
describe('Cuando el servidor todavía no sabe de algo', () => {
  it('no se pierde lo que hay en el navegador', () => {
    useAppStore.getState().hidratar({ ...vacio });
    expect(useAppStore.getState().retos).toHaveLength(1);
  });

  /** Pero si el servidor SÍ lo sabe y dice que no hay nada, manda el servidor. */
  it('y si el servidor dice que no hay ninguno, se hace caso', () => {
    useAppStore.getState().hidratar({ ...vacio, retos: [] });
    expect(useAppStore.getState().retos).toEqual([]);
  });

  it('lo que llega del servidor pisa lo local', () => {
    const otro = { ...RETO, id: 'rt2', nombre: 'UPGRADE 2.0' };
    useAppStore.getState().hidratar({ ...vacio, retos: [otro] });
    expect(useAppStore.getState().retos.map((r) => r.nombre)).toEqual(['UPGRADE 2.0']);
  });
});
