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

describe('Enviar el plan al cliente', () => {
  it('sin enviar lo dice y ofrece el botón', () => {
    render(
      <SendPlanPanel plan={PLAN} client={CLIENTE} onEnviar={() => {}} onRetirar={() => {}} />,
    );
    expect(screen.getByText('Sin enviar')).toBeTruthy();
    expect(screen.getByText(/todavía no ve este plan/)).toBeTruthy();
  });

  it('al enviar se puede escribir un mensaje, con uno propuesto', () => {
    const onEnviar = vi.fn();
    render(
      <SendPlanPanel plan={PLAN} client={CLIENTE} onEnviar={onEnviar} onRetirar={() => {}} />,
    );
    fireEvent.click(screen.getByText(/Enviar al cliente/));
    const caja = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(caja.value).toContain('Vanessa');
    fireEvent.change(caja, { target: { value: 'Sube la proteína del desayuno' } });
    fireEvent.click(screen.getByText('Enviar'));
    expect(onEnviar).toHaveBeenCalledWith('Sube la proteína del desayuno');
  });

  it('una vez enviado enseña la fecha y el mensaje', () => {
    render(
      <SendPlanPanel
        plan={{ ...PLAN, envio: { fecha: '2026-08-09T09:30:00', mensaje: 'Ahí lo tienes' } }}
        client={CLIENTE}
        onEnviar={() => {}}
        onRetirar={() => {}}
      />,
    );
    expect(screen.getByText(/Enviado el 9 de agosto/)).toBeTruthy();
    expect(screen.getByText(/Ahí lo tienes/)).toBeTruthy();
  });

  it('se puede retirar', () => {
    const onRetirar = vi.fn();
    render(
      <SendPlanPanel
        plan={{ ...PLAN, envio: { fecha: '2026-08-09T09:30:00' } }}
        client={CLIENTE}
        onEnviar={() => {}}
        onRetirar={onRetirar}
      />,
    );
    fireEvent.click(screen.getByText('Retirar'));
    expect(onRetirar).toHaveBeenCalled();
  });

  it('y reenviarse con otro mensaje', () => {
    const onEnviar = vi.fn();
    render(
      <SendPlanPanel
        plan={{ ...PLAN, envio: { fecha: '2026-08-09T09:30:00', mensaje: 'Antiguo' } }}
        client={CLIENTE}
        onEnviar={onEnviar}
        onRetirar={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/Reenviar con otro mensaje/));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nuevo mensaje' } });
    fireEvent.click(screen.getByText('Reenviar'));
    expect(onEnviar).toHaveBeenCalledWith('Nuevo mensaje');
  });
});
