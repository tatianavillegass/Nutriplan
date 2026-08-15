import type { Bocado, ComidaGuardada, RegistroDia } from '../types/diary';
import type { Alimento } from '../types/food';
import { diaAnterior } from './racha';
import { uid, nowIso } from './storage';

/**
 * REPETIR LO DE SIEMPRE
 *
 * Mucha gente desayuna lo mismo todos los días. Volver a apuntar cinco
 * alimentos con sus gramos cada mañana es el trabajo que hace que la gente
 * abandone los contadores, y no enseña nada: ya sabe lo que desayuna.
 *
 * Dos atajos, los dos por comida:
 *
 *  · **Repetir**: trae lo que apuntó la última vez en esa comida. No hace
 *    falta que sea ayer —quien salta un día no pierde el atajo— pero se dice
 *    de qué día viene, que si no parece que la app se lo inventa.
 *  · **Mis comidas**: las que ella ha guardado con nombre.
 *
 * Entra tal cual y luego retoca: quitar una línea o cambiar unos gramos es un
 * toque, y el caso normal —comer lo mismo— no cuesta ninguno.
 */

export interface UltimaVez {
  fecha: string;
  bocados: Bocado[];
  porciones: Record<string, number>;
  /** Los alimentos que ella se calculó ese día y que hacen falta hoy. */
  alimentos: Alimento[];
}

/** Los alimentos propios de un registro que usan esos ids. */
function alimentosUsados(registro: RegistroDia, ids: string[]): Alimento[] {
  const quiero = new Set(ids);
  return (registro.alimentosPropios ?? []).filter((a) => quiero.has(a.id));
}

/**
 * La última vez que apuntó algo en esa comida, mirando hacia atrás desde hoy.
 * Hoy no cuenta: repetir lo que acabas de apuntar sería duplicarlo.
 */
export function ultimaVezQueComio(
  registros: RegistroDia[],
  hoy: string,
  mealId: string,
): UltimaVez | undefined {
  const anteriores = registros
    .filter((r) => r.fecha < hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  for (const r of anteriores) {
    const bocados = (r.bocados ?? []).filter((b) => b.momento === mealId);
    const porciones = Object.fromEntries(
      Object.entries(r.porciones?.[mealId] ?? {}).filter(([, n]) => (n ?? 0) > 0),
    );

    if (!bocados.length && !Object.keys(porciones).length) continue;

    const ids = [
      ...bocados.map((b) => b.foodId).filter(Boolean),
      ...Object.keys(porciones),
    ] as string[];

    return { fecha: r.fecha, bocados, porciones, alimentos: alimentosUsados(r, ids) };
  }
  return undefined;
}

/** «de ayer», «del 12 de agosto»: de dónde viene lo que se va a copiar. */
export function deCuandoEs(fecha: string, hoy: string): string {
  if (fecha === diaAnterior(hoy)) return 'de ayer';
  const d = new Date(`${fecha}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? `del ${fecha}`
    : `del ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
}

/**
 * Copia unos bocados a la comida de hoy. Ids nuevos: si se reutilizaran, quitar
 * el de hoy borraría también el de aquel día.
 */
export function copiarBocados(bocados: Bocado[], mealId: string): Bocado[] {
  const hora = new Date().toISOString().slice(11, 16);
  return bocados.map((b) => ({ ...b, id: uid('bo_'), momento: mealId, hora }));
}

/** Guardar lo que hay hoy en esa comida como comida habitual. */
export function comidaGuardadaDe(
  nombre: string,
  mealId: string,
  contenido: { bocados?: Bocado[]; porciones?: Record<string, number> },
  alimentosPropios: Alimento[] = [],
): ComidaGuardada {
  const ids = [
    ...(contenido.bocados ?? []).map((b) => b.foodId).filter(Boolean),
    ...Object.keys(contenido.porciones ?? {}),
  ] as string[];
  const quiero = new Set(ids);

  return {
    id: uid('cg_'),
    nombre: nombre.trim(),
    mealId,
    bocados: contenido.bocados?.length ? contenido.bocados : undefined,
    porciones: Object.keys(contenido.porciones ?? {}).length ? contenido.porciones : undefined,
    alimentos: alimentosPropios.filter((a) => quiero.has(a.id)),
    creada: nowIso(),
  };
}

/**
 * Todas sus comidas guardadas, juntando sus días. Las borradas no salen: como
 * el día en que se creó una no se puede reescribir desde hoy, borrar se apunta
 * en el día de hoy y aquí se descuenta.
 */
export function misComidas(registros: RegistroDia[], mealId?: string): ComidaGuardada[] {
  const borradas = new Set(registros.flatMap((r) => r.comidasBorradas ?? []));
  const porId = new Map<string, ComidaGuardada>();

  for (const r of registros) {
    for (const c of r.comidasGuardadas ?? []) {
      if (borradas.has(c.id)) continue;
      porId.set(c.id, c);
    }
  }

  return [...porId.values()]
    .filter((c) => !mealId || c.mealId === mealId)
    .sort((a, b) => b.creada.localeCompare(a.creada));
}

/** Los alimentos propios que hay que arrastrar al día de hoy para que cuadre. */
export function alimentosQueFaltan(
  traidos: Alimento[] | undefined,
  yaEstan: Alimento[],
): Alimento[] {
  const tengo = new Set(yaEstan.map((a) => a.id));
  return (traidos ?? []).filter((a) => !tengo.has(a.id));
}
