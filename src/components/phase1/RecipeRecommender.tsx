import { useMemo, useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Meal, DayType } from '../../types/plan';
import { RECETAS_POR_COMIDA, ajustesDeReceta } from '../../types/plan';
import type { Client } from '../../types/client';
import type { Alimento, MealSlot } from '../../types/food';
import { matchRecipes } from '../../utils/recipeMatcher';
import { coincide } from '../../utils/similitud';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { ScaledRecipeView } from './ScaledRecipeView';
import { RecipeQuickEditor } from './RecipeQuickEditor';
import { AjustarCantidades } from './AjustarCantidades';
import { Badge, Button, EmptyState, Input } from '../common/ui';
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
  /** Guardar los gramos ajustados a mano, sólo para esta clienta. */
  onAjustarCantidades?: (recetaId: string, ajustes: Record<string, number>) => void;
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
  onAjustarCantidades,
}: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  /** Receta cuyas cantidades se están ajustando para esta clienta. */
  const [ajustando, setAjustando] = useState<string | null>(null);
  /**
   * De entrada, el tipo de comida que toca aquí: en el desayuno se enseñan
   * recetas de desayuno. Antes la categoría sólo sumaba puntos, así que un
   * plato de comida cuyo perfil de grupos encajara bien con el reparto del
   * desayuno se colaba por delante de los desayunos de verdad.
   *
   * `'todas'` es la vía de escape, para cuando una receta se esconde porque
   * se le olvidó ponerle la categoría.
   */
  const [slot, setSlot] = useState<MealSlot | 'todas'>(meal.slot);
  const [tags, setTags] = useState<string[]>([]);
  /** Ir a por una receta concreta, esté donde esté en la puntuación. */
  const [busqueda, setBusqueda] = useState('');
  const reparto = dayType.grid[meal.id] ?? {};

  const todosLosTags = useMemo(() => tagsDisponibles(recetas), [recetas]);

  /** El filtro de tags es un Y: «dulce» + «huevos» son las que llevan ambos. */
  const candidatas = useMemo(
    () =>
      recetas.filter(
        (r) =>
          (slot === 'todas' || r.categorias.includes(slot)) &&
          tags.every((t) => r.tags.includes(t)),
      ),
    [recetas, slot, tags],
  );

  /**
   * BUSCAR UNA RECETA CONCRETA
   *
   * El recomendador sólo enseña las ocho que mejor encajan con el reparto, y
   * un batido de proteína pierde puntos por cada grupo que no cubre: puede
   * quedar el decimocuarto y no verse nunca. Buscando por nombre se salta la
   * puntuación entera y se busca en todo el banco, sin filtros.
   *
   * Las bloqueadas por las restricciones del cliente salen también, con el
   * motivo: esconderlas sin explicación es lo que hacía parecer que faltaban.
   */
  const encontradas = useMemo(() => {
    const q = busqueda.trim();
    if (q.length < 2) return [];
    return matchRecipes(
      recetas.filter((r) => coincide(r.nombre, q)),
      reparto,
      { slot: meal.slot, limite: 12, client, foods, incluirBloqueadas: true },
    );
  }, [busqueda, recetas, reparto, meal.slot, client, foods]);

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

  const filtrando = slot !== meal.slot || tags.length > 0;
  const alternarTag = (t: string) =>
    setTags((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]));

  /** Cuántas se están escondiendo por no ser de este tipo de comida. */
  const ocultasPorSlot =
    slot === 'todas' ? 0 : recetas.filter((r) => !r.categorias.includes(slot)).length;

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
            onChange={(e) => setSlot(e.target.value as MealSlot | 'todas')}
            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-brand-400"
          >
            {SLOTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
            <option value="todas">Todas ({recetas.length})</option>
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
              setSlot(meal.slot);
              setTags([]);
            }}
            className="ml-auto text-[10px] text-slate-400 underline hover:text-slate-600"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {/* ── Buscar una receta concreta ────────────────────── */}
      <div className="mb-3">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="¿Buscas una receta concreta? Escribe su nombre…"
          className="w-full text-sm"
        />

        {busqueda.trim().length >= 2 && (
          <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/40 p-2.5">
            {encontradas.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                No hay ninguna receta con ese nombre en el banco.
              </p>
            ) : (
              <>
                <p className="mb-1.5 text-[10px] tracking-wide text-brand-700 uppercase">
                  En todo el banco, sin filtros
                </p>
                <ul className="space-y-1">
                  {encontradas.map((s) => {
                    const activa = seleccionadas.includes(s.receta.id);
                    return (
                      <li key={s.receta.id}>
                        <button
                          onClick={() => !s.bloqueada && onToggle(s.receta.id)}
                          disabled={s.bloqueada || (!activa && completo)}
                          className={`flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-xs transition disabled:cursor-not-allowed ${
                            activa
                              ? 'bg-brand-600 text-white'
                              : s.bloqueada
                                ? 'bg-white text-slate-400'
                                : 'bg-white text-slate-700 hover:bg-brand-100'
                          }`}
                        >
                          <span className="flex-1">
                            {s.receta.nombre}
                            {!!s.faltantes.length && !s.bloqueada && (
                              <span
                                className={`ml-1.5 text-[10px] ${activa ? 'text-brand-100' : 'text-amber-600'}`}
                              >
                                no cubre{' '}
                                {s.faltantes.map((g) => EXCHANGE_GROUPS[g].nombre.toLowerCase()).join(', ')}
                              </span>
                            )}
                            {s.bloqueada && (
                              <span className="ml-1.5 text-[10px] text-red-600">
                                bloqueada — {s.motivosBloqueo?.join(' · ')}
                              </span>
                            )}
                          </span>
                          {activa && <span className="shrink-0 text-[10px]">✓ elegida</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
                  Aquí sale el banco entero: puedes asignar una receta aunque no cubra todo lo
                  pautado. Lo que falte se completa con otra opción o en otra comida.
                </p>
              </>
            )}
          </div>
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
            {slot !== 'todas' && ocultasPorSlot > 0 ? (
              <p>
                No hay recetas de {SLOTS.find((s) => s.id === slot)?.nombre.toLowerCase()} que
                encajen con este reparto. Pon «Todas» en el tipo de comida para ver el resto del
                banco, o búscala por su nombre.
              </p>
            ) : tags.length > 0 ? (
              <p>Con estos tags no queda ninguna que encaje con el reparto.</p>
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

      {/*
        Antes esto sólo se decía cuando no quedaba ninguna sugerencia: si había
        ocho válidas, una receta descartada por una alergia desaparecía sin más
        y parecía que faltaba del banco.
      */}
      {sugerencias.length > 0 && bloqueadas.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-600">
            {bloqueadas.length}{' '}
            {bloqueadas.length === 1
              ? 'receta encajaba pero está descartada'
              : 'recetas encajaban pero están descartadas'}{' '}
            por lo que {client.nombre.split(' ')[0]} no puede tomar
          </summary>
          <ul className="mt-1 space-y-0.5">
            {bloqueadas.map((b) => (
              <li key={b.receta.id} className="text-[11px] text-red-600">
                {b.receta.nombre}: {b.motivosBloqueo?.join(' · ')}
              </li>
            ))}
          </ul>
        </details>
      )}

      {sugerencias.length > 0 && slot !== 'todas' && ocultasPorSlot > 0 && (
        <p className="mt-1 text-[11px] text-slate-400">
          Se están enseñando sólo recetas de{' '}
          {SLOTS.find((s) => s.id === slot)?.nombre.toLowerCase()}.{' '}
          <button
            onClick={() => setSlot('todas')}
            className="underline hover:text-slate-600"
          >
            Ver las {ocultasPorSlot} restantes
          </button>
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
                <div key={r.id}>
                  {ajustando === r.id && onAjustarCantidades ? (
                    <AjustarCantidades
                      receta={r}
                      requeridos={reparto}
                      foods={foods}
                      ajustes={ajustesDeReceta(dayType, meal.id, r.id)}
                      onGuardar={(a) => {
                        onAjustarCantidades(r.id, a);
                        setAjustando(null);
                      }}
                      onCerrar={() => setAjustando(null)}
                    />
                  ) : (
                    <ScaledRecipeView
                      receta={r}
                      requeridos={reparto}
                      foods={foods}
                      ajustes={ajustesDeReceta(dayType, meal.id, r.id)}
                      paraNutricionista
                      acciones={
                        <>
                          {onAjustarCantidades && (
                            <Button variant="outline" onClick={() => setAjustando(r.id)}>
                              Ajustar cantidades
                            </Button>
                          )}
                          {onEditarReceta && (
                            <Button variant="outline" onClick={() => setEditando(r.id)}>
                              Editar receta
                            </Button>
                          )}
                        </>
                      }
                    />
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
