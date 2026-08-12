import { useMemo, useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Meal, DayType } from '../../types/plan';
import { RECETAS_POR_COMIDA } from '../../types/plan';
import type { Client } from '../../types/client';
import type { Alimento, MealSlot } from '../../types/food';
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

const SLOTS: { id: MealSlot; nombre: string }[] = [
  { id: 'desayuno', nombre: 'Desayuno' },
  { id: 'almuerzo', nombre: 'Almuerzo' },
  { id: 'comida', nombre: 'Comida' },
  { id: 'merienda', nombre: 'Merienda' },
  { id: 'cena', nombre: 'Cena' },
  { id: 'extra', nombre: 'Extra' },
];

/** Cuántas recetas del banco llevan cada tag, para no ofrecer filtros vacíos. */
function tagsDisponibles(recetas: Receta[]): string[] {
  const cuenta = new Map<string, number>();
  for (const r of recetas) {
    for (const t of r.tags) {
      const limpio = t.trim();
      if (limpio) cuenta.set(limpio, (cuenta.get(limpio) ?? 0) + 1);
    }
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
}

/**
 * FASE 1 — la nutricionista elige varias recetas por comida (3 por defecto)
 * y el cliente escoge entre ellas cada día.
 *
 * El recomendador ordena por lo que cuadra con el reparto, pero con el banco
 * ya grande hacía falta poder acotar a mano: enseñar sólo las de desayuno, o
 * sólo las dulces, o sólo las que llevan huevo.
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
  /** Vacío = el tipo de comida que toca aquí. */
  const [slot, setSlot] = useState<MealSlot | ''>('');
  const [tags, setTags] = useState<string[]>([]);
  const reparto = dayType.grid[meal.id] ?? {};

  const todosLosTags = useMemo(() => tagsDisponibles(recetas), [recetas]);

  /**
   * De partida no se esconde nada: se ordenan poniendo delante las de esta
   * comida. Al elegir un tipo de comida sí se recorta a las de esa categoría,
   * que es lo que sirve para ir a buscar «algo de desayuno» a propósito.
   *
   * El filtro de tags es un Y: «dulce» + «huevos» son las que llevan ambos.
   */
  const candidatas = useMemo(
    () =>
      recetas.filter(
        (r) =>
          (!slot || r.categorias.includes(slot)) && tags.every((t) => r.tags.includes(t)),
      ),
    [recetas, slot, tags],
  );

  const sugerencias = useMemo(
    () =>
      matchRecipes(candidatas, reparto, {
        slot: meal.slot,
        preferencias: client.preferencias,
        yaAsignadas,
        limite: 8,
        client,
        foods,
      }),
    [candidatas, reparto, meal.slot, client, foods, yaAsignadas],
  );

  const bloqueadas = useMemo(
    () =>
      matchRecipes(candidatas, reparto, {
        slot: meal.slot,
        limite: 6,
        client,
        foods,
        incluirBloqueadas: true,
      }).filter((r) => r.bloqueada),
    [candidatas, reparto, meal.slot, client, foods],
  );

  const filtrando = !!slot || tags.length > 0;
  const alternarTag = (t: string) =>
    setTags((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]));

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

      {/* ── Filtros: tipo de comida y tags ───────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
          Tipo de comida
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value as MealSlot | '')}
            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-brand-400"
          >
            <option value="">Todas</option>
            {SLOTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>

        {todosLosTags.length > 0 && <span className="mx-1 h-4 w-px bg-slate-200" />}

        <div className="flex flex-wrap items-center gap-1">
          {todosLosTags.map((t) => {
            const activo = tags.includes(t);
            return (
              <button
                key={t}
                onClick={() => alternarTag(t)}
                aria-pressed={activo}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                  activo
                    ? 'border-brand-500 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>

        {filtrando && (
          <button
            onClick={() => {
              setSlot('');
              setTags([]);
            }}
            className="ml-auto text-[10px] text-slate-400 underline hover:text-slate-600"
          >
            Quitar filtros
          </button>
        )}
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
            {filtrando ? (
              <p>
                Con estos filtros no queda ninguna que encaje con el reparto. Quita alguno para ver
                más.
              </p>
            ) : bloqueadas.length > 0 ? (
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
