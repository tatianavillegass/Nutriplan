import type { MenuSemana, RegistroDia } from '../types/diary';
import type { MenuPropuesto } from '../types/plan';

/**
 * ORGANIZA TU SEMANA
 *
 * En fase 1 y 2 la clienta elige cada día entre las recetas que le pusieron.
 * Eso está bien para comer, pero es imposible hacer la compra: no se sabe qué
 * va a comer el jueves hasta el jueves. Y sin saberlo no hay lista de la
 * compra, ni batch cooking, ni manera de cocinar una vez para tres días.
 *
 * El menú de la semana es un dato pequeño: qué receta va en qué comida y en
 * qué día. De ahí sale todo lo demás.
 *
 * ES UNA PROPUESTA, NO UN CONTRATO
 * ================================
 * Si el martes no le apetece lo que puso, cambia la receta ese día y no pasa
 * nada: ni aviso, ni «has incumplido tu menú». Un menú que riñe se convierte en
 * una jaula y se deja de abrir a las dos semanas.
 *
 * DÓNDE VIVE
 * ==========
 * En el registro del lunes de esa semana, como las comidas guardadas: el
 * registro es lo único que sube el cliente, así que meterlo en su ficha
 * significaría que la nutricionista se lo pisa al guardar cualquier otra cosa.
 */

/** El lunes de la semana de esa fecha, en ISO y sin líos de zona horaria. */
export function lunesDe(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  // getUTCDay: 0 es domingo, así que el domingo cuenta como fin de esa semana.
  const dia = fecha.getUTCDay();
  const atras = dia === 0 ? 6 : dia - 1;
  fecha.setUTCDate(fecha.getUTCDate() - atras);
  return fecha.toISOString().slice(0, 10);
}

/** Los siete días de esa semana, de lunes a domingo. */
export function diasDeLaSemana(lunes: string): string[] {
  const [a, m, d] = lunes.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(Date.UTC(a, m - 1, d));
    fecha.setUTCDate(fecha.getUTCDate() + i);
    return fecha.toISOString().slice(0, 10);
  });
}

const NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** «Miércoles», para poder hablarle de días y no de fechas. */
export function nombreDelDia(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return NOMBRES[dia === 0 ? 6 : dia - 1];
}

/** El menú de esa semana, leído del registro del lunes. */
export function menuDeLaSemana(
  registros: RegistroDia[],
  fecha: string,
): MenuSemana | undefined {
  const lunes = lunesDe(fecha);
  return registros.find((r) => r.fecha === lunes)?.menuSemana;
}

/**
 * Lo que tenía planeado comer ese día, por comida.
 *
 * Las comidas en blanco no cuentan: son las que quitó a propósito de lo que le
 * habían repartido. Ver `menuEfectivo`.
 */
export function menuDelDia(
  menu: MenuSemana | undefined,
  fecha: string,
): Record<string, string> {
  const comidas = menu?.dias?.[fecha]?.comidas ?? {};
  const out: Record<string, string> = {};
  for (const [mealId, recetaId] of Object.entries(comidas)) {
    if (recetaId) out[mealId] = recetaId;
  }
  return out;
}

/**
 * Qué tipo de día toca según la semana. Sirve para escalar las recetas y para
 * dejar preseleccionado el tipo de día al abrir la app, que es la mitad de la
 * gracia: quien entrena los lunes lo dice una vez.
 */
export function tipoDeDiaPlaneado(
  menu: MenuSemana | undefined,
  fecha: string,
): string | undefined {
  return menu?.dias?.[fecha]?.dayTypeId;
}

/**
 * Pone una receta en una comida, en los días marcados, y la quita de los que se
 * desmarcaron. Se trabaja así porque es como se piensa: «pan con huevo, lunes,
 * miércoles y viernes», no día por día.
 *
 * AL TOCAR UNA COMIDA, ESA COMIDA PASA A SER SUYA
 * ===============================================
 * Se escriben los siete días de esa comida, también los que se quedan vacíos.
 * Hace falta por lo que le haya repartido su nutricionista: si quitar un plato
 * sólo borrara la línea, la propuesta volvería a asomar por debajo y el plato
 * reaparecería al recargar. Las demás comidas de la semana siguen siguiendo la
 * propuesta — cambiar la cena del martes no tira por tierra el resto.
 *
 * `efectivo` es lo que se está viendo en pantalla (propuesta y cambios ya
 * mezclados); `menu` es lo suyo, que es donde se escribe.
 */
export function ponerEnDias(
  menu: MenuSemana,
  mealId: string,
  recetaId: string,
  dias: string[],
  efectivo?: MenuSemana,
): MenuSemana {
  const marcados = new Set(dias);
  const out: MenuSemana = { ...menu, dias: { ...menu.dias } };
  const visible = efectivo ?? menu;

  for (const fecha of diasDeLaSemana(menu.inicio)) {
    const dia = out.dias[fecha] ?? { comidas: {} };
    const comidas = { ...dia.comidas };
    const ahora = visible.dias?.[fecha]?.comidas?.[mealId];

    if (marcados.has(fecha)) comidas[mealId] = recetaId;
    // Sólo se quita lo suyo: si ese día tenía otra receta en esa comida, se
    // queda. Desmarcar el martes no puede borrar lo que puso el martes.
    else if (ahora === recetaId) comidas[mealId] = '';
    else if (ahora) comidas[mealId] = ahora;

    out.dias[fecha] = { ...dia, comidas };
  }
  return out;
}

