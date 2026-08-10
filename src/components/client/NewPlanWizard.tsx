import { useState } from 'react';
import type { Client } from '../../types/client';
import { edadDe } from '../../types/client';
import { calcBmr } from '../../utils/bmr';
import { calcEnergy } from '../../utils/energy';
import {
  ACTIVITY_FACTORS,
  ACTIVITY_GROUP_LABELS,
  GOAL_PRESETS,
  THERMOGENESIS_FACTOR,
  getActivityFactor,
} from '../../data/activityFactors';
import { Button, Field, Input, Select, fmt } from '../common/ui';

export interface MedidasNuevoPlan {
  peso: number;
  altura?: number;
  cintura?: number;
  cadera?: number;
  activityFactorId: string;
  goalMultiplier: number;
  notas?: string;
}

interface Props {
  client: Client;
  onCancelar: () => void;
  onCrear: (medidas: MedidasNuevoPlan, kcalObjetivo: number) => void;
}

/**
 * NUEVA PLANIFICACIÓN
 *
 * El plan nuevo tiene que salir de datos nuevos. Se piden las medidas del día
 * — sólo el peso es obligatorio, porque la mayoría de los clientes son online
 * y no hay báscula de pliegues — se recalcula el GET delante y de ahí sale la
 * planificación. Los perímetros son opcionales y quedan registrados.
 */
export function NewPlanWizard({ client, onCancelar, onCrear }: Props) {
  const [peso, setPeso] = useState(String(client.peso));
  const [altura, setAltura] = useState(String(client.altura));
  const [cintura, setCintura] = useState('');
  const [cadera, setCadera] = useState('');
  const [actividad, setActividad] = useState(client.activityFactorId);
  const [objetivo, setObjetivo] = useState(client.goalMultiplier);
  const [notas, setNotas] = useState('');

  const pesoN = Number(peso.replace(',', '.'));
  const alturaN = Number(altura.replace(',', '.')) || client.altura;
  const valido = Number.isFinite(pesoN) && pesoN > 20 && pesoN < 400;

  const factor = getActivityFactor(actividad);
  const tmb = valido
    ? calcBmr({ sexo: client.sexo, peso: pesoN, altura: alturaN, edad: edadDe(client) })
    : undefined;
  const energia =
    tmb && valido
      ? calcEnergy({
          tmb: client.bmrFormula === 'media' ? tmb.media : (tmb[client.bmrFormula] ?? tmb.media),
          activityFactor: factor,
          thermogenesis: THERMOGENESIS_FACTOR,
          goalMultiplier: objetivo,
        })
      : undefined;

  const deltaPeso = valido ? pesoN - client.peso : 0;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <p className="text-sm font-semibold text-brand-900">Nueva planificación</p>
      <p className="mt-0.5 mb-3 text-[11px] text-slate-600">
        Toma las medidas de hoy y el objetivo se recalcula solo. Sólo el peso es obligatorio.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Peso (kg)">
          <Input
            autoFocus
            type="number"
            step="0.1"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
          />
        </Field>
        <Field label="Altura (cm) — opcional">
          <Input type="number" value={altura} onChange={(e) => setAltura(e.target.value)} />
        </Field>
        <Field label="Cintura (cm) — opcional">
          <Input type="number" step="0.1" value={cintura} onChange={(e) => setCintura(e.target.value)} />
        </Field>
        <Field label="Cadera (cm) — opcional">
          <Input type="number" step="0.1" value={cadera} onChange={(e) => setCadera(e.target.value)} />
        </Field>

        <Field label="Actividad" className="sm:col-span-2">
          <Select value={actividad} onChange={(e) => setActividad(e.target.value)}>
            {(Object.keys(ACTIVITY_GROUP_LABELS) as (keyof typeof ACTIVITY_GROUP_LABELS)[]).map(
              (g) => (
                <optgroup key={g} label={ACTIVITY_GROUP_LABELS[g]}>
                  {ACTIVITY_FACTORS.filter((f) => f.grupo === g).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} (×{f.factor})
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </Select>
        </Field>
        <Field label="Objetivo" className="sm:col-span-2">
          <Select value={objetivo} onChange={(e) => setObjetivo(Number(e.target.value))}>
            {GOAL_PRESETS.map((g) => (
              <option key={g.id} value={g.multiplier}>
                {g.label} (×{g.multiplier})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Qué cambia respecto a la anterior (opcional)" className="sm:col-span-4">
          <Input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Deja el CrossFit, sube proteína, vuelve de vacaciones…"
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-brand-200 pt-3">
        <p className="tnum text-xs text-slate-600">
          {energia ? (
            <>
              TMB {fmt(energia.subtotal / factor)} · GET {fmt(energia.getMostrado)} ·{' '}
              <strong className="text-base text-brand-900">
                {fmt(energia.caloriasObjetivo)} kcal
              </strong>{' '}
              objetivo
              {deltaPeso !== 0 && (
                <span className="ml-2 text-slate-500">
                  ({deltaPeso > 0 ? '+' : ''}
                  {fmt(deltaPeso, 1)} kg desde la última)
                </span>
              )}
            </>
          ) : (
            <span className="text-amber-700">Escribe un peso para calcular el objetivo.</span>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || !energia}
            onClick={() =>
              energia &&
              onCrear(
                {
                  peso: pesoN,
                  altura: Number(altura.replace(',', '.')) || undefined,
                  cintura: Number(cintura.replace(',', '.')) || undefined,
                  cadera: Number(cadera.replace(',', '.')) || undefined,
                  activityFactorId: actividad,
                  goalMultiplier: objetivo,
                  notas: notas.trim() || undefined,
                },
                Math.round(energia.caloriasObjetivo),
              )
            }
          >
            Crear planificación →
          </Button>
        </div>
      </div>
    </div>
  );
}
