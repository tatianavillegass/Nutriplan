import type { Phase } from '../../types/plan';
import { FASES } from '../../types/plan';

/**
 * Selector de fase de entrega. Las tres son una progresión de autonomía:
 * el cliente empieza en la 1 y va subiendo cuando ya sabe manejarse.
 */
export function PhaseSelector({ value, onChange }: { value: Phase; onChange: (p: Phase) => void }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {FASES.map((p) => {
        const active = value === p.fase;
        return (
          <button
            key={p.fase}
            onClick={() => onChange(p.fase)}
            className={`rounded-xl border p-4 text-left transition ${
              active
                ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100'
                : 'border-slate-200 bg-white hover:border-brand-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  active ? 'border-brand-600' : 'border-slate-300'
                }`}
              >
                {active && <span className="h-2 w-2 rounded-full bg-brand-600" />}
              </span>
              <span
                className={`text-sm font-semibold ${active ? 'text-brand-800' : 'text-slate-700'}`}
              >
                Fase {p.fase} — {p.titulo}
              </span>
            </div>
            <dl className="mt-2.5 space-y-1.5 text-xs">
              <div>
                <dt className="text-slate-400">Qué recibe</dt>
                <dd className="text-slate-600">{p.recibe}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Para quién</dt>
                <dd className="text-slate-600">{p.paraQuien}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Autonomía</dt>
                <dd className="text-slate-600">{p.autonomia}</dd>
              </div>
            </dl>
          </button>
        );
      })}
      <p className="text-[11px] text-slate-500 lg:col-span-3">
        Cambiar de fase <strong>no modifica los intercambios pautados</strong>: solo cambia cómo se le
        presenta el plan al cliente.
      </p>
    </div>
  );
}
