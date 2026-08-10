import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { buscarPorEmail } from '../utils/auth';
import { estadoCuenta } from '../types/auth';
import { hayNube } from '../utils/supabase';
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
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cuenta = email.includes('@') ? buscarPorEmail(cuentas, email) : undefined;
  const invitacionPendiente = !!cuenta && estadoCuenta(cuenta) === 'pendiente';
  const modoReal: Modo = invitacionPendiente ? 'invitacion' : modo;

  /** La fecha que consta en la ficha del cliente, para comprobar el olvido. */
  const enFicha = cuenta?.clientId
    ? clients.find((c) => c.id === cuenta.clientId)?.fechaNacimiento
    : undefined;

  /** En la nube la fecha de nacimiento no pinta nada: se manda un email. */
  const pideNacimiento = !hayNube && modoReal === 'olvido' && cuenta?.rol === 'cliente';

  /**
   * NADIE ABRE CONSULTA POR SU CUENTA
   *
   * "Crear cuenta" no es una invitación abierta: es el sitio donde el cliente
   * al que ya han dado de alta elige su contraseña la primera vez. La única
   * excepción es el estreno de la app en un navegador vacío, donde hace falta
   * para que la nutricionista se dé de alta a sí misma.
   */
  const primeraVez = !hayNube && cuentas.length === 0;
  const invitacion = primeraVez
    ? '¿Todavía no tienes cuenta?'
    : '¿Es tu primera vez y tu nutricionista te ha dado de alta?';

  const enviar = async () => {
    if (enviando) return;
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      const r =
        modoReal === 'registro'
          ? await registrar({ nombre, email, pass })
          : modoReal === 'invitacion'
            ? await activarInvitacion(email, pass)
            : modoReal === 'olvido'
              ? await recuperarContrasena({
                  email,
                  fechaNacimiento: nacimiento,
                  nueva: pass,
                  enFicha,
                })
              : await entrar(email, pass);

      if (!r.ok) setError(r.error);
      else if (r.valor === 'email-enviado') {
        setAviso(
          `Te hemos mandado un email a ${email.trim()} con un enlace para elegir contraseña nueva. Si no aparece, mira en spam.`,
        );
      }
    } finally {
      setEnviando(false);
    }
  };

  const titulo = {
    entrar: 'Entra en NutriPlan',
    registro: 'Crea tu cuenta',
    invitacion: `Bienvenida${cuenta?.nombre ? `, ${cuenta.nombre.split(' ')[0]}` : ''}`,
    olvido: 'Recupera tu contraseña',
  }[modoReal];

  const subtitulo = {
    entrar: 'Tu email y tu contraseña.',
    registro: primeraVez
      ? 'Para nutricionistas. A tus clientes los invitas tú después.'
      : 'Usa el email con el que tu nutricionista te ha dado de alta y elige tu contraseña.',
    invitacion: 'Tu nutricionista te ha dado de alta. Elige una contraseña para entrar.',
    olvido: hayNube
      ? 'Escribe tu email y te mandamos un enlace para elegir una contraseña nueva.'
      : cuenta && cuenta.rol !== 'cliente'
        ? 'Elige una contraseña nueva. Sólo funciona en este navegador, donde ya están tus datos.'
        : 'Confirma tu fecha de nacimiento y elige una contraseña nueva.',
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

          {pideNacimiento && (
            <Field label="Fecha de nacimiento">
              <Input
                type="date"
                value={nacimiento}
                onChange={(e) => setNacimiento(e.target.value)}
              />
            </Field>
          )}

          {!(hayNube && modoReal === 'olvido') && (
            <Field label={modoReal === 'entrar' ? 'Contraseña' : 'Elige una contraseña'}>
              <Input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void enviar()}
                placeholder={modoReal === 'entrar' ? '' : 'Mínimo 8 caracteres'}
              />
            </Field>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {aviso && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {aviso}
          </p>
        )}

        <Button
          onClick={() => void enviar()}
          disabled={enviando}
          className="mt-4 w-full justify-center"
        >
          {enviando
            ? 'Un momento…'
            : modoReal === 'registro'
              ? 'Crear cuenta'
              : modoReal === 'invitacion'
                ? 'Guardar y entrar'
                : modoReal === 'olvido'
                  ? hayNube
                    ? 'Mandarme el enlace'
                    : 'Guardar y entrar'
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
            {modo === 'entrar' ? `${invitacion} ` : '¿Ya tienes cuenta? '}
            <button
              onClick={() => {
                setModo(modo === 'entrar' ? 'registro' : 'entrar');
                setError(null);
              }}
              className="font-medium text-brand-600 hover:underline"
            >
              {modo === 'entrar' ? (primeraVez ? 'Crear una' : 'Crear mi contraseña') : 'Entrar'}
            </button>
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
        {hayNube
          ? 'Tu cuenta y tus planes viven en el servidor: entras desde el móvil, el portátil o donde quieras.'
          : 'Los datos se guardan en este navegador. Al conectar el servidor podrás entrar desde cualquier dispositivo y las contraseñas quedarán cifradas de verdad.'}
      </p>
    </div>
  );
}
