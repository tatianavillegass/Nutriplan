import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Cuenta, Sesion } from '../types/auth';
import { comprobarContrasena, emailValido, normEmail } from '../types/auth';
import {
  activarInvitacion,
  cambiarContrasena,
  entrar,
  invitarCliente,
  leerCuentas,
  leerSesion,
  quitarCuentaDeCliente,
  recuperarContrasena,
  registrar,
  reiniciarContrasena,
  salir,
  type Resultado,
} from '../utils/auth';
import { hayNube, nube, mensajeDeError } from '../utils/supabase';
import { resolverPerfil, type Perfil } from '../utils/nube';
import { nowIso } from '../utils/storage';

/**
 * CUENTAS
 *
 * Dos modos según haya servidor detrás (ver `utils/supabase.ts`):
 *
 *  · en la nube — Supabase Auth. Contraseñas cifradas de verdad, la misma
 *    cuenta desde cualquier dispositivo y recuperación por email.
 *  · en el navegador — lo de siempre, para poder probar sin configurar nada.
 *
 * Las pantallas no distinguen: llaman a los mismos métodos y reciben el
 * mismo `Resultado`. Lo único que cambia es que ahora son asíncronos,
 * porque hablar con un servidor lleva su tiempo.
 */

/** Qué ha pasado al pedir una contraseña nueva. */
export type Recuperacion = 'cambiada' | 'email-enviado';

interface AuthState {
  cuentas: Cuenta[];
  sesion: Sesion | null;
  /** Sólo en la nube: quién eres y de dónde cuelgan tus datos. */
  perfil: Perfil | null;
  /** Mientras se comprueba si había una sesión abierta. */
  cargando: boolean;
  /** Ha llegado por el enlace de "se me olvidó": toca elegir contraseña. */
  recuperando: boolean;
  /** Cierra la pantalla de contraseña nueva. */
  finRecuperacion: () => void;

  actual: () => Cuenta | undefined;

  /** Se llama una vez al arrancar la app. */
  arrancar: () => Promise<void>;

  registrar: (datos: { nombre: string; email: string; pass: string }) => Promise<Resultado<Cuenta>>;
  entrar: (email: string, pass: string) => Promise<Resultado<Sesion>>;
  salir: () => Promise<void>;

  invitarCliente: (datos: {
    nombre: string;
    email: string;
    clientId: string;
  }) => Promise<Resultado<Cuenta>>;
  activarInvitacion: (email: string, pass: string) => Promise<Resultado<Sesion>>;
  cambiarContrasena: (actual: string, nueva: string) => Promise<Resultado<true>>;
  recuperarContrasena: (datos: {
    email: string;
    fechaNacimiento: string;
    nueva: string;
    enFicha?: string;
  }) => Promise<Resultado<Recuperacion>>;
  reiniciarContrasena: (cuentaId: string) => Promise<Resultado<true>>;
  quitarCuentaDeCliente: (clientId: string) => void;
}

/** Traduce el perfil del servidor a la cuenta que esperan las pantallas. */
function cuentaDePerfil(id: string, perfil: Perfil): Cuenta {
  return {
    id,
    email: perfil.email,
    nombre: perfil.nombre,
    rol: perfil.rol,
    clientId: perfil.clientId,
    hash: 'nube',
    createdAt: nowIso(),
  };
}

