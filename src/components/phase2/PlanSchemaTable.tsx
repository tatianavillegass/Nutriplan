import type { DayType } from '../../types/plan';
import { bucketExchanges, gridTotals } from '../../utils/exchanges';

const fmtEx = (n: number) => (n ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : '');

/** §6.1 — "ESQUEMA DEL PLAN": una tabla por tipo de día, limpia e imprimible. */
export function PlanSchemaTable({ dayType }: { dayType: DayType }) {
  const totales = bucketExchanges(gridTotals(dayType.grid, dayType.meals));

  return (
    <div className="print-sheet rounded-xl border border-brand-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-center text-base font-semibold tracking-wide text-brand-800">
        Plan Días {dayType.nombre}
      </h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-2/5 border border-brand-200 bg-brand-700 px-3 py-2 text-left text-xs font-semibold text-white"></th>
            <th className="border border-brand-200 bg-brand-700 px-3 py-2 text-center text-xs font-semibold text-white">
              Proteína
            </th>
            <th className="border border-brand-200 bg-brand-700 px-3 py-2 text-center text-xs font-semibold text-white">
              Carbohidrato
            </th>
            <th className="border border-brand-200 bg-brand-700 px-3 py-2 text-center text-xs font-semibold text-white">
              Grasa
            </th>
          </tr>
        </thead>
        <tbody className="tnum">
          {dayType.meals.map((m) => {
            const b = bucketExchanges(dayType.grid[m.id] ?? {});
            return (
              <tr key={m.id}>
                <td className="border border-brand-100 px-3 py-2 font-medium text-slate-700">{m.nombre}</td>
                <td className="border border-brand-100 px-3 py-2 text-center text-slate-800">{fmtEx(b.proteina)}</td>
                <td className="border border-brand-100 px-3 py-2 text-center text-slate-800">{fmtEx(b.carbohidrato)}</td>
                <td className="border border-brand-100 px-3 py-2 text-center text-slate-800">{fmtEx(b.grasa)}</td>
              </tr>
            );
          })}
          <tr className="bg-brand-50 font-semibold">
            <td className="border border-brand-200 px-3 py-2 text-brand-900 uppercase">Total</td>
            <td className="border border-brand-200 px-3 py-2 text-center text-brand-900">{fmtEx(totales.proteina)}</td>
            <td className="border border-brand-200 px-3 py-2 text-center text-brand-900">{fmtEx(totales.carbohidrato)}</td>
            <td className="border border-brand-200 px-3 py-2 text-center text-brand-900">{fmtEx(totales.grasa)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-slate-500">
        Verdura ilimitada (mínimo ½ plato: 200 g) en comida y cena.
      </p>
    </div>
  );
}
