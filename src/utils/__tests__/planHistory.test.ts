// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

const store = () => useAppStore.getState();

/**
 * El historial de planificaciones: sólo una en uso, las demás archivadas.
 * Se prueba contra el store porque la regla vive en las acciones.
 */
describe('Historial de planificaciones', () => {
  let clientId: string;

  beforeEach(() => {
    const c = store().addClient({
      nombre: 'Prueba',
      sexo: 'mujer',
      edad: 35,
      peso: 68,
      altura: 170,
      activityFactorId: 'moderado',
      objetivo: 'mantenimiento',
      goalMultiplier: 1,
      bmrFormula: 'media',
      alergias: [],
      preferencias: [],
    });
    clientId = c.id;
    store().ensurePlan(clientId);
  });

  it('un cliente nuevo arranca con una sola planificación en uso', () => {
    const planes = store().planesDe(clientId);
    expect(planes).toHaveLength(1);
    expect(planes[0].archivado).toBeFalsy();
    expect(store().getPlanByClient(clientId)!.id).toBe(planes[0].id);
  });

  it('la nueva archiva la anterior y queda ella en uso', () => {
    const primera = store().getPlanByClient(clientId)!;
    const segunda = store().nuevaPlanificacion(clientId, 1700);

    const planes = store().planesDe(clientId);
    expect(planes).toHaveLength(2);
    expect(planes.filter((p) => !p.archivado)).toHaveLength(1);
    expect(store().getPlanByClient(clientId)!.id).toBe(segunda.id);
    expect(store().planesDe(clientId).find((p) => p.id === primera.id)!.archivado).toBe(true);
  });

  it('la nueva copia la grilla de la anterior pero con identidad propia', () => {
    const primera = store().getPlanByClient(clientId)!;
    store().setCell(primera.id, primera.dayTypes[0].id, 'desayuno', 'almidones', 3);

    const segunda = store().nuevaPlanificacion(clientId);
    expect(segunda.dayTypes[0].grid.desayuno?.almidones).toBe(3);
    expect(segunda.dayTypes[0].id).not.toBe(primera.dayTypes[0].id);
    expect(segunda.id).not.toBe(primera.id);
  });

  it('editar la nueva no toca la archivada', () => {
    const primera = store().getPlanByClient(clientId)!;
    store().setCell(primera.id, primera.dayTypes[0].id, 'desayuno', 'almidones', 2);
    const segunda = store().nuevaPlanificacion(clientId);
    store().setCell(segunda.id, segunda.dayTypes[0].id, 'desayuno', 'almidones', 5);

    const archivada = store().planesDe(clientId).find((p) => p.id === primera.id)!;
    expect(archivada.dayTypes[0].grid.desayuno?.almidones).toBe(2);
    expect(store().getPlanByClient(clientId)!.dayTypes[0].grid.desayuno?.almidones).toBe(5);
  });

  it('se numeran y se ordenan de la más reciente a la más antigua', () => {
    store().nuevaPlanificacion(clientId);
    store().nuevaPlanificacion(clientId);
    const planes = store().planesDe(clientId);
    expect(planes).toHaveLength(3);
    expect(planes[0].nombre).toBe('Planificación 3');
    expect(planes[2].nombre).toBe('Planificación 1');
  });

  it('reactivar una archivada devuelve el uso a esa y archiva la otra', () => {
    const primera = store().getPlanByClient(clientId)!;
    const segunda = store().nuevaPlanificacion(clientId);

    store().reactivarPlan(primera.id);
    expect(store().getPlanByClient(clientId)!.id).toBe(primera.id);
    expect(store().planesDe(clientId).find((p) => p.id === segunda.id)!.archivado).toBe(true);
  });

  it('borrar la que está en uso deja en uso la más reciente que quede', () => {
    const primera = store().getPlanByClient(clientId)!;
    const segunda = store().nuevaPlanificacion(clientId);

    store().deletePlan(segunda.id);
    const planes = store().planesDe(clientId);
    expect(planes).toHaveLength(1);
    expect(planes[0].id).toBe(primera.id);
    expect(store().getPlanByClient(clientId)!.id).toBe(primera.id);
  });

  it('cada planificación guarda su fecha para el historial', () => {
    const p = store().nuevaPlanificacion(clientId, 1650);
    expect(p.fecha).toBeTruthy();
    expect(p.kcalObjetivo).toBe(1650);
  });
});
