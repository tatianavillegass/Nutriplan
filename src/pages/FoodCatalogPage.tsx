import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { EXCHANGE_GROUP_LIST, EXCHANGE_GROUPS, type ExchangeGroupId } from '../data/exchangeGroups';
import type { Alimento, MealSlot, Alergeno } from '../types/food';
import { Button, Card, Field, Input, Select, Badge } from '../components/common/ui';

const SLOTS: MealSlot[] = ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena', 'extra'];
const ALERGENOS: Alergeno[] = ['gluten', 'lactosa', 'frutos_secos', 'huevo', 'soja', 'pescado'];

const NUEVO: Omit<Alimento, 'id'> = {
  nombre: '',
  grupo: 'proteicos_magros',
  medida_casera: '',
  gramos: 0,
  intercambios: 1,
  comidas_sugeridas: ['comida'],
  alergenos: [],
  apto: [],
};

export function FoodCatalogPage() {
  const foods = useAppStore((s) => s.foods);
  const { addFood, deleteFood } = useAppStore();
  const [draft, setDraft] = useState(NUEVO);
  const [abierto, setAbierto] = useState(false);
  const [grupoFiltro, setGrupoFiltro] = useState<ExchangeGroupId | 'todos'>('todos');

  const agrupados = useMemo(() => {
    const out = new Map<ExchangeGroupId, Alimento[]>();
    for (const f of foods) {
      if (grupoFiltro !== 'todos' && f.grupo !== grupoFiltro) continue;
      if (!out.has(f.grupo)) out.set(f.grupo, []);
      out.get(f.grupo)!.push(f);
    }
    return out;
  }, [foods, grupoFiltro]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-900">Catálogo de alimentos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {foods.length} alimentos. Cada uno declara su medida casera, gramaje y grupo de intercambio.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={grupoFiltro} onChange={(e) => setGrupoFiltro(e.target.value as ExchangeGroupId)} className="w-52">
            <option value="todos">Todos los grupos</option>
            {EXCHANGE_GROUP_LIST.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </Select>
          <Button onClick={() => setAbierto((v) => !v)}>{abierto ? 'Cancelar' : '+ Alimento'}</Button>
        </div>
      </div>

      {abierto && (
        <Card title="Nuevo alimento">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Nombre" className="sm:col-span-2">
              <Input value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
            </Field>
            <Field label="Grupo" className="sm:col-span-2">
              <Select
                value={draft.grupo}
                onChange={(e) => setDraft({ ...draft, grupo: e.target.value as ExchangeGroupId })}
              >
                {EXCHANGE_GROUP_LIST.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Medida casera" className="sm:col-span-2">
              <Input
                value={draft.medida_casera}
                placeholder="1/4 taza"
                onChange={(e) => setDraft({ ...draft, medida_casera: e.target.value })}
              />
            </Field>
            <Field label="Gramos">
              <Input
                type="number"
                step="0.5"
                value={draft.gramos}
                onChange={(e) => setDraft({ ...draft, gramos: Number(e.target.value) })}
              />
            </Field>
            <Field label="g cocido (opcional)">
              <Input
                type="number"
                value={draft.equivalencia_cocido ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    equivalencia_cocido: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </Field>
            <Field label="Comidas sugeridas" className="sm:col-span-2">
              <div className="flex flex-wrap gap-1">
                {SLOTS.map((s) => {
                  const on = draft.comidas_sugeridas.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          comidas_sugeridas: on
                            ? draft.comidas_sugeridas.filter((x) => x !== s)
                            : [...draft.comidas_sugeridas, s],
                        })
                      }
                      className={`rounded border px-2 py-0.5 text-[11px] capitalize ${
                        on ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Alérgenos" className="sm:col-span-2">
              <div className="flex flex-wrap gap-1">
                {ALERGENOS.map((a) => {
                  const on = draft.alergenos.includes(a);
                  return (
                    <button
                      key={a}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          alergenos: on ? draft.alergenos.filter((x) => x !== a) : [...draft.alergenos, a],
                        })
                      }
                      className={`rounded border px-2 py-0.5 text-[11px] ${
                        on ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {a.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                addFood(draft);
                setDraft(NUEVO);
                setAbierto(false);
              }}
              disabled={!draft.nombre.trim() || !draft.medida_casera.trim()}
            >
              Añadir al catálogo
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {[...agrupados.entries()]
          .sort((a, b) => EXCHANGE_GROUPS[a[0]].orden - EXCHANGE_GROUPS[b[0]].orden)
          .map(([gid, items]) => {
            const g = EXCHANGE_GROUPS[gid];
            return (
              <Card
                key={gid}
                title={
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: g.color }} />
                    {g.nombre}
                  </span>
                }
                subtitle={`1 intercambio = HC ${g.hc} g · Proteína ${g.proteina} g · Grasa ${g.grasa} g`}
              >
                <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((f) => (
                    <li
                      key={f.id}
                      className="group flex items-baseline justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      <span className="text-slate-700">
                        {f.medida_casera}{' '}
                        <span className="tnum text-slate-400">
                          ({f.gramos} {f.unidad ?? 'g'}
                          {f.equivalencia_cocido ? ` / ${f.equivalencia_cocido} coc.` : ''})
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {f.custom && <Badge tone="brand">propio</Badge>}
                        {f.alergenos.map((a) => (
                          <Badge key={a} tone="warn">
                            {a[0].toUpperCase()}
                          </Badge>
                        ))}
                        <button
                          onClick={() => deleteFood(f.id)}
                          className="hidden text-red-400 group-hover:block hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
