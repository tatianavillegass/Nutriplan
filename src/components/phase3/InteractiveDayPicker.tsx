import { useState } from 'react';
import type { Alimento } from '../../types/food';
import { formatFoodOption } from '../../types/food';
import type { DayType } from '../../types/plan';
import { EXCHANGE_GROUPS, type MacroBucket } from '../../data/exchangeGroups';
import {
  balanceComida,
  resumenDia,
  type Seleccion,
  type BalanceBucket,
} from '../../utils/dailyBudget';
import { BUCKET_LABEL } from '../../utils/mealOptions';
import { fmt } from '../common/ui';

interface Props {
  dayType: DayType;
  foods: Alimento[];
}

const ESTADO_CLASES: Record<BalanceBucket['estado'], string> = {
  pendiente: 'bg-slate-100 text-slate-600',
  completo: 'bg-emerald-50 text-emerald-700',
  excedido: 'bg-amber-50 text-amber-800',
  sin_margen: 'bg-red-50 text-red-700',
};

/**
 * FASE 3 — el cliente arma sus platos escogiendo porciones.
 * No se le bloquea si se pasa: se le dice qué le queda para el resto del día.
 */
export function InteractiveDayPicker({ dayType, foods }: Props) {
  const [seleccion, setSeleccion] = useState<Seleccion>({});

  const marcar = (mealId: string, bucket: MacroBucket, delta: number) =>
    setSeleccion((s) => {
      const comida = { ...(s[mealId] ?? {}) };
      const v = Math.max(0, (comida[bucket] ?? 0) + delta);
      if (v === 0) delete comida[bucket];
      else comida[bucket] = v;
      return { ...s, [mealId]: comida };
    });

  const dia = resumenDia(dayType, seleccion);
  const algoElegido = dia.some((d) => d.elegido > 0);

  const opcionesDe = (bucket: MacroBucket, slot: string) =>
    foods.filter((f) => {
      const g = f.grupo ? EXCHANGE_GROUPS[f.grupo] : undefined;
      if (!g || g.ilimitado || g.bucket !== bucket) return false;
      if ((dayType.alimentosExcluidos ?? []).includes(f.id)) return false;
      return f.comidas_sugeridas.includes(slot as never);
    });

  return (
    <div className="space-y-4">
      {/* Resumen del día, siempre visible */}
      <div className="sticky top-16 z-20 rounded-xl border border-brand-200 bg-white/95 p-3 backdrop-blur no-print">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-[11px] font-medium tracking-wide text-brand-800 uppercase">
            Tu día
          </span>
          {dia.map((d) => (
            <span key={d.bucket} className="tnum flex items-baseline gap-1 text-xs">
              <span className="text-slate-500">{BUCKET_LABEL[d.bucket]}</span>
              <strong
                className={`font-medium ${
                  d.restante < 0
                    ? 'text-red-700'
                    : d.restante === 0
                      ? 'text-emerald-700'
                      : 'text-slate-800'
                }`}
              >
                {fmt(d.elegido, d.elegido % 1 ? 1 : 0)}/{fmt(d.pautado, d.pautado % 1 ? 1 : 0)}
              </strong>
              {d.restante > 0 && (
                <span className="text-[10px] text-slate-400">
                  quedan {fmt(d.restante, d.restante % 1 ? 1 : 0)}
                </span>
              )}
            </span>
          ))}
          {algoElegido && (
            <button
              onClick={() => setSeleccion({})}
              className="ml-auto text-[11px] text-brand-600 underline"
            >
              Empezar de nuevo
            </button>
          )}
        </div>
      </div>

      {dayType.meals.map((meal) => {
        const balances = balanceComida(dayType, meal, seleccion);
        if (!balances.length) return null;

        return (
          <section key={meal.id} className="rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-5 py-2.5">
              <h3 className="text-base font-bold tracking-wide text-slate-300 uppercase">
                {meal.nombre}
              </h3>
            </header>

            <div className="grid gap-5 p-5 md:grid-cols-3">
              {balances.map((b) => {
                const opciones = opcionesDe(b.bucket, meal.slot);
                return (
                  <div key={b.bucket}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800">
                        {BUCKET_LABEL[b.bucket]}
                        <span className="ml-1 font-normal text-slate-500">
                          escoge {fmt(b.pautadoComida, b.pautadoComida % 1 ? 1 : 0)}
                        </span>
                      </p>
                      <span
                        className={`tnum rounded px-1.5 py-0.5 text-[10px] ${ESTADO_CLASES[b.estado]}`}
                      >
                        {fmt(b.elegidoComida, b.elegidoComida % 1 ? 1 : 0)}/
                        {fmt(b.pautadoComida, b.pautadoComida % 1 ? 1 : 0)}
                        {b.estado === 'completo' && ' ✓'}
                      </span>
                    </div>

                    <div className="mb-2 flex items-center gap-1">
                      <button
                        onClick={() => marcar(meal.id, b.bucket, -0.5)}
                        disabled={b.elegidoComida <= 0}
                        className="h-6 w-6 rounded border border-slate-200 text-sm text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                        aria-label={`Quitar media porción de ${BUCKET_LABEL[b.bucket]}`}
                      >
                        −
                      </button>
                      <button
                        onClick={() => marcar(meal.id, b.bucket, 0.5)}
                        className="h-6 w-6 rounded border border-slate-200 text-sm text-slate-500 transition hover:bg-slate-50"
                        aria-label={`Añadir media porción de ${BUCKET_LABEL[b.bucket]}`}
                      >
                        +
                      </button>
                      <span className="ml-1 text-[10px] text-slate-400">
                        marca lo que te sirves
                      </span>
                    </div>

                    {b.mensaje && (
                      <p
                        className={`mb-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug ${
                          b.estado === 'sin_margen'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {b.mensaje}
                      </p>
                    )}

                    <ul className="space-y-1">
                      {opciones.slice(0, 10).map((f) => (
                        <li
                          key={f.id}
                          className="flex items-baseline gap-1.5 text-[12px] leading-snug text-slate-600"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                          <span>{formatFoodOption(f)}</span>
                        </li>
                      ))}
                      {!opciones.length && (
                        <li className="text-[11px] text-slate-400">Sin opciones disponibles.</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>

            {dayType.notas?.[meal.id] && (
              <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-600">
                {dayType.notas[meal.id]}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
