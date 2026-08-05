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
import { kcalFromMacros } from '../../utils/macros';
import { EXCHANGE_GROUPS, MIN_VERDURA_G } from '../../data/exchangeGroups';
import { RecipeCustomizer } from './RecipeCustomizer';
import { Button, fmt } from '../common/ui';

interface Props {
  receta: Receta;
  requeridos: ExchangeCounts;
  foods?: Alimento[];
  onCambiarReceta?: () => void;
  /** Modo impresión: sin controles, sólo la ficha. */
  soloLectura?: boolean;
}

export function ScaledRecipeView({
  receta,
  requeridos,
  foods = [],
  onCambiarReceta,
  soloLectura = false,
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
        {receta.foto_url && (
          <img src={receta.foto_url} alt={receta.nombre} className="h-40 w-full object-cover" />
        )}
        <div className="p-5">
          <header className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-brand-800">{receta.nombre}</h3>
              <p className="tnum mt-0.5 text-xs text-slate-500">
                {fmt(kcalFromMacros(macros))} kcal · P {fmt(macros.proteina, 1)} g · HC{' '}
                {fmt(macros.hc, 1)} g · G {fmt(macros.grasa, 1)} g
              </p>
            </div>
            {!soloLectura && (
              <div className="flex shrink-0 gap-1.5 no-print">
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

          {escalada.gruposSinCubrir.length > 0 && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
              Esta receta no cubre:{' '}
              {escalada.gruposSinCubrir.map((g) => EXCHANGE_GROUPS[g].nombre).join(', ')}. Habrá que
              completarlo aparte.
            </p>
          )}

          <ul className="space-y-1.5">
            {resultado.ingredientes.map((ing) => (
              <li key={ing.id} className="flex items-baseline gap-2 text-sm">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                <span className="flex-1 text-slate-700">
                  {ing.nombre}
                  <span className="tnum ml-1.5 font-medium text-brand-800">{ing.display}</span>
                  {ing.factor !== 1 && ing.cantidad_base != null && (
                    <span className="tnum ml-1.5 text-[10px] text-slate-400">
                      ({ing.cantidad_base} × {ing.factor.toFixed(1)})
                    </span>
                  )}
                </span>
              </li>
            ))}
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
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Preparación
              </p>
              <p className="text-xs leading-relaxed whitespace-pre-line text-slate-600">
                {receta.preparacion}
              </p>
            </div>
          )}

          {receta.notas && <p className="mt-3 text-[11px] text-slate-500 italic">{receta.notas}</p>}
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
