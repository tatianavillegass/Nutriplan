import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { buscarPorEmail } from '../utils/auth';
import { estadoCuenta } from '../types/auth';
import { Button, Field, Input } from '../components/common/ui';

type Modo = 'entrar' | 'registro' | 'invitacion' | 'olvido';

/**
 * REGISTRO Y ACCESO
 *
 * Una sola pantalla con tres caras: entrar, crear cuenta de nutricionista y
 * activar la invitación de un cliente. Se decide sola con el email que se
 * escribe, para que nadie tenga que saber en qué pestaña está.
 */
export function AuthPage() {
  const cuentas = useAuthStore((s) => s.cuentas);
  const clients = useAppStore((s) => s.clients);
  const { registrar, entrar, activarInvitacion, recuperarContrasena } = useAuthStore();

  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [nacimiento, setNacimiento] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cuenta = email.includes('@') ? buscarPorEmail(cuentas, email) : undefined;
  const invitacionPendiente = !!cuenta && estadoCuenta(cuenta) === 'pendiente';
  const modoReal: Modo = invitacionPendiente ? 'invitacion' : modo;

  /** La fecha que consta en la ficha del cliente, para comprobar el olvido. */
  const enFicha = cuenta?.clientId
    ? clients.find((c) => c.id === cuenta.clientId)?.fechaNacimiento
    : undefined;

  const enviar = () => {
    setError(null);
    const r =
      modoReal === 'registro'
        ? registrar({ nombre, email, pass })
        : modoReal === 'invitacion'
          ? activarInvitacion(email, pass)
          : modoReal === 'olvido'
            ? recuperarContrasena({ email, fechaNacimiento: nacimiento, nueva: pass, enFicha })
            : entrar(email, pass);
    if (!r.ok) setError(r.error);
  };

  const titulo = {
    entrar: 'Entra en NutriPlan',
    registro: 'Crea tu cuenta',
    invitacion: `Bienvenida${cuenta?.nombre ? `, ${cuenta.nombre.split(' ')[0]}` : ''}`,
    olvido: 'Recupera tu contraseña',
  }[modoReal];

  const subtitulo = {
    entrar: 'Tu email y tu contraseña.',
    registro: 'Para nutricionistas. A tus clientes los invitas tú después.',
    invitacion: 'Tu nutricionista te ha dado de alta. Elige una contraseña para entrar.',
    olvido: 'Confirma tu fecha de nacimiento y elige una contraseña nueva.',
  }[modoReal];

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
          N
        </span>
        <span className="text-base font-semibold tracking-tight text-brand-900">NutriPlan</span>
      </div>

      <div className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-brand-900">{titulo}</h1>
        <p className="mt-0.5 mb-4 text-xs text-slate-500">{subtitulo}</p>

        <div className="space-y-3">
          {modoReal === 'registro' && (
            <Field label="Nombre">
              <Input
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
              />
            </Field>
          )}

          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="nombre@correo.com"
            />
          </Field>

          {modoReal === 'olvido' && (
            <Field label="Fecha de nacimiento">
              <Input
                type="date"
                value={nacimiento}
                onChange={(e) => setNacimiento(e.target.value)}
              />
            </Field>
          )}

          <Field label={modoReal === 'entrar' ? 'Contraseña' : 'Elige una contraseña'}>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
              placeholder={modoReal === 'entrar' ? '' : 'Mínimo 8 caracteres'}
            />
          </Field>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <Button onClick={enviar} className="mt-4 w-full justify-center">
          {modoReal === 'registro'
            ? 'Crear cuenta'
            : modoReal === 'invitacion' || modoReal === 'olvido'
              ? 'Guardar y entrar'
              : 'Entrar'}
        </Button>

        {modoReal === 'entrar' && (
          <p className="mt-2 text-center">
            <button
              onClick={() => {
                setModo('olvido');
                setPass('');
                setError(null);
              }}
              className="text-xs text-slate-500 hover:text-brand-700 hover:underline"
            >
              Se me olvidó la contraseña
            </button>
          </p>
        )}

        {modoReal === 'olvido' && (
          <p className="mt-3 text-center text-xs text-slate-500">
            <button
              onClick={() => {
                setModo('entrar');
                setError(null);
              }}
              className="font-medium text-brand-600 hover:underline"
            >
              ← Volver
            </button>
          </p>
        )}

        {(modoReal === 'entrar' || modoReal === 'registro') && (
          <p className="mt-3 text-center text-xs text-slate-500">
            {modo === 'entrar' ? '¿Todavía no tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button
              onClick={() => {
                setModo(modo === 'entrar' ? 'registro' : 'entrar');
                setError(null);
              }}
              className="font-medium text-brand-600 hover:underline"
            >
              {modo === 'entrar' ? 'Crear una' : 'Entrar'}
            </button>
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
        Los datos se guardan en este navegador. Al conectar el servidor podrás entrar desde
        cualquier dispositivo y las contraseñas quedarán cifradas de verdad.
      </p>
    </div>
  );
}
