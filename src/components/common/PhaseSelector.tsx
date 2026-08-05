import type { Phase } from '../../types/plan';

const PHASES: { id: Phase; titulo: string; sub: string; recibe: string; para: string }[] = [
  {
    id: 1,
    titulo: 'Fase 1',
    sub: 'Recetas cerradas',
    recibe: 'Recetas concretas con los gramajes ya multiplicados',
    para: 'Cliente nuevo, poca autonomía, quiere que le digan qué comer',
  },
  {
    id: 2,
    titulo: 'Fase 2',
    sub: 'Intercambios abiertos',
    recibe: 'Sus porciones diarias + menú de opciones para armar',
    para: 'Cliente con experiencia, come fuera, quiere flexibilidad',
  },
];

export function PhaseSelector({ value, onChange }: { value: Phase; onChange: (p: Phase) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PHASES.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`rounded-xl border p-4 text-left transition ${
              active
                ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100'
                : 'border-slate-200 bg-white hover:border-brand-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  active ? 'border-brand-600' : 'border-slate-300'
                }`}
              >
                {active && <span className="h-2 w-2 rounded-full bg-brand-600" />}
              </span>
              <span className={`text-sm font-semibold ${active ? 'text-brand-800' : 'text-slate-700'}`}>
                {p.titulo} — {p.sub}
              </span>
            </div>
            <dl className="mt-2.5 space-y-1.5 text-xs">
              <div>
                <dt className="text-slate-400">Qué recibe</dt>
                <dd className="text-slate-600">{p.recibe}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Para quién</dt>
                <dd className="text-slate-600">{p.para}</dd>
              </div>
            </dl>
          </button>
        );
      })}
      <p className="text-[11px] text-slate-500 sm:col-span-2">
        Cambiar de fase <strong>no modifica los intercambios pautados</strong>: solo cambia cómo se le
        presenta el plan al cliente.
      </p>
    </div>
  );
}
