import type { Cita, Client, Pago, Sesion } from '../types/client';
import { bonoVigente, comoVanLasSesiones } from './bonos';
import { momentoDeCita } from './agenda';
import { uid } from './storage';

/**
 * LA AGENDA
 *
 * Hasta ahora una clienta tenía **una sola cita** —la siguiente— y al poner la
 * de octubre se perdía la de septiembre. Con eso no hay semana que pintar, y
 * sobre todo no hay forma de que la app sepa qué consultas se dieron: las
 * sesiones del bono había que marcarlas aparte en la ficha, y eso es justo lo
 * que se queda sin hacer un jueves con quince citas.
 *
 * La regla nueva, y es la que cambia todo: **marcar una cita como realizada es
 * lo que consume una sesión del bono**. Una anulada o movida no cuenta, que era
 * el motivo por el que se marcaban a mano — el «2 de 3» sigue sin poder mentir,
 * pero ya no depende de acordarse de dos cosas en dos sitios.
 *
 * Lo que NO se hace es darlas por hechas al pasar la hora: quien no viene y no
 * se anula dejaría el contador mintiendo, y un contador que miente es peor que
 * uno que va con retraso.
 *
 * `Client.cita` sigue existiendo y **es un espejo de la próxima**: la app de la
 * clienta lee ese campo desde siempre, así que se mantiene al día solo.
 */

/** Todo lo que se sabe de una cita para pintarla en la semana. */
export interface CitaEnAgenda {
  client: Client;
  cita: Cita;
  /** Con id seguro y estado resuelto, que es como se trabaja con ella. */
  id: string;
  cuando?: Date;
}

const ID_VIEJA = 'cita-vieja';

/**
 * Las citas de una clienta, con id y estado puestos. **Lo que había guardado
 * en `cita` cuenta como una más**: son las que tiene ahora mismo en la agenda
 * y desaparecerían el día del despliegue.
 */
export function citasDe(client: Pick<Client, 'cita' | 'citas'>): Cita[] {
  const lista = (client.citas ?? []).map((c) => ({
    ...c,
    id: c.id ?? `${c.fecha}-${c.hora ?? ''}`,
    estado: c.estado ?? ('prevista' as const),
  }));
  const vieja = client.cita;
  if (vieja && !lista.some((c) => c.fecha === vieja.fecha && c.hora === vieja.hora)) {
    lista.push({ ...vieja, id: vieja.id ?? ID_VIEJA, estado: vieja.estado ?? 'prevista' });
  }
  return lista.sort((a, b) => `${a.fecha}${a.hora ?? ''}`.localeCompare(`${b.fecha}${b.hora ?? ''}`));
}

/** La próxima que no ha pasado ni está anulada. Es la que ve la clienta. */
export function proximaCita(client: Pick<Client, 'cita' | 'citas'>, hoy = new Date()): Cita | undefined {
  const desde = iso(hoy);
  return citasDe(client).find((c) => c.estado !== 'anulada' && c.fecha >= desde);
}

/** YYYY-MM-DD de un Date, en hora local: `toISOString` se va un día en España. */
export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** El lunes de la semana en la que cae esa fecha. */
export function lunesDe(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(`${fecha}T12:00:00`) : new Date(fecha);
  /* getDay(): 0 es domingo, y aquí la semana empieza en lunes. */
  const desplazamiento = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desplazamiento);
  return iso(d);
}

