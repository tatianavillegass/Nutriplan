import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { hayNube, nube } from '../../utils/supabase';
import { Button, Field, Input } from './ui';

/**
 * CONTRASEÑA NUEVA
 *
 * Se enseña al llegar por el enlace de "se me olvidó la contraseña". El
 * enlace ya deja dentro, pero la contraseña vieja sigue siendo la buena:
 * hasta elegir una nueva no se sigue.
 *
 * PRIMERO SE MIRA SI EL ENLACE HA SERVIDO DE ALGO
 * ===============================================
 * Un enlace caducado, ya usado, o abierto en otro móvil del que se pidió, deja
 * la app aquí pero sin sesión: se escribía la contraseña, se pulsaba guardar y
 * salía un error en inglés. Se comprueba antes y se dice qué ha pasado, que es
 * la diferencia entre volver a pedir el enlace y escribirle a su nutricionista.
 */
export function ClaveNueva() {
  const cambiar = useAuthStore((s) => s.cambiarContrasena);
  const terminar = useAuthStore((s) => s.finRecuperacion);
  const arrancar = useAuthStore((s) => s.arrancar);
  const salir = useAuthStore((s) => s.salir);

  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [sirve, setSirve] = useState<boolean | undefined>();

  useEffect(() => {
    if (!hayNube) {
      setSirve(true);
      return;
    }
    let vivo = true;
    /*
     * La librería canjea el código de la URL nada más cargarse, pero tarda un
     * momento. Se mira un par de veces antes de dar el enlace por malo: decirle
     * que no vale cuando sí valía la manda a pedir otro para nada.
     */
    const mirar = async (intentos: number) => {
      const { data } = await nube().auth.getSession();
      if (!vivo) return;
      if (data.session) return setSirve(true);
      if (intentos <= 0) return setSirve(false);
      setTimeout(() => void mirar(intentos - 1), 400);
    };
    void mirar(4);
    return () => {
      vivo = false;
    };
  }, []);

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const r = await cambiar('', pass);
      if (!r.ok) setError(r.error);
      else {
        /*
         * Al arrancar no se resolvió su perfil —durante la recuperación se
         * salta, porque si falla cierra la sesión— así que se resuelve ahora.
         * Sin esto, acabar de cambiar la contraseña la devolvía a la pantalla
         * de entrar y tenía que escribirla otra vez.
         */
        terminar();
        await arrancar();
      }
    } finally {
      setGuardando(false);
    }
  };

  if (sirve === false)
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
        <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800">Este enlace ya no vale</h1>
          <p className="mt-2 text-sm leading-snug text-slate-600">
            Los enlaces de contraseña caducan al rato y sólo se pueden usar una vez. Además hay
            que abrirlos <strong>en el mismo móvil u ordenador</strong> donde pediste el cambio, y
            desde el navegador: si el correo lo abre dentro de su propia aplicación, no funciona.
          </p>
          <p className="mt-2 text-sm leading-snug text-slate-600">
            Vuelve a pedir uno y ábrelo en cuanto te llegue.
          </p>
          <Button
            onClick={() => {
              terminar();
              void salir();
            }}
            className="mt-4 w-full justify-center"
          >
            Pedir otro enlace
          </Button>
        </div>
      </div>
    );

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
