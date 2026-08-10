import { describe, it, expect } from 'vitest';
import { aFilas, deFilas, type FilaCliente } from '../nube';
import type { Foto } from '../nube';
import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import type { Medicion } from '../../types/anthropometry';

/**
 * Lo que se comprueba aquí es el reparto: que al subir cada plan acabe en la
 * fila de su cliente y que al bajar vuelva a montarse igual. Si esto falla,
 * alguien vería el plan de otra persona — es lo más grave que puede pasar.
 */

const cliente = (id: string, email?: string): Client => ({
  id,
  nombre: `Cliente ${id}`,
  email,
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
});

const plan = (id: string, clientId: string): Plan => ({
  id,
  clientId,
  nombre: 'Planificación 1',
  fase: 1,
  dayTypes: [],
  fecha: '2026-01-01',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
});

const medicion = (id: string, clientId: string): Medicion => ({
  id,
  clientId,
  fecha: '2026-01-01',
  peso: 65,
  pliegues: {},
  perimetros: {},
  diametros: {},
});

const foto = (): Foto => ({
  clients: [cliente('c1', 'Ana@Correo.com'), cliente('c2')],
  plans: [plan('p1', 'c1'), plan('p2', 'c1'), plan('p3', 'c2')],
  mediciones: [medicion('m1', 'c1'), medicion('m2', 'c2')],
  registros: [],
  recipes: [],
  foods: [],
  plantillas: [],
  plantillasDia: [],
});

describe('Repartir el estado en filas', () => {
  it('cada plan va a la fila de su cliente y no a la de al lado', () => {
    const filas = aFilas('nutri-1', foto());
    const c1 = filas.find((f) => f.id === 'c1')!;
    const c2 = filas.find((f) => f.id === 'c2')!;

    expect(c1.planes.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(c2.planes.map((p) => p.id)).toEqual(['p3']);
    expect(c1.mediciones.map((m) => m.id)).toEqual(['m1']);
    expect(c2.mediciones.map((m) => m.id)).toEqual(['m2']);
  });

  it('todas cuelgan de la misma nutricionista', () => {
    expect(aFilas('nutri-1', foto()).every((f) => f.nutri_id === 'nutri-1')).toBe(true);
  });

  it('el email se guarda en minúsculas: es con el que entrará', () => {
    expect(aFilas('nutri-1', foto())[0].email).toBe('ana@correo.com');
  });

  it('sin email la fila queda a nulo, no con una cadena vacía', () => {
    // Importa: el índice que impide repetir emails ignora los nulos, y una
    // cadena vacía haría que dos clientes sin email chocaran entre sí.
    expect(aFilas('nutri-1', foto())[1].email).toBeNull();
  });

  it('un espacio de más no cuenta como email', () => {
    const f = foto();
    f.clients[1] = { ...f.clients[1], email: '   ' };
    expect(aFilas('nutri-1', f)[1].email).toBeNull();
  });
});

describe('Volver a montarlo al bajar', () => {
  it('lo que sube y baja es lo mismo que había', () => {
    const antes = foto();
    const despues = deFilas(aFilas('nutri-1', antes));

    expect(despues.clients.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(despues.plans.map((p) => p.id).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(despues.mediciones.map((m) => m.id).sort()).toEqual(['m1', 'm2']);
  });

  it('el cliente sólo baja lo suyo', () => {
    // Es lo que devuelve el servidor cuando entra ella: una sola fila.
    const suya = aFilas('nutri-1', foto()).filter((f) => f.id === 'c2');
    const montado = deFilas(suya);

    expect(montado.clients).toHaveLength(1);
    expect(montado.plans.map((p) => p.id)).toEqual(['p3']);
    expect(montado.plans.some((p) => p.clientId === 'c1')).toBe(false);
  });

  it('manda el email de la fila, que es el que da acceso', () => {
    const filas: FilaCliente[] = [
      {
        id: 'c1',
        nutri_id: 'nutri-1',
        email: 'nuevo@correo.com',
        ficha: cliente('c1', 'viejo@correo.com'),
        planes: [],
        mediciones: [],
      },
    ];
    expect(deFilas(filas).clients[0].email).toBe('nuevo@correo.com');
  });

  it('una fila sin planes ni mediciones no rompe nada', () => {
    const filas = [
      {
        id: 'c9',
        nutri_id: 'nutri-1',
        email: null,
        ficha: cliente('c9'),
      } as unknown as FilaCliente,
    ];
    const montado = deFilas(filas);
    expect(montado.plans).toEqual([]);
    expect(montado.mediciones).toEqual([]);
  });
});
