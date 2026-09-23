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

// ── Las horas del día ───────────────────────────────────────────────

/**
 * DE MEDIA HORA EN MEDIA HORA
 *
 * Es el paso con el que ella agenda: las consultas duran 30, 45 o 60 minutos y
 * las llamadas 15, pero **ninguna empieza a y cuarto**. Con franjas de cuarto
 * de hora la semana se va a cincuenta filas y hay que buscar el hueco con la
 * lupa; una llamada de 15 minutos se pinta igual, ocupando media franja.
 */
export const PASO_MIN = 30;

/** Por defecto se enseña de ocho a nueve, que es la jornada de la consulta. */
const DESDE = 8 * 60;
const HASTA = 21 * 60;

export const enMinutos = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const comoHora = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Las franjas que se pintan esa semana. **Se estira para que quepa todo lo que
 * hay**: una cita a las siete de la mañana o una a las diez de la noche no
 * pueden quedarse fuera de la rejilla, que es donde se miran.
 */
export function franjasDeLaSemana(
  clients: Client[],
  dias: string[],
  /** Las 24 horas, para quien madruga o cierra tarde. */
  todoElDia = false,
): string[] {
  let desde = todoElDia ? 0 : DESDE;
  let hasta = todoElDia ? 24 * 60 : HASTA;
  for (const dia of dias) {
    for (const { cita } of citasDelDia(clients, dia)) {
      if (!cita.hora) continue;
      const empieza = enMinutos(cita.hora);
      const acaba = empieza + (cita.duracionMin ?? 60);
      desde = Math.min(desde, Math.floor(empieza / PASO_MIN) * PASO_MIN);
      hasta = Math.max(hasta, Math.ceil(acaba / PASO_MIN) * PASO_MIN);
    }
  }
  const out: string[] = [];
  for (let m = desde; m < hasta; m += PASO_MIN) out.push(comoHora(m));
  return out;
}

/**
 * CUÁNTO DURA CADA COSA, SIN TENER QUE PENSARLO
 *
 * Una llamada de seguimiento son quince minutos y una consulta media hora: son
 * los dos números que ella pone siempre, así que escribirlos en cada cita es
 * trabajo inventado. Se puede cambiar — hay primeras visitas de una hora.
 */
export function duracionPorDefecto(modo: Cita['modo']): number {
  return modo === 'llamada' ? 15 : 30;
}

/** Lo que cabe elegir sin escribir a mano. */
export const DURACIONES = [15, 30, 45, 60];

/** Si ese hueco está pillado: sirve para no ofrecerlo como libre. */
export function huecoOcupado(clients: Client[], fecha: string, hora: string): boolean {
  return seSolapanCon(clients, fecha, hora, PASO_MIN).length > 0;
}

/**
 * QUIÉN PISA ESE RATO
 *
 * Dos a la misma hora **se puede**: hay días de doblar y hay llamadas que se
 * meten encima de una consulta. Lo que no puede pasar es hacerlo sin enterarse,
 * así que se avisa con nombres y no se bloquea — quien agenda sabe lo que hace.
 */
export function seSolapanCon(
  clients: Client[],
  fecha: string,
  hora: string,
  duracion: number,
  /** La cita que se está moviendo: no se solapa consigo misma. */
  exceptoId?: string,
): CitaEnAgenda[] {
  if (!hora) return [];
  const desde = enMinutos(hora);
  const hasta = desde + (duracion || PASO_MIN);
  return citasDelDia(clients, fecha).filter(({ cita, id }) => {
    if (cita.estado === 'anulada' || !cita.hora || id === exceptoId) return false;
    const empieza = enMinutos(cita.hora);
    return empieza < hasta && empieza + (cita.duracionMin ?? 60) > desde;
  });
}

/**
 * CÓMO SE REPARTEN LAS QUE CAEN A LA VEZ
 *
 * Pintadas una encima de otra, la de abajo desaparece y parece que la agenda
 * se ha comido una cita. Se parten en columnas: las que se pisan entre sí se
 * reparten el ancho del día, y las que no vuelven a ocuparlo entero.
 */
export interface Carril {
  /** Qué columna ocupa, empezando en cero. */
  carril: number;
  /** Cuántas columnas hay en su grupo. */
  de: number;
}

export function carrilesDelDia(citas: CitaEnAgenda[]): Map<string, Carril> {
  const out = new Map<string, Carril>();
  const conHora = citas.filter((x) => x.cita.hora);
  const fin = (x: CitaEnAgenda) => enMinutos(x.cita.hora!) + (x.cita.duracionMin ?? 60);

  let grupo: CitaEnAgenda[] = [];
  let hastaDondeLlega = -1;

  const cerrarGrupo = () => {
    /* Dentro de un grupo, cada una entra en el primer carril que tenga libre. */
    const carriles: number[] = [];
    const puestas: { x: CitaEnAgenda; carril: number }[] = [];
    for (const x of grupo) {
      const empieza = enMinutos(x.cita.hora!);
      let i = carriles.findIndex((libreDesde) => libreDesde <= empieza);
      if (i === -1) i = carriles.length;
      carriles[i] = fin(x);
      puestas.push({ x, carril: i });
    }
    for (const { x, carril } of puestas) {
      out.set(x.id, { carril, de: carriles.length });
    }
  };

  for (const x of conHora) {
    const empieza = enMinutos(x.cita.hora!);
    if (grupo.length && empieza >= hastaDondeLlega) {
      cerrarGrupo();
      grupo = [];
    }
    grupo.push(x);
    hastaDondeLlega = Math.max(hastaDondeLlega, fin(x));
  }
  if (grupo.length) cerrarGrupo();

  /* Las que no llevan hora no compiten por sitio: van a lo ancho. */
  for (const x of citas) if (!out.has(x.id)) out.set(x.id, { carril: 0, de: 1 });
  return out;
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
