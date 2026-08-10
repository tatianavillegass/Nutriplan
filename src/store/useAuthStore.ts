import { create } from 'zustand';
import type { Cuenta, Sesion } from '../types/auth';
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

interface AuthState {
  cuentas: Cuenta[];
  sesion: Sesion | null;

  /** La cuenta con la que se está trabajando ahora. */
  actual: () => Cuenta | undefined;

  registrar: (datos: { nombre: string; email: string; pass: string }) => Resultado<Cuenta>;
  entrar: (email: string, pass: string) => Resultado<Sesion>;
  salir: () => void;

  invitarCliente: (datos: {
    nombre: string;
    email: string;
    clientId: string;
  }) => Resultado<Cuenta>;
  activarInvitacion: (email: string, pass: string) => Resultado<Sesion>;
  cambiarContrasena: (actual: string, nueva: string) => Resultado<true>;
  /** "Se me olvidó": el cliente se identifica con su fecha de nacimiento. */
  recuperarContrasena: (datos: {
    email: string;
    fechaNacimiento: string;
    nueva: string;
    enFicha?: string;
  }) => Resultado<Sesion>;
  /** Deja la cuenta pendiente: el cliente elegirá contraseña nueva. */
  reiniciarContrasena: (cuentaId: string) => Resultado<true>;
  quitarCuentaDeCliente: (clientId: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  cuentas: typeof window === 'undefined' ? [] : leerCuentas(),
  sesion: typeof window === 'undefined' ? null : leerSesion(),

  actual: () => {
    const { cuentas, sesion } = get();
    return sesion ? cuentas.find((c) => c.id === sesion.cuentaId) : undefined;
  },

  registrar: (datos) => {
    const r = registrar(get().cuentas, datos);
    if (!r.ok) return r;
    // Registrarse entra directamente: nadie quiere escribir la contraseña dos veces.
    const e = entrar(r.valor.cuentas, datos.email, datos.pass);
    if (e.ok) set({ cuentas: e.valor.cuentas, sesion: e.valor.sesion });
    else set({ cuentas: r.valor.cuentas });
    return { ok: true, valor: r.valor.cuenta };
  },

  entrar: (email, pass) => {
    const r = entrar(get().cuentas, email, pass);
    if (!r.ok) return r;
    set({ cuentas: r.valor.cuentas, sesion: r.valor.sesion });
    return { ok: true, valor: r.valor.sesion };
  },

  salir: () => {
    salir();
    set({ sesion: null });
  },

  invitarCliente: (datos) => {
    const yo = get().actual();
    if (!yo) return { ok: false, error: 'No hay ninguna sesión abierta.' };
    const r = invitarCliente(get().cuentas, { ...datos, invitadoPor: yo.id });
    if (!r.ok) return r;
    set({ cuentas: r.valor.cuentas });
    return { ok: true, valor: r.valor.cuenta };
  },

  activarInvitacion: (email, pass) => {
    const r = activarInvitacion(get().cuentas, email, pass);
    if (!r.ok) return r;
    set({ cuentas: r.valor.cuentas, sesion: r.valor.sesion });
    return { ok: true, valor: r.valor.sesion };
  },

  cambiarContrasena: (actual, nueva) => {
    const yo = get().actual();
    if (!yo) return { ok: false, error: 'No hay ninguna sesión abierta.' };
    const r = cambiarContrasena(get().cuentas, yo.id, actual, nueva);
    if (!r.ok) return r;
    set({ cuentas: r.valor });
    return { ok: true, valor: true };
  },

  recuperarContrasena: (datos) => {
    const r = recuperarContrasena(get().cuentas, datos);
    if (!r.ok) return r;
    set({ cuentas: r.valor.cuentas, sesion: r.valor.sesion });
    return { ok: true, valor: r.valor.sesion };
  },

  reiniciarContrasena: (cuentaId) => {
    const r = reiniciarContrasena(get().cuentas, cuentaId);
    if (!r.ok) return r;
    set({ cuentas: r.valor });
    // Si era la sesión abierta, se cierra: ya no tiene contraseña.
    if (get().sesion?.cuentaId === cuentaId) get().salir();
    return { ok: true, valor: true };
  },

  quitarCuentaDeCliente: (clientId) => set({ cuentas: quitarCuentaDeCliente(get().cuentas, clientId) }),
}));
