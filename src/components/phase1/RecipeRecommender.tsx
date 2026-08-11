import { useMemo, useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Meal, DayType } from '../../types/plan';
import { RECETAS_POR_COMIDA } from '../../types/plan';
import type { Client } from '../../types/client';
import type { Alimento } from '../../types/food';
import { matchRecipes } from '../../utils/recipeMatcher';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { ScaledRecipeView } from './ScaledRecipeView';
import { RecipeQuickEditor } from './RecipeQuickEditor';
import { Badge, Button, EmptyState } from '../common/ui';
import { RecipeMeta } from '../common/RecipeMeta';

interface Props {
  dayType: DayType;
  meal: Meal;
  recetas: Receta[];
  client: Client;
  /** Recetas ya elegidas para esta comida. */
  seleccionadas: string[];
  /** Recetas usadas en otras comidas, para dar variedad. */
  yaAsignadas: string[];
  onToggle: (recetaId: string) => void;
  foods?: Alimento[];
  /** Guardar cambios en la receta del banco. */
  onEditarReceta?: (recetaId: string, patch: Partial<Receta>) => void;
}

/**
 * FASE 1 — la nutricionista elige varias recetas por comida (3 por defecto)
 * y el cliente escoge entre ellas cada día.
 */
export function RecipeRecommender({
  dayType,
  meal,
  recetas,
  client,
  seleccionadas,
  yaAsignadas,
  onToggle,
  foods = [],
  onEditarReceta,
}: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const reparto = dayType.grid[meal.id] ?? {};

  const sugerencias = useMemo(
    () =>
      matchRecipes(recetas, reparto, {
        slot: meal.slot,
        preferencias: client.preferencias,
        yaAsignadas,
        limite: 8,
        client,
        foods,
      }),
    [recetas, reparto, meal.slot, client, foods, yaAsignadas],
  );

  const bloqueadas = useMemo(
    () =>
      matchRecipes(recetas, reparto, {
        slot: meal.slot,
        limite: 6,
        client,
        foods,
        incluirBloqueadas: true,
      }).filter((r) => r.bloqueada),
    [recetas, reparto, meal.slot, client, foods],
  );

  const elegidas = seleccionadas
    .map((id) => recetas.find((r) => r.id === id))
    .filter(Boolean) as Receta[];

  const vacio = Object.values(reparto).every((v) => !v);
  if (vacio) {
    return (
      <EmptyState title={`${meal.nombre} sin intercambios`}>
        Reparte intercambios en la grilla para recibir recomendaciones.
      </EmptyState>
    );
  }

  const completo = elegidas.length >= RECETAS_POR_COMIDA;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {meal.nombre}
          </p>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] ${
              completo
                ? 'bg-emerald-50 text-emerald-700'
                : elegidas.length > 0
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {elegidas.length} de {RECETAS_POR_COMIDA} opciones
          </span>
        </div>
        <p className="tnum text-[11px] text-slate-400">
          {(Object.entries(reparto) as [keyof typeof EXCHANGE_GROUPS, number][])
            .filter(([, n]) => n > 0)
            .map(([g, n]) => `${n} ${EXCHANGE_GROUPS[g].nombre.toLowerCase()}`)
            .join(' · ')}
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {sugerencias.map((s) => {
          const activa = seleccionadas.includes(s.receta.id);
          return (
            <button
              key={s.receta.id}
              onClick={() => onToggle(s.receta.id)}
              disabled={!activa && completo}
              className={`rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                activa
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 bg-white hover:border-brand-400 hover:shadow-sm'
              }`}
            >
              {s.receta.foto_url && (
                <img
                  src={s.receta.foto_url}
                  alt={s.receta.nombre}
                  className="mb-2.5 h-24 w-full rounded-lg object-cover"
                />
              )}
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-800">{s.receta.nombre}</h4>
                <div className="flex shrink-0 items-center gap-1">
                  {s.faltantes.length === 0 && s.sobrantes.length === 0 && (
                    <Badge tone="brand">exacta</Badge>
                  )}
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      activa ? 'bg-brand-600 text-white' : 'border border-slate-300 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                </div>
              </div>
              <RecipeMeta receta={s.receta} className="mt-1 gap-x-3 text-[10px]" />
              <p className="mt-1 flex flex-wrap gap-1">
                {s.receta.tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                  >
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
          );
        })}

        {!sugerencias.length && (
          <EmptyState title="Sin recetas compatibles">
            {bloqueadas.length > 0 ? (
              <>
                <p>
                  {bloqueadas.length}{' '}
                  {bloqueadas.length === 1 ? 'receta encajaba' : 'recetas encajaban'} por macros, pero
                  las restricciones del cliente las descartan.
                </p>
                <ul className="mt-2 space-y-0.5 text-left">
                  {bloqueadas.slice(0, 4).map((b) => (
                    <li key={b.receta.id} className="text-[11px] text-red-600">
                      {b.receta.nombre}: {b.motivosBloqueo?.join(' · ')}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              'Añade recetas al banco cuyo perfil de grupos encaje con este reparto.'
            )}
          </EmptyState>
        )}
      </div>

      {completo && (
        <p className="mt-2 text-[11px] text-slate-400">
          Ya hay {RECETAS_POR_COMIDA} opciones. Quita una para poder cambiarla.
        </p>
      )}

      {elegidas.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[11px] font-medium text-slate-500">
            Así las verá el cliente, con los gramajes ya escalados
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {elegidas.map((r) =>
              editando === r.id && onEditarReceta ? (
                <div key={r.id} className="lg:col-span-2">
                  <RecipeQuickEditor
                    receta={r}
                    foods={foods}
                    requeridos={reparto}
                    onCerrar={() => setEditando(null)}
                    onGuardar={(patch) => {
                      onEditarReceta(r.id, patch);
                      setEditando(null);
                    }}
                  />
                </div>
              ) : (
                <ScaledRecipeView
                  key={r.id}
                  receta={r}
                  requeridos={reparto}
                  foods={foods}
                  paraNutricionista
                  acciones={
                    onEditarReceta ? (
                      <Button variant="outline" onClick={() => setEditando(r.id)}>
                        Editar receta
                      </Button>
                    ) : undefined
                  }
                />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
