import type { MenuSemana, RegistroDia } from '../types/diary';

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

/** Lo que tenía planeado comer ese día, por comida. */
export function menuDelDia(
  menu: MenuSemana | undefined,
  fecha: string,
): Record<string, string> {
  return menu?.dias?.[fecha]?.comidas ?? {};
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
 * Pone una receta en una comida, en los días marcados, y la quita de los que
 * se desmarcaron. Se trabaja así porque es como se piensa: «pan con huevo,
 * lunes, miércoles y viernes», no día por día.
 */
export function ponerEnDias(
  menu: MenuSemana,
  mealId: string,
  recetaId: string,
  dias: string[],
): MenuSemana {
  const marcados = new Set(dias);
  const out: MenuSemana = { ...menu, dias: { ...menu.dias } };

  for (const fecha of diasDeLaSemana(menu.inicio)) {
    const dia = out.dias[fecha] ?? { comidas: {} };
    const comidas = { ...dia.comidas };

    if (marcados.has(fecha)) comidas[mealId] = recetaId;
    // Sólo se quita lo suyo: si ese día tenía otra receta en esa comida, se
    // queda. Desmarcar el martes no puede borrar lo que puso el martes.
    else if (comidas[mealId] === recetaId) delete comidas[mealId];

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
    (s, fecha) => s + Object.keys(menu.dias?.[fecha]?.comidas ?? {}).length,
    0,
  );
}
