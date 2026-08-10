import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { EXCHANGE_GROUPS, type MacroBucket } from '../data/exchangeGroups';
import { gramosPorIntercambio } from '../utils/recipeComposition';
import {
  borrarPlantilla,
  borrarPlantillaDia,
  guardarPlantilla,
  guardarPlantillaDia,
  leerPlantillas,
  leerPlantillasDia,
  totalAlimentos,
  type PlantillaDespensa,
  type PlantillaDia,
} from '../utils/plantillas';
import { FoodPicker } from '../components/food/FoodPicker';
import { Button, Card, EmptyState, Input } from '../components/common/ui';
import type { MealSlot } from '../types/food';

const SLOTS: MealSlot[] = ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena', 'extra'];

const BUCKETS: [MacroBucket, string, string][] = [
  ['proteina', 'Proteína', 'queso batido, huevo, pollo…'],
  ['carbohidrato', 'Carbohidrato', 'avena, pan, plátano…'],
  ['grasa', 'Grasa', 'aceite, aguacate, nueces…'],
];

/**
 * MIS PLANTILLAS
 *
 * Los alimentos que más manda, guardados una vez y reutilizables con todos
 * los clientes. Se editan aquí, sin tener que entrar en la ficha de nadie.
 */
export function TemplatesPage() {
  const foods = useAppStore((s) => s.foods);
  const [comidas, setComidas] = useState<PlantillaDespensa[]>(() => leerPlantillas());
  const [dias, setDias] = useState<PlantillaDia[]>(() => leerPlantillasDia());
  const [editando, setEditando] = useState<string | null>(null);
  const [nueva, setNueva] = useState('');
  /** Plantilla de día que se está componiendo. */
  const [editandoDia, setEditandoDia] = useState<string | null>(null);
  const [nuevoDia, setNuevoDia] = useState('');

  const porId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const enEdicion = comidas.find((p) => p.id === editando);

  const alimentosDe = (p: PlantillaDespensa) =>
    p.foodIds.map((id) => porId.get(id)).filter((f): f is NonNullable<typeof f> => !!f);

  const guardarLista = (p: PlantillaDespensa, foodIds: string[]) =>
    setComidas(guardarPlantilla(comidas, p.nombre, foodIds, p.slot));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-900">Mis plantillas</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Los alimentos que más mandas, listos para aplicar a cualquier cliente y retocar desde ahí.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            placeholder="Nombre de la plantilla nueva"
            className="w-56"
          />
          <Button
            disabled={!nueva.trim()}
            onClick={() => {
              // Nace con un alimento cualquiera de proteína para que exista;
              // el primer gesto es quitarlo o cambiarlo por los suyos.
              const semilla = foods.find((f) => f.grupo === 'proteicos_magros');
              const lista = guardarPlantilla(comidas, nueva, semilla ? [semilla.id] : []);
              setComidas(lista);
              setEditando(lista.find((p) => p.nombre === nueva.trim())?.id ?? null);
              setNueva('');
            }}
          >
            + Nueva plantilla
          </Button>
        </div>
      </div>

      {/* Plantillas de día completo */}
      <Card
        title="De día completo"
        subtitle="Rellenan todas las comidas de un tipo de día de una vez"
        actions={
          <div className="flex gap-2">
            <Input
              value={nuevoDia}
              onChange={(e) => setNuevoDia(e.target.value)}
              placeholder="Día de entreno"
              className="w-44 text-xs"
            />
            <Button
              variant="outline"
              disabled={!nuevoDia.trim()}
              onClick={() => {
                // Nace con el desayuno vacío para poder abrirla y rellenarla.
                const lista = guardarPlantillaDia(dias, nuevoDia, { desayuno: [] });
                setDias(lista);
                setEditandoDia(lista.find((p) => p.nombre === nuevoDia.trim())?.id ?? null);
                setNuevoDia('');
              }}
            >
              + Nueva
            </Button>
          </div>
        }
      >
        {!dias.length ? (
          <EmptyState title="Ninguna todavía">
            Escríbele un nombre arriba, o monta un día en fase 3 y guárdalo desde ahí.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {dias.map((p) => {
              const abierta = p.id === editandoDia;
              return (
                <div key={p.id} className="rounded-lg border border-slate-200">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
                    <button
                      onClick={() => setEditandoDia(abierta ? null : p.id)}
                      className="text-sm font-medium text-slate-800 hover:text-brand-700"
                    >
                      {p.nombre}
                    </button>
                    <span className="tnum text-[11px] text-slate-400">
                      {Object.keys(p.comidas).length} comidas · {totalAlimentos(p)} alimentos
                    </span>
                    <span className="flex-1 truncate text-[11px] text-slate-500">
                      {Object.keys(p.comidas).join(' · ')}
                    </span>
                    <button
                      onClick={() => setEditandoDia(abierta ? null : p.id)}
                      className="text-[11px] text-brand-600 hover:underline"
                    >
                      {abierta ? 'Cerrar' : 'Editar'}
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`¿Borrar la plantilla "${p.nombre}"?`)) return;
                        setDias(borrarPlantillaDia(dias, p.id));
                      }}
                      className="text-[11px] text-slate-400 hover:text-red-600"
                    >
                      Borrar
                    </button>
                  </div>

                  {abierta && (
                    <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                      {SLOTS.map((slot) => {
                        const ids = p.comidas[slot];
                        const activa = ids !== undefined;
                        const lista = (ids ?? [])
                          .map((id) => porId.get(id))
                          .filter((f): f is NonNullable<typeof f> => !!f);

                        const setComida = (siguientes: string[] | undefined) =>
                          setDias(
                            guardarPlantillaDia(dias, p.nombre, {
                              ...p.comidas,
                              [slot]: siguientes,
                            }),
                          );

                        return (
                          <div key={slot} className="rounded-lg bg-slate-50/70 p-2.5">
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 capitalize">
                              <input
                                type="checkbox"
                                checked={activa}
                                onChange={(e) => setComida(e.target.checked ? [] : undefined)}
                                className="accent-brand-600"
                              />
                              {slot}
                              {activa && (
                                <span className="tnum font-normal text-slate-400">
                                  {lista.length} alimentos
                                </span>
                              )}
                            </label>

                            {activa && (
                              <div className="mt-2 grid gap-3 md:grid-cols-3">
                                {BUCKETS.map(([bucket, label, ejemplo]) => {
                                  const dentro = lista.filter(
                                    (f) => !!f.grupo && EXCHANGE_GROUPS[f.grupo]?.bucket === bucket,
                                  );
                                  return (
                                    <div key={bucket}>
                                      <p className="mb-1 text-[10px] font-medium text-slate-600">
                                        {label}
                                        <span className="tnum ml-1 font-normal text-slate-400">
                                          {dentro.length}
                                        </span>
                                      </p>
                                      <FoodPicker
                                        foods={foods.filter(
                                          (f) =>
                                            !!f.grupo && EXCHANGE_GROUPS[f.grupo]?.bucket === bucket,
                                        )}
                                        placeholder={ejemplo}
                                        limpiarTrasElegir
                                        onSelect={(f) =>
                                          !(ids ?? []).includes(f.id) &&
                                          setComida([...(ids ?? []), f.id])
                                        }
                                      />
                                      <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto pr-1">
                                        {dentro.map((f) => (
                                          <li key={f.id}>
                                            <button
                                              onClick={() =>
                                                setComida((ids ?? []).filter((x) => x !== f.id))
                                              }
                                              title="Quitar de la plantilla"
                                              className="flex w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left text-[11px] text-slate-700 transition hover:bg-red-50"
                                            >
                                              <span className="text-slate-300">−</span>
                                              <span className="flex-1 truncate">{f.nombre}</span>
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Plantillas de una comida */}
      <Card title="De una comida" subtitle="Para rellenar un desayuno, una cena…">
        {!comidas.length ? (
          <EmptyState title="Ninguna todavía">
            Escribe un nombre arriba y añade los alimentos que sueles mandar.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {comidas.map((p) => {
              const lista = alimentosDe(p);
              const abierta = p.id === editando;
              return (
                <div key={p.id} className="rounded-lg border border-slate-200">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
                    <button
                      onClick={() => setEditando(abierta ? null : p.id)}
                      className="text-sm font-medium text-slate-800 hover:text-brand-700"
                    >
                      {p.nombre}
                    </button>
                    <span className="tnum text-[11px] text-slate-400">
                      {lista.length} alimentos
                      {p.slot ? ` · ${p.slot}` : ''}
                    </span>
                    <span className="flex-1 truncate text-[11px] text-slate-500">
                      {lista.slice(0, 6).map((f) => f.nombre.toLowerCase()).join(', ')}
                      {lista.length > 6 ? '…' : ''}
                    </span>
                    <button
                      onClick={() => setEditando(abierta ? null : p.id)}
                      className="text-[11px] text-brand-600 hover:underline"
                    >
                      {abierta ? 'Cerrar' : 'Editar'}
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`¿Borrar la plantilla "${p.nombre}"?`)) return;
                        setComidas(borrarPlantilla(comidas, p.id));
                      }}
                      className="text-[11px] text-slate-400 hover:text-red-600"
                    >
                      Borrar
                    </button>
                  </div>

                  {abierta && enEdicion && (
                    <div className="grid gap-4 border-t border-slate-100 px-3 py-3 md:grid-cols-3">
                      {BUCKETS.map(([bucket, label, ejemplo]) => {
                        const dentro = lista.filter(
                          (f) => !!f.grupo && EXCHANGE_GROUPS[f.grupo]?.bucket === bucket,
                        );
                        return (
                          <div key={bucket}>
                            <p className="mb-1 text-[11px] font-medium text-slate-700">
                              {label}
                              <span className="tnum ml-1 font-normal text-slate-400">
                                {dentro.length}
                              </span>
                            </p>
                            <FoodPicker
                              foods={foods.filter(
                                (f) => !!f.grupo && EXCHANGE_GROUPS[f.grupo]?.bucket === bucket,
                              )}
                              placeholder={ejemplo}
                              limpiarTrasElegir
                              onSelect={(f) =>
                                !p.foodIds.includes(f.id) &&
                                guardarLista(p, [...p.foodIds, f.id])
                              }
                            />
                            <ul className="mt-1.5 max-h-56 space-y-0.5 overflow-auto pr-1">
                              {dentro.map((f) => (
                                <li key={f.id}>
                                  <button
                                    onClick={() =>
                                      guardarLista(
                                        p,
                                        p.foodIds.filter((x) => x !== f.id),
                                      )
                                    }
                                    title="Quitar de la plantilla"
                                    className="flex w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left text-[11px] text-slate-700 transition hover:bg-red-50"
                                  >
                                    <span className="text-slate-300">−</span>
                                    <span className="flex-1 truncate">{f.nombre}</span>
                                    <span className="tnum text-[10px] text-slate-400">
                                      {gramosPorIntercambio(f)} {f.unidad ?? 'g'}
                                    </span>
                                  </button>
                                </li>
                              ))}
                              {!dentro.length && (
                                <li className="text-[11px] text-slate-400">Sin alimentos.</li>
                              )}
                            </ul>
                          </div>
                        );
                      })}

                      <div className="md:col-span-3">
                        <label className="flex items-center gap-2 text-[11px] text-slate-500">
                          Pensada para
                          <select
                            value={p.slot ?? ''}
                            onChange={(e) =>
                              setComidas(
                                guardarPlantilla(
                                  comidas,
                                  p.nombre,
                                  p.foodIds,
                                  (e.target.value || undefined) as MealSlot | undefined,
                                ),
                              )
                            }
                            className="rounded border border-slate-200 px-2 py-1 text-[11px] capitalize outline-none focus:border-brand-400"
                          >
                            <option value="">cualquier comida</option>
                            {SLOTS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
