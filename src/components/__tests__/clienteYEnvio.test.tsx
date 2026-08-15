// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ClientForm } from '../client/ClientForm';
import { SendPlanPanel } from '../client/SendPlanPanel';
import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';

afterEach(cleanup);

const CLIENTE: Client = {
  id: 'c1',
  nombre: 'Vanessa Muñoz',
  email: 'vanessa@correo.com',
  edad: 30,
  peso: 68,
  altura: 170,
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

const PLAN: Plan = {
  id: 'p1',
  clientId: 'c1',
  nombre: 'Planificación 2',
  fase: 3,
  dayTypes: [],
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
};

const datos = (extra: Partial<Client> = {}) => {
  const { id, createdAt, updatedAt, ...resto } = { ...CLIENTE, ...extra };
  void id;
  void createdAt;
  void updatedAt;
  return resto;
};

describe('Ficha del cliente', () => {
  it('con fecha de nacimiento la edad se calcula sola y no se puede escribir', () => {
    render(
      <ClientForm
        inicial={datos({ fechaNacimiento: '1991-03-15' })}
        titulo="Editar"
        textoBoton="Guardar"
        onGuardar={() => {}}
        onCancelar={() => {}}
      />,
    );
    const edad = screen.getByLabelText(/Edad/) as HTMLInputElement;
    expect(edad.disabled).toBe(true);
    expect(Number(edad.value)).toBeGreaterThan(30);
  });

  it('sin fecha de nacimiento la edad se escribe a mano', () => {
    render(
      <ClientForm
        inicial={datos()}
        titulo="Editar"
        textoBoton="Guardar"
        onGuardar={() => {}}
        onCancelar={() => {}}
      />,
    );
    const edad = screen.getByLabelText(/Edad/) as HTMLInputElement;
    expect(edad.disabled).toBe(false);
    expect(edad.value).toBe('30');
  });

  it('se puede cambiar el nombre y se devuelve al guardar', () => {
    const onGuardar = vi.fn();
    render(
      <ClientForm
        inicial={datos()}
        titulo="Editar"
        textoBoton="Guardar cambios"
        onGuardar={onGuardar}
        onCancelar={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'Vanessa M.' } });
    fireEvent.click(screen.getByText('Guardar cambios'));
    expect(onGuardar.mock.calls[0][0].nombre).toBe('Vanessa M.');
  });

  it('sin nombre no deja guardar', () => {
    const onGuardar = vi.fn();
    render(
      <ClientForm
        inicial={datos({ nombre: '' })}
        titulo="Nuevo"
        textoBoton="Crear"
        onGuardar={onGuardar}
        onCancelar={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Crear'));
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('el acceso puede dejarse abierto', () => {
    const onGuardar = vi.fn();
    render(
      <ClientForm
        inicial={datos({ accesoHasta: '2026-09-30' })}
        titulo="Editar"
        textoBoton="Guardar"
        onGuardar={onGuardar}
        onCancelar={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Dejar abierto'));
    fireEvent.click(screen.getByText('Guardar'));
    expect(onGuardar.mock.calls[0][0].accesoHasta).toBeUndefined();
  });

  it('un acceso caducado ofrece reactivarlo', () => {
    render(
      <ClientForm
        inicial={datos({ accesoHasta: '2020-01-01' })}
        titulo="Editar"
        textoBoton="Guardar"
        onGuardar={() => {}}
        onCancelar={() => {}}
      />,
    );
    expect(screen.getByText(/Reactivar 1 mes/)).toBeTruthy();
  });
});

/**
 * BORRADOR Y ENVÍO
 *
 * Lo que la nutricionista toca es un borrador; la clienta ve lo último
 * enviado. Así se puede cambiar la fase un martes por la tarde sin que a nadie
 * le cambie la app mientras cena.
 *
 * El precio es olvidarse de enviar, y por eso el panel avisa en ámbar.
 */
describe('Enviar el plan al cliente', () => {
  const enviado = (p = PLAN) => ({
    ...p,
    publicado: { fase: p.fase, dayTypes: p.dayTypes, fecha: '2026-08-09T09:30:00' },
    envio: { fecha: '2026-08-09T09:30:00', mensaje: 'Ahí lo tienes' },
  });

  it('sin enviar nada, la clienta no ve el plan', () => {
    render(
      <SendPlanPanel plan={PLAN} client={CLIENTE} onEnviar={() => {}} onRetirar={() => {}} />,
    );
    expect(screen.getByText(/todavía no ve nada/i)).toBeTruthy();
    expect(screen.getByText('Enviar el plan')).toBeTruthy();
  });

  it('al enviar se escribe un mensaje, con uno propuesto', () => {
    const onEnviar = vi.fn();
    render(
      <SendPlanPanel plan={PLAN} client={CLIENTE} onEnviar={onEnviar} onRetirar={() => {}} />,
    );
    fireEvent.click(screen.getByText('Enviar el plan'));
    const caja = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(caja.value).toContain('Vanessa');
    fireEvent.change(caja, { target: { value: 'Sube la proteína del desayuno' } });
    fireEvent.click(screen.getAllByText('Enviar el plan')[0]);
    expect(onEnviar).toHaveBeenCalledWith('Sube la proteína del desayuno');
  });

  it('con todo mandado, dice qué está viendo ella', () => {
    render(
      <SendPlanPanel plan={enviado()} client={CLIENTE} onEnviar={() => {}} onRetirar={() => {}} />,
    );
    expect(screen.getByText(/está viendo lo que le enviaste el 9 de agosto/i)).toBeTruthy();
    expect(screen.getByText(/Ahí lo tienes/)).toBeTruthy();
  });

  /** Lo que hace que un olvido se vea en vez de quedarse callado. */
  it('si se toca algo después, avisa de que está sin enviar', () => {
    const tocado = { ...enviado(), fase: 1 as const };
    render(
      <SendPlanPanel plan={tocado} client={CLIENTE} onEnviar={() => {}} onRetirar={() => {}} />,
    );
    expect(screen.getByText('Tienes cambios sin enviar')).toBeTruthy();
    expect(screen.getByText(/sigue viendo lo del 9 de agosto/i)).toBeTruthy();
    expect(screen.getByText('Enviar los cambios')).toBeTruthy();
  });

  it('y dice qué cambió, para no mandar a ciegas', () => {
    const tocado = { ...enviado(), fase: 1 as const };
    render(
      <SendPlanPanel plan={tocado} client={CLIENTE} onEnviar={() => {}} onRetirar={() => {}} />,
    );
    expect(screen.getByText(/La fase pasa de 3 a 1/)).toBeTruthy();
  });

  it('se puede retirar', () => {
    const onRetirar = vi.fn();
    render(
      <SendPlanPanel plan={enviado()} client={CLIENTE} onEnviar={() => {}} onRetirar={onRetirar} />,
    );
    fireEvent.click(screen.getByText('Retirar'));
    expect(onRetirar).toHaveBeenCalled();
  });

  it('y volver a enviarlo con otro mensaje', () => {
    const onEnviar = vi.fn();
    render(
      <SendPlanPanel plan={enviado()} client={CLIENTE} onEnviar={onEnviar} onRetirar={() => {}} />,
    );
    fireEvent.click(screen.getByText('Volver a enviar'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nuevo mensaje' } });
    // El texto sale dos veces: en el título del formulario y en el botón.
    fireEvent.click(screen.getAllByText('Enviar los cambios')[1]);
    expect(onEnviar).toHaveBeenCalledWith('Nuevo mensaje');
  });
});

