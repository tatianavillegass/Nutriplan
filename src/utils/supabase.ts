import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * LA NUBE
 *
 * NutriPlan funciona de dos maneras según haya o no un servidor detrás:
 *
 *  - Sin configurar (que es como arranca): todo vive en el navegador.
 *    Sirve para probar, pero cada dispositivo tiene sus propios datos.
 *
 *  - Con Supabase: las cuentas y los planes viven en un servidor. La
 *    nutricionista entra desde donde quiera y el cliente ve su plan
 *    desde su móvil.
 *
 * Se activa poniendo dos variables de entorno. En local, en un archivo
 * `.env.local`; en Vercel, en Settings → Environment Variables:
 *
 *    VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
 *    VITE_SUPABASE_ANON_KEY=eyJhbGci...
 *
 * La clave "anon" es pública a propósito: quien la tenga sólo puede
 * pedir lo que las reglas de la base de datos le dejen (ver
 * `supabase/esquema.sql`). La que nunca sale de Supabase es la
 * `service_role`.
 */

const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

/** ¿Hay servidor detrás? Decide el modo de toda la app. */
export const hayNube = Boolean(url && anon);

export const supabase: SupabaseClient | null = hayNube
  ? createClient(url!, anon!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // El enlace de "recuperar contraseña" vuelve con el token en la
        // URL; hay que dejar que lo recoja al abrirse.
        detectSessionInUrl: true,
        // Con PKCE el token vuelve como `?code=...` en lugar de detrás de
        // la almohadilla. Importa porque la app usa rutas con almohadilla
        // (`#/clientes/...`) y si no se pisarían.
        flowType: 'pkce',
      },
    })
  : null;

/** Igual que `supabase` pero sin comprobar el nulo en cada llamada. */
export function nube(): SupabaseClient {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
}

/**
 * Los mensajes de Supabase vienen en inglés y a veces son crípticos.
 * Aquí se traducen los que puede ver una persona normal.
 */
export function mensajeDeError(e: unknown): string {
  const bruto = e instanceof Error ? e.message : String(e ?? '');
  const t = bruto.toLowerCase();

  if (t.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (t.includes('user already registered') || t.includes('already been registered'))
    return 'Ya hay una cuenta con ese email. Prueba a entrar.';
  if (t.includes('email not confirmed'))
    return 'Tienes que confirmar el email. Mira tu bandeja de entrada.';
  if (t.includes('password should be at least')) return 'La contraseña necesita al menos 8 caracteres.';
  if (t.includes('unable to validate email') || t.includes('invalid email'))
    return 'Ese email no parece válido.';
  if (t.includes('for security purposes') || t.includes('rate limit'))
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  if (t.includes('failed to fetch') || t.includes('networkerror'))
    return 'No hay conexión con el servidor. Comprueba tu internet.';

  return bruto || 'Algo ha fallado. Vuelve a intentarlo.';
}
