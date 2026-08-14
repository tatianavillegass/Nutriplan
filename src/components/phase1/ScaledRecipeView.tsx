import { useMemo, useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import type { ExchangeCounts } from '../../utils/exchanges';
import { exchangesToMacros } from '../../utils/exchanges';
import { scaleRecipe } from '../../utils/recipeScaling';
import { applyCustomization, EMPTY_CUSTOMIZATION } from '../../utils/substitutions';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { estadoComida, avisoDeGrasa } from '../../utils/completitud';
import { sumarIntercambios } from '../../utils/anadidos';
import { CompletenessBadge } from './MealCompleteness';
import { IngredientSwap } from './IngredientSwap';
import { gramosPorIntercambio } from '../../utils/recipeComposition';
import { roundPortion } from '../../utils/macros';
import { escalarMedida } from '../../utils/measures';
import { Button } from '../common/ui';
import { RecipeMeta, MacroBar } from '../common/RecipeMeta';
import { LABEL_ACOMPANAMIENTO, type Acompanamiento } from '../../types/plan';

/**
 * Parte la preparación en pasos numerados. Acepta tanto una línea por paso
 * como un párrafo con "1." delante de cada uno.
 */
function pasos(texto: string): string[] {
  const lineas = texto
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean);
  return lineas.length ? lineas : [texto.trim()];
}

interface Props {
  receta: Receta;
  requeridos: ExchangeCounts;
  foods?: Alimento[];
  onCambiarReceta?: () => void;
  /** Modo impresión: sin controles, sólo la ficha. */
  soloLectura?: boolean;
  /**
   * Cambios del cliente: ingredienteId → foodId del equivalente elegido.
   * Cuando se pasa, cada ingrediente se puede cambiar por otro de su grupo.
   */
  equivalentes?: Record<string, string>;
  onEquivalente?: (ingredienteId: string, foodId: string | undefined) => void;
  /** Acciones extra en la cabecera (editar, marcar como hecha…). */
  acciones?: React.ReactNode;
  /**
   * Enseña por qué han salido esas cantidades: que las nueces cubran la
   * grasa pautada, o que se haya recortado algo para no pasarse. Es para
   * decidir si la receta encaja, no para quien come.
   */
  paraNutricionista?: boolean;
  /**
   * Sin título ni foto: cuando la receta va dentro de una tarjeta de comida
   * que ya los enseña, repetirlos sobra.
   */
  sinCabecera?: boolean;
  /**
   * Gramos que la nutricionista ha fijado a mano para esta clienta. Mandan
   * sobre el cálculo. Ver `DayType.ajustesReceta`.
   */
  ajustes?: Record<string, number>;
  /** Lo que la nutricionista le ha puesto al lado a esta receta. */
  acompanamientos?: Acompanamiento[];
}

