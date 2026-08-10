import { useMemo, useState } from 'react';
import type { Receta, Ingrediente } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import type { ExchangeCounts } from '../../utils/exchanges';
import { EXCHANGE_GROUPS, EXCHANGE_GROUP_LIST, type ExchangeGroupId } from '../../data/exchangeGroups';
import { composicionDesdeIngredientes, gramosPorIntercambio } from '../../utils/recipeComposition';
import { FoodPicker } from '../food/FoodPicker';
import { Button, Input, fmt } from '../common/ui';
import { uid } from '../../utils/storage';

interface Props {
  receta: Receta;
  foods: Alimento[];
  /** Intercambios pautados de la comida donde se va a usar. */
  requeridos: ExchangeCounts;
  onGuardar: (patch: Partial<Receta>) => void;
  onCerrar: () => void;
}

/**
 * Edición rápida de una receta desde el plan: cambiar el nombre, añadir o
 * quitar ingredientes y ver al momento si sigue cuadrando con lo pautado.
 */
export function RecipeQuickEditor({ receta, foods, requeridos, onGuardar, onCerrar }: Props) {
  const [nombre, setNombre] = useState(receta.nombre);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>(receta.ingredientes);
  const [preparacion, setPreparacion] = useState(receta.preparacion);

  const composicion = useMemo(
    () => composicionDesdeIngredientes({ ingredientes }, foods),
    [ingredientes, foods],
  );

  /**
   * La receta es la unidad base del escalado: se compara su composición con
   * el reparto de la comida para ver qué grupos cubre y en qué proporción.
   */
  const cobertura = useMemo(() => {
    const grupos = new Set<ExchangeGroupId>([
      ...(Object.keys(requeridos) as ExchangeGroupId[]),
      ...(Object.keys(composicion.base) as ExchangeGroupId[]),
    ]);
    return [...grupos]
      .filter((g) => !EXCHANGE_GROUPS[g]?.ilimitado)
      .filter((g) => (requeridos[g] ?? 0) > 0 || !!composicion.base[g])
      .sort((a, b) => EXCHANGE_GROUPS[a].orden - EXCHANGE_GROUPS[b].orden)
      .map((g) => {
        const pide = requeridos[g] ?? 0;
        const base = composicion.base[g];
        const aporta = typeof base === 'number' ? base : 0;
        return {
          grupo: g,
          pide,
          aporta,
          /** Cuánto habría que multiplicar la receta para cubrir ese grupo. */
          factor: aporta > 0 ? pide / aporta : 0,
          estado:
            aporta === 0 && pide > 0
              ? ('falta' as const)
              : pide === 0 && aporta > 0
                ? ('sobra' as const)
                : ('ok' as const),
        };
      });
  }, [requeridos, composicion.base]);

  const factores = cobertura.filter((c) => c.estado === 'ok' && c.factor > 0).map((c) => c.factor);
  const escaladoUniforme =
    factores.length > 1 ? Math.max(...factores) / Math.min(...factores) < 1.01 : true;

  const set = (i: number, patch: Partial<Ingrediente>) =>
    setIngredientes((xs) => xs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const añadir = () =>
    setIngredientes((xs) => [
      ...xs,
      {
        id: uid('i_'),
        nombre: '',
        cantidad_base: null,
        unidad: 'g',
        grupo: 'proteicos_magros',
        escalable: true,
        opcional: false,
      },
    ]);

  return (
    <div className="rounded-xl border border-brand-300 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="flex-1">
          <span className="mb-0.5 block text-[10px] text-slate-500">Nombre del plato</span>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full text-sm"
          />
        </label>
        <Button variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button
          onClick={() =>
            onGuardar({
              nombre: nombre.trim() || receta.nombre,
              ingredientes,
              preparacion,
              base: composicion.base,
            })
          }
        >
          Guardar receta
        </Button>
      </div>

      {/* Cobertura contra lo pautado */}
      <div className="mb-3 rounded-lg bg-brand-50/60 p-3">
        <p className="text-[11px] font-medium text-brand-800">Frente a lo pautado en esta comida</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {cobertura.map((c) => (
            <span
              key={c.grupo}
              className={`tnum rounded-lg border px-2 py-0.5 text-[11px] ${
                c.estado === 'falta'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : c.estado === 'sobra'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-brand-200 bg-white text-slate-700'
              }`}
              title={
                c.estado === 'ok' && c.factor
                  ? `La receta se multiplicará ×${fmt(c.factor, 2)} para este grupo`
                  : undefined
              }
            >
              {EXCHANGE_GROUPS[c.grupo].nombre.toLowerCase()}: {fmt(c.aporta, c.aporta % 1 ? 1 : 0)}{' '}
              base → pide {fmt(c.pide, c.pide % 1 ? 1 : 0)}
              {c.estado === 'ok' && c.factor > 0 && (
                <span className="ml-1 text-brand-600">×{fmt(c.factor, c.factor % 1 ? 1 : 0)}</span>
              )}
            </span>
          ))}
          {!cobertura.length && (
            <span className="text-[11px] text-slate-400">
              Añade ingredientes para ver cómo encaja.
            </span>
          )}
        </div>

        {cobertura.some((c) => c.estado === 'falta') && (
          <p className="mt-1.5 text-[11px] text-red-700">
            Faltan grupos que esta comida sí pide:{' '}
            {cobertura
              .filter((c) => c.estado === 'falta')
              .map((c) => EXCHANGE_GROUPS[c.grupo].nombre.toLowerCase())
              .join(', ')}
            . El cliente tendría que completarlos aparte.
          </p>
        )}
        {cobertura.some((c) => c.estado === 'sobra') && (
          <p className="mt-1.5 text-[11px] text-amber-700">
            Aporta grupos que esta comida no pide:{' '}
            {cobertura
              .filter((c) => c.estado === 'sobra')
              .map((c) => EXCHANGE_GROUPS[c.grupo].nombre.toLowerCase())
              .join(', ')}
            .
          </p>
        )}
        {!escaladoUniforme && (
          <p className="mt-1.5 text-[11px] text-slate-500">
            Cada grupo se multiplica por un factor distinto: los ingredientes no crecen todos igual.
          </p>
        )}
        <p className="tnum mt-1.5 text-[11px] text-slate-500">
          Receta base: {fmt(composicion.kcal)} kcal · P {fmt(composicion.macros.proteina, 1)} g · HC{' '}
          {fmt(composicion.macros.hc, 1)} g · G {fmt(composicion.macros.grasa, 1)} g
        </p>
      </div>

      {/* Ingredientes */}
      <div className="space-y-2">
        {ingredientes.map((ing, i) => {
          const food = ing.foodId ? foods.find((f) => f.id === ing.foodId) : undefined;
          const gpi = food ? gramosPorIntercambio(food) : undefined;
          return (
            <div key={ing.id} className="grid items-start gap-2 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <FoodPicker
                  foods={foods}
                  value={ing.foodId}
                  nombreLibre={ing.nombre}
                  placeholder="Escribe un alimento…"
                  onLibre={(n) => set(i, { nombre: n, foodId: undefined })}
                  onSelect={(f) =>
                    set(i, {
                      foodId: f.id,
                      nombre: f.nombre,
                      grupo: f.grupo,
                      unidad: f.equivalencia_cocido ? 'g crudo' : (f.unidad ?? 'g'),
                      cantidad_base: ing.cantidad_base || f.gramos,
                    })
                  }
                />
                {gpi && ing.cantidad_base != null && (
                  <p className="tnum mt-0.5 text-[10px] text-slate-500">
                    {fmt(ing.cantidad_base / gpi, 2)} intercambios de{' '}
                    {EXCHANGE_GROUPS[ing.grupo as ExchangeGroupId]?.nombre.toLowerCase()}
                  </p>
                )}
              </div>

              <Input
                className="text-center sm:col-span-2"
                type="number"
                placeholder="—"
                value={ing.cantidad_base ?? ''}
                onChange={(e) =>
                  set(i, {
                    cantidad_base: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
              <Input
                className="sm:col-span-2"
                value={ing.unidad}
                onChange={(e) => set(i, { unidad: e.target.value })}
              />

              <div className="flex items-center gap-2 text-[11px] text-slate-500 sm:col-span-3">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={ing.opcional}
                    onChange={(e) => set(i, { opcional: e.target.checked })}
                    className="accent-brand-600"
                  />
                  opcional
                </label>
                <button
                  onClick={() => setIngredientes((xs) => xs.filter((_, x) => x !== i))}
                  className="ml-auto text-red-500 hover:underline"
                  aria-label={`Quitar ${ing.nombre || 'ingrediente'}`}
                >
                  Quitar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={añadir}>
          + Ingrediente
        </Button>
        <span className="text-[11px] text-slate-400">
          Los grupos disponibles son:{' '}
          {EXCHANGE_GROUP_LIST.filter((g) => !g.ilimitado)
            .slice(0, 4)
            .map((g) => g.nombre.toLowerCase())
            .join(', ')}
          …
        </span>
      </div>

      <label className="mt-3 block">
        <span className="mb-0.5 block text-[10px] text-slate-500">Preparación</span>
        <textarea
          value={preparacion}
          onChange={(e) => setPreparacion(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-400"
        />
      </label>
    </div>
  );
}
