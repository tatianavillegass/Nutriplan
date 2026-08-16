import type { Client } from '../../types/client';
import { edadDe } from '../../types/client';
import type { BmrFormulaId } from '../../types/calculations';
import { BMR_FORMULA_LABELS, BMR_FORMULA_ORDER, BMR_FORMULA_NOTES } from '../../utils/bmr';
import { ACTIVITY_FACTORS, ACTIVITY_GROUP_LABELS, GOAL_PRESETS, THERMOGENESIS_FACTOR } from '../../data/activityFactors';
import { multiplierToPct, pctToMultiplier } from '../../utils/energy';
import { useEnergy } from '../../hooks/useEnergy';
import { Card, Field, Input, Select, Stat, fmt, Badge } from './ui';

interface Props {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
}

export function CalorieCalculator({ client, onChange }: Props) {
  const calc = useEnergy(client);
  if (!calc) return null;
  const { bmr, energy, activityFactor } = calc;

  const grouped = {
    base: ACTIVITY_FACTORS.filter((a) => a.grupo === 'base'),
    sedentario_entreno: ACTIVITY_FACTORS.filter((a) => a.grupo === 'sedentario_entreno'),
    ligero_entreno: ACTIVITY_FACTORS.filter((a) => a.grupo === 'ligero_entreno'),
  };

  const pct = multiplierToPct(client.goalMultiplier);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <Card title="Cálculo GET" subtitle="Todo se recalcula en tiempo real">
        <div className="grid gap-4 sm:grid-cols-2">
          {/*
            LA EDAD SALE DE SU FECHA DE NACIMIENTO
            ==========================================================
            El cálculo ya usaba la edad de verdad, pero esta casilla enseñaba
            el número suelto de la ficha: en quien se apuntó por el enlace del
            reto —que da su fecha de nacimiento y no su edad— ponía 0, y
            parecía que el GET estaba mal calculado.

            Con fecha de nacimiento no se escribe: se calcula y se bloquea,
            porque si no cumple años cada 365 días sin que nadie lo toque.
          */}
          <Field
            label={
              client.fechaNacimiento
                ? "Edad (de su fecha de nacimiento)"
                : "Edad (años)"
            }
          >
            <Input
              type="number"
              value={edadDe(client)}
              min={10}
              max={100}
              disabled={!!client.fechaNacimiento}
              onChange={(e) => onChange({ edad: Number(e.target.value) })}
            />
          </Field>
          <Field label="Sexo">
            <Select value={client.sexo} onChange={(e) => onChange({ sexo: e.target.value as Client['sexo'] })}>
              <option value="hombre">Hombre</option>
              <option value="mujer">Mujer</option>
            </Select>
          </Field>
          <Field label="Peso (kg)">
            <Input
              type="number"
              step="0.1"
              value={client.peso}
              onChange={(e) => onChange({ peso: Number(e.target.value) })}
            />
          </Field>
          <Field label="Altura (cm)">
            <Input
              type="number"
              value={client.altura}
              onChange={(e) => onChange({ altura: Number(e.target.value) })}
            />
          </Field>
          <Field label="Estilo de vida y entrenamiento" className="sm:col-span-2">
            <Select
              value={client.activityFactorId}
              onChange={(e) => onChange({ activityFactorId: e.target.value })}
            >
              {(Object.keys(grouped) as (keyof typeof grouped)[]).map((g) => (
                <optgroup key={g} label={ACTIVITY_GROUP_LABELS[g]}>
                  {grouped[g].map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — ×{a.factor.toFixed(2)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Objetivo" className="sm:col-span-2">
            <Select
              value={client.objetivo}
              onChange={(e) => onChange({ objetivo: e.target.value as Client['objetivo'] })}
            >
              <option value="perder_peso">Perder peso</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="ganancia_muscular">Ganancia de masa muscular</option>
            </Select>
          </Field>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-600">Ajuste por objetivo</p>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => onChange({ goalMultiplier: p.multiplier })}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  Math.abs(client.goalMultiplier - p.multiplier) < 1e-9
                    ? 'border-brand-500 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-slate-500">Libre:</span>
            <Input
              type="number"
              step="1"
              className="w-24"
              value={Math.round(pct * 10) / 10}
              onChange={(e) => onChange({ goalMultiplier: pctToMultiplier(Number(e.target.value)) })}
            />
            <span className="text-xs text-slate-500">% → ×{client.goalMultiplier.toFixed(3)}</span>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="TMB por fórmula" subtitle="Elige cuál usar como base del cálculo">
          <ul className="space-y-1.5">
            {BMR_FORMULA_ORDER.map((id: BmrFormulaId) => {
              const val = bmr[id as keyof typeof bmr] as number;
              const active = client.bmrFormula === id;
              const esMedia = id === 'media' || id === 'media_con_hb_original';
              return (
                <li key={id}>
                  <button
                    onClick={() => onChange({ bmrFormula: id })}
                    title={BMR_FORMULA_NOTES[id]}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-slate-200 bg-white hover:border-brand-200'
                    }`}
                  >
                    <span className={`text-xs ${esMedia ? 'font-semibold text-brand-800' : 'text-slate-600'}`}>
                      {BMR_FORMULA_LABELS[id]}
                      {id === 'media' && <Badge tone="brand"> por defecto</Badge>}
                    </span>
                    <span className="tnum text-sm font-semibold text-slate-800">{fmt(val)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            La <strong>media</strong> promedia Harris-Benedict revisada, Owen y Mifflin. La variante
            original de 1919 se incluye porque es la que reproduce los cálculos históricos de la hoja.
          </p>
        </Card>

        <Card title="Resultado">
          <div className="grid gap-2.5">
            <Stat
              label="TMB seleccionada"
              value={fmt(energy.tmb)}
              unit="kcal"
              hint={BMR_FORMULA_LABELS[client.bmrFormula]}
            />
            <Stat
              label="× Factor actividad"
              value={fmt(energy.subtotal)}
              unit="kcal"
              hint={`×${activityFactor.toFixed(2)}`}
            />
            <Stat
              label="GET"
              value={fmt(energy.getMostrado)}
              unit="kcal"
              hint={`× ${THERMOGENESIS_FACTOR} termogénesis`}
            />
            <Stat
              label="Calorías objetivo"
              value={fmt(energy.caloriasObjetivo)}
              unit="kcal"
              emphasis
              hint={`GET × ${client.goalMultiplier.toFixed(2)}`}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
