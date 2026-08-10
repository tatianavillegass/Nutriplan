import {
  comprobarContrasena,
  emailValido,
  normEmail,
  type Cuenta,
  type Rol,
  type Sesion,
} from '../types/auth';
import { storage, uid, nowIso } from './storage';

/**
 * REGISTRO Y ACCESO
 *
 * Toda la lógica de cuentas en un sitio, sin tocar componentes. Cuando se
 * conecte Supabase se sustituye el cuerpo de estas cuatro funciones
 * (`registrar`, `entrar`, `invitarCliente`, `activarInvitacion`) por llamadas
 * a su API, y las pantallas no se enteran.
 */

export const CUENTAS_KEY = 'cuentas';
export const SESION_KEY = 'sesion';

/**
 * Hash de andar por casa (djb2 con sal). No protege de nadie con acceso al
 * ordenador: sólo evita que la contraseña se lea a simple vista en el
 * almacenamiento. La de verdad la pone Supabase.
 */
export function hashear(pass: string, sal = 'nutriplan'): string {
  let h = 5381;
  const txt = `${sal}:${pass}`;
  for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) >>> 0;
  // Segunda vuelta para que dos contraseñas parecidas no den hashes parecidos.
  let g = 52711;
  for (let i = txt.length - 1; i >= 0; i--) g = ((g << 5) + g + txt.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}.${g.toString(36)}`;
}

export function leerCuentas(): Cuenta[] {
  return storage.getSync<Cuenta[]>(CUENTAS_KEY) ?? [];
}

export function guardarCuentas(cuentas: Cuenta[]): void {
  void storage.set(CUENTAS_KEY, cuentas);
}

export function leerSesion(): Sesion | null {
  return storage.getSync<Sesion>(SESION_KEY);
}

export function guardarSesion(s: Sesion | null): void {
  if (s) void storage.set(SESION_KEY, s);
  else void storage.remove(SESION_KEY);
}

export function buscarPorEmail(cuentas: Cuenta[], email: string): Cuenta | undefined {
  const e = normEmail(email);
  return cuentas.find((c) => normEmail(c.email) === e);
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

/** Alta de una nutricionista. El primer registro no necesita invitación. */
export function registrar(
  cuentas: Cuenta[],
  datos: { nombre: string; email: string; pass: string; rol?: Rol },
): Resultado<{ cuentas: Cuenta[]; cuenta: Cuenta }> {
  const nombre = datos.nombre.trim();
  if (!nombre) return { ok: false, error: 'Escribe tu nombre.' };
  if (!emailValido(datos.email)) return { ok: false, error: 'Ese email no parece válido.' };
  if (buscarPorEmail(cuentas, datos.email))
    return { ok: false, error: 'Ya hay una cuenta con ese email. Prueba a entrar.' };

  const fuerza = comprobarContrasena(datos.pass);
  if (!fuerza.valida) return { ok: false, error: fuerza.motivo! };

  const cuenta: Cuenta = {
    id: uid('cu_'),
    email: normEmail(datos.email),
    nombre,
    rol: datos.rol ?? 'nutricionista',
    hash: hashear(datos.pass),
    createdAt: nowIso(),
  };

  const siguiente = [...cuentas, cuenta];
  guardarCuentas(siguiente);
  return { ok: true, valor: { cuentas: siguiente, cuenta } };
}

/** Entrar. El mismo mensaje para email inexistente y contraseña mala. */
export function entrar(
  cuentas: Cuenta[],
  email: string,
  pass: string,
): Resultado<{ cuentas: Cuenta[]; sesion: Sesion }> {
  const cuenta = buscarPorEmail(cuentas, email);
  if (!cuenta || !cuenta.hash || cuenta.hash !== hashear(pass)) {
    return { ok: false, error: 'Email o contraseña incorrectos.' };
  }

  const sesion: Sesion = { cuentaId: cuenta.id, rol: cuenta.rol, desde: nowIso() };
  const siguiente = cuentas.map((c) =>
    c.id === cuenta.id ? { ...c, ultimoAcceso: nowIso() } : c,
  );
  guardarCuentas(siguiente);
  guardarSesion(sesion);
  return { ok: true, valor: { cuentas: siguiente, sesion } };
}

export function salir(): void {
  guardarSesion(null);
}

/**
 * La nutricionista da de alta al cliente con su email: la cuenta queda
 * pendiente hasta que él elige contraseña. Así nadie recibe una contraseña
 * por WhatsApp.
 */
export function invitarCliente(
  cuentas: Cuenta[],
  datos: { nombre: string; email: string; clientId: string; invitadoPor: string },
): Resultado<{ cuentas: Cuenta[]; cuenta: Cuenta }> {
  if (!emailValido(datos.email)) return { ok: false, error: 'Ese email no parece válido.' };

  const existente = buscarPorEmail(cuentas, datos.email);
  if (existente) {
    if (existente.clientId === datos.clientId) {
      return { ok: true, valor: { cuentas, cuenta: existente } };
    }
    return { ok: false, error: 'Ese email ya está usado por otra cuenta.' };
  }

  const cuenta: Cuenta = {
    id: uid('cu_'),
    email: normEmail(datos.email),
    nombre: datos.nombre.trim(),
    rol: 'cliente',
    clientId: datos.clientId,
    invitadoPor: datos.invitadoPor,
    createdAt: nowIso(),
  };

  const siguiente = [...cuentas, cuenta];
  guardarCuentas(siguiente);
  return { ok: true, valor: { cuentas: siguiente, cuenta } };
}

/** El cliente abre su invitación y elige contraseña. */
export function activarInvitacion(
  cuentas: Cuenta[],
  email: string,
  pass: string,
): Resultado<{ cuentas: Cuenta[]; sesion: Sesion }> {
  const cuenta = buscarPorEmail(cuentas, email);
  if (!cuenta) return { ok: false, error: 'No hay ninguna invitación con ese email.' };
  if (cuenta.hash)
    return { ok: false, error: 'Esta cuenta ya tiene contraseña. Entra con ella.' };

  const fuerza = comprobarContrasena(pass);
  if (!fuerza.valida) return { ok: false, error: fuerza.motivo! };

  const actualizada: Cuenta = { ...cuenta, hash: hashear(pass), ultimoAcceso: nowIso() };
  const siguiente = cuentas.map((c) => (c.id === cuenta.id ? actualizada : c));
  const sesion: Sesion = { cuentaId: actualizada.id, rol: actualizada.rol, desde: nowIso() };

  guardarCuentas(siguiente);
  guardarSesion(sesion);
  return { ok: true, valor: { cuentas: siguiente, sesion } };
}

/** Cambiar la contraseña conociendo la anterior. */
export function cambiarContrasena(
  cuentas: Cuenta[],
  cuentaId: string,
  actual: string,
  nueva: string,
): Resultado<Cuenta[]> {
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  if (!cuenta) return { ok: false, error: 'Cuenta no encontrada.' };
  if (cuenta.hash !== hashear(actual)) return { ok: false, error: 'La contraseña actual no es esa.' };

  const fuerza = comprobarContrasena(nueva);
  if (!fuerza.valida) return { ok: false, error: fuerza.motivo! };

  const siguiente = cuentas.map((c) =>
    c.id === cuentaId ? { ...c, hash: hashear(nueva) } : c,
  );
  guardarCuentas(siguiente);
  return { ok: true, valor: siguiente };
}

/**
 * SE ME OLVIDÓ LA CONTRASEÑA
 *
 * Sin servidor de correo hace falta algo que sólo sepa el interesado: su
 * fecha de nacimiento, que la nutricionista ya tiene en la ficha. Se compara
 * contra la ficha y, si cuadra, elige contraseña nueva ahí mismo.
 *
 * No es tan sólido como un enlace por email — eso llega con Supabase — pero
 * evita que un email suelto baste para entrar en el plan de alguien.
 */
export function recuperarContrasena(
  cuentas: Cuenta[],
  datos: {
    email: string;
    fechaNacimiento: string;
    nueva: string;
    /** Fecha de nacimiento que consta en la ficha del cliente. */
    enFicha?: string;
  },
): Resultado<{ cuentas: Cuenta[]; sesion: Sesion }> {
  const cuenta = buscarPorEmail(cuentas, datos.email);
  // El mismo mensaje exista o no la cuenta: no se confirman emails ajenos.
  const generico = 'Los datos no coinciden. Habla con tu nutricionista.';
  if (!cuenta) return { ok: false, error: generico };

  if (!datos.enFicha) {
    return {
      ok: false,
      error: 'Tu ficha no tiene fecha de nacimiento. Pídele a tu nutricionista que la añada.',
    };
  }
  if (datos.enFicha !== datos.fechaNacimiento.trim()) return { ok: false, error: generico };

  const fuerza = comprobarContrasena(datos.nueva);
  if (!fuerza.valida) return { ok: false, error: fuerza.motivo! };

  const actualizada: Cuenta = { ...cuenta, hash: hashear(datos.nueva), ultimoAcceso: nowIso() };
  const siguiente = cuentas.map((c) => (c.id === cuenta.id ? actualizada : c));
  const sesion: Sesion = { cuentaId: actualizada.id, rol: actualizada.rol, desde: nowIso() };

  guardarCuentas(siguiente);
  guardarSesion(sesion);
  return { ok: true, valor: { cuentas: siguiente, sesion } };
}

/**
 * Restablecer: la cuenta vuelve a estar pendiente y el cliente elige
 * contraseña nueva la próxima vez que entre.
 *
 * La nutricionista nunca ve ni fija la contraseña de nadie — sólo puede
 * devolver la cuenta al estado inicial. Es lo que hace cualquier sistema
 * serio, y aquí además evita que la contraseña viaje por WhatsApp.
 */
export function reiniciarContrasena(cuentas: Cuenta[], cuentaId: string): Resultado<Cuenta[]> {
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  if (!cuenta) return { ok: false, error: 'Cuenta no encontrada.' };

  const siguiente = cuentas.map((c) =>
    c.id === cuentaId ? { ...c, hash: undefined } : c,
  );
  guardarCuentas(siguiente);
  return { ok: true, valor: siguiente };
}

/** Cuenta de cliente asociada a una ficha, si la hay. */
export function cuentaDeCliente(cuentas: Cuenta[], clientId: string): Cuenta | undefined {
  return cuentas.find((c) => c.rol === 'cliente' && c.clientId === clientId);
}

/** Al borrar un cliente se va también su cuenta. */
export function quitarCuentaDeCliente(cuentas: Cuenta[], clientId: string): Cuenta[] {
  const siguiente = cuentas.filter((c) => c.clientId !== clientId);
  guardarCuentas(siguiente);
  return siguiente;
}
