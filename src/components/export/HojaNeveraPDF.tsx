import type { Client } from '../../types/client';
import type { Alimento } from '../../types/food';
import type { DayType, Meal, Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import { MIN_VERDURA_G } from '../../data/exchangeGroups';
import { columnasDeComida } from '../../utils/combosGuardados';
import { BUCKET_LABEL, textoItem } from '../../utils/mealOptions';
import { notaAceite, repartoElegible } from '../../utils/pantry';
import { matchRecipes } from '../../utils/recipeMatcher';
import { CabeceraDeMarca, MARCA, MarcaDeAgua } from '../brand/Marca';
import { fechaLarga } from './printing';

/**
 * LA HOJA DE LA NEVERA — FASE 2
 *
 * El PDF de antes era un documento de trabajo: las mismas columnas de la
 * pantalla, en blanco y negro y con el vocabulario de la consulta. Esto es otra
 * cosa: una hoja que se imprime, se pega con un imán y se lee de pie, de lejos
 * y con prisa.
 *
 * De ahí las decisiones:
 *
 * - **Una comida por bloque y tres columnas.** Es la misma forma que tiene el
 *   plan en su cabeza —proteína, carbohidrato, grasa— y la que ya ve en la app.
 * - **Las opciones van numeradas.** No es decoración: en la cocina se señala
 *   con el dedo y en consulta se dice «esta semana tira de la 2».
 * - **Las recetas son sólo el nombre y la foto.** La preparación está en la
 *   app; ponerla aquí convertiría la hoja en un folleto de cuatro folios y
 *   dejaría de caber en la puerta de la nevera.
 * - **No se imprimen kcal ni porciones.** Las cantidades ya vienen hechas en
 *   cada opción, que es lo que significa la fase 2. Un número al lado invita a
 *   sumar, y en esa fase no hay nada que sumar.
 */

/**
 * TRES OPCIONES POR COLUMNA, NO LAS QUE HAYA
 *
 * En pantalla salen hasta cinco y está bien: se desplaza. En papel, cada opción
 * puede ocupar tres líneas —«1 taza de mezcla de tortitas proteicas (165 g),
 * 1/4 taza de arroz blanco crudo (18 g)»— y con cuatro columnas llenas el día
 * se iba a dos hojas. Y una hoja de nevera que ocupa dos hojas ya no se cuelga.
 *
 * Tres es además el número con el que se decide de pie: más opciones no dan más
 * libertad, dan que pensar a las siete de la mañana. La lista completa sigue
 * estando en la app.
 */
const TOPE_DE_OPCIONES = 3;
export function HojaNeveraPDF({
  client,
  plan,
  recipes,
  foods,
}: {
  client: Client;
  plan: Plan;
  recipes: Receta[];
  foods: Alimento[];
}) {
  return (
    <div className="print-doc" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {plan.dayTypes.map((d) => (
        <section key={d.id} className="print-page relative">
          <MarcaDeAgua ancho={340} />

          <div className="relative" style={{ zIndex: 1 }}>
            <CabeceraDeMarca>
              <h1 className="text-xl leading-tight font-semibold tracking-tight" style={{ color: MARCA.oscuro }}>
                {client.nombre}
              </h1>
              <p className="text-[11px]" style={{ color: MARCA.verde }}>
                {plan.dayTypes.length > 1 ? d.nombre : 'Tus comidas'}
              </p>
            </CabeceraDeMarca>

            <p className="mb-3 text-[11px] text-slate-600">
              Elige <strong className="font-semibold">una opción de cada columna</strong>. Las
              cantidades ya están calculadas para ti.
            </p>

            <div className="space-y-2">
              {d.meals.map((m) => (
                <ComidaDeLaNevera
                  key={m.id}
                  dayType={d}
                  meal={m}
                  foods={foods}
                  recetas={recipes}
                  client={client}
                />
              ))}
            </div>

            <footer
              className="mt-4 border-t pt-2 text-[9px] text-slate-500"
              style={{ borderColor: MARCA.claro }}
            >
              <p>
                Verdura libre en comida y cena: mínimo medio plato ({MIN_VERDURA_G} g). Agua a lo
                largo del día.
              </p>
              {/*
                Su nombre va también aquí abajo, no sólo en la cabecera: cuando
                un día lleva muchas comidas la hoja se va a un segundo folio, y
                ese folio se quedaba sin firmar.
              */}
              <p className="mt-1 flex items-baseline justify-between gap-4">
                <span style={{ color: MARCA.verde }}>
                  {MARCA.nombre} · {MARCA.rol}
                </span>
                <span className="shrink-0">{fechaLarga()}</span>
              </p>
            </footer>
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Un bloque por comida. Se marca `break-inside-avoid` porque una comida partida
 * entre dos hojas es justo lo que rompe el formato: la mitad de las opciones se
 * quedaría en la página de detrás, que en la nevera no se ve.
 */
function ComidaDeLaNevera({
  dayType,
  meal,
  foods,
  recetas,
  client,
}: {
  dayType: DayType;
  meal: Meal;
  foods: Alimento[];
  recetas: Receta[];
  client: Client;
}) {
  const columnas = columnasDeComida(dayType, meal, foods, { limite: TOPE_DE_OPCIONES });
  if (!columnas.length) return null;

  const { reserva, reparto } = repartoElegible(dayType, meal);
  const aceite = notaAceite(foods, reserva);
  const nota = dayType.notas?.[meal.id];
  const postre = meal.slot === 'cena' ? dayType.postre : undefined;

  const ideas = matchRecipes(recetas, reparto, {
    slot: meal.slot,
    preferencias: client.preferencias,
    limite: 3,
    client,
    foods,
  });

  return (
    <section
      className="break-inside-avoid overflow-hidden rounded-lg border"
      style={{ borderColor: MARCA.claro, printColorAdjust: 'exact' }}
    >
      <h2
        className="px-3 py-0.5 text-[10px] font-bold tracking-[0.16em] uppercase"
        style={{ backgroundColor: '#EAF3EF', color: MARCA.oscuro, printColorAdjust: 'exact' }}
      >
        {meal.nombre}
      </h2>

      <div className="grid grid-cols-3 gap-x-4 px-3 py-1.5">
        {columnas.map((col) => (
          <div key={col.bucket}>
            <p
              className="mb-1 border-b pb-0.5 text-[8px] font-semibold tracking-[0.1em] uppercase"
              style={{ color: MARCA.verde, borderColor: MARCA.arena, printColorAdjust: 'exact' }}
            >
              {BUCKET_LABEL[col.bucket]}
            </p>
            {col.opciones.length === 0 ? (
              <p className="text-[10px] text-slate-400">—</p>
            ) : (
              <ol className="space-y-0.5">
                {col.opciones.map((o, i) => (
                  <li key={o.id} className="flex gap-1 text-[9px] leading-tight text-slate-700">
                    <span
                      className="mt-px flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[7px] font-bold"
                      style={{
                        backgroundColor: MARCA.verde,
                        color: '#fff',
                        printColorAdjust: 'exact',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span>{o.items.map(textoItem).join(', ')}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>

      {(aceite || nota || postre || ideas.length > 0) && (
        <div
          className="space-y-0.5 border-t px-3 py-1"
          style={{ borderColor: '#EAF3EF', printColorAdjust: 'exact' }}
        >
          {aceite && <p className="text-[9px] text-slate-500">{aceite} — ya contado.</p>}
          {nota && <p className="text-[9px] text-slate-600">{nota}</p>}
          {postre && (
            <p className="text-[9px] text-slate-600">
              <strong className="font-semibold">Postre:</strong> {postre}
            </p>
          )}

          {ideas.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className="text-[8px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: MARCA.verde }}
              >
                Ideas
              </span>
              {ideas.map(({ receta }) => (
                <span key={receta.id} className="flex items-center gap-1">
                  {receta.foto_url && (
                    <img
                      src={receta.foto_url}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                      style={{ printColorAdjust: 'exact' }}
                    />
                  )}
                  <span className="text-[9px] text-slate-600">{receta.nombre}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
