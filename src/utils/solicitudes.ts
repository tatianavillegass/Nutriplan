import { hayNube, nube } from "./supabase";
import type { Solicitud } from "../types/solicitud";
import type { Reto } from "../types/reto";

/**
 * EL ENLACE PÚBLICO DEL RETO
 *
 * Aquí entra gente sin cuenta, así que hay dos cosas que salen de la app
 * normal:
 *
 *   · `retos_publicos` — sólo el nombre, la fecha y los días. Lo mínimo para
 *     que la página pueda decir «UPGRADE 1.0, empieza el 1 de septiembre» sin
 *     enseñar participantes, recetas ni nada de nadie.
 *
 *   · `solicitudes` — donde cae lo que rellenan. Se puede escribir sin cuenta
 *     pero NO leer: quien se apunta no puede ver quién más se ha apuntado.
 *
 * Las dos reglas viven en la base de datos (`supabase/esquema.sql`), no aquí.
 * Que la app haga lo correcto no es garantía de nada.
 */

export interface RetoPublico {
  id: string;
  nombre: string;
  descripcion?: string;
  fechaInicio: string;
  dias: number;
}

/** Los datos que se publican de un reto: ni uno más. */
export function aRetoPublico(reto: Reto, nutriId: string) {
  return {
    id: reto.id,
    nutri_id: nutriId,
    nombre: reto.nombre,
    descripcion: reto.descripcion ?? null,
    fecha_inicio: reto.fechaInicio,
    dias: reto.dias,
  };
}

/**
 * Se publican al guardar, con el resto. Si la tabla todavía no existe no pasa
 * nada: el enlace público no funcionará, pero la app sí.
 */
export async function publicarRetos(
  nutriId: string,
  retos: Reto[],
): Promise<void> {
  if (!hayNube || !retos.length) return;
  const { error } = await nube()
    .from("retos_publicos")
    .upsert(
      retos.map((r) => aRetoPublico(r, nutriId)),
      { onConflict: "id" },
    );
  if (error) console.warn("[retos] no se pudieron publicar", error.message);
}

/** Lo que lee la página de apuntarse. Sin sesión. */
export async function leerRetoPublico(
  retoId: string,
): Promise<RetoPublico | undefined> {
  if (!hayNube) return undefined;
  const { data, error } = await nube()
    .from("retos_publicos")
    .select("id, nombre, descripcion, fecha_inicio, dias")
    .eq("id", retoId)
    .maybeSingle();

  if (error || !data) return undefined;
  return {
    id: data.id as string,
    nombre: data.nombre as string,
    descripcion: (data.descripcion as string) ?? undefined,
    fechaInicio: data.fecha_inicio as string,
    dias: data.dias as number,
  };
}

/**
 * Guardar lo que ha rellenado. Devuelve si se pudo: si falla hay que decírselo
 * a la persona, no tragárselo — acaba de pagar.
 */
export async function enviarSolicitud(
  s: Solicitud,
): Promise<{ ok: boolean; error?: string }> {
  if (!hayNube)
    return { ok: false, error: "La aplicación no está conectada al servidor." };

  const { error } = await nube().from("solicitudes").insert({
    id: s.id,
    reto_id: s.retoId,
    email: s.email.trim().toLowerCase(),
    datos: s,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Las que están sin dar de alta. Sólo las ve la nutricionista. */
export async function leerSolicitudes(): Promise<Solicitud[]> {
  if (!hayNube) return [];
  const { data, error } = await nube()
    .from("solicitudes")
    .select("datos")
    .order("creada", { ascending: false });

  if (error) {
    console.warn("[solicitudes] no se pudieron leer", error.message);
    return [];
  }
  return (data ?? []).map((f) => (f as { datos: Solicitud }).datos);
}

/** Al dar de alta se borra: ya es una clienta, no una solicitud. */
export async function borrarSolicitud(id: string): Promise<void> {
  if (!hayNube) return;
  const { error } = await nube().from("solicitudes").delete().eq("id", id);
  if (error) console.warn("[solicitudes] no se pudo borrar", error.message);
}
