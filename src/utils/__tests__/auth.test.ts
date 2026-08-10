// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  activarInvitacion,
  buscarPorEmail,
  cambiarContrasena,
  cuentaDeCliente,
  entrar,
  guardarCuentas,
  hashear,
  invitarCliente,
  leerCuentas,
  leerSesion,
  quitarCuentaDeCliente,
  recuperarContrasena,
  registrar,
  reiniciarContrasena,
  salir,
} from '../auth';
import { comprobarContrasena, emailValido, estadoCuenta } from '../../types/auth';

const NUTRI = { nombre: 'Tats', email: 'tats@correo.com', pass: 'plan12345' };

const alta = () => {
  const r = registrar([], NUTRI);
  if (!r.ok) throw new Error(r.error);
  return r.valor;
};

describe('Comprobaciones básicas', () => {
  it('el email tiene que parecer un email', () => {
    expect(emailValido('tats@correo.com')).toBe(true);
    expect(emailValido('tats@correo')).toBe(false);
    expect(emailValido('sin arroba')).toBe(false);
  });

  it('la contraseña pide ocho caracteres y no sólo números', () => {
    expect(comprobarContrasena('corta').valida).toBe(false);
    expect(comprobarContrasena('12345678').motivo).toMatch(/sólo números/);
    expect(comprobarContrasena('plan12345').valida).toBe(true);
  });

  it('el hash cambia con la contraseña y es estable', () => {
    expect(hashear('plan12345')).toBe(hashear('plan12345'));
    expect(hashear('plan12345')).not.toBe(hashear('plan12346'));
  });
});

describe('Registro y acceso de la nutricionista', () => {
  beforeEach(() => {
    localStorage.clear();
    guardarCuentas([]);
  });

  it('registrarse crea la cuenta y no guarda la contraseña en claro', () => {
    const { cuenta, cuentas } = alta();
    expect(cuentas).toHaveLength(1);
    expect(cuenta.rol).toBe('nutricionista');
    expect(JSON.stringify(leerCuentas())).not.toContain('plan12345');
  });

  it('el email se guarda en minúsculas y se busca sin distinguirlas', () => {
    const r = registrar([], { ...NUTRI, email: 'TATS@Correo.com' });
    if (!r.ok) throw new Error(r.error);
    expect(r.valor.cuenta.email).toBe('tats@correo.com');
    expect(buscarPorEmail(r.valor.cuentas, 'tats@CORREO.com')).toBeTruthy();
  });

  it('no deja registrar dos veces el mismo email', () => {
    const { cuentas } = alta();
    const r = registrar(cuentas, NUTRI);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Ya hay una cuenta/);
  });

  it('rechaza nombre vacío, email malo y contraseña corta', () => {
    expect(registrar([], { ...NUTRI, nombre: '  ' }).ok).toBe(false);
    expect(registrar([], { ...NUTRI, email: 'malo' }).ok).toBe(false);
    expect(registrar([], { ...NUTRI, pass: '123' }).ok).toBe(false);
  });

  it('entrar con las credenciales correctas abre sesión', () => {
    const { cuentas } = alta();
    const r = entrar(cuentas, NUTRI.email, NUTRI.pass);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.sesion.rol).toBe('nutricionista');
      expect(leerSesion()?.cuentaId).toBe(r.valor.sesion.cuentaId);
    }
  });

  it('con la contraseña mala no dice si el email existe', () => {
    const { cuentas } = alta();
    const mala = entrar(cuentas, NUTRI.email, 'otracosa123');
    const inexistente = entrar(cuentas, 'nadie@correo.com', 'loquesea123');
    expect(mala.ok).toBe(false);
    expect(inexistente.ok).toBe(false);
    if (!mala.ok && !inexistente.ok) expect(mala.error).toBe(inexistente.error);
  });

  it('salir cierra la sesión guardada', () => {
    const { cuentas } = alta();
    entrar(cuentas, NUTRI.email, NUTRI.pass);
    salir();
    expect(leerSesion()).toBeNull();
  });

  it('la nutricionista puede recuperar su acceso sin quedarse encerrada', () => {
    const { cuentas } = alta();
    const r = recuperarContrasena(cuentas, {
      email: NUTRI.email,
      fechaNacimiento: '',
      nueva: 'nueva12345',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.sesion.rol).toBe('nutricionista');
      expect(entrar(r.valor.cuentas, NUTRI.email, 'nueva12345').ok).toBe(true);
      // La vieja deja de valer.
      expect(entrar(r.valor.cuentas, NUTRI.email, NUTRI.pass).ok).toBe(false);
    }
  });

  it('un email que no existe no da pistas ni crea nada', () => {
    const { cuentas } = alta();
    const r = recuperarContrasena(cuentas, {
      email: 'nadie@correo.com',
      fechaNacimiento: '',
      nueva: 'nueva12345',
    });
    expect(r.ok).toBe(false);
  });

  it('cambiar la contraseña exige la anterior', () => {
    const { cuentas, cuenta } = alta();
    expect(cambiarContrasena(cuentas, cuenta.id, 'mala', 'nueva12345').ok).toBe(false);
    const r = cambiarContrasena(cuentas, cuenta.id, NUTRI.pass, 'nueva12345');
    expect(r.ok).toBe(true);
    if (r.ok) expect(entrar(r.valor, NUTRI.email, 'nueva12345').ok).toBe(true);
  });
});

