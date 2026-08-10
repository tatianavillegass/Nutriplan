import { useState } from 'react';
import type { Client } from '../../types/client';
import { estadoCuenta } from '../../types/auth';
import { useAuthStore } from '../../store/useAuthStore';
import { cuentaDeCliente } from '../../utils/auth';
import { Button, Input } from '../common/ui';

interface Props {
  client: Client;
  onEmail: (email: string) => void;
}

/**
 * ACCESO DEL CLIENTE
 *
 * La nutricionista lo da de alta con su email y la cuenta queda pendiente:
 * el cliente elige su contraseña la primera vez que entra. Así nadie manda
 * contraseñas por WhatsApp.
 */
export function ClientAccountPanel({ client, onEmail }: Props) {
  const cuentas = useAuthStore((s) => s.cuentas);
  const invitar = useAuthStore((s) => s.invitarCliente);
  const reiniciar = useAuthStore((s) => s.reiniciarContrasena);

  const cuenta = cuentaDeCliente(cuentas, client.id);
  const [email, setEmail] = useState(client.email ?? '');
  const [error, setError] = useState<string | null>(null);

  if (cuenta) {
    const pendiente = estadoCuenta(cuenta) === 'pendiente';
    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
          pendiente ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${pendiente ? 'bg-amber-500' : 'bg-emerald-500'}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${pendiente ? 'text-amber-900' : 'text-emerald-900'}`}>
            {pendiente ? 'Invitación pendiente' : 'Cuenta activa'}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {cuenta.email}
            {pendiente
              ? ' — entrará con este email y elegirá su contraseña la primera vez.'
              : cuenta.ultimoAcceso
                ? ` — última entrada el ${new Date(cuenta.ultimoAcceso).toLocaleDateString('es-ES')}.`
                : ''}
          </p>
        </div>
        {!pendiente && (
          <Button
            variant="outline"
            onClick={() => {
              if (
                !window.confirm(
                  `¿Restablecer la contraseña de ${cuenta.nombre}? Volverá a elegir una la próxima vez que entre con ${cuenta.email}.`,
                )
              )
                return;
              reiniciar(cuenta.id);
            }}
          >
            Restablecer contraseña
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
      <p className="text-sm font-medium text-brand-900">Dar acceso a {client.nombre.split(' ')[0]}</p>
      <p className="mt-0.5 mb-2 text-xs text-slate-600">
        Con su email podrá entrar a ver su plan. Elegirá su contraseña la primera vez.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="nombre@correo.com"
          className="min-w-[220px] flex-1"
        />
        <Button
          disabled={!email.trim()}
          onClick={() => {
            const r = invitar({ nombre: client.nombre, email, clientId: client.id });
            if (!r.ok) {
              setError(r.error);
              return;
            }
            onEmail(email.trim());
          }}
        >
          Invitar
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
