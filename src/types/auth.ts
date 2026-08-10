/**
 * CUENTAS
 *
 * Dos papeles: la nutricionista, que monta los planes, y el cliente, que sólo
 * ve el suyo. Cada cuenta lleva su email y su contraseña, y el cliente además
 * apunta a su ficha (`clientId`), que es lo que le da acceso a un plan y no a
 * los demás.
 *
 * AVISO IMPORTANTE
 * Mientras todo viva en el navegador esto NO es seguridad de verdad: la
 * contraseña se guarda con un hash simple y cualquiera con acceso al
 * ordenador puede leer el almacenamiento. Sirve para separar sesiones y
 * probar el flujo completo. La seguridad llega al conectar Supabase, y el
 * modelo ya está pensado para eso: mismos campos, mismas pantallas.
 */

export type Rol = 'nutricionista' | 'cliente';

export interface Cuenta {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  /** Hash de la contraseña. Vacío mientras la invitación está pendiente. */
  hash?: string;
  /** Sólo en cuentas de cliente: a qué ficha pertenece. */
  clientId?: string;
  /** Quién la invitó. Para saber de qué nutricionista es cada cliente. */
  invitadoPor?: string;
  createdAt: string;
  ultimoAcceso?: string;
}

export interface Sesion {
  cuentaId: string;
  rol: Rol;
  desde: string;
}

/** Estado de una cuenta de cliente. */
export type EstadoCuenta = 'pendiente' | 'activa';

export function estadoCuenta(c: Cuenta): EstadoCuenta {
  return c.hash ? 'activa' : 'pendiente';
}

export const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

/** Normaliza el email para comparar: los correos no distinguen mayúsculas. */
export const normEmail = (email: string) => email.trim().toLowerCase();

export interface FuerzaContrasena {
  valida: boolean;
  motivo?: string;
}

/**
 * Reglas mínimas y explicadas: nada de "debe contener un símbolo raro".
 * Ocho caracteres y que no sea sólo números.
 */
export function comprobarContrasena(pass: string): FuerzaContrasena {
  if (pass.length < 8) return { valida: false, motivo: 'Al menos 8 caracteres.' };
  if (/^\d+$/.test(pass)) return { valida: false, motivo: 'No puede ser sólo números.' };
  return { valida: true };
}