describe('Invitación del cliente', () => {
  beforeEach(() => {
    localStorage.clear();
    guardarCuentas([]);
  });

  const invitar = () => {
    const { cuentas, cuenta } = alta();
    const r = invitarCliente(cuentas, {
      nombre: 'Vanessa',
      email: 'vanessa@correo.com',
      clientId: 'c1',
      invitadoPor: cuenta.id,
    });
    if (!r.ok) throw new Error(r.error);
    return r.valor;
  };

  it('la cuenta nace pendiente, sin contraseña', () => {
    const { cuenta } = invitar();
    expect(cuenta.rol).toBe('cliente');
    expect(cuenta.clientId).toBe('c1');
    expect(estadoCuenta(cuenta)).toBe('pendiente');
    expect(cuenta.hash).toBeUndefined();
  });

  it('una cuenta pendiente no puede entrar todavía', () => {
    const { cuentas } = invitar();
    expect(entrar(cuentas, 'vanessa@correo.com', 'loquesea123').ok).toBe(false);
  });

  it('el cliente elige contraseña y entra en el mismo gesto', () => {
    const { cuentas } = invitar();
    const r = activarInvitacion(cuentas, 'vanessa@correo.com', 'vanessa123');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.sesion.rol).toBe('cliente');
      expect(leerSesion()).toBeTruthy();
    }
  });

  it('no se puede activar dos veces', () => {
    const { cuentas } = invitar();
    const r = activarInvitacion(cuentas, 'vanessa@correo.com', 'vanessa123');
    if (!r.ok) throw new Error(r.error);
    const otra = activarInvitacion(r.valor.cuentas, 'vanessa@correo.com', 'otra12345');
    expect(otra.ok).toBe(false);
    if (!otra.ok) expect(otra.error).toMatch(/ya tiene contraseña/);
  });

  it('invitar dos veces al mismo cliente no duplica la cuenta', () => {
    const { cuentas, cuenta } = invitar();
    const r = invitarCliente(cuentas, {
      nombre: 'Vanessa',
      email: 'vanessa@correo.com',
      clientId: 'c1',
      invitadoPor: 'x',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.cuentas).toHaveLength(2);
      expect(r.valor.cuenta.id).toBe(cuenta.id);
    }
  });

  it('un email ya usado por otra persona se rechaza', () => {
    const { cuentas } = invitar();
    const r = invitarCliente(cuentas, {
      nombre: 'Otra',
      email: 'vanessa@correo.com',
      clientId: 'c2',
      invitadoPor: 'x',
    });
    expect(r.ok).toBe(false);
  });

  it('si olvida la contraseña, la nutricionista la restablece', () => {
    const { cuentas } = invitar();
    const activada = activarInvitacion(cuentas, 'vanessa@correo.com', 'vanessa123');
    if (!activada.ok) throw new Error(activada.error);
    expect(entrar(activada.valor.cuentas, 'vanessa@correo.com', 'vanessa123').ok).toBe(true);

    const cuenta = buscarPorEmail(activada.valor.cuentas, 'vanessa@correo.com')!;
    const r = reiniciarContrasena(activada.valor.cuentas, cuenta.id);
    if (!r.ok) throw new Error(r.error);

    // Vuelve a estar pendiente: ni la vieja sirve ni hay contraseña guardada.
    expect(estadoCuenta(buscarPorEmail(r.valor, 'vanessa@correo.com')!)).toBe('pendiente');
    expect(entrar(r.valor, 'vanessa@correo.com', 'vanessa123').ok).toBe(false);

    // Y puede elegir una nueva.
    const otra = activarInvitacion(r.valor, 'vanessa@correo.com', 'nueva12345');
    expect(otra.ok).toBe(true);
  });

  it('restablecer no toca a los demás', () => {
    const { cuentas } = invitar();
    const cliente = buscarPorEmail(cuentas, 'vanessa@correo.com')!;
    const r = reiniciarContrasena(cuentas, cliente.id);
    if (!r.ok) throw new Error(r.error);
    expect(entrar(r.valor, NUTRI.email, NUTRI.pass).ok).toBe(true);
  });

  it('la cuenta se encuentra por su ficha y se borra con ella', () => {
    const { cuentas } = invitar();
    expect(cuentaDeCliente(cuentas, 'c1')).toBeTruthy();
    const quedan = quitarCuentaDeCliente(cuentas, 'c1');
    expect(cuentaDeCliente(quedan, 'c1')).toBeUndefined();
    // La nutricionista sigue ahí.
    expect(quedan).toHaveLength(1);
  });
});
