import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Button, Field, Input } from './ui';

/**
 * CONTRASEÑA NUEVA
 *
 * Se enseña al llegar por el enlace de "se me olvidó la contraseña". El
 * enlace ya deja dentro, pero la contraseña vieja sigue siendo la buena:
 * hasta elegir una nueva no se sigue.
 */
export function ClaveNueva() {
  const cambiar = useAuthStore((s) => s.cambiarContrasena);
  const terminar = useAuthStore((s) => s.finRecuperacion);
  const salir = useAuthStore((s) => s.salir);

  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const r = await cambiar('', pass);
      if (!r.ok) setError(r.error);
      else terminar();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <div className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-brand-900">Elige una contraseña nueva</h1>
        <p className="mt-0.5 mb-4 text-xs text-slate-500">
          La anterior deja de valer en cuanto guardes esta.
        </p>

        <Field label="Contraseña nueva">
          <Input
            autoFocus
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void guardar()}
            placeholder="Mínimo 8 caracteres"
          />
        </Field>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <Button
          onClick={() => void guardar()}
          disabled={guardando}
          className="mt-4 w-full justify-center"
        >
          {guardando ? 'Guardando…' : 'Guardar y seguir'}
        </Button>

        <p className="mt-3 text-center">
          <button
            onClick={() => {
              terminar();
              void salir();
            }}
            className="text-xs text-slate-500 hover:text-brand-700 hover:underline"
          >
            Ahora no
          </button>
        </p>
      </div>
    </div>
  );
}