/** Qué días tiene puesta esa receta en esa comida. */
export function diasConReceta(
  menu: MenuSemana | undefined,
  mealId: string,
  recetaId: string,
): string[] {
  if (!menu) return [];
  return diasDeLaSemana(menu.inicio).filter(
    (fecha) => menu.dias?.[fecha]?.comidas?.[mealId] === recetaId,
  );
}

/** Marca (o desmarca) un día como de otro tipo: entreno, descanso… */
export function ponerTipoDeDia(
  menu: MenuSemana,
  fecha: string,
  dayTypeId: string | undefined,
): MenuSemana {
  const dia = menu.dias?.[fecha] ?? { comidas: {} };
  return { ...menu, dias: { ...menu.dias, [fecha]: { ...dia, dayTypeId } } };
}

export function menuVacio(fecha: string): MenuSemana {
  return { inicio: lunesDe(fecha), dias: {} };
}

/** Cuántas comidas de la semana tiene ya decididas, para saber si va llena. */
export function comidasPuestas(menu: MenuSemana | undefined): number {
  if (!menu) return 0;
  return diasDeLaSemana(menu.inicio).reduce(
    (s, fecha) => s + Object.keys(menuDelDia(menu, fecha)).length,
    0,
  );
}

// ─────────────────────────────────────── La semana que le repartió ella

/** Cuántas semanas enteras van del lunes A al lunes B. */
function semanasEntre(desde: string, hasta: string): number {
  const dia = 86400000;
  const a = Date.parse(`${lunesDe(desde)}T00:00:00Z`);
  const b = Date.parse(`${lunesDe(hasta)}T00:00:00Z`);
  return Math.round((b - a) / (7 * dia));
}

/**
 * Cuál de las dos semanas del ciclo toca. Con una sola semana siempre es la
 * misma; con dos van alternando, que es lo que evita comer lo mismo cada siete
 * días. Antes de la fecha de inicio también funciona: el resto en negativo se
 * endereza para que no se salte ninguna.
 */
export function semanaDelCiclo(propuesto: MenuPropuesto, lunes: string): number {
  const n = propuesto.semanas.length;
  if (n <= 1) return 0;
  return ((semanasEntre(propuesto.desde, lunes) % n) + n) % n;
}

/**
 * LA PROPUESTA POR DEBAJO, LO SUYO POR ENCIMA
 *
 * Devuelve el menú de esa semana tal y como hay que enseñarlo y tal y como
 * tiene que salir en la lista de la compra y en el batch cooking: se parte de
 * lo que le repartió la nutricionista y se le pone encima todo lo que ella haya
 * cambiado.
 *
 * Comida a comida, no semana a semana: cambiar la cena del martes no tira por
 * tierra el resto del reparto.
 *
 * Una comida que ella dejó **en blanco** es una comida que quitó a propósito, y
 * gana igual: si no, quitar un plato lo haría reaparecer al recargar.
 *
 * No se copia nada a su registro. Copiándolo, un cambio de la nutricionista no
 * le llegaría nunca y lo que ella ya hubiera tocado se perdería al volver a
 * repartir.
 */
export function menuEfectivo(
  propuesto: MenuPropuesto | undefined,
  suyo: MenuSemana | undefined,
  fecha: string,
): MenuSemana | undefined {
  const lunes = lunesDe(fecha);
  if (!propuesto?.semanas?.length) return suyo;

  const semana = propuesto.semanas[semanaDelCiclo(propuesto, lunes)];
  const out: MenuSemana = { ...(suyo ?? menuVacio(lunes)), inicio: lunes, dias: {} };

  diasDeLaSemana(lunes).forEach((f, i) => {
    const propuesta = semana?.dias?.[i];
    const cambiado = suyo?.dias?.[f];
    if (!propuesta && !cambiado) return;
    out.dias[f] = {
      comidas: { ...(propuesta?.comidas ?? {}), ...(cambiado?.comidas ?? {}) },
      dayTypeId: cambiado?.dayTypeId ?? propuesta?.dayTypeId,
    };
  });

  return out;
}

/**
 * Si esa comida de ese día viene de lo que le repartió su nutricionista. Sirve
 * para decírselo —«te lo ha puesto Tatiana»— sin que suene a obligación.
 */
export function vieneDeLaPropuesta(
  propuesto: MenuPropuesto | undefined,
  suyo: MenuSemana | undefined,
  fecha: string,
  mealId: string,
): boolean {
  if (!propuesto?.semanas?.length) return false;
  if (suyo?.dias?.[fecha]?.comidas?.[mealId] !== undefined) return false;
  const lunes = lunesDe(fecha);
  const i = diasDeLaSemana(lunes).indexOf(fecha);
  const semana = propuesto.semanas[semanaDelCiclo(propuesto, lunes)];
  return !!semana?.dias?.[i]?.comidas?.[mealId];
}

/** Tachar (o destachar) una línea de la lista de la compra. */
export function alternarComprado(menu: MenuSemana, clave: string): MenuSemana {
  const ya = menu.comprados ?? [];
  return {
    ...menu,
    comprados: ya.includes(clave) ? ya.filter((c) => c !== clave) : [...ya, clave],
  };
}

/**
 * Al cambiar el menú, lo tachado de lo que ya no está sobra. Si no, quitar una
 * receta y volver a ponerla dejaba su pollo tachado sin haberlo comprado.
 */
export function limpiarComprados(menu: MenuSemana, claves: string[]): MenuSemana {
  const vivas = new Set(claves);
  const comprados = (menu.comprados ?? []).filter((c) => vivas.has(c));
  return comprados.length === (menu.comprados ?? []).length
    ? menu
    : { ...menu, comprados };
}
