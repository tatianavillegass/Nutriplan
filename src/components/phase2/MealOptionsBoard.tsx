import { useMemo, useState } from 'react';
import { EXCHANGE_GROUPS, type MacroBucket } from '../../data/exchangeGroups';
import type { Alimento } from '../../types/food';
import { formatFoodOption } from '../../types/food';
import type { DayType, Meal } from '../../types/plan';
import { bucketExchanges } from '../../utils/exchanges';
import { alimentosDeComida, notaAceite, repartoElegible } from '../../utils/pantry';

export type BoardMode = 'documento' | 'interactivo' | 'editor';

const BUCKET_LABEL: Record<MacroBucket, string> = {
  proteina: 'Proteína',
  carbohidrato: 'Carbohidrato',
  grasa: 'Grasa',
};

interface Props {
  dayType: DayType;
  meal: Meal;
  foods: Alimento[];
  mode: BoardMode;
  onToggleExcluir?: (foodId: string) => void;
  onNota?: (texto: string) => void;
  onPostre?: (texto: string) => void;
}

export function MealOptionsBoard({
  dayType,
  meal,
  foods,
  mode,
  onToggleExcluir,
  onNota,
  onPostre,
}: Props) {
  const excluidos = dayType.alimentosExcluidos ?? [];
  const { reparto, reserva } = repartoElegible(dayType, meal);
  const aceite = notaAceite(foods, reserva);
  const counts = bucketExchanges(reparto);
  /** La despensa de esta comida manda sobre el catálogo general. */
  const despensa = useMemo(
    () => alimentosDeComida(dayType, meal, foods),
    [dayType, meal, foods],
  );
  const [picked, setPicked] = useState<Record<string, number>>({});

  const porBucket = useMemo(() => {
    const out: Record<MacroBucket, Alimento[]> = { proteina: [], carbohidrato: [], grasa: [] };
    const lista = mode === 'editor' ? foods.filter((f) => f.comidas_sugeridas.includes(meal.slot)) : despensa;
    for (const f of lista) {
      const g = f.grupo ? EXCHANGE_GROUPS[f.grupo] : undefined;
      if (!g || g.ilimitado) continue;
      out[g.bucket].push(f);
    }
    return out;
  }, [foods, despensa, meal.slot, mode]);

  const grasaProt = useMemo(
    () => foods.filter((f) => f.grasa_prot && f.comidas_sugeridas.includes(meal.slot) && !excluidos.includes(f.id)),
    [foods, meal.slot, excluidos],
  );

  const buckets: MacroBucket[] = ['proteina', 'carbohidrato', 'grasa'];
  const esComidaPrincipal = meal.slot === 'comida' || meal.slot === 'cena';

  const pickedIn = (b: MacroBucket) =>
    porBucket[b].reduce((s, f) => s + (picked[f.id] ?? 0) * f.intercambios, 0);

  return (
    <div className="print-sheet rounded-xl border border-brand-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 border-b border-brand-100 pb-2 text-sm font-bold tracking-widest text-brand-800 uppercase">
        {meal.nombre}
      </h3>

      <div className="grid gap-6 md:grid-cols-3">
        {buckets.map((b) => {
          const n = counts[b];
          const lista = porBucket[b];
          if (!n && mode !== 'editor') return <div key={b} />;
          const elegidos = pickedIn(b);
          const completo = elegidos === n;

          return (
            <div key={b}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h4 className="text-xs font-semibold text-brand-700">
                  {BUCKET_LABEL[b]}: Escoge {n || 0}
                </h4>
                {mode === 'interactivo' && !!n && (
                  <span
                    className={`tnum rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      completo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {elegidos}/{n} {completo && '✓'}
                  </span>
                )}
              </div>

              <ul className="space-y-1">
                {lista.map((f) => {
                  const excluido = excluidos.includes(f.id);
                  const sel = picked[f.id] ?? 0;
                  return (
                    <li key={f.id}>
                      {mode === 'editor' ? (
                        <label
                          className={`flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs transition hover:bg-slate-50 ${
                            excluido ? 'text-slate-300 line-through' : 'text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!excluido}
                            onChange={() => onToggleExcluir?.(f.id)}
                            className="mt-0.5 accent-brand-600"
                          />
                          <span>{formatFoodOption(f)}</span>
                        </label>
                      ) : mode === 'interactivo' ? (
                        <button
                          onClick={() =>
                            setPicked((p) => ({ ...p, [f.id]: ((p[f.id] ?? 0) + 1) % 3 }))
                          }
                          className={`flex w-full items-start gap-2 rounded px-1.5 py-1 text-left text-xs transition ${
                            sel ? 'bg-brand-50 font-medium text-brand-800' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="tnum w-4 shrink-0 text-center text-[10px] text-brand-600">
                            {sel ? `${sel}×` : '·'}
                          </span>
                          <span>{formatFoodOption(f)}</span>
                        </button>
                      ) : (
                        <div className="flex items-start gap-2 px-1.5 py-0.5 text-xs text-slate-600">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-300" />
                          <span>{formatFoodOption(f)}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
                {!lista.length && (
                  <li className="px-1.5 py-1 text-xs text-slate-300">Sin opciones para esta comida</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {meal.slot === 'merienda' && grasaProt.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-3">
          <h4 className="mb-1.5 text-xs font-semibold text-brand-700">Grasa Prot</h4>
          <p className="text-xs text-slate-600">
            {grasaProt.map((f) => formatFoodOption(f)).join(' · ')}
          </p>
        </div>
      )}

      {aceite && (
        <p className="mt-3 text-[11px] text-amber-800">
          <strong className="font-medium">{aceite}</strong> — ya reservado.
        </p>
      )}

      {esComidaPrincipal && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          Verdura ilimitada (mínimo ½ plato: 200 g)
        </p>
      )}

      <div className="mt-4 space-y-2">
        <div className="flex items-start gap-2">
          <span className="mt-1.5 text-xs font-semibold text-slate-500">Nota:</span>
          {mode === 'documento' ? (
            <span className="mt-1.5 flex-1 border-b border-dotted border-slate-300 text-xs text-slate-600">
              {dayType.notas[meal.id] || ' '}
            </span>
          ) : (
            <input
              value={dayType.notas[meal.id] ?? ''}
              onChange={(e) => onNota?.(e.target.value)}
              placeholder="Añadir nota para esta comida…"
              className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400"
            />
          )}
        </div>

        {meal.slot === 'cena' && (
          <div className="flex items-start gap-2">
            <span className="mt-1.5 text-xs font-semibold text-slate-500">Postre:</span>
            {mode === 'documento' ? (
              <span className="mt-1.5 flex-1 border-b border-dotted border-slate-300 text-xs text-slate-600">
                {dayType.postre || ' '}
              </span>
            ) : (
              <input
                value={dayType.postre ?? ''}
                onChange={(e) => onPostre?.(e.target.value)}
                placeholder="Postre…"
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
