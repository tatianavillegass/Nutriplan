import { describe, it, expect } from 'vitest';
import {
  VERSION_COPIA,
  armarCopia,
  nombreDelArchivo,
  pesoLegible,
  queLleva,
  type CopiaDeSeguridad,
} from '../copiaDeSeguridad';

/**
 * LA COPIA DE SEGURIDAD
 *
 * El plan gratuito del servidor no hace copias. Si algo se corrompe o se borra,
 * no hay de dónde tirar: se van las fichas, los planes y el registro de todas
 * las clientas.
 */

const vacios: CopiaDeSeguridad['datos'] = {
  clients: [],
  plans: [],
  recipes: [],
  foods: [],
  mediciones: [],
  registros: [],
  recursos: [],
  retos: [],
  gastos: [],
};

const conDatos = (): CopiaDeSeguridad['datos'] => ({
  ...vacios,
  clients: [{ id: 'c1' }, { id: 'c2' }] as never,
  plans: [{ id: 'p1' }] as never,
  recipes: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] as never,
  mediciones: [{ id: 'm1' }] as never,
  registros: [{ id: 'd1' }, { id: 'd2' }] as never,
});

describe('El archivo se identifica solo', () => {
  it('lleva de qué app es, su versión y cuándo se bajó', () => {
    const c = armarCopia(vacios, 'hola@tatiana-villegas.com', new Date('2026-09-12T10:00:00Z'));
    expect(c.app).toBe('nutriplan');
    expect(c.version).toBe(VERSION_COPIA);
    expect(c.fecha.slice(0, 10)).toBe('2026-09-12');
    expect(c.correo).toBe('hola@tatiana-villegas.com');
  });

  /** Sin correo no se inventa uno vacío que luego confunda. */
  it('y sin correo, no lo pone', () => {
    expect(armarCopia(vacios)).not.toHaveProperty('correo');
  });

  it('el nombre ordena solo por fecha', () => {
    expect(nombreDelArchivo(new Date('2026-09-12T10:00:00Z'))).toBe(
      'nutriplan-copia-2026-09-12.json',
    );
  });
});

/**
 * Una copia vacía pesa dos kilobytes y parece que ha funcionado igual. Con los
 * números delante se ve de un vistazo si de verdad está todo.
 */
describe('Se dice qué lleva antes de descargar', () => {
  it('cuenta lo que hay', () => {
    expect(queLleva(conDatos())).toEqual({
      clientas: 2,
      planes: 1,
      recetas: 3,
      mediciones: 1,
      registros: 2,
    });
  });

  it('y una copia vacía sale en ceros, no en blanco', () => {
    expect(queLleva(vacios)).toEqual({
      clientas: 0,
      planes: 0,
      recetas: 0,
      mediciones: 0,
      registros: 0,
    });
  });
});

describe('Lo que se descarga se puede volver a leer', () => {
  it('pasa por JSON sin perder nada', () => {
    const c = armarCopia(conDatos(), 'hola@x.com');
    const leida = JSON.parse(JSON.stringify(c)) as CopiaDeSeguridad;
    expect(leida.datos.clients.length).toBe(2);
    expect(leida.version).toBe(VERSION_COPIA);
  });

  /** Las plantillas viven en el navegador: no están en ningún otro sitio. */
  it('y se guardan las plantillas, que no están en el servidor', () => {
    const c = armarCopia({ ...vacios, plantillas: { despensa: [{ id: 'pl1' }] } });
    expect(c.datos.plantillas).toEqual({ despensa: [{ id: 'pl1' }] });
  });
});

describe('El tamaño se dice en algo legible', () => {
  it('bytes, kilobytes y megas', () => {
    expect(pesoLegible(512)).toBe('512 B');
    expect(pesoLegible(2048)).toBe('2 KB');
    expect(pesoLegible(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
