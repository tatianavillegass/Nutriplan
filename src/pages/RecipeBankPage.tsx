import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { EXCHANGE_GROUPS, EXCHANGE_GROUP_LIST, type ExchangeGroupId } from '../data/exchangeGroups';
import { composicionDesdeIngredientes, gramosPorIntercambio } from '../utils/recipeComposition';
import { fmt } from '../components/common/ui';
import { FoodPicker } from '../components/food/FoodPicker';
import type { Receta, Ingrediente, TiempoReceta, Dificultad } from '../types/recipe';
import { TIEMPOS, DIFICULTADES } from '../types/recipe';
import type { MealSlot } from '../types/food';
import { Button, Card, Field, Input, Select, EmptyState, Badge } from '../components/common/ui';
import { PhotoUpload } from '../components/common/PhotoUpload';
import { ListaTexto } from '../components/common/ListaTexto';
import { RecipeMeta } from '../components/common/RecipeMeta';
import { uid } from '../utils/storage';

const SLOTS: MealSlot[] = ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena', 'extra'];

const RECETA_VACIA: Omit<Receta, 'id' | 'createdAt' | 'updatedAt'> = {
  nombre: '',
  categorias: ['comida'],
  tags: [],
  base: {},
  ingredientes: [],
  preparacion: '',
  notas: '',
};