export function ScaledRecipeView({
  receta,
  requeridos,
  foods = [],
  onCambiarReceta,
  soloLectura = false,
  equivalentes,
  onEquivalente,
  acciones,
  paraNutricionista = false,
  sinCabecera = false,
  ajustes,
  acompanamientos,
}: Props) {
  /**
   * Gramos o medidas caseras. Se mezclaban las dos y confundía: ahora se
   * elige, y la elección vale para toda la lista.
   */
  const [caseras, setCaseras] = useState(false);

  const escalada = useMemo(
    () => scaleRecipe(receta, requeridos, foods, ajustes, acompanamientos),
    [receta, requeridos, foods, ajustes, acompanamientos],
  );
  const resultado = useMemo(
    () => applyCustomization(escalada, requeridos, EMPTY_CUSTOMIZATION, foods),
    [escalada, requeridos, foods],
  );

  /**
   * Lo que se come de verdad: lo que cubre la receta escalada, más lo añadido
   * que ocupa sitio en el plan, más lo marcado como extra. Los macros salen de
   * ahí y no de lo pautado, que es lo que debería haber, no lo que hay.
   */
  const macros = exchangesToMacros(
    sumarIntercambios(resultado.enPlato, resultado.extras),
  );

  /** Pautado vs plato: el badge y el checklist salen de aquí. */
  const resumen = useMemo(
    () => estadoComida(requeridos, resultado.enPlato),
    [requeridos, resultado.enPlato],
  );

  /** La grasa que se mueve dentro de la proteína, para quien pauta. */
  const grasa = useMemo(
    () => avisoDeGrasa(requeridos, resultado.enPlato),
    [requeridos, resultado.enPlato],
  );

  return (
    <div>
      <article className={sinCabecera ? 'print-sheet' : 'print-sheet overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm'}>
        <div className={receta.foto_url && !sinCabecera ? 'gap-5 p-5 sm:grid sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]' : 'p-5'}>
          {receta.foto_url && !sinCabecera && (
            <img
              src={receta.foto_url}
              alt={receta.nombre}
              className="mb-4 aspect-square w-full rounded-xl object-cover sm:mb-0"
            />
          )}
          <div className="min-w-0">
          {/*
            Dentro de una tarjeta de comida y sin botones que enseñar, la
            cabecera sólo dejaba un hueco en blanco.

            El título va en su propia línea y los botones debajo: con los dos
            en la misma fila, en la columna estrecha del recomendador el nombre
            se quedaba con dos centímetros y salía una palabra por renglón, con
            los botones encima.
          */}
          {(!sinCabecera || (!soloLectura && (acciones || onCambiarReceta))) && (
          <header className={sinCabecera ? 'mb-3 flex justify-end gap-1.5 no-print' : 'mb-3'}>
            {sinCabecera ? null : (
              <div className="min-w-0">
                <h3 className="text-lg leading-tight font-semibold text-balance text-brand-900">
                  {receta.nombre}
                </h3>
                <RecipeMeta receta={receta} className="mt-1.5" />
              </div>
            )}
            {!soloLectura && (
              <div
                className={`flex flex-wrap gap-1.5 no-print ${sinCabecera ? '' : 'mt-2.5'}`}
              >
                {acciones}
                {onCambiarReceta && (
                  <Button variant="outline" onClick={onCambiarReceta}>
                    Cambiar receta
                  </Button>
                )}
              </div>
            )}
          </header>
          )}

          <div className="mb-4 border-y border-slate-100 py-3">
            <MacroBar macros={macros} />
            {/* Si la receta cuadra o no con lo pautado es cosa de quien pauta:
                a quien come sólo le confundía. */}
            {paraNutricionista && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <CompletenessBadge resumen={resumen} />
              </div>
            )}
          </div>

          {/*
            La comparación es por macro, así que dos claras y dos huevos son lo
            mismo. Lo que se pierde ahí —la grasa que Tats pautó a propósito—
            se dice aparte, y sólo a quien pauta.
          */}
          {paraNutricionista && grasa && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
              {grasa.texto}
            </p>
          )}

          {paraNutricionista && escalada.notas.length > 0 && (
            <ul className="mb-3 space-y-1 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2 text-[11px] leading-snug text-brand-900">
              {escalada.notas.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          )}

          {/*
            Ya sólo aparece cuando falta un macro entero, que es cuando de
            verdad hay que completar algo aparte. Antes saltaba también porque
            la receta cubriera el hidrato con pan en vez de con fruta, y eso no
            era ningún problema.
          */}
          {escalada.gruposSinCubrir.length > 0 && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
              Esta receta no cubre:{' '}
              {escalada.gruposSinCubrir.map((g) => EXCHANGE_GROUPS[g].nombre).join(', ')}. Habrá que
              completarlo aparte.
            </p>
          )}

          <div className="mt-1 mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-brand-900">Ingredientes</h4>
            <button
              onClick={() => setCaseras((v) => !v)}
              role="switch"
              aria-checked={caseras}
              className="flex items-center gap-2 text-[11px] text-slate-500 no-print"
            >
              <span
                className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                  caseras ? 'bg-brand-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow transition ${
                    caseras ? 'translate-x-4' : ''
                  }`}
                />
              </span>
              Medidas caseras
            </button>
          </div>

          <ul className="space-y-1.5">
            {resultado.ingredientes
              .filter((ing) => !ing.acompanamiento)
              .map((ing) => {
              // Equivalente elegido por el cliente: mismo grupo, gramaje recalculado.
              const equivalenteId = equivalentes?.[ing.id];
              const equivalente = equivalenteId
                ? foods.find((f) => f.id === equivalenteId)
                : undefined;
              const intercambios =
                (requeridos[ing.grupo as keyof typeof requeridos] as number | undefined) ?? 0;
              const gpi = equivalente ? gramosPorIntercambio(equivalente) : undefined;

              const nombreFinal = equivalente?.nombre ?? ing.nombre;
              const enGramos =
                equivalente && gpi && intercambios > 0
                  ? `${roundPortion(gpi * intercambios)} ${equivalente.unidad ?? 'g'}`
                  : ing.display;

              // La medida casera sale del alimento: sus gramos por medida.
              const alimento = equivalente ?? foods.find((f) => f.id === ing.foodId);
              const gramosFinales =
                equivalente && gpi && intercambios > 0
                  ? roundPortion(gpi * intercambios)
                  : ing.cantidad_final;
              const casera =
                alimento?.medida_casera && alimento.gramos > 0 && gramosFinales
                  ? escalarMedida(alimento.medida_casera, gramosFinales / alimento.gramos)
                  : undefined;
              const displayFinal = caseras && casera ? casera : enGramos;

              return (
                <li key={ing.id} className="flex items-baseline gap-2 text-sm">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                  <span className="flex-1 text-slate-700">
                    {nombreFinal}
                    <span className="tnum ml-1.5 font-medium text-brand-800">{displayFinal}</span>
                    {caseras && casera && (
                      <span className="tnum ml-1.5 text-[10px] text-slate-400">{enGramos}</span>
                    )}
                    {onEquivalente && !soloLectura && intercambios > 0 && (
                      <IngredientSwap
                        ingrediente={ing}
                        intercambios={intercambios}
                        foods={foods}
                        cambiadoPor={equivalenteId}
                        onCambiar={(fid) => onEquivalente(ing.id, fid)}
                      />
                    )}
                  </span>
                </li>
              );
            })}
            {/* Lo que ha añadido el cliente va en la misma lista: al comer no
                hay «ingredientes de la receta» y «lo mío», hay un plato. */}
            {resultado.anadidos.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2 text-sm">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                <span className="flex-1 text-slate-700">
                  {a.nombre}
                  <span className="tnum ml-1.5 font-medium text-brand-800">
                    {a.cantidad == null ? 'al gusto' : `${a.cantidad} ${a.unidad}`}
                  </span>
                  {caseras && a.medida && a.cantidad != null && (
                    <span className="tnum ml-1.5 text-[10px] text-slate-400">{a.medida}</span>
                  )}
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                      !a.grupo
                        ? 'bg-emerald-50 text-emerald-700'
                        : a.cuenta
                          ? 'bg-brand-50 text-brand-700'
                          : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {!a.grupo ? 'libre' : a.cuenta ? 'añadido' : 'extra'}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/*
            Lo que la nutricionista ha puesto al lado va aparte de la receta:
            no es un ingrediente del plato, es algo que se toma con él.
          */}
          {resultado.ingredientes.some((i) => i.acompanamiento) && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Además
              </p>
              <ul className="space-y-1.5">
                {resultado.ingredientes
                  .filter((i) => i.acompanamiento)
                  .map((a) => (
                    <li key={a.id} className="flex items-baseline gap-2 text-sm">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                      <span className="flex-1 text-slate-700">
                        {a.nombre}
                        <span className="tnum ml-1.5 font-medium text-brand-800">{a.display}</span>
                        <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">
                          {LABEL_ACOMPANAMIENTO[
                            a.acompanamiento as keyof typeof LABEL_ACOMPANAMIENTO
                          ] ?? 'Acompañamiento'}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {receta.preparacion && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Elaboración
              </p>
              <ol className="space-y-1.5">
                {pasos(receta.preparacion).map((paso, i) => (
                  <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-slate-600">
                    <span className="tnum mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-brand-300 text-[9px] font-semibold text-brand-700">
                      {i + 1}
                    </span>
                    {paso}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {receta.notas && <p className="mt-3 text-[11px] text-slate-500 italic">{receta.notas}</p>}
          </div>
        </div>
      </article>
    </div>
  );
}
