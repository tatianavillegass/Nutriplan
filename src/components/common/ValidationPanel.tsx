import type { MacroGrams } from '../../types/calculations';
import { comparePlanned, SEMAFORO_DOT } from '../../utils/validation';
import { Card, fmt } from './ui';

export function ValidationPanel({
  planeado,
  pautado,
}: {
  planeado: MacroGrams;
  pautado: MacroGrams;
}) {
  const rows = comparePlanned(planeado, pautado);

  return (
    <Card title="Planeado vs pautado" subtitle="Verde ≤5% · Ámbar 5–10% · Rojo >10%">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] tracking-wide text-slate-400 uppercase">
            <th className="pb-2 text-left font-medium"></th>
            <th className="pb-2 text-right font-medium">Planeado</th>
            <th className="pb-2 text-right font-medium">Pautado</th>
            <th className="pb-2 text-right font-medium">Dif.</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((r) => {
            const d = r.decimales ?? (r.key === 'kcal' ? 0 : 1);
            return (
              <tr key={r.key} className="border-t border-slate-100">
                <td className="py-1.5 text-left text-slate-600">{r.label}</td>
                <td className="py-1.5 text-right text-slate-500">{fmt(r.planeado, d)}</td>
                <td className="py-1.5 text-right font-medium text-slate-800">{fmt(r.pautado, d)}</td>
                <td
                  className={`py-1.5 text-right font-medium ${
                    r.diferencia >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {r.diferencia >= 0 ? '+' : '−'}
                  {fmt(Math.abs(r.diferencia), d)}
                </td>
                <td className="py-1.5 text-right">
                  <span
                    title={`${r.desviacionPct >= 0 ? '+' : ''}${r.desviacionPct.toFixed(1)}%`}
                    className={`inline-block h-2.5 w-2.5 rounded-full ${SEMAFORO_DOT[r.semaforo]}`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
