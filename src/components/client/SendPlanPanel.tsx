import { useState } from "react";
import type { Plan } from "../../types/plan";
import { hayCambiosSinEnviar, queCambio } from "../../types/plan";
import type { Client } from "../../types/client";
import { Button } from "../common/ui";

interface Props {
  plan: Plan;
  client: Client;
  onEnviar: (mensaje: string) => void;
  onRetirar: () => void;
}

const fechaLarga = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/**
 * ENVIAR EL PLAN
 *
 * Lo que la nutricionista toca es un borrador; el cliente ve lo último
 * enviado. Así se puede cambiar la fase un martes por la tarde sin que a nadie
 * le cambie la app mientras cena, y un plan a medio montar no se ve nunca en
 * el móvil de otra persona.
 *
 * El precio de trabajar así es olvidarse de enviar. Por eso, en cuanto hay algo
 * tocado sin mandar, este panel lo dice en ámbar y con la lista de qué cambió.
 */
export function SendPlanPanel({ plan, client, onEnviar, onRetirar }: Props) {
  const enviado = plan.publicado;
  const pendiente = hayCambiosSinEnviar(plan);
  const [redactando, setRedactando] = useState(false);
  const [mensaje, setMensaje] = useState(
    `¡Hola ${client.nombre.split(" ")[0]}! Ya tienes tu plan nuevo. Cualquier duda me escribes.`,
  );

  // ── Todo mandado ────────────────────────────────────
  if (enviado && !pendiente && !redactando) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-900">
            {client.nombre.split(" ")[0]} está viendo lo que le enviaste el{" "}
            {fechaLarga(enviado.fecha)}
          </p>
          {plan.envio?.mensaje && (
            <p className="mt-0.5 truncate text-xs text-emerald-800">
              «{plan.envio.mensaje}»
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => setRedactando(true)}>
          Volver a enviar
        </Button>
        <Button variant="outline" onClick={onRetirar}>
          Retirar
        </Button>
      </div>
    );
  }

  // ── Redactando el mensaje ───────────────────────────
  if (redactando) {
    return (
      <div className="rounded-xl border border-brand-200 bg-white px-4 py-3">
        <p className="text-sm font-medium text-brand-900">
          {enviado ? "Enviar los cambios" : "Enviarle el plan"}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">
          Este mensaje es lo primero que lee al abrir su app.
        </p>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setRedactando(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onEnviar(mensaje.trim());
              setRedactando(false);
            }}
          >
            {enviado ? "Enviar los cambios" : "Enviar el plan"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Hay cosas sin enviar ────────────────────────────
  const cambios = queCambio(plan);

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900">
            {enviado
              ? "Tienes cambios sin enviar"
              : `${client.nombre.split(" ")[0]} todavía no ve nada`}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-amber-800">
            {enviado
              ? `Sigue viendo lo del ${fechaLarga(enviado.fecha)} hasta que se los mandes.`
              : "Móntalo con calma: no le llega nada hasta que lo envíes."}
          </p>
        </div>
        <Button onClick={() => setRedactando(true)}>
          {enviado ? "Enviar los cambios" : "Enviar el plan"}
        </Button>
      </div>

      {enviado && cambios.length > 0 && (
        <ul className="mt-2 border-t border-amber-200 pt-2">
          {cambios.map((c, i) => (
            <li key={i} className="text-xs leading-snug text-amber-800">
              · {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
