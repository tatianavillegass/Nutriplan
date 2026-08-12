import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FoodForm, type FoodFormValue } from '../components/food/FoodForm';
import {
  EXCHANGE_GROUPS,
  EXCHANGE_GROUP_LIST,
  type ExchangeGroupId,
} from '../data/exchangeGroups';
import { ALERGENO_LABELS, type Alimento } from '../types/food';
import { calcularPorcion } from '../utils/portions';
import { esCompuesto, describeEquivalencia } from '../utils/exchanges';
import { Badge, Button, Card, EmptyState, Input, Select, fmt } from '../components/common/ui';

/**
 * Base de datos de alimentos. De aquí salen los intercambios: se introducen
 * los nutrientes por 100 g y la app deduce cuántos gramos son una porción.
 */
export function FoodCatalogPage() {
  const foods = useAppStore((s) => s.foods);
  const addFood = useAppStore((s) => s.addFood);
  const updateFood = useAppStore((s) => s.updateFood);
  const deleteFood = useAppStore((s) => s.deleteFood);

  const [q, setQ] = useState('');
  const [grupo, setGrupo] = useState<ExchangeGroupId | ''>('');
  const [editando, setEditando] = useState<Alimento | null>(null);
  const [creando, setCreando] = useState(false);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return foods
      .filter((f) => (!t || f.nombre.toLowerCase().includes(t)) && (!grupo || f.grupo === grupo))
      .sort(
        (a, b) =>
          (a.grupo ? EXCHANGE_GROUPS[a.grupo].orden : 99) -
            (b.grupo ? EXCHANGE_GROUPS[b.grupo].orden : 99) || a.nombre.localeCompare(b.nombre),
      );
  }, [foods, q, grupo]);

  const conNutrientes = foods.filter((f) => f.nutrientes).length;

  /**
   * Con casi trescientos alimentos, el que se edita casi nunca está a la
   * vista del formulario, que sale arriba. Sin subir hasta él, pulsar
   * "Editar" parece no hacer nada.
   */
  const formulario = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (creando || editando) {
      formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [creando, editando]);

  const guardar = (v: FoodFormValue) => {
    const datos = {
      nombre: v.nombre,
      grupo: v.grupo,
      bucket: EXCHANGE_GROUPS[v.grupo].bucket,
      medida_casera: v.medida_casera,
      gramos: v.gramos ?? 0,
      // En un compuesto la medida es la unidad: gasta lo que diga `equivale`.
      intercambios: 1,
      equivale: v.equivale,
      nutrientes: v.nutrientes,
      equivalencia_cocido: v.equivalencia_cocido,
      comidas_sugeridas: v.comidas_sugeridas,
      alergenos: v.alergenos,
      apto: v.apto,
      notas: v.notas,
    };
    if (editando) updateFood(editando.id, datos);
    else addFood(datos);
    setEditando(null);
    setCreando(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-900">Alimentos</h1>
          <p className="text-sm text-slate-500">
            {foods.length} alimentos · {conNutrientes} con datos nutricionales completos
          </p>
        </div>
        {!creando && !editando && (
          <Button onClick={() => setCreando(true)}>Añadir alimento</Button>
        )}
      </div>

      <div ref={formulario} className="scroll-mt-20" />

      {(creando || editando) && (
        <Card
          title={editando ? `Editar ${editando.nombre}` : 'Nuevo alimento'}
          subtitle="Introduce los datos por 100 g: la porción se calcula sola"
        >
          <FoodForm
            key={editando?.id ?? 'nuevo'}
            inicial={editando ?? undefined}
            onGuardar={guardar}
            onCancelar={() => {
              setEditando(null);
              setCreando(false);
            }}
          />
        </Card>
      )}

      <Card
        title="Alimentos"
        actions={
          <div className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="w-44 text-xs"
            />
            <Select
              value={grupo}
              onChange={(e) => setGrupo(e.target.value as ExchangeGroupId | '')}
              className="w-44 text-xs"
            >
              <option value="">Todos los subgrupos</option>
              {EXCHANGE_GROUP_LIST.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {filtrados.length === 0 ? (
          <EmptyState title="Sin resultados">Prueba con otro nombre o cambia el subgrupo.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-400">
                  <th className="py-1.5 text-left font-medium">Alimento</th>
                  <th className="py-1.5 text-left font-medium">Subgrupo</th>
                  <th className="py-1.5 text-right font-medium">Porción</th>
                  <th className="py-1.5 text-left font-medium">Medida casera</th>
                  <th className="py-1.5 text-right font-medium">Por 100 g</th>
                  <th className="py-1.5 text-left font-medium">Alérgenos</th>
                  <th className="py-1.5"> </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f) => {
                  const g = f.grupo ? EXCHANGE_GROUPS[f.grupo] : undefined;
                  const porcion =
                    f.nutrientes && f.grupo ? calcularPorcion(f.nutrientes, f.grupo) : undefined;
                  const desvia =
                    porcion && f.gramos
                      ? Math.abs(porcion.gramos - f.gramos) / f.gramos > 0.2
                      : false;
                  return (
                    <tr key={f.id} className="group border-b border-slate-50">
                      <td className="py-1.5">
                        <span className="text-slate-800">{f.nombre}</span>
                        {f.custom && <span className="ml-1.5 text-[10px] text-brand-600">propio</span>}
                      </td>
                      <td className="py-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span
                            className="h-2 w-2 shrink-0 rounded-sm"
                            style={{ backgroundColor: g?.color ?? "#cbd5e1" }}
                          />
                          {/*
                            Un compuesto gasta varios grupos, así que enseñar
                            sólo el suyo engañaba: no había forma de ver desde
                            la lista si la equivalencia estaba puesta o faltaba.
                          */}
                          {esCompuesto(f) ? describeEquivalencia(f) : g?.nombre ?? 'Libre (sin intercambio)'}
                        </span>
                      </td>
                      <td className="tnum py-1.5 text-right font-medium text-brand-800">
                        {f.gramos || porcion?.gramos} {f.unidad ?? 'g'}
                        {desvia && (
                          <span
                            className="ml-1 cursor-help text-[10px] font-normal text-amber-600"
                            title={`Por sus nutrientes la porción saldría de ${porcion!.gramos} g`}
                          >
                            ≠{porcion!.gramos}
                          </span>
                        )}
                        {f.equivalencia_cocido && (
                          <span className="ml-1 text-[10px] font-normal text-slate-400">
                            / {f.equivalencia_cocido} coc.
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-xs text-slate-500">{f.medida_casera}</td>
                      <td className="tnum py-1.5 text-right text-[11px] text-slate-500">
                        {f.nutrientes ? (
                          <>
                            {fmt(f.nutrientes.hc, 1)} / {fmt(f.nutrientes.proteina, 1)} /{' '}
                            {fmt(f.nutrientes.grasa, 1)}
                          </>
                        ) : (
                          <span className="text-slate-300">sin datos</span>
                        )}
                      </td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {f.alergenos.map((a) => (
                            <Badge key={a} tone="warn">
                              {ALERGENO_LABELS[a]}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditando(f);
                            setCreando(false);
                          }}
                          className="text-[11px] text-slate-400 hover:text-brand-700"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Eliminar ${f.nombre} de la base de datos?`)) {
                              deleteFood(f.id);
                            }
                          }}
                          className="ml-2 text-[11px] text-slate-300 hover:text-red-600"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-400">
              La columna "Por 100 g" muestra carbohidrato / proteína / grasa. La porción es la cantidad
              que aporta 1 intercambio de su subgrupo.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