export function RecipeBankPage() {
  const recipes = useAppStore((s) => s.recipes);
  const foods = useAppStore((s) => s.foods);
  const { addRecipe, updateRecipe, deleteRecipe } = useAppStore();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Receta, 'id' | 'createdAt' | 'updatedAt'>>(RECETA_VACIA);
  const [filtro, setFiltro] = useState('');

  const abrirNueva = () => {
    setDraft(RECETA_VACIA);
    setEditandoId('nuevo');
  };

  const abrirEdicion = (r: Receta) => {
    const { id, createdAt, updatedAt, ...rest } = r;
    void id; void createdAt; void updatedAt;
    setDraft(rest);
    setEditandoId(r.id);
  };

  // La composición en intercambios se deriva de los ingredientes enlazados.
  const composicion = useMemo(
    () => composicionDesdeIngredientes(draft, foods),
    [draft, foods],
  );
  const enlazada = draft.ingredientes.some((i) => i.foodId);

  const guardar = () => {
    const aGuardar = enlazada ? { ...draft, base: composicion.base } : draft;
    if (editandoId === 'nuevo') addRecipe(aGuardar);
    else if (editandoId) updateRecipe(editandoId, aGuardar);
    setEditandoId(null);
  };

  const setIngrediente = (i: number, patch: Partial<Ingrediente>) =>
    setDraft((d) => ({
      ...d,
      ingredientes: d.ingredientes.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)),
    }));

  const visibles = recipes.filter(
    (r) =>
      !filtro ||
      r.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(filtro.toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-900">Banco de recetas</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {recipes.length} recetas plantilla. La composición base se expresa en intercambios: es la
            unidad de escalado.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nombre o tag…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-56"
          />
          <Button onClick={abrirNueva}>+ Nueva receta</Button>
        </div>
      </div>

      {editandoId && (
        <Card
          title={editandoId === 'nuevo' ? 'Nueva receta' : 'Editar receta'}
          actions={
            <>
              <Button variant="ghost" onClick={() => setEditandoId(null)}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={!draft.nombre.trim()}>
                Guardar
              </Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-[320px_minmax(0,1fr)]">
            <PhotoUpload
              value={draft.foto_url}
              onChange={(foto_url) => setDraft({ ...draft, foto_url })}
            />
            <div className="grid content-start gap-3">
              <Field label="Nombre">
                <Input value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Tiempo">
                  <Select
                    value={draft.tiempo ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, tiempo: (e.target.value || undefined) as TiempoReceta | undefined })
                    }
                  >
                    <option value="">—</option>
                    {TIEMPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Dificultad">
                  <Select
                    value={draft.dificultad ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, dificultad: (e.target.value || undefined) as Dificultad | undefined })
                    }
                  >
                    <option value="">—</option>
                    {DIFICULTADES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tupper">
                  <Select
                    value={draft.tupper === undefined ? '' : draft.tupper ? 'si' : 'no'}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        tupper: e.target.value === '' ? undefined : e.target.value === 'si',
                      })
                    }
                  >
                    <option value="">—</option>
                    <option value="si">Apto</option>
                    <option value="no">No apto</option>
                  </Select>
                </Field>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Categorías de comida" className="sm:col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {SLOTS.map((s) => {
                  const on = draft.categorias.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          categorias: on
                            ? draft.categorias.filter((x) => x !== s)
                            : [...draft.categorias, s],
                        })
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs capitalize transition ${
                        on ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Tags (separados por coma)" className="sm:col-span-2">
              <ListaTexto
                valor={draft.tags}
                onChange={(tags) => setDraft({ ...draft, tags })}
                placeholder="pollo, rápido, sin lactosa"
              />
            </Field>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-600">
              Composición base (intercambios por grupo)
            </p>

            {enlazada ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3">
                <p className="text-[11px] text-slate-600">
                  Calculada desde los ingredientes: cada uno aporta sus gramos divididos por la
                  porción de su subgrupo.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(Object.entries(composicion.base) as [ExchangeGroupId, number | 'ilimitado'][])
                    .sort((a, b) => EXCHANGE_GROUPS[a[0]].orden - EXCHANGE_GROUPS[b[0]].orden)
                    .map(([g, v]) => (
                      <span
                        key={g}
                        className="rounded-lg border border-brand-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                      >
                        <span className="tnum font-medium text-brand-800">
                          {v === 'ilimitado' ? '∞' : v}
                        </span>{' '}
                        {EXCHANGE_GROUPS[g].nombre.toLowerCase()}
                      </span>
                    ))}
                  {!Object.keys(composicion.base).length && (
                    <span className="text-[11px] text-slate-400">
                      Aún sin ingredientes que aporten intercambios.
                    </span>
                  )}
                </div>
                <p className="tnum mt-2 text-[11px] text-slate-500">
                  {fmt(composicion.kcal)} kcal · P {fmt(composicion.macros.proteina, 1)} g · HC{' '}
                  {fmt(composicion.macros.hc, 1)} g · G {fmt(composicion.macros.grasa, 1)} g
                </p>
                {composicion.sinResolver.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-amber-700">
                    Sin enlazar al catálogo: {composicion.sinResolver.join(', ')}.
                  </p>
                )}
              </div>
            ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {EXCHANGE_GROUP_LIST.map((g) => {
                const v = draft.base[g.id];
                return (
                  <div key={g.id} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: g.color }} />
                    <span className="flex-1 truncate text-xs text-slate-600">{g.nombre}</span>
                    {g.ilimitado ? (
                      <label className="flex items-center gap-1 text-[11px] text-slate-500">
                        <input
                          type="checkbox"
                          checked={v === 'ilimitado'}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              base: { ...draft.base, [g.id]: e.target.checked ? 'ilimitado' : undefined },
                            })
                          }
                          className="accent-brand-600"
                        />
                        ilimitado
                      </label>
                    ) : (
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        value={typeof v === 'number' ? v : 0}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            base: { ...draft.base, [g.id]: Number(e.target.value) || undefined },
                          })
                        }
                        className="w-16 py-1 text-center text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600">Ingredientes</p>
              <Button
                variant="outline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    ingredientes: [
                      ...draft.ingredientes,
                      {
                        id: uid('i_'),
                        nombre: '',
                        cantidad_base: 0,
                        unidad: 'g',
                        grupo: 'proteicos_magros',
                        escalable: true,
                        opcional: false,
                        sustitutos: [],
                      },
                    ],
                  })
                }
              >
                + Ingrediente
              </Button>
            </div>
            <div className="space-y-2">
              {draft.ingredientes.map((ing, i) => (
                <div key={ing.id} className="grid items-center gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-12">
                  <div className="sm:col-span-3">
                    <FoodPicker
                      foods={foods}
                      value={ing.foodId}
                      nombreLibre={ing.nombre}
                      placeholder="Escribe: pollo, avena, plátano…"
                      onLibre={(nombre) => setIngrediente(i, { nombre, foodId: undefined })}
                      onSelect={(f) =>
                        setIngrediente(i, {
                          foodId: f.id,
                          nombre: f.nombre,
                          grupo: f.grupo,
                          unidad: f.equivalencia_cocido ? 'g crudo' : (f.unidad ?? 'g'),
                          cantidad_base: ing.cantidad_base || f.gramos,
                        })
                      }
                    />
                    {ing.foodId && (
                      <p className="tnum mt-0.5 text-[10px] text-slate-500">
                        {(() => {
                          const f = foods.find((x) => x.id === ing.foodId);
                          const gpi = f ? gramosPorIntercambio(f) : undefined;
                          if (!gpi || ing.cantidad_base == null) return null;
                          return `${fmt(ing.cantidad_base / gpi, 2)} intercambios · porción ${gpi} g`;
                        })()}
                      </p>
                    )}
                  </div>
                  <Input
                    className="sm:col-span-1 text-center"
                    type="number"
                    value={ing.cantidad_base ?? ''}
                    placeholder="—"
                    onChange={(e) =>
                      setIngrediente(i, {
                        cantidad_base: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    className="sm:col-span-1"
                    value={ing.unidad}
                    onChange={(e) => setIngrediente(i, { unidad: e.target.value })}
                  />
                  <Select
                    className="sm:col-span-2"
                    value={ing.grupo}
                    onChange={(e) => setIngrediente(i, { grupo: e.target.value as ExchangeGroupId })}
                  >
                    {EXCHANGE_GROUP_LIST.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                      </option>
                    ))}
                    <option value="condimento">Condimento</option>
                  </Select>
                  <ListaTexto
                    className="sm:col-span-3"
                    placeholder="Sustitutos (coma)"
                    valor={ing.sustitutos ?? []}
                    onChange={(sustitutos) => setIngrediente(i, { sustitutos })}
                  />
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 sm:col-span-2">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={ing.escalable}
                        onChange={(e) => setIngrediente(i, { escalable: e.target.checked })}
                        className="accent-brand-600"
                      />
                      escala
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={ing.opcional}
                        onChange={(e) => setIngrediente(i, { opcional: e.target.checked })}
                        className="accent-brand-600"
                      />
                      opc.
                    </label>
                    <button
                      onClick={() =>
                        setDraft({ ...draft, ingredientes: draft.ingredientes.filter((_, x) => x !== i) })
                      }
                      className="ml-auto text-red-500 hover:underline"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="Preparación" className="mt-4">
            <textarea
              value={draft.preparacion}
              onChange={(e) => setDraft({ ...draft, preparacion: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </Field>
          <Field label="Notas" className="mt-3">
            <Input value={draft.notas} onChange={(e) => setDraft({ ...draft, notas: e.target.value })} />
          </Field>
        </Card>
      )}

      {visibles.length === 0 ? (
        <EmptyState title="Sin recetas" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm">
              {r.foto_url ? (
                <img src={r.foto_url} alt={r.nombre} className="h-36 w-full object-cover" />
              ) : (
                <button
                  onClick={() => abrirEdicion(r)}
                  className="flex h-36 w-full flex-col items-center justify-center gap-1 bg-slate-50 text-[11px] text-slate-400 hover:bg-slate-100"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="8.5" cy="10" r="1.5" />
                    <path d="M21 16l-5-5-4.5 4.5L9 13l-6 6" />
                  </svg>
                  Añadir foto
                </button>
              )}
              <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">{r.nombre}</h3>
                <div className="flex shrink-0 gap-1 text-[11px]">
                  <button onClick={() => abrirEdicion(r)} className="text-brand-600 hover:underline">
                    Editar
                  </button>
                  <button onClick={() => deleteRecipe(r.id)} className="text-red-500 hover:underline">
                    Borrar
                  </button>
                </div>
              </div>
              <RecipeMeta receta={r} className="mt-1.5 gap-x-3 text-[11px]" />
              <p className="mt-1.5 flex flex-wrap gap-1">
                {r.categorias.map((c) => (
                  <Badge key={c} tone="brand">
                    {c}
                  </Badge>
                ))}
                {r.tags.slice(0, 3).map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </p>
              <p className="tnum mt-2 text-[11px] text-slate-500">
                {Object.entries(r.base)
                  .filter(([, v]) => v)
                  .map(([g, v]) =>
                    v === 'ilimitado'
                      ? 'verduras ilim.'
                      : `${v} ${EXCHANGE_GROUP_LIST.find((x) => x.id === g)?.nombre.toLowerCase()}`,
                  )
                  .join(' · ')}
              </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