/** Los siete días de esa semana, de lunes a domingo. */
export function diasDeLaSemana(lunes: string): string[] {
  const base = new Date(`${lunes}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return iso(d);
  });
}

/** Correr la semana adelante o atrás. */
export function otraSemana(lunes: string, semanas: number): string {
  const d = new Date(`${lunes}T12:00:00`);
  d.setDate(d.getDate() + semanas * 7);
  return iso(d);
}

/**
 * Las citas de un día, de todas las clientas y ordenadas por la hora. Las que
 * no llevan hora van al final: están ese día, pero no a una hora.
 */
export function citasDelDia(clients: Client[], fecha: string): CitaEnAgenda[] {
  const out: CitaEnAgenda[] = [];
  for (const client of clients) {
    for (const cita of citasDe(client)) {
      if (cita.fecha !== fecha) continue;
      out.push({ client, cita, id: cita.id!, cuando: momentoDeCita(cita) });
    }
  }
  return out.sort((a, b) => (a.cita.hora ?? '99:99').localeCompare(b.cita.hora ?? '99:99'));
}

/** Cuántas hay ese día sin contar las anuladas, que es lo que se enseña arriba. */
export function cuantasEseDia(clients: Client[], fecha: string): number {
  return citasDelDia(clients, fecha).filter((c) => c.cita.estado !== 'anulada').length;
}

// ── Escribir ────────────────────────────────────────────────────────

/**
 * Guardar una cita —nueva o cambiada— en la ficha. Devuelve el parche para
 * `updateClient`, con `cita` reescrita para que la clienta vea la próxima.
 */
export function conLaCita(client: Client, cita: Cita, hoy = new Date()): Partial<Client> {
  const id = cita.id ?? uid('ci_');
  const puesta = { ...cita, id };
  const resto = citasDe(client).filter((c) => c.id !== id);
  const citas = [...resto, puesta].sort((a, b) =>
    `${a.fecha}${a.hora ?? ''}`.localeCompare(`${b.fecha}${b.hora ?? ''}`),
  );
  return { citas, cita: proximaCita({ citas }, hoy) };
}

/** Quitarla del todo. Para «no se dio» está anular, que deja constancia. */
export function sinLaCita(client: Client, citaId: string, hoy = new Date()): Partial<Client> {
  const citas = citasDe(client).filter((c) => c.id !== citaId);
  return { citas, cita: proximaCita({ citas }, hoy) };
}

/**
 * QUÉ LÍNEA DEL BONO CONSUME ESTA CITA
 *
 * Una llamada gasta una llamada y una consulta gasta una consulta: el concepto
 * de la línea se mira por su nombre, que es como ella las escribe. Si no hay
 * ninguna que le cuadre, se coge la primera a la que le queden: más vale
 * descontar de donde sea y que ella lo corrija que no descontar de nada.
 */
function lineaQueTocaria(client: Client, cita: Cita, hoy: Date): { bonoId?: string; lineaId?: string } {
  const bono = bonoVigente(client, hoy);
  if (!bono || bono.bono.cerrado) return {};
  const lineas = comoVanLasSesiones(bono.bono, client.sesiones);
  const esLlamada = cita.modo === 'llamada';
  const porNombre = lineas.find((l) => {
    const n = l.linea.concepto.toLowerCase();
    return esLlamada ? n.includes('llamada') : !n.includes('llamada');
  });
  const conHueco = [porNombre, ...lineas].find((l) => l && l.quedan > 0);
  const elegida = conHueco ?? porNombre ?? lineas[0];
  return { bonoId: bono.bono.id, lineaId: elegida?.linea.id };
}

/**
 * MARCARLA COMO REALIZADA CONSUME LA SESIÓN
 *
 * Es el único gesto: se marca la cita y el bono se entera. La sesión se apunta
 * **con la fecha de la cita** y no con la de hoy, porque las citas del lunes se
 * marcan a veces el miércoles y el mes en que se dio la consulta es el que
 * manda en el trabajo hecho.
 *
 * Es idempotente: marcar dos veces no descuenta dos sesiones.
 */
export function marcarRealizada(client: Client, citaId: string, hoy = new Date()): Partial<Client> {
  const cita = citasDe(client).find((c) => c.id === citaId);
  if (!cita || cita.estado === 'realizada') return {};

  const { bonoId, lineaId } = lineaQueTocaria(client, cita, hoy);
  const sesion: Sesion = {
    id: uid('se_'),
    fecha: cita.fecha,
    bonoId,
    lineaId,
    /* Sin bono es una sesión suelta y lo que vale sale de su tarifa por sesión. */
    importe:
      !bonoId && client.tarifa?.periodicidad === 'sesion' ? client.tarifa.importe : undefined,
    modalidad: cita.modo === 'consulta' ? undefined : 'online',
  };

  const puesta: Cita = { ...cita, estado: 'realizada', bonoId, lineaId, sesionId: sesion.id };
  return {
    ...conLaCita(client, puesta, hoy),
    sesiones: [...(client.sesiones ?? []), sesion],
  };
}

/**
 * Deshacerlo: la cita vuelve a prevista y **se quita su sesión**, no la última
 * que haya — que podría ser de otro día apuntado a mano en la ficha.
 */
export function desmarcar(client: Client, citaId: string, hoy = new Date()): Partial<Client> {
  const cita = citasDe(client).find((c) => c.id === citaId);
  if (!cita) return {};
  const puesta: Cita = { ...cita, estado: 'prevista', sesionId: undefined };
  return {
    ...conLaCita(client, puesta, hoy),
    sesiones: (client.sesiones ?? []).filter((s) => s.id !== cita.sesionId),
  };
}

/**
 * No se dio. Se guarda anulada en vez de borrarla: un hueco vacío en la semana
 * no cuenta que alguien no vino, y eso en consulta se habla.
 */
export function anular(client: Client, citaId: string, hoy = new Date()): Partial<Client> {
  const cita = citasDe(client).find((c) => c.id === citaId);
  if (!cita) return {};
  /* Si estaba marcada como hecha, se le quita también la sesión. */
  const sinSesion = cita.sesionId
    ? (client.sesiones ?? []).filter((s) => s.id !== cita.sesionId)
    : client.sesiones;
  const puesta: Cita = { ...cita, estado: 'anulada', sesionId: undefined };
  return { ...conLaCita(client, puesta, hoy), sesiones: sinSesion };
}

/**
 * COBRAR DESDE LA PROPIA CITA
 *
 * El pago se cuelga del bono de la cita —o del vigente— para que el «faltan
 * 90 €» se entere solo. Apuntarlo en la ficha sigue funcionando igual: esto es
 * otra puerta al mismo sitio, no un sitio nuevo donde se escriben pagos.
 */
export function cobrarDeLaCita(
  client: Client,
  citaId: string,
  importe: number,
  extra: { metodo?: string; fecha?: string } = {},
  hoy = new Date(),
): Partial<Client> {
  const cita = citasDe(client).find((c) => c.id === citaId);
  if (!cita || !(importe > 0)) return {};
  const bonoId = cita.bonoId ?? bonoVigente(client, hoy)?.bono.id;
  const pago: Pago = {
    id: uid('pg_'),
    fecha: extra.fecha ?? cita.fecha,
    importe,
    metodo: extra.metodo,
    bonoId,
    concepto: 'Consulta',
  };
  return { pagos: [...(client.pagos ?? []), pago] };
}

/** Lo que propone cobrar la cita: lo que falta del bono, o su tarifa suelta. */
export function loQueTocaCobrar(client: Client, hoy = new Date()): number {
  const bono = bonoVigente(client, hoy);
  if (bono && !bono.bono.cerrado && bono.pendiente > 0) return bono.pendiente;
  if (client.tarifa?.periodicidad === 'sesion') return client.tarifa.importe;
  return 0;
}

// ── Lo que hay que recordarle ───────────────────────────────────────

/**
 * LAS QUE YA PASARON Y SIGUEN SIN MARCAR
 *
 * Es el olvido que esto viene a resolver: el jueves hubo quince citas y el
 * viernes ninguna está marcada, así que los bonos de quince personas van
 * atrasados. Se mira el día, no la hora: una cita de las seis de la tarde no
 * puede salir en rojo a las siete, que a esa hora aún se está trabajando.
 */
export function citasSinMarcar(clients: Client[], hoy = new Date()): CitaEnAgenda[] {
  const ayer = iso(new Date(hoy.getTime() - 86_400_000));
  const out: CitaEnAgenda[] = [];
  for (const client of clients) {
    for (const cita of citasDe(client)) {
      if (cita.fecha > ayer) continue;
      if (cita.estado !== 'prevista') continue;
      out.push({ client, cita, id: cita.id!, cuando: momentoDeCita(cita) });
    }
  }
  return out.sort((a, b) => b.cita.fecha.localeCompare(a.cita.fecha));
}

/**
 * QUIÉN SE HA IDO SIN LA SIGUIENTE PUESTA
 *
 * Sólo de quien tiene un bono con sesiones por gastar: quien lo terminó no es
 * que le falte la cita, es que toca renovar — y de eso ya avisa la lista de
 * clientas. Las participantes de un reto no llevan agenda.
 */
export function sinProximaCita(clients: Client[], hoy = new Date()): Client[] {
  return clients.filter((c) => {
    if (c.soloReto) return false;
    const bono = bonoVigente(c, hoy);
    if (!bono || bono.bono.cerrado || bono.estado === 'vencido') return false;
    if (bono.lineas.every((l) => l.quedan <= 0)) return false;
    return !proximaCita(c, hoy);
  });
}

/** Cómo va la semana de un vistazo. */
export interface ComoVaLaSemana {
  citas: number;
  realizadas: number;
  /** Las que ya pasaron y siguen sin marcar: el aviso de arriba. */
  sinMarcar: number;
}

export function comoVaLaSemana(
  clients: Client[],
  lunes: string,
  hoy = new Date(),
): ComoVaLaSemana {
  const ayer = iso(new Date(hoy.getTime() - 86_400_000));
  let citas = 0;
  let realizadas = 0;
  let sinMarcar = 0;
  for (const dia of diasDeLaSemana(lunes)) {
    for (const { cita } of citasDelDia(clients, dia)) {
      if (cita.estado === 'anulada') continue;
      citas += 1;
      if (cita.estado === 'realizada') realizadas += 1;
      else if (cita.fecha <= ayer) sinMarcar += 1;
    }
  }
  return { citas, realizadas, sinMarcar };
}
