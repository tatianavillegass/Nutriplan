import { useMemo, useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Meal, DayType } from '../../types/plan';
import type { Client } from '../../types/client';
import type { Alimento } from '../../types/food';
import { matchRecipes } from '../../utils/recipeMatcher';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { ScaledRecipeView } from './ScaledRecipeView';
import { Badge, EmptyState } from '../common/ui';

interface Props {
  dayType: DayType;
  meal: Meal;
  recetas: Receta[];
  client: Client;
  asignada?: string;
  yaAsignadas: string[];
  onAsignar: (recetaId: string | undefined) => void;
  /** Catálogo, para resolver el gramaje de las sustituciones. */
  foods?: Alimento[];
}

export function RecipeRecommender({
  dayType,
  meal,
  recetas,
  client,
  asignada,
  yaAsignadas,
  onAsignar,
  foods = [],
}: Props) {
  const reparto = dayType.grid[meal.id] ?? {};
  const [mostrandoOpciones, setMostrandoOpciones] = useState(!asignada);

  const sugerencias = useMemo(
    () =>
      matchRecipes(recetas, reparto, {
        slot: meal.slot,
        preferencias: client.preferencias,
        yaAsignadas,
        limite: 4,
      }),
    [recetas, reparto, meal.slot, client.preferencias, yaAsignadas],
  );

  const recetaAsignada = recetas.find((r) => r.id === asignada);
  const vacio = Object.values(reparto).every((v) => !v);

  if (vacio) {
    return (
      <EmptyState title={`${meal.nombre} sin intercambios`}>
        Reparte intercambios en la grilla para recibir recomendaciones.
      </EmptyState>
    );
  }

  if (recetaAsignada && !mostrandoOpciones) {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{meal.nombre}</p>
        <ScaledRecipeView
          receta={recetaAsignada}
          requeridos={reparto}
          foods={foods}
          onCambiarReceta={() => setMostrandoOpciones(true)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{meal.nombre}</p>
        <p className="tnum text-[11px] text-slate-400">
          {(Object.entries(reparto) as [keyof typeof EXCHANGE_GROUPS, number][])
            .filter(([, n]) => n > 0)
            .map(([g, n]) => `${n} ${EXCHANGE_GROUPS[g].nombre.toLowerCase()}`)
            .join(' · ')}
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {sugerencias.map((s) => (
          <button
            key={s.receta.id}
            onClick={() => {
              onAsignar(s.receta.id);
              setMostrandoOpciones(false);
            }}
            className="rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-brand-400 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800">{s.receta.nombre}</h4>
              {s.faltantes.length === 0 && s.sobrantes.length === 0 && <Badge tone="brand">exacta</Badge>}
            </div>
            <p className="mt-1 flex flex-wrap gap-1">
              {s.receta.tags.slice(0, 4).map((t) => (
                <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {t}
                </span>
              ))}
            </p>
            {!!s.motivos.length && (
              <p className="mt-1.5 text-[11px] text-slate-400">{s.motivos.join(' · ')}</p>
            )}
            {!!s.faltantes.length && (
              <p className="mt-1 text-[11px] text-amber-600">
                No cubre: {s.faltantes.map((g) => EXCHANGE_GROUPS[g].nombre).join(', ')}
              </p>
            )}
          </button>
        ))}
        {!sugerencias.length && (
          <EmptyState title="Sin recetas compatibles">
            Añade recetas al banco cuyo perfil de grupos encaje con este reparto.
          </EmptyState>
        )}
      </div>

      {recetaAsignada && (
        <button
          onClick={() => setMostrandoOpciones(false)}
          className="mt-2 text-[11px] text-brand-600 underline"
        >
          Volver a «{recetaAsignada.nombre}»
        </button>
      )}
    </div>
  );
}
