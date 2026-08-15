import type { DayType } from "../types/plan";
import { comidasConPauta } from "../types/plan";
import type { RegistroDia } from "../types/diary";

/**
 * LA RACHA
 *
 * Cuántos días seguidos ha cerrado la clienta. Un día está cerrado cuando
 * todas sus comidas están marcadas — **hechas o libres, las dos valen**.
 *
 * Comer fuera no rompe la racha, y eso es a propósito: si una cena con amigas
 * te tira por tierra veinte días, la aplicación está enseñando que salir a
 * cenar es un fallo. Lo que premia la racha es aparecer y marcar, que es el
 * hábito que sostiene el plan.
 *
 * Un día sin nada marcado sí la corta. No hay forma honesta de contarlo: no
 * sabemos si comió y no lo apuntó o si no comió, y darlo por bueno haría que
 * el número dejara de significar nada.
 */

/** Un día está cerrado si no le queda ninguna comida sin marcar. */
export function diaCerrado(
  registro: RegistroDia | undefined,
  dayType: DayType | undefined,
): boolean {
  if (!registro || !dayType) return false;

  const comidas = comidasConPauta(dayType);
  if (!comidas.length) return false;

  const cumplidas = new Set(registro.cumplidas ?? []);
  const libres = registro.libres ?? {};
  return comidas.every((m) => cumplidas.has(m.id) || !!libres[m.id]);
}

/** El día anterior a una fecha ISO (YYYY-MM-DD), sin líos de zona horaria. */
export function diaAnterior(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() - 1);
  return fecha.toISOString().slice(0, 10);
}

export interface Racha {
  /** Días seguidos cerrados hasta hoy. */
  actual: number;
  /** La mejor que ha tenido, para poder decir «tu récord son 12». */
  mejor: number;
  /** Si hoy ya está cerrado: cambia el texto de «llevas» a «vas por». */
  hoyCerrado: boolean;
}

/**
 * Se cuenta hacia atrás desde hoy.
 *
 * Si hoy todavía no está cerrado no se rompe nada: son las once de la mañana y
 * queda el día entero por delante. Se empieza a contar desde ayer y el día de
 * hoy se suma en cuanto se cierre.
 */
export function calcularRacha(
  registros: RegistroDia[],
  dayTypes: DayType[],
  hoy: string,
): Racha {
  const porFecha = new Map(registros.map((r) => [r.fecha, r]));
  const tipoDe = (r: RegistroDia | undefined) =>
    dayTypes.find((d) => d.id === r?.dayTypeId) ?? dayTypes[0];

  const cerrado = (fecha: string) => {
    const r = porFecha.get(fecha);
    return diaCerrado(r, tipoDe(r));
  };

  const hoyCerrado = cerrado(hoy);

  let actual = 0;
  let dia = hoyCerrado ? hoy : diaAnterior(hoy);
  while (cerrado(dia)) {
    actual += 1;
    dia = diaAnterior(dia);
  }

  // La mejor: se recorren las fechas que tienen registro, en orden.
  const fechas = [...porFecha.keys()].sort();
  let mejor = 0;
  let seguidos = 0;
  let anterior: string | undefined;
  for (const f of fechas) {
    if (!cerrado(f)) {
      seguidos = 0;
      anterior = f;
      continue;
    }
    seguidos = anterior && diaAnterior(f) === anterior ? seguidos + 1 : 1;
    mejor = Math.max(mejor, seguidos);
    anterior = f;
  }

  return { actual, mejor: Math.max(mejor, actual), hoyCerrado };
}

/**
 * COMER FUERA: LA FRECUENCIA, NO LA CULPA
 *
 * El dato que sirve en consulta es cuántas veces al mes, no cuántas calorías
 * tenía la hamburguesa. Se devuelve el número y el detalle por si se quiere
 * pintar un círculo por comida.
 */
export interface Libres {
  total: number;
  /** Una entrada por comida libre, de la más reciente a la más antigua. */
  detalle: { fecha: string; mealId: string; nota?: string }[];
}

export function libresDesde(registros: RegistroDia[], desde: string): Libres {
  const detalle: Libres["detalle"] = [];
  for (const r of registros) {
    if (r.fecha < desde) continue;
    for (const [mealId, libre] of Object.entries(r.libres ?? {})) {
      detalle.push({ fecha: r.fecha, mealId, nota: libre?.nota });
    }
  }
  detalle.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { total: detalle.length, detalle };
}

/** El primer día del mes de una fecha ISO. */
export function inicioDeMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * LAS METAS HACEN RACHA APARTE
 *
 * Un día de poca agua no puede tirar por tierra veinte días de comer bien, ni
 * al revés. Son dos costumbres distintas y juntarlas en un solo número sólo
 * sirve para castigar dos veces por el mismo día flojo.
 *
 * El día de metas está cerrado cuando están marcadas TODAS las activas. Con
 * media docena de metas eso sería imposible, así que la nutricionista pone
 * dos o tres: la lista corta es parte del diseño.
 */
export function diaDeMetasCerrado(
  registro: RegistroDia | undefined,
  metasActivas: { id: string }[],
): boolean {
  if (!metasActivas.length) return false;
  const hechas = new Set(registro?.metas ?? []);
  return metasActivas.every((m) => hechas.has(m.id));
}

export function calcularRachaMetas(
  registros: RegistroDia[],
  metasActivas: { id: string }[],
  hoy: string,
): Racha {
  const porFecha = new Map(registros.map((r) => [r.fecha, r]));
  const cerrado = (fecha: string) => diaDeMetasCerrado(porFecha.get(fecha), metasActivas);

  const hoyCerrado = cerrado(hoy);
  let actual = 0;
  let dia = hoyCerrado ? hoy : diaAnterior(hoy);
  while (cerrado(dia)) {
    actual += 1;
    dia = diaAnterior(dia);
  }

  let mejor = 0;
  let seguidos = 0;
  let anterior: string | undefined;
  for (const f of [...porFecha.keys()].sort()) {
    if (!cerrado(f)) {
      seguidos = 0;
      anterior = f;
      continue;
    }
    seguidos = anterior && diaAnterior(f) === anterior ? seguidos + 1 : 1;
    mejor = Math.max(mejor, seguidos);
    anterior = f;
  }

  return { actual, mejor: Math.max(mejor, actual), hoyCerrado };
}

/**
 * LOS DÍAS DEL MES, UNO A UNO
 *
 * Para pintarlos en círculos: uno por día, hasta hoy. El futuro no se pinta —
 * un mes lleno de huecos por delante se lee como deuda, y no lo es.
 */
export interface DiaDelMes {
  fecha: string;
  cerrado: boolean;
}

export function diasDelMes(
  registros: RegistroDia[],
  hoy: string,
  cerrado: (registro: RegistroDia | undefined) => boolean,
): DiaDelMes[] {
  const porFecha = new Map(registros.map((r) => [r.fecha, r]));
  const ultimo = Number(hoy.slice(8, 10));
  const out: DiaDelMes[] = [];
  for (let d = 1; d <= ultimo; d++) {
    const fecha = `${hoy.slice(0, 7)}-${String(d).padStart(2, '0')}`;
    out.push({ fecha, cerrado: cerrado(porFecha.get(fecha)) });
  }
  return out;
}
