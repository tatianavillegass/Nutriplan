// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { olvidarLocal, fotoActual } from '../sincronizacion';
import { useAppStore } from '../../store/useAppStore';
import { guardarPlantillas } from '../plantillas';
import type { Client } from '../../types/client';

/**
 * Al cerrar sesión no basta con olvidar quién eras: hay que vaciar lo que
 * quedaba en el navegador. Si no, la siguiente persona que entre en ese
 * ordenador se encontraría los clientes de la anterior — y peor, al crearse
 * una cuenta nueva se los subiría como suyos.
 */

const CLIENTE: Client = {
  id: 'c1',
  nombre: 'Sofía',
  edad: 30,
  peso: 65,
  altura: 168,
  sexo: 'mujer',
  activityFactorId: 'moderado',
  objetivo: 'mantenimiento',
  goalMultiplier: 1,
  bmrFormula: 'media',
  alergias: [],
  preferencias: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('Cerrar sesión no deja rastro', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      clients: [CLIENTE],
      plans: [],
      mediciones: [],
      registros: [],
    });
    guardarPlantillas([
      { id: 'pt1', nombre: 'Mi desayuno', foodIds: ['a-huevo'], createdAt: '2026-01-01' },
    ]);
  });

  it('los clientes desaparecen', () => {
    expect(useAppStore.getState().clients).toHaveLength(1);
    olvidarLocal();
    expect(useAppStore.getState().clients).toEqual([]);
  });

  it('y también sus plantillas, que son suyas y no de la app', () => {
    olvidarLocal();
    // Puede haber plantillas de ejemplo, las que trae NutriPlan de fábrica.
    // Lo que no puede quedar es la que se había guardado a mano.
    expect(fotoActual().plantillas.some((p) => p.nombre === 'Mi desayuno')).toBe(false);
  });

  it('pero el catálogo de la app se queda: no es de nadie', () => {
    olvidarLocal();
    expect(fotoActual().foods.length).toBeGreaterThan(0);
    expect(fotoActual().recipes.length).toBeGreaterThan(0);
  });

  it('tampoco quedan clientes guardados en el navegador', () => {
    olvidarLocal();
    expect(JSON.stringify(localStorage)).not.toContain('Sofía');
  });
});
