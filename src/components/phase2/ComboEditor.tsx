import { useMemo, useState } from 'react';
import type { Alimento } from '../../types/food';
import type { CombinacionGuardada, DayType, Meal } from '../../types/plan';
import type { MacroBucket } from '../../data/exchangeGroups';
import { BUCKET_LABEL, describirReparto } from '../../utils/mealOptions';
import { generarCombinaciones, objetivoDeBucket, validarCombo } from '../../utils/combos';
import { alimentosDeBucket, notaAceite, repartoElegible } from '../../utils/pantry';
import { EXCHANGE_GROUPS, type ExchangeGroupId } from '../../data/exchangeGroups';
import {
  desdeOpcion,
  guardadasDe,
  guardarCombinacion,
  materializar,
  quitarCombinacion,
  sumarItem,
  volverAPropuestas,
} from '../../utils/combosGuardados';
import { gramosPorIntercambio } from '../../utils/recipeComposition';
import { escalarMedida } from '../../utils/measures';
import { FoodPicker } from '../food/FoodPicker';
import { Button, fmt } from '../common/ui';
import { uid } from '../../utils/storage';

interface Props {
  dayType: DayType;
  meal: Meal;
  foods: Alimento[];
  onCombinaciones: (c: Record<string, CombinacionGuardada[]>) => void;
  /** Cambiar la reserva de aceite de cocción de esta comida. */
  onAceite?: (porciones: number) => void;
  /** Nota libre que el cliente verá en esta comida. */
  onNota?: (texto: string) => void;
  /** Por qué un alimento está vetado para este cliente. */
  motivoBloqueo?: (food: Alimento) => string | undefined;
}

const BUCKETS: MacroBucket[] = ['proteina', 'carbohidrato', 'grasa'];

/**
 * Las combinaciones que verá el cliente en Fase 2.
 *
 * La app propone; la nutricionista decide. Puede quedarse con las propuestas,
 * quitarlas o componer las suyas: la validación avisa si falta una familia,
 * sobra otra o se pasa de calorías.
 */
