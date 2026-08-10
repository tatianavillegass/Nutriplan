import { useState } from 'react';
import type { Plan } from '../../types/plan';
import type { Client } from '../../types/client';
import { Button } from '../common/ui';

interface Props {
  plan: Plan;
  client: Client;
  onEnviar: (mensaje: string) => void;
  onRetirar: () => void;
}

const fechaLarga = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};

/**
 * ENVIAR EL PLAN
 *
 * Hasta que se envía, el cliente no ve nada: se puede montar el plan a medias
 * sin que le llegue un plan incompleto. Al enviarlo se le puede escribir un
 * mensaje, que es lo primero que lee al abrir su vista.
 */
export function SendPlanPanel({ plan, client, onEnviar, onRetirar }: Props) {
  const enviado = plan.envio;
  const [redactando, setRedactando] = useState(false);
  const [mensaje, setMensaje] = useState(
    `¡Hola ${client.nombre.split(' ')[0]}! Ya tienes tu plan nuevo. Cualquier duda me escribes.`,
  );

  if (enviado && !redactando) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-900">
            Enviado el {fechaLarga(enviado.fecha)}
            {enviado.visto && <span className="ml-2 text-[11px] font-normal">· visto</span>}
          </p>
          {enviado.mensaje && (
            <p className="mt-0.5 truncate text-xs text-emerald-800 italic">«{enviado.mensaje}»</p>
          )}
        </div>
        <Button variant="outline" onClick={() => setRedactando(true)}>
          Reenviar con otro mensaje
        </Button>
        <Button variant="ghost" onClick={onRetirar}>
          Retirar
        </Button>
      </div>
    );
  }

  if (!redactando) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-brand-900">Sin enviar</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {client.nombre.split(' ')[0]} todavía no ve este plan. Cuando esté listo, envíaselo.
          </p>
        </div>
        <Button onClick={() => setRedactando(true)}>Enviar al cliente →</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
      <p className="text-sm font-semibold text-brand-900">
        Enviar {plan.nombre} a {client.nombre.split(' ')[0]}
      </p>
      <p className="mt-0.5 mb-2 text-[11px] text-slate-600">
        Este mensaje es lo primero que verá al abrir su plan.
      </p>
      <textarea
        autoFocus
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        rows={3}
        placeholder="Escríbele algo: qué cambia, qué quieres que pruebe esta semana…"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setRedactando(false)}>
          Cancelar
        </Button>
        <Button onClick={() => { onEnviar(mensaje.trim()); setRedactando(false); }}>
          {enviado ? 'Reenviar' : 'Enviar'}
        </Button>
      </div>
    </div>
  );
}
