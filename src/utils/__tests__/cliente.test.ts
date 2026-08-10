import { describe, it, expect } from 'vitest';
import { edadDe, edadEn, estadoAcceso } from '../../types/client';

const HOY = new Date('2026-08-09T12:00:00');

describe('La edad sale de la fecha de nacimiento', () => {
  it('cuenta años cumplidos, no diferencia de años', () => {
    expect(edadEn('1991-08-10', HOY)).toBe(34); // mañana cumple
    expect(edadEn('1991-08-09', HOY)).toBe(35); // hoy cumple
    expect(edadEn('1991-08-08', HOY)).toBe(35);
  });

  it('el cumpleaños de un mes posterior aún no cuenta', () => {
    expect(edadEn('1991-12-01', HOY)).toBe(34);
  });

  it('sube sola al año siguiente sin tocar nada', () => {
    expect(edadEn('1991-03-15', new Date('2026-08-09'))).toBe(35);
    expect(edadEn('1991-03-15', new Date('2027-08-09'))).toBe(36);
  });

  it('una fecha imposible no devuelve una edad absurda', () => {
    expect(edadEn('no-es-fecha', HOY)).toBeUndefined();
    expect(edadEn('2030-01-01', HOY)).toBeUndefined();
  });

  it('sin fecha de nacimiento se usa la edad escrita a mano', () => {
    expect(edadDe({ edad: 42 }, HOY)).toBe(42);
    expect(edadDe({ edad: 42, fechaNacimiento: '1991-03-15' }, HOY)).toBe(35);
  });

  it('con una fecha rota se cae con elegancia a la edad escrita', () => {
    expect(edadDe({ edad: 42, fechaNacimiento: 'ayer' }, HOY)).toBe(42);
  });
});

describe('Periodo de acceso', () => {
  it('sin fecha de fin el acceso es abierto', () => {
    expect(estadoAcceso({}, HOY).estado).toBe('activo');
  });

  it('con margen amplio sigue activo', () => {
    expect(estadoAcceso({ accesoHasta: '2026-12-31' }, HOY).estado).toBe('activo');
  });

  it('en la última semana avisa de que termina pronto', () => {
    const a = estadoAcceso({ accesoHasta: '2026-08-14' }, HOY);
    expect(a.estado).toBe('termina_pronto');
    expect(a.diasRestantes).toBe(5);
  });

  it('el mismo día de fin todavía tiene acceso', () => {
    expect(estadoAcceso({ accesoHasta: '2026-08-09' }, HOY).estado).toBe('termina_pronto');
  });

  it('pasada la fecha queda sin acceso', () => {
    const a = estadoAcceso({ accesoHasta: '2026-07-31' }, HOY);
    expect(a.estado).toBe('caducado');
    expect(a.diasRestantes).toBeLessThan(0);
  });

  it('alargar la fecha lo reactiva', () => {
    expect(estadoAcceso({ accesoHasta: '2026-07-31' }, HOY).estado).toBe('caducado');
    expect(estadoAcceso({ accesoHasta: '2026-09-30' }, HOY).estado).toBe('activo');
  });
});
