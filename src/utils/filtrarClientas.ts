import { estadoAcceso, type Client } from "../types/client";
import { tocaRenovar } from "./bonos";

/**
 * ENCONTRAR A UNA CLIENTA
 *
 * La lista se pintaba entera y en el orden en que se dieron de alta. Con diez
 * cabe en la pantalla; con cuarenta hay que ir leyendo nombre a nombre, y las
 * que ya no vienen ocupan el mismo sitio que las de esta semana.
 *
 * Tres filtros, que son las tres preguntas que ella se hace de verdad:
 *
 *   · «¿dónde está Fulanita?»           → el buscador
 *   · «¿a quién le caduca el acceso?»    → por estado
 *   · «¿a quién le falta mandarle algo?» → sin enviar
 *
 * **No se filtra por peso ni por objetivo a propósito.** Ordenar a las
 * clientas por lo que pesan es hacer un ranking de cuerpos, y eso es lo mismo
 * que ya se rechazó en el reto: aquí se busca a una persona, no se comparan
 * medidas.
 */

export type FiltroAcceso = "todas" | "activo" | "termina_pronto" | "caducado";

export type Orden = "alta" | "nombre";

export interface Filtro {
  /** Lo que ella escribe: busca en el nombre y en el correo. */
  texto: string;
  acceso: FiltroAcceso;
  /** Sólo las que tienen cambios en el plan sin mandar. */
  soloSinEnviar: boolean;
  /** Sólo aquellas a las que se les acaba —o se les acabó— el bono. */
  soloRenovar: boolean;
  orden: Orden;
}

export const FILTRO_VACIO: Filtro = {
  texto: "",
  acceso: "todas",
  soloSinEnviar: false,
  soloRenovar: false,
  orden: "alta",
};

/** Si no hay nada puesto, no se enseña el «quitar filtros». */
export function hayFiltro(f: Filtro): boolean {
  return (
    f.texto.trim() !== "" ||
    f.acceso !== "todas" ||
    f.soloSinEnviar ||
    f.soloRenovar ||
    f.orden !== "alta"
  );
}

/**
 * Sin tildes y en minúsculas: quien escribe deprisa pone «maria» y su clienta
 * se llama María. Que el buscador no encuentre por eso sería absurdo.
 */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function filtrarClientas(
  clientes: Client[],
  filtro: Filtro,
  /** Si esa clienta tiene el plan tocado y sin mandar. Lo sabe la pantalla. */
  sinEnviar: (c: Client) => boolean = () => false,
  hoy?: Date,
): Client[] {
  const busca = normalizar(filtro.texto.trim());

  const filtradas = clientes.filter((c) => {
    if (busca) {
      const donde = normalizar(`${c.nombre} ${c.email ?? ""}`);
      if (!donde.includes(busca)) return false;
    }
    if (filtro.acceso !== "todas") {
      if (estadoAcceso(c, hoy).estado !== filtro.acceso) return false;
    }
    if (filtro.soloSinEnviar && !sinEnviar(c)) return false;
    if (filtro.soloRenovar && !tocaRenovar(c, hoy)) return false;
    return true;
  });

  /*
   * Por defecto, las últimas en llegar arriba: a quien acabas de dar de alta
   * es a quien vas a abrir ahora. Por nombre es para cuando buscas a alguien
   * concreto y no recuerdas cuándo entró.
   */
  return [...filtradas].sort((a, b) =>
    filtro.orden === "nombre"
      ? a.nombre.localeCompare(b.nombre, "es")
      : (b.fechaAlta ?? "").localeCompare(a.fechaAlta ?? ""),
  );
}
