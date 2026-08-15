import { describe, it, expect } from 'vitest';
import { entrenosAbiertos } from '../retos';
import {
  PASOS_DE_PREPARACION,
  preparacionCompleta,
  preparacionDe,
} from '../preparacion';
import { clienteDeSolicitud } from '../altaDeSolicitud';
import type { Reto } from '../../types/reto';
import type { RegistroDia } from '../../types/diary';
import type { Solicitud } from '../../types/solicitud';

const RETO: Reto = {
  id: 'rt1',
  nombre: 'UPGRADE 1.0',
  fechaInicio: '2026-09-01',
  dias: 30,
  participantes: [],
  recursos: [],
  recetas: [],
  entrenos: [
    { id: 'e1', nombre: 'Tren inferior', desdeDia: 1, ejercicios: [] },
    { id: 'e2', nombre: 'Tren superior', desdeDia: 8, ejercicios: [] },
  ],
  createdAt: '2026-08-01',
};

const dia = (fecha: string, preparacion?: RegistroDia['preparacion']): RegistroDia => ({
  id: `r-${fecha}`,
  clientId: 'c1',
  fecha,
  recetaElegida: {},
  cumplidas: [],
  porciones: {},
  sustituciones: {},
  extras: [],
  preparacion,
});

/** Lo abierto sigue abierto: el reto suma, no rota. */
describe('Los entrenos se abren por días', () => {
  it('antes de empezar no hay ninguno', () => {
    expect(entrenosAbiertos(RETO, '2026-08-30')).toHaveLength(0);
  });

  it('el primer día se abre el primero', () => {
    expect(entrenosAbiertos(RETO, '2026-09-01').map((e) => e.id)).toEqual(['e1']);
  });

  it('y el día 8 se suma el siguiente, sin quitar el anterior', () => {
    expect(entrenosAbiertos(RETO, '2026-09-08').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('un reto sin entrenos no se rompe', () => {
    expect(entrenosAbiertos({ ...RETO, entrenos: undefined }, '2026-09-08')).toEqual([]);
  });
});

/**
 * Entre apuntarse y empezar pasan días, y ese hueco es donde se pierde la
 * gente. Cada paso pudo marcarlo un día distinto, así que se juntan.
 */
describe('La preparación de antes de empezar', () => {
  it('se junta leyendo todos sus días', () => {
    const p = preparacionDe([
      dia('2026-08-20', { hechos: ['medidas'], cintura: 78 }),
      dia('2026-08-22', { hechos: ['foto'] }),
    ]);
    expect(p.hechos.sort()).toEqual(['foto', 'medidas']);
    expect(p.cintura).toBe(78);
  });

  it('sin nada marcado está vacía', () => {
    expect(preparacionDe([dia('2026-08-20')]).hechos).toEqual([]);
  });

  it('lo último escrito manda', () => {
    const p = preparacionDe([
      dia('2026-08-20', { hechos: ['medidas'], cintura: 80 }),
      dia('2026-08-25', { hechos: ['medidas'], cintura: 78 }),
    ]);
    expect(p.cintura).toBe(78);
    // Y el paso no se duplica por marcarlo dos veces.
    expect(p.hechos).toEqual(['medidas']);
  });

  it('está completa con los tres pasos', () => {
    const todos = PASOS_DE_PREPARACION.map((p) => p.id);
    expect(preparacionCompleta({ hechos: todos })).toBe(true);
    expect(preparacionCompleta({ hechos: todos.slice(0, 2) })).toBe(false);
  });

  /** La foto es suya: el paso se puede dar por hecho sin subirla. */
  it('la foto no hace falta para dar el paso por hecho', () => {
    const p = preparacionDe([dia('2026-08-20', { hechos: ['foto'] })]);
    expect(p.hechos).toContain('foto');
    expect(p.foto).toBeUndefined();
  });
});

/**
 * Con veinte apuntadas, la lista de clientas dejaba de servir para encontrar a
 * tus clientas. Por dentro siguen siendo clientas: heredan todo.
 */
describe('Quien llega por el enlace del reto', () => {
  const solicitud: Solicitud = {
    id: 's1',
    retoId: 'rt1',
    nombre: 'Marta Ruiz',
    email: 'marta@correo.com',
    fechaNacimiento: '1992-03-15',
    sexo: 'mujer',
    peso: 68,
    altura: 165,
    comidasDia: 4,
    activityFactorId: 'moderado',
    objetivo: 'perder_peso',
    creada: '2026-08-14T10:00:00.000Z',
  } as unknown as Solicitud;

  it('se marca como participante y no como clienta de consulta', () => {
    expect(clienteDeSolicitud(solicitud).soloReto).toBe(true);
  });
});