export function ComboEditor({
  dayType,
  meal,
  foods,
  onCombinaciones,
  onAceite,
  onNota,
  motivoBloqueo,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, { foodId: string; porciones: number }[]>>(
    {},
  );

  const { reparto, reserva } = repartoElegible(dayType, meal);
  const aceite = notaAceite(foods, reserva);

  const columnas = useMemo(
    () =>
      BUCKETS.map((bucket) => {
        const objetivo = objetivoDeBucket(reparto, bucket);
        if (!objetivo) return undefined;
        const despensa = alimentosDeBucket(dayType, meal, bucket, foods);
        return {
          bucket,
          objetivo,
          despensa,
          /** Para el buscador: cualquier alimento del macro, de cualquier comida. */
          todos: foods.filter(
            (f) =>
              !!f.grupo &&
              EXCHANGE_GROUPS[f.grupo].bucket === bucket &&
              !EXCHANGE_GROUPS[f.grupo].ilimitado,
          ),
          propuestas: generarCombinaciones(objetivo, despensa, { limite: 6 }),
          guardadas: guardadasDe(dayType, meal.id, bucket),
        };
      }).filter((x): x is NonNullable<typeof x> => !!x),
    [reparto, dayType, meal, foods],
  );

  const totalGuardadas = columnas.reduce((s, c) => s + c.guardadas.length, 0);

  if (!columnas.length) return null;

  const items = (bucket: MacroBucket) => borrador[bucket] ?? [];

  const setItems = (bucket: MacroBucket, next: { foodId: string; porciones: number }[]) =>
    setBorrador((b) => ({ ...b, [bucket]: next }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-baseline justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
          {meal.nombre}
        </span>
        <span className="text-[11px] text-slate-400">
          {totalGuardadas > 0
            ? `${totalGuardadas} combinaciones propias`
            : 'usando las propuestas'}
          <span className="ml-2 text-brand-600">{abierto ? 'ocultar' : 'editar'}</span>
        </span>
      </button>

      {abierto && (
        <div className="space-y-5 border-t border-slate-100 px-4 py-3">
          {(dayType.grid[meal.id]?.grasas ?? 0) > 0 && onAceite && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50/60 px-3 py-2 text-[11px] text-slate-700">
              <span>Reservar para aceite de cocción</span>
              <input
                type="number"
                min={0}
                max={dayType.grid[meal.id]?.grasas ?? 0}
                step="0.5"
                value={reserva}
                onChange={(e) => onAceite(Math.max(0, Number(e.target.value) || 0))}
                className="tnum w-16 rounded border border-slate-200 px-2 py-0.5 text-xs outline-none focus:border-brand-400"
              />
              <span className="text-slate-500">
                de {fmt(dayType.grid[meal.id]?.grasas ?? 0)} porciones de grasa
              </span>
              {aceite && <span className="text-amber-800">· {aceite}</span>}
            </div>
          )}

          {onNota && (
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-500">
                Nota para el cliente en {meal.nombre.toLowerCase()} (opcional)
              </span>
              <input
                value={dayType.notas?.[meal.id] ?? ''}
                onChange={(e) => onNota(e.target.value)}
                placeholder="Verdura libre, café sin azúcar…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400"
              />
            </label>
          )}

          {columnas.map((col) => {
            const enBorrador = items(col.bucket);
            const validacion = validarCombo(
              col.objetivo,
              enBorrador
                .map((i) => ({
                  grupo: foods.find((f) => f.id === i.foodId)?.grupo,
                  intercambios: i.porciones,
                }))
                .filter((i): i is { grupo: ExchangeGroupId; intercambios: number } => !!i.grupo),
            );

            return (
              <div key={col.bucket} className="rounded-lg border border-slate-100 p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800">
                    {BUCKET_LABEL[col.bucket]}
                    <span className="tnum ml-1.5 font-normal text-slate-400">
                      {describirReparto(col.objetivo.porSubgrupo)} · hasta{' '}
                      {fmt(col.objetivo.kcalMaximas)} kcal
                    </span>
                  </p>
                  {col.guardadas.length > 0 && (
                    <button
                      onClick={() =>
                        onCombinaciones(volverAPropuestas(dayType, meal.id, col.bucket))
                      }
                      className="text-[11px] text-brand-600 underline"
                    >
                      Volver a las propuestas
                    </button>
                  )}
                </div>

                {/* Lo que se va a mostrar al cliente */}
                {col.guardadas.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {col.guardadas.map((g) => {
                      const o = materializar(g, foods);
                      return (
                        <li
                          key={g.id}
                          className="flex items-baseline gap-2 rounded-lg bg-brand-50 px-2.5 py-1.5"
                        >
                          <span className="flex-1 text-[12px] leading-snug text-brand-900">
                            {o?.texto ?? '—'}
                          </span>
                          <button
                            onClick={() =>
                              onCombinaciones(quitarCombinacion(dayType, meal.id, g.id))
                            }
                            className="shrink-0 text-slate-400 transition hover:text-red-600"
                            aria-label="Quitar combinación"
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Propuestas para añadir */}
                <p className="mb-1 text-[10px] tracking-wide text-slate-400 uppercase">
                  {col.guardadas.length ? 'Añadir de las propuestas' : 'Propuestas'}
                </p>
                <ul className="space-y-0.5">
                  {col.propuestas
                    .filter((p) => !col.guardadas.some((g) => g.id === p.id))
                    .map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() =>
                            onCombinaciones(
                              guardarCombinacion(dayType, meal.id, desdeOpcion(p)),
                            )
                          }
                          className="flex w-full items-baseline gap-1.5 rounded px-1.5 py-1 text-left text-[12px] leading-snug text-slate-600 transition hover:bg-emerald-50 hover:text-slate-800"
                        >
                          <span className="text-slate-300">+</span>
                          <span className="flex-1">{p.texto}</span>
                        </button>
                      </li>
                    ))}
                  {!col.propuestas.length && (
                    <li className="text-[11px] text-amber-700">
                      No hay combinaciones posibles con la despensa de esta comida. Añade algún
                      alimento de{' '}
                      {col.objetivo.familias.map((f) => f.familia).join(' y ')}.
                    </li>
                  )}
                </ul>

                {/* Componer una a mano */}
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <p className="mb-1 text-[10px] tracking-wide text-slate-400 uppercase">
                    Crear la mía — busca cualquier alimento
                  </p>

                  {enBorrador.length > 0 && (
                    <ul className="mb-1.5 space-y-1">
                      {enBorrador.map((it, idx) => {
                        const food = foods.find((f) => f.id === it.foodId)!;
                        const gpi = gramosPorIntercambio(food) ?? 0;
                        return (
                          <li key={`${it.foodId}-${idx}`} className="flex items-center gap-1.5">
                            <span className="flex-1 text-[11px] text-slate-700">
                              {food.nombre}
                              <span className="tnum ml-1 text-slate-500">
                                {Math.round(gpi * it.porciones)} {food.unidad ?? 'g'}
                              </span>
                              <span className="ml-1 text-[10px] text-slate-400">
                                {escalarMedida(food.medida_casera, it.porciones)}
                              </span>
                            </span>
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={it.porciones}
                              onChange={(e) =>
                                setItems(
                                  col.bucket,
                                  enBorrador.map((x, i) =>
                                    i === idx
                                      ? { ...x, porciones: Math.max(0.5, Number(e.target.value) || 0) }
                                      : x,
                                  ),
                                )
                              }
                              className="tnum w-14 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] outline-none focus:border-brand-400"
                            />
                            <button
                              onClick={() =>
                                setItems(
                                  col.bucket,
                                  enBorrador.filter((_, i) => i !== idx),
                                )
                              }
                              className="text-slate-300 transition hover:text-red-600"
                              aria-label={`Quitar ${food.nombre}`}
                            >
                              ×
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[200px] flex-1">
                      <FoodPicker
                        key={enBorrador.length}
                        foods={col.todos}
                        placeholder={`Añadir ${BUCKET_LABEL[col.bucket].toLowerCase()}…`}
                        limpiarTrasElegir
                        motivoBloqueo={motivoBloqueo}
                        onSelect={(f) => setItems(col.bucket, sumarItem(enBorrador, f.id))}
                      />
                    </div>
                    <Button
                      variant={validacion.valida ? 'primary' : 'outline'}
                      // Antes se quedaba pulsable pero no hacía nada cuando la
                      // combinación no cuadraba, y parecía que la app fallaba.
                      disabled={!enBorrador.length || !validacion.valida}
                      title={
                        !enBorrador.length
                          ? 'Añade algún alimento'
                          : validacion.valida
                            ? undefined
                            : validacion.avisos.join(' · ')
                      }
                      onClick={() => {
                        if (!validacion.valida) return;
                        onCombinaciones(
                          guardarCombinacion(dayType, meal.id, {
                            id: uid('cb_'),
                            bucket: col.bucket,
                            items: enBorrador,
                          }),
                        );
                        setItems(col.bucket, []);
                      }}
                    >
                      Guardar combinación
                    </Button>
                  </div>

                  {enBorrador.length > 0 && (
                    <div className="mt-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {validacion.porFamilia.map((f) => (
                          <span
                            key={f.familia}
                            className={`tnum rounded px-1.5 py-0.5 text-[10px] ${
                              f.ok
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {f.familia} {fmt(f.lleva, f.lleva % 1 ? 1 : 0)}/
                            {fmt(f.pide, f.pide % 1 ? 1 : 0)}
                          </span>
                        ))}
                        <span
                          className={`tnum rounded px-1.5 py-0.5 text-[10px] ${
                            validacion.kcal <= validacion.kcalMaximas * 1.02
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {fmt(validacion.kcal)}/{fmt(validacion.kcalMaximas)} kcal
                        </span>
                      </div>
                      {validacion.avisos.map((a) => (
                        <p key={a} className="mt-1 text-[11px] text-amber-700">
                          {a}
                        </p>
                      ))}
                      {validacion.nota && (
                        <p className="mt-1 text-[11px] text-sky-700">{validacion.nota}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <p className="text-[11px] text-slate-400">
            Mientras no guardes ninguna, el cliente ve las propuestas. En cuanto guardes una, verá
            sólo las tuyas de ese grupo.
          </p>
        </div>
      )}
    </div>
  );
}
