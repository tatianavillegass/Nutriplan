import { describe, it, expect } from 'vitest';
import { comoVaElGrupo, enumerar, type SenalDelMuro } from '../muro';

const senal = (
  clienteId: string,
  nombre: string,
  fecha: string,
  cerrado = true,
): SenalDelMuro => ({ clienteId, nombre, fecha, cerrado });

/**
 * LO QUE HACE GRUPO NO ES UN MURO DE PUBLICACIONES
 *
 * Si cinco publican y quince miran, las quince se sienten menos del grupo. Lo
 * que acompaña es ver que las demás también han aparecido hoy, y por eso aquí
 * sólo viaja quién, qué día y si lo cerró.
 */
describe('Cómo va el grupo', () => {
  const senales = [
    senal('c1', 'Marta Ruiz', '2026-09-03'),
    senal('c2', 'Ana López', '2026-09-03'),
    senal('c3', 'Lucía Gil', '2026-09-03', false),
    senal('c1', 'Marta Ruiz', '2026-09-02'),
  ];

  it('dice quién ha cerrado hoy, por su nombre de pila', () => {
    const g = comoVaElGrupo(senales, '2026-09-03', 3);
    expect(g.hoy).toEqual(['Ana', 'Marta']);
  });

  it('quien no ha cerrado no sale', () => {
    expect(comoVaElGrupo(senales, '2026-09-03', 3).hoy).not.toContain('Lucía');
  });

  it('cuenta cuánta gente hay en el muro', () => {
    expect(comoVaElGrupo(senales, '2026-09-03', 3).cuantas).toBe(3);
  });

  /** Se gana o se pierde en equipo: la que va floja queda arropada. */
  it('la meta es de todas: días cerrados contra los posibles', () => {
    const g = comoVaElGrupo(senales, '2026-09-03', 3);
    expect(g.cerrados).toBe(3);
    // Tres personas por tres días.
    expect(g.posibles).toBe(9);
  });

  it('el día 1 no divide por cero', () => {
    expect(comoVaElGrupo([senal('c1', 'Marta', '2026-09-01')], '2026-09-01', 0).posibles).toBe(1);
  });

  it('sin nadie que haya cerrado, se dice y ya', () => {
    const g = comoVaElGrupo([senal('c1', 'Marta', '2026-09-03', false)], '2026-09-03', 3);
    expect(g.hoy).toEqual([]);
  });
});

describe('Los nombres se dicen como en voz alta', () => {
  it('uno solo', () => {
    expect(enumerar(['Marta'])).toBe('Marta');
  });

  it('dos, con «y»', () => {
    expect(enumerar(['Marta', 'Ana'])).toBe('Marta y Ana');
  });

  it('y varios, con comas y una «y» al final', () => {
    expect(enumerar(['Marta', 'Ana', 'Lucía'])).toBe('Marta, Ana y Lucía');
  });

  it('ninguno no rompe nada', () => {
    expect(enumerar([])).toBe('');
  });
});
