import { hayNube, nube } from './supabase';

/**
 * EL MURO DEL RETO
 *
 * Lo que hace grupo no es un muro de publicaciones. Si cinco publican y quince
 * miran, las quince se sienten MENOS del grupo, no más. Lo que acompaña de
 * verdad es ver que las demás también han aparecido hoy.
 *
 * Por eso aquí viaja lo mínimo: quién, qué día y si lo cerró. Nada de lo que
 * una escribe en su registro —lo que come, su peso, sus notas— sale de su
 * registro. Con estas tres cosas se pinta «hoy han cerrado Marta, Ana y Lucía»
 * y la meta común, que es todo lo que hace falta para no sentirse sola.
 */

export interface SenalDelMuro {
  clienteId: string;
  nombre: string;
  fecha: string;
  cerrado: boolean;
}

interface Fila {
  cliente_id: string;
  nombre: string;
  fecha: string;
  cerrado: boolean;
}

/**
 * Deja constancia de su día. Se escribe aunque el día no esté cerrado: así
 * quien todavía no ha cerrado ninguno tiene fila propia y puede leer el muro
 * —la regla del servidor pide estar en él para verlo—.
 */
export async function apuntarEnElMuro(s: {
  retoId: string;
  clienteId: string;
  nombre: string;
  fecha: string;
  cerrado: boolean;
}): Promise<void> {
  if (!hayNube) return;
  await nube()
    .from('muro')
    .upsert(
      {
        reto_id: s.retoId,
        cliente_id: s.clienteId,
        nombre: s.nombre,
        fecha: s.fecha,
        cerrado: s.cerrado,
        actualizado: new Date().toISOString(),
      },
      { onConflict: 'reto_id,cliente_id,fecha' },
    );
}

/** Lo que ha pasado en el muro desde una fecha. */
export async function leerMuro(retoId: string, desde: string): Promise<SenalDelMuro[]> {
  if (!hayNube) return [];
  const { data, error } = await nube()
    .from('muro')
    .select('cliente_id, nombre, fecha, cerrado')
    .eq('reto_id', retoId)
    .gte('fecha', desde);

  if (error) return [];
  return ((data ?? []) as Fila[]).map((f) => ({
    clienteId: f.cliente_id,
    nombre: f.nombre,
    fecha: f.fecha,
    cerrado: f.cerrado,
  }));
}

export interface ComoVaElGrupo {
  /** Nombres de pila de quienes han cerrado hoy. */
  hoy: string[];
  /** Cuánta gente hay en el muro. */
  cuantas: number;
  /** Días cerrados por todas, sumados. */
  cerrados: number;
  /** Los que se podrían haber cerrado: gente × días transcurridos. */
  posibles: number;
}

/**
 * LA META ES DE TODAS
 *
 * Se suman los días cerrados del grupo entero contra los que se podían cerrar.
 * Se gana o se pierde en equipo: la que va floja no queda última, queda
 * arropada. Un ranking haría lo contrario, y en un grupo siempre hay alguien
 * en el último puesto.
 */
export function comoVaElGrupo(
  senales: SenalDelMuro[],
  hoy: string,
  dia: number,
): ComoVaElGrupo {
  const gente = new Set(senales.map((s) => s.clienteId));
  const deHoy = senales.filter((s) => s.fecha === hoy && s.cerrado);

  /** Un nombre por persona, y sin apellidos: es un muro, no una lista. */
  const nombres = [...new Set(deHoy.map((s) => s.nombre.split(' ')[0]))].sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    hoy: nombres,
    cuantas: gente.size,
    cerrados: senales.filter((s) => s.cerrado).length,
    posibles: gente.size * Math.max(1, dia),
  };
}

/** «Marta, Ana y Lucía», como se dice en voz alta. */
export function enumerar(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}
