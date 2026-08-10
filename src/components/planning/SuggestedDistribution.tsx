import { useMemo, useState } from 'react';
import type { MacroBreakdown } from '../../types/calculations';
import type { Meal } from '../../types/plan';
import type { ExchangeGrid } from '../../types/plan';
import { EXCHANGE_GROUPS, type ExchangeGroupId } from '../../data/exchangeGroups';
import {
  REPARTO_POR_DEFECTO,
  proponerGrilla,
  type OpcionesReparto,
} from '../../utils/distribution';
import { Button, Input, fmt } from '../common/ui';

interface Props {
  planeado: MacroBreakdown;
  meals: Meal[];
  /** true si la grilla ya tiene algo pautado. */
  hayReparto: boolean;
  onAplicar: (grid: ExchangeGrid) => void;
}

const FIJOS: [keyof OpcionesReparto, string][] = [
  ['verduras', 'Verduras'],
  ['fruta', 'Fruta'],
  ['lacteos', 'Lácteos'],
  ['legumbres', 'Legumbres'],
  ['azucares', 'Azúcares'],
];

/**
 * Propone el reparto de intercambios a partir de los g/kg ya definidos.
 * La nutricionista ajusta los grupos fijos y el peso de los proteicos grasos;
 * el resto (almidones, proteicos magros y grasas) se recalcula solo.
 */
export function SuggestedDistribution({ planeado, meals, hayReparto, onAplicar }: Props) {
  const [op, setOp] = useState<OpcionesReparto>(REPARTO_POR_DEFECTO);
  const [abierto, setAbierto] = useState(false);

  const { grid, reparto } = useMemo(
    () => proponerGrilla({ proteina: planeado.proteina, hc: planeado.hc, grasa: planeado.grasa }, meals, op),
    [planeado.proteina, planeado.hc, planeado.grasa, meals, op],
  );

  const filas = (Object.entries(reparto.intercambios) as [ExchangeGroupId, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => EXCHANGE_GROUPS[a[0]].orden - EXCHANGE_GROUPS[b[0]].orden);

  const set = (k: keyof OpcionesReparto, v: number) => setOp((o) => ({ ...o, [k]: v }));

  const desv = (v: number, objetivo: number) => {
    const pct = objetivo ? Math.abs(v / objetivo) * 100 : 0;
    return pct <= 5 ? 'text-emerald-700' : pct <= 10 ? 'text-amber-700' : 'text-red-700';
  };

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-brand-800 uppercase">
            Reparto recomendado
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Calculado desde los g/kg de arriba. Verduras y fruta las fijas tú; almidones, proteicos y
            grasas salen del resto.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar ajustes' : 'Ajustar'}
          </Button>
          <Button
            onClick={() => {
              if (
                hayReparto &&
                !window.confirm('Esto sustituye el reparto actual de la grilla. ¿Seguimos?')
              ) {
                return;
              }
              onAplicar(grid);
            }}
          >
            Aplicar a la grilla
          </Button>
        </div>
      </div>

      {abierto && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-white/70 p-3 sm:grid-cols-6">
          {FIJOS.map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-0.5 block text-[10px] text-slate-500">{label}</span>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={op[k] as number}
                onChange={(e) => set(k, Math.max(0, Number(e.target.value) || 0))}
                className="w-full text-xs"
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-slate-500">Prot. grasos</span>
            <Input
              type="number"
              step="5"
              min="0"
              max="100"
              value={Math.round(op.pctProteicosGrasos * 100)}
              onChange={(e) =>
                set('pctProteicosGrasos', Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100)
              }
              className="w-full text-xs"
            />
          </label>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {filas.map(([g, v]) => (
          <span
            key={g}
            className="rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-[11px] text-slate-700"
          >
            <span className="tnum font-medium text-brand-800">{v}</span> {EXCHANGE_GROUPS[g].nombre.toLowerCase()}
          </span>
        ))}
      </div>

      <p className="tnum mt-3 text-[11px] text-slate-600">
        Resultado: {fmt(reparto.kcal)} kcal · P {fmt(reparto.macros.proteina, 1)} g · HC{' '}
        {fmt(reparto.macros.hc, 1)} g · G {fmt(reparto.macros.grasa, 1)} g
        <span className="ml-2 text-slate-400">frente al objetivo</span>{' '}
        <span className={desv(reparto.desviacion.proteina, planeado.proteina)}>
          P {reparto.desviacion.proteina >= 0 ? '+' : '−'}
          {fmt(Math.abs(reparto.desviacion.proteina), 1)}
        </span>{' '}
        <span className={desv(reparto.desviacion.hc, planeado.hc)}>
          HC {reparto.desviacion.hc >= 0 ? '+' : '−'}
          {fmt(Math.abs(reparto.desviacion.hc), 1)}
        </span>{' '}
        <span className={desv(reparto.desviacion.grasa, planeado.grasa)}>
          G {reparto.desviacion.grasa >= 0 ? '+' : '−'}
          {fmt(Math.abs(reparto.desviacion.grasa), 1)}
        </span>
      </p>
    </div>
  );
}