/** Lo que se hace tras un acceso correcto en la nube. */
async function tras(user: User) {
  const perfil = await resolverPerfil(user);
  const cuenta = cuentaDePerfil(user.id, perfil);
  const sesion: Sesion = { cuentaId: cuenta.id, rol: cuenta.rol, desde: nowIso() };
  return { perfil, cuenta, sesion };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  cuentas: typeof window === 'undefined' || hayNube ? [] : leerCuentas(),
  sesion: typeof window === 'undefined' || hayNube ? null : leerSesion(),
  perfil: null,
  cargando: hayNube,
  recuperando: false,

  finRecuperacion: () => set({ recuperando: false }),

  actual: () => {
    const { cuentas, sesion } = get();
    return sesion ? cuentas.find((c) => c.id === sesion.cuentaId) : undefined;
  },

  arrancar: async () => {
    if (!hayNube) return;
    try {
      // El enlace del email abre la app ya dentro, pero con la contraseña
      // todavía sin cambiar: hay que pedirla antes de dejar seguir.
      nube().auth.onAuthStateChange((evento) => {
        if (evento === 'PASSWORD_RECOVERY') set({ recuperando: true });
      });

      const { data } = await nube().auth.getSession();
      const user = data.session?.user;
      if (!user) {
        set({ cargando: false });
        return;
      }
      const { perfil, cuenta, sesion } = await tras(user);
      set({ perfil, cuentas: [cuenta], sesion, cargando: false });
    } catch (e) {
      console.error('[auth] no se pudo recuperar la sesión', e);
      set({ cargando: false });
    }
  },

  registrar: async (datos) => {
    if (!hayNube) {
      const r = registrar(get().cuentas, datos);
      if (!r.ok) return r;
      const e = entrar(r.valor.cuentas, datos.email, datos.pass);
      if (e.ok) set({ cuentas: e.valor.cuentas, sesion: e.valor.sesion });
      else set({ cuentas: r.valor.cuentas });
      return { ok: true, valor: r.valor.cuenta };
    }

    if (!datos.nombre.trim()) return { ok: false, error: 'Escribe tu nombre.' };
    if (!emailValido(datos.email)) return { ok: false, error: 'Ese email no parece válido.' };
    const fuerza = comprobarContrasena(datos.pass);
    if (!fuerza.valida) return { ok: false, error: fuerza.motivo! };

    try {
      const { data, error } = await nube().auth.signUp({
        email: normEmail(datos.email),
        password: datos.pass,
        options: { data: { nombre: datos.nombre.trim() } },
      });
      if (error) return { ok: false, error: mensajeDeError(error) };
      if (!data.user) return { ok: false, error: 'No se pudo crear la cuenta.' };
      if (!data.session) {
        return {
          ok: false,
          error: 'Cuenta creada. Confirma el email desde tu bandeja de entrada y vuelve a entrar.',
        };
      }
      const { perfil, cuenta, sesion } = await tras(data.user);
      set({ perfil, cuentas: [cuenta], sesion });
      return { ok: true, valor: cuenta };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e) };
    }
  },

  entrar: async (email, pass) => {
    if (!hayNube) {
      const r = entrar(get().cuentas, email, pass);
      if (!r.ok) return r;
      set({ cuentas: r.valor.cuentas, sesion: r.valor.sesion });
      return { ok: true, valor: r.valor.sesion };
    }

    try {
      const { data, error } = await nube().auth.signInWithPassword({
        email: normEmail(email),
        password: pass,
      });
      if (error || !data.user) return { ok: false, error: mensajeDeError(error) };
      const { perfil, cuenta, sesion } = await tras(data.user);
      set({ perfil, cuentas: [cuenta], sesion });
      return { ok: true, valor: sesion };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e) };
    }
  },

  salir: async () => {
    if (hayNube) {
      try {
        await nube().auth.signOut();
      } catch (e) {
        console.error('[auth] no se pudo cerrar sesión', e);
      }
      // Se limpia lo que quedaba en el navegador: si detrás entra otra
      // persona, no debe encontrarse los clientes de la anterior.
      const { olvidarLocal } = await import('../utils/sincronizacion');
      olvidarLocal();
      set({ sesion: null, perfil: null, cuentas: [] });
      return;
    }
    salir();
    set({ sesion: null });
  },

  /**
   * En la nube "invitar" es simplemente apuntar el email en la ficha: las
   * reglas de la base de datos hacen el resto. El cliente se crea su cuenta
   * con ese correo y ya ve su plan, sin que nadie le mande una contraseña.
   */
  invitarCliente: async (datos) => {
    if (!emailValido(datos.email)) return { ok: false, error: 'Ese email no parece válido.' };

    if (hayNube) {
      const cuenta: Cuenta = {
        id: `cl_${datos.clientId}`,
        email: normEmail(datos.email),
        nombre: datos.nombre,
        rol: 'cliente',
        clientId: datos.clientId,
        createdAt: nowIso(),
      };
      return { ok: true, valor: cuenta };
    }

    const yo = get().actual();
    if (!yo) return { ok: false, error: 'No hay ninguna sesión abierta.' };
    const r = invitarCliente(get().cuentas, { ...datos, invitadoPor: yo.id });
    if (!r.ok) return r;
    set({ cuentas: r.valor.cuentas });
    return { ok: true, valor: r.valor.cuenta };
  },

  /**
   * El cliente entra por primera vez. En la nube es un alta normal: si su
   * email ya está en una ficha, al resolver el perfil sale como cliente.
   */
  activarInvitacion: async (email, pass) => {
    if (hayNube) {
      const fuerza = comprobarContrasena(pass);
      if (!fuerza.valida) return { ok: false, error: fuerza.motivo! };
      try {
        const { data, error } = await nube().auth.signUp({
          email: normEmail(email),
          password: pass,
        });
        if (error) return { ok: false, error: mensajeDeError(error) };
        if (!data.session || !data.user) {
          return {
            ok: false,
            error: 'Cuenta creada. Confirma el email desde tu bandeja de entrada y vuelve a entrar.',
          };
        }
        const { perfil, cuenta, sesion } = await tras(data.user);
        set({ perfil, cuentas: [cuenta], sesion });
        return { ok: true, valor: sesion };
      } catch (e) {
        return { ok: false, error: mensajeDeError(e) };
      }
    }

    const r = activarInvitacion(get().cuentas, email, pass);
    if (!r.ok) return r;
    set({ cuentas: r.valor.cuentas, sesion: r.valor.sesion });
    return { ok: true, valor: r.valor.sesion };
  },

  cambiarContrasena: async (actual, nueva) => {
    if (hayNube) {
      const fuerza = comprobarContrasena(nueva);
      if (!fuerza.valida) return { ok: false, error: fuerza.motivo! };
      try {
        const { error } = await nube().auth.updateUser({ password: nueva });
        if (error) return { ok: false, error: mensajeDeError(error) };
        return { ok: true, valor: true };
      } catch (e) {
        return { ok: false, error: mensajeDeError(e) };
      }
    }

    const yo = get().actual();
    if (!yo) return { ok: false, error: 'No hay ninguna sesión abierta.' };
    const r = cambiarContrasena(get().cuentas, yo.id, actual, nueva);
    if (!r.ok) return r;
    set({ cuentas: r.valor });
    return { ok: true, valor: true };
  },

  /**
   * "Se me olvidó la contraseña". En la nube se manda un enlace al email,
   * que es como se hace en cualquier sitio serio. Sin servidor se comprueba
   * la fecha de nacimiento contra la ficha, que es lo único que hay.
   */
  recuperarContrasena: async (datos) => {
    if (hayNube) {
      if (!emailValido(datos.email)) return { ok: false, error: 'Ese email no parece válido.' };
      try {
        const { error } = await nube().auth.resetPasswordForEmail(normEmail(datos.email), {
          redirectTo: `${window.location.origin}${window.location.pathname}#/`,
        });
        if (error) return { ok: false, error: mensajeDeError(error) };
        return { ok: true, valor: 'email-enviado' };
      } catch (e) {
        return { ok: false, error: mensajeDeError(e) };
      }
    }

    const r = recuperarContrasena(get().cuentas, datos);
    if (!r.ok) return r;
    set({ cuentas: r.valor.cuentas, sesion: r.valor.sesion });
    return { ok: true, valor: 'cambiada' };
  },

  reiniciarContrasena: async (cuentaId) => {
    if (hayNube) {
      return {
        ok: false,
        error:
          'Las contraseñas las lleva el servidor: nadie puede verlas ni cambiarlas por otro. Dile que use "Se me olvidó la contraseña" y le llegará un enlace a su email.',
      };
    }
    const r = reiniciarContrasena(get().cuentas, cuentaId);
    if (!r.ok) return r;
    set({ cuentas: r.valor });
    if (get().sesion?.cuentaId === cuentaId) void get().salir();
    return { ok: true, valor: true };
  },

  quitarCuentaDeCliente: (clientId) => {
    if (hayNube) return;
    set({ cuentas: quitarCuentaDeCliente(get().cuentas, clientId) });
  },
}));
