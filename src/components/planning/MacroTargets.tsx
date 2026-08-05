import type { DayType } from '../../types/plan';
import { planTargets } from '../../utils/macros';
import { Card, Field, Input, fmt } from '../common/ui';

interface Props {
  dayType: DayType;
  peso: number;
  caloriasBase: number;
  onChange: (patch: Partial<DayType>) => void;
}

export function MacroTargets({ dayType, peso, caloriasBase, onChange }: Props) {
  const kcal = dayType.caloriasOverride ?? caloriasBase;
  const t = planTargets(kcal, peso, dayType.proteinaGkg, dayType.hcGkg);
  const grasaNegativa = t.grasa < 0;

  const rows = [
    { label: 'Proteína', g: t.proteina, gkg: t.gkg.proteina, pct: t.pct.proteina, color: '#2E6B5E', editable: 'proteinaGkg' as const },
    { label: 'Carbohidratos', g: t.hc, gkg: t.gkg.hc, pct: t.pct.hc, color: '#B08A3E', editable: 'hcGkg' as const },
    { label: 'Grasas', g: t.grasa, gkg: t.gkg.grasa, pct: t.pct.grasa, color: '#D4A04F', editable: null },
  ];

  return (
    <Card
      title="Objetivos de macros"
      subtitle="La grasa siempre sale por diferencia — nunca se introduce a mano"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Calorías del tipo de día" hint={`Base del cliente: ${fmt(caloriasBase)} kcal`}>
          <Input
            type="number"
            value={Math.round(kcal)}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({ caloriasOverride: Math.abs(v - caloriasBase) < 1 ? undefined : v });
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Proteína g/kg">
            <Input
              type="number"
              step="0.1"
              value={dayType.proteinaGkg}
              onChange={(e) => onChange({ proteinaGkg: Number(e.target.value) })}
            />
          </Field>
          <Field label="HC g/kg">
            <Input
              type="number"
              step="0.1"
              value={dayType.hcGkg}
              onChange={(e) => onChange({ hcGkg: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-[11px] tracking-wide text-slate-400 uppercase">
            <th className="pb-1.5 text-left font-medium">Macro</th>
            <th className="pb-1.5 text-right font-medium">Total (g)</th>
            <th className="pb-1.5 text-right font-medium">g/kg</th>
            <th className="pb-1.5 text-right font-medium">% kcal</th>
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-slate-100">
              <td className="py-1.5">
                <span className="inline-flex items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: r.color }} />
                  {r.label}
                  {!r.editable && (
                    <span className="rounded bg-slate-100 px-1 text-[9px] text-slate-500">por diferencia</span>
                  )}
                </span>
              </td>
              <td className="py-1.5 text-right font-medium text-slate-800">{fmt(r.g, 1)}</td>
              <td className="py-1.5 text-right text-slate-600">{r.gkg.toFixed(2)}</td>
              <td className="py-1.5 text-right text-slate-500">{fmt(r.pct, 0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {grasaNegativa && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          La proteína y los carbohidratos ya superan las calorías objetivo: la grasa sale negativa.
          Baja algún g/kg o sube las calorías del día.
        </p>
      )}
    </Card>
  );
}
