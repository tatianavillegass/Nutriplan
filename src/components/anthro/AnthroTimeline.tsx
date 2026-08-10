import type { DeltaMedicion, Medicion } from '../../types/anthropometry';
import { fmt } from '../common/ui';

interface Props {
  evolucion: DeltaMedicion[];
  mediciones: Medicion[];
  seleccionada?: string;
  onSeleccionar: (id: string) => void;
  onEliminar: (id: string) => void;
}

function Delta({ v, decimales, bajarEsMejor }: { v?: number; decimales: number; bajarEsMejor?: boolean }) {
  if (v == null || Math.abs(v) < 0.001) {
    return <span className="text-slate-300">—</span>;
  }
  const mejora = bajarEsMejor ? v < 0 : v > 0;
  return (
    <span className={mejora ? 'text-emerald-700' : 'text-amber-700'}>
      {v > 0 ? '+' : '−'}
      {fmt(Math.abs(v), decimales)}
    </span>
  );
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });

export function AnthroTimeline({
  evolucion,
  mediciones,
  seleccionada,
  onSeleccionar,
  onEliminar,
}: Props) {
  if (!mediciones.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {mediciones.map((m, i) => (
          <div key={m.id} className="group relative">
            <button
              onClick={() => onSeleccionar(m.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                m.id === seleccionada
                  ? 'border-brand-500 bg-brand-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
              }`}
            >
              {fecha(m.fecha)}
              {i === 0 && <span className="ml-1 opacity-60">· inicial</span>}
              {i === mediciones.length - 1 && i > 0 && <span className="ml-1 opacity-60">· última</span>}
            </button>
            <button
              onClick={() => onEliminar(m.id)}
              className="absolute -top-1.5 -right-1.5 hidden h-4 w-4 rounded-full bg-slate-200 text-[10px] leading-none text-slate-600 group-hover:block hover:bg-red-500 hover:text-white"
              title="Eliminar medición"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {evolucion.length > 0 && mediciones.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1.5 text-left text-[11px] font-medium text-slate-400"> </th>
                <th className="py-1.5 text-right text-[11px] font-medium text-slate-400">Inicial</th>
                <th className="py-1.5 text-right text-[11px] font-medium text-slate-400">Anterior</th>
                <th className="py-1.5 text-right text-[11px] font-medium text-slate-400">Actual</th>
                <th className="py-1.5 text-right text-[11px] font-medium text-slate-400">Δ anterior</th>
                <th className="py-1.5 text-right text-[11px] font-medium text-slate-400">Δ inicial</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {evolucion.map((e) => (
                <tr key={e.key} className="border-b border-slate-50">
                  <td className="py-1.5 text-xs text-slate-600">
                    {e.label}
                    {e.unidad && <span className="ml-1 text-[10px] text-slate-400">{e.unidad}</span>}
                  </td>
                  <td className="py-1.5 text-right text-xs text-slate-400">
                    {e.inicial != null ? fmt(e.inicial, e.decimales) : '—'}
                  </td>
                  <td className="py-1.5 text-right text-xs text-slate-400">
                    {e.previo != null ? fmt(e.previo, e.decimales) : '—'}
                  </td>
                  <td className="py-1.5 text-right text-xs font-medium text-slate-800">
                    {e.actual != null ? fmt(e.actual, e.decimales) : '—'}
                  </td>
                  <td className="py-1.5 text-right text-xs">
                    <Delta v={e.deltaPrevio} decimales={e.decimales} bajarEsMejor={e.bajarEsMejor} />
                  </td>
                  <td className="py-1.5 text-right text-xs">
                    <Delta v={e.deltaInicial} decimales={e.decimales} bajarEsMejor={e.bajarEsMejor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-400">
            Verde = va en la dirección del objetivo. Las medidas que no se hayan tomado no aparecen.
          </p>
        </div>
      )}
    </div>
  );
}
