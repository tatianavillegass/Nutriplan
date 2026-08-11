import { useMemo, useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import type { ExchangeCounts } from '../../utils/exchanges';
import { exchangesToMacros } from '../../utils/exchanges';
import { scaleRecipe } from '../../utils/recipeScaling';
import {
  applyCustomization,
  EMPTY_CUSTOMIZATION,
  type CustomizationState,
} from '../../utils/substitutions';
import { EXCHANGE_GROUPS, MIN_VERDURA_G } from '../../data/exchangeGroups';
import { RecipeCustomizer } from './RecipeCustomizer';
import { IngredientSwap } from './IngredientSwap';
import { gramosPorIntercambio } from '../../utils/recipeComposition';
import { roundPortion } from '../../utils/macros';
import { escalarMedida } from '../../utils/measures';
import { Button } from '../common/ui';
import { RecipeMeta, MacroBar } from '../common/RecipeMeta';

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
}: Props) {
  const [custom, setCustom] = useState<CustomizationState>(EMPTY_CUSTOMIZATION);
  const [aviso, setAviso] = useState<string | null>(null);
  const [personalizando, setPersonalizando] = useState(false);

  const escalada = useMemo(() => scaleRecipe(receta, requeridos), [receta, requeridos]);
  const resultado = useMemo(
    () => applyCustomization(escalada, requeridos, custom, foods),
    [escalada, requeridos, custom, foods],
  );

  const macros = exchangesToMacros(resultado.exchangesDespues);

  const mostrarAviso = (motivo: string) => {
    setAviso(motivo);
    setTimeout(() => setAviso(null), 3200);
  };

  return (
    <div className={personalizando ? 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]' : ''}>
      <article className="print-sheet overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm">
        <div className={receta.foto_url ? 'gap-5 p-5 sm:grid sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)]' : 'p-5'}>
          {receta.foto_url && (
            <img
              src={receta.foto_url}
              alt={receta.nombre}
              className="mb-4 aspect-square w-full rounded-xl object-cover sm:mb-0"
            />
          )}
          <div className="min-w-0">
          <header className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl leading-tight font-semibold text-brand-900">{receta.nombre}</h3>
              <RecipeMeta receta={receta} className="mt-2" />
            </div>
            {!soloLectura && (
              <div className="flex shrink-0 gap-1.5 no-print">
                {acciones}
                {onCambiarReceta && (
                  <Button variant="outline" onClick={onCambiarReceta}>
                    Cambiar receta
                  </Button>
                )}
                <Button
                  variant={personalizando ? 'primary' : 'outline'}
                  onClick={() => setPersonalizando((v) => !v)}
                >
                  Personalizar
                </Button>
              </div>
            )}
          </header>

          <div className="mb-4 border-y border-slate-100 py-3">
            <MacroBar macros={macros} />
          </div>

          {paraNutricionista && escalada.notas.length > 0 && (
            <ul className="mb-3 space-y-1 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2 text-[11px] leading-snug text-brand-900">
              {escalada.notas.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          )}

          {escalada.gruposSinCubrir.length > 0 && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
              Esta receta no cubre:{' '}
              {escalada.gruposSinCubrir.map((g) => EXCHANGE_GROUPS[g].nombre).join(', ')}. Habrá que
              completarlo aparte.
            </p>
          )}

          <ul className="space-y-1.5">
            {resultado.ingredientes.map((ing) => {
              // Equivalente elegido por el cliente: mismo grupo, gramaje recalculado.
              const equivalenteId = equivalentes?.[ing.id];
              const equivalente = equivalenteId
                ? foods.find((f) => f.id === equivalenteId)
                : undefined;
              const intercambios =
                (requeridos[ing.grupo as keyof typeof requeridos] as number | undefined) ?? 0;
              const gpi = equivalente ? gramosPorIntercambio(equivalente) : undefined;

              const nombreFinal = equivalente?.nombre ?? ing.nombre;
              const displayFinal =
                equivalente && gpi && intercambios > 0
                  ? `${roundPortion(gpi * intercambios)} ${equivalente.unidad ?? 'g'}`
                  : ing.display;

              return (
                <li key={ing.id} className="flex items-baseline gap-2 text-sm">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                  <span className="flex-1 text-slate-700">
                    {nombreFinal}
                    <span className="tnum ml-1.5 font-medium text-brand-800">{displayFinal}</span>
                    {equivalente && intercambios > 0 && (
                      <span className="ml-1.5 text-[10px] text-slate-400">
                        {escalarMedida(equivalente.medida_casera, intercambios)}
                      </span>
                    )}
                    {!equivalente && ing.factor !== 1 && ing.cantidad_base != null && (
                      <span className="tnum ml-1.5 text-[10px] text-slate-400">
                        ({ing.cantidad_base} × {ing.factor.toFixed(1)})
                      </span>
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
          </ul>

          <p className="mt-2 text-[11px] text-emerald-700">
            Verdura al gusto — mínimo {MIN_VERDURA_G} g (medio plato).
          </p>

          {resultado.cambios.length > 0 && (
            <p className="mt-2 text-[11px] text-brand-600 no-print">
              Tus cambios: {resultado.cambios.join(' · ')}
            </p>
          )}

          {aviso && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 no-print">
              {aviso}
            </p>
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

      {personalizando && !soloLectura && (
        <RecipeCustomizer
          ingredientes={escalada.ingredientes}
          resultado={resultado.ingredientes}
          foods={foods}
          state={custom}
          onChange={setCustom}
          antes={requeridos}
          despues={resultado.exchangesDespues}
          avisos={resultado.avisos}
          onBloqueado={mostrarAviso}
        />
      )}
    </div>
  );
}
