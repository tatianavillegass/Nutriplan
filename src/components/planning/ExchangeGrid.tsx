import { EXCHANGE_GROUP_LIST, type ExchangeGroupId } from '../../data/exchangeGroups';
import type { DayType } from '../../types/plan';
import { exchangesToMacros, exchangesToKcal, gridTotals, groupTotal } from '../../utils/exchanges';
import { kcalFromMacros } from '../../utils/macros';
import { MIN_PROT_GKG_COMIDA_PRINCIPAL } from '../../utils/validation';
import { fmt } from '../common/ui';

interface Props {
  dayType: DayType;
  peso: number;
  onCell: (mealId: string, group: ExchangeGroupId, value: number) => void;
  onRenameMeal: (mealId: string, nombre: string) => void;
  onRemoveMeal: (mealId: string) => void;
}

function Stepper({
  value,
  onChange,
  accent,
}: {
  value: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  const active = value > 0;
  return (
    <div
      className={`flex items-center justify-between rounded-md border px-1 py-0.5 transition ${
        active ? 'border-transparent' : 'border-transparent hover:bg-slate-50'
      }`}
      style={active ? { backgroundColor: `${accent}14` } : undefined}
    >
      <button
        onClick={() => onChange(value - 0.5)}
        disabled={value <= 0}
        className="h-5 w-5 rounded text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:opacity-20"
        aria-label="Restar medio intercambio"
      >
        −
      </button>
      <span
        className={`tnum w-8 text-center text-sm ${active ? 'font-semibold' : 'text-slate-300'}`}
        style={active ? { color: accent } : undefined}
      >
        {active ? value : '·'}
      </span>
      <button
        onClick={() => onChange(value + 0.5)}
        className="h-5 w-5 rounded text-slate-400 transition hover:bg-white hover:text-slate-700"
        aria-label="Sumar medio intercambio"
      >
        +
      </button>
    </div>
  );
}

export function ExchangeGrid({ dayType, peso, onCell, onRenameMeal, onRemoveMeal }: Props) {
  const { meals, grid } = dayType;
  const totales = gridTotals(grid, meals);

  const macrosPorComida = meals.map((m) => exchangesToMacros(grid[m.id] ?? {}));
  const macrosTotal = exchangesToMacros(totales);

  const cellCls = 'px-1.5 py-1 border-l border-slate-100';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-52 bg-white px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              Grupo de intercambio
            </th>
            {meals.map((m) => (
              <th key={m.id} className="border-l border-slate-100 px-1.5 py-2 align-bottom">
                <div className="group relative">
                  <input
                    value={m.nombre}
                    onChange={(e) => onRenameMeal(m.id, e.target.value)}
                    className="w-full rounded bg-transparent px-1 py-0.5 text-center text-xs font-semibold text-brand-800 outline-none hover:bg-brand-50 focus:bg-brand-50"
                  />
                  <button
                    onClick={() => onRemoveMeal(m.id)}
                    className="absolute -top-1 -right-1 hidden h-4 w-4 rounded-full bg-slate-200 text-[10px] leading-none text-slate-600 group-hover:block hover:bg-red-500 hover:text-white no-print"
                    title="Quitar comida"
                  >
                    ×
                  </button>
                </div>
              </th>
            ))}
            <th className="border-l-2 border-brand-200 bg-brand-50/60 px-2 py-2 text-center text-xs font-semibold text-brand-800">
              TOTAL
            </th>
          </tr>
        </thead>

        <tbody>
          {EXCHANGE_GROUP_LIST.map((g) => {
            const total = groupTotal(grid, g.id, meals);
            return (
              <tr key={g.id} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: g.color }} />
                    <span className="text-xs text-slate-700">{g.nombre}</span>
                    {g.ilimitado && (
                      <span className="rounded bg-emerald-50 px-1 text-[9px] font-medium text-emerald-700">
                        ilimitado
                      </span>
                    )}
                  </div>
                  <div className="tnum mt-0.5 pl-4.5 text-[10px] text-slate-400">
                    HC {g.hc} · P {g.proteina} · G {g.grasa} · {kcalFromMacros(g)} kcal
                  </div>
                </td>
                {meals.map((m) => (
                  <td key={m.id} className={cellCls}>
                    <Stepper
                      value={grid[m.id]?.[g.id] ?? 0}
                      accent={g.color}
                      onChange={(v) => onCell(m.id, g.id, v)}
                    />
                  </td>
                ))}
                <td className="tnum border-l-2 border-brand-200 bg-brand-50/60 px-2 py-1 text-center text-sm font-semibold text-brand-900">
                  {total || <span className="text-brand-300">·</span>}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot className="tnum">
          {(
            [
              ['Proteína (g)', (i: number) => (i < 0 ? macrosTotal.proteina : macrosPorComida[i].proteina), 1],
              ['Carbohidratos (g)', (i: number) => (i < 0 ? macrosTotal.hc : macrosPorComida[i].hc), 1],
              ['Grasas (g)', (i: number) => (i < 0 ? macrosTotal.grasa : macrosPorComida[i].grasa), 1],
            ] as const
          ).map(([label, get, dec]) => (
            <tr key={label} className="border-t border-slate-100 bg-slate-50/70">
              <td className="sticky left-0 z-10 bg-slate-50/70 px-3 py-1 text-[11px] font-medium text-slate-500">
                {label}
              </td>
              {meals.map((_, i) => (
                <td key={i} className="border-l border-slate-100 px-1.5 py-1 text-center text-xs text-slate-600">
                  {fmt(get(i), dec)}
                </td>
              ))}
              <td className="border-l-2 border-brand-200 bg-brand-50/60 px-2 py-1 text-center text-xs font-semibold text-brand-900">
                {fmt(get(-1), dec)}
              </td>
            </tr>
          ))}

          <tr className="border-t-2 border-brand-200 bg-brand-50">
            <td className="sticky left-0 z-10 bg-brand-50 px-3 py-1.5 text-[11px] font-semibold text-brand-800 uppercase">
              Calorías (kcal)
            </td>
            {meals.map((m) => (
              <td key={m.id} className="border-l border-brand-100 px-1.5 py-1.5 text-center text-xs font-semibold text-brand-900">
                {fmt(exchangesToKcal(grid[m.id] ?? {}))}
              </td>
            ))}
            <td className="border-l-2 border-brand-300 bg-brand-100 px-2 py-1.5 text-center text-sm font-bold text-brand-900">
              {fmt(exchangesToKcal(totales))}
            </td>
          </tr>

          {/* g/kg por comida (§3) */}
          <tr className="border-t border-slate-100">
            <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500">
              g/kg por comida
            </td>
            {meals.map((m, i) => {
              const mm = macrosPorComida[i];
              const pGkg = peso > 0 ? mm.proteina / peso : 0;
              const bajo = pGkg > 0 && pGkg < MIN_PROT_GKG_COMIDA_PRINCIPAL;
              return (
                <td key={m.id} className="border-l border-slate-100 px-1 py-1.5 text-center">
                  <div className="space-y-0.5 text-[10px] leading-tight">
                    <div className={bajo ? 'font-medium text-amber-600' : 'text-slate-500'}>
                      P {pGkg.toFixed(2)}
                      {bajo && ' ⚠'}
                    </div>
                    <div className="text-slate-400">HC {(peso > 0 ? mm.hc / peso : 0).toFixed(2)}</div>
                    <div className="text-slate-400">G {(peso > 0 ? mm.grasa / peso : 0).toFixed(2)}</div>
                  </div>
                </td>
              );
            })}
            <td className="border-l-2 border-brand-200 bg-brand-50/60 px-1 py-1.5 text-center">
              <div className="space-y-0.5 text-[10px] leading-tight text-brand-800">
                <div>P {(peso > 0 ? macrosTotal.proteina / peso : 0).toFixed(2)}</div>
                <div>HC {(peso > 0 ? macrosTotal.hc / peso : 0).toFixed(2)}</div>
                <div>G {(peso > 0 ? macrosTotal.grasa / peso : 0).toFixed(2)}</div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-2 text-[11px] text-slate-400">
        ⚠ marca comidas con menos de {MIN_PROT_GKG_COMIDA_PRINCIPAL} g/kg de proteína. Los pasos son de
        medio intercambio.
      </p>
    </div>
  );
}
