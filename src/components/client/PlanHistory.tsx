import type { Plan } from '../../types/plan';
import { resumenDelPlan } from '../../utils/seguimiento';
import { Card, Button, EmptyState, fmt } from '../common/ui';

interface Props {
  planes: Plan[];
  activoId?: string;
  kcalObjetivo: number;
  onNueva: () => void;
  onVer: (planId: string) => void;
  onReactivar: (planId: string) => void;
  onBorrar: (planId: string) => void;
}

const COLOR = { hc: '#38bdf8', proteina: '#f472b6', grasa: '#818cf8' } as const;

/** Anillo de proporción H / P / G, como el de la ficha del cliente. */
function AnilloMacros({ pct }: { pct: { hc: number; proteina: number; grasa: number } }) {
  const r = 15.9155; // circunferencia 100
  const partes = [
    { k: 'hc' as const, v: pct.hc },
    { k: 'proteina' as const, v: pct.proteina },
    { k: 'grasa' as const, v: pct.grasa },
  ];
  let acumulado = 0;
  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11 shrink-0 -rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      {partes.map((p) => {
        const el = (
          <circle
            key={p.k}
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke={COLOR[p.k]}
            strokeWidth="4"
            strokeDasharray={`${Math.max(0, p.v - 1)} ${100 - Math.max(0, p.v - 1)}`}
            strokeDashoffset={-acumulado}
            strokeLinecap="round"
          />
        );
        acumulado += p.v;
        return el;
      })}
    </svg>
  );
}

function fechaCorta(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Historial de planificaciones del cliente. La de arriba es la que está en
 * uso; las de debajo son el registro de lo que se pautó y cuándo.
 */
export function PlanHistory({
  planes,
  activoId,
  kcalObjetivo,
  onNueva,
  onVer,
  onReactivar,
  onBorrar,
}: Props) {
  return (
    <Card
      title="Planificación"
      subtitle="Todas las que le has pautado, la más reciente primero"
      actions={<Button onClick={onNueva}>+ Nueva planificación</Button>}
    >
      {!planes.length ? (
        <EmptyState title="Sin planificaciones todavía" />
      ) : (
        <ul className="space-y-2">
          {planes.map((p) => {
            const r = resumenDelPlan(p);
            const activo = p.id === activoId;
            const kcal = r?.kcal || p.kcalObjetivo || (activo ? kcalObjetivo : 0);
            return (
              <li key={p.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onVer(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onVer(p.id);
                  }
                }}
                title={`Abrir el cálculo de ${p.nombre}`}
                className={`w-full cursor-pointer rounded-xl border p-3.5 text-left transition hover:border-brand-400 hover:shadow-sm ${
                  activo ? 'border-brand-300 bg-brand-50/50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <p className="flex items-baseline gap-2 text-sm font-semibold text-slate-800">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        activo ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      aria-hidden
                    />
                    {p.nombre}
                    <span className="text-xs font-normal text-slate-400">
                      {fechaCorta(p.fecha ?? p.createdAt)}
                    </span>
                    {activo && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                        en uso
                      </span>
                    )}
                  </p>
                  <span className="flex gap-2.5 text-[11px]">
                    <span className="text-brand-600">{activo ? 'Editar' : 'Ver'}</span>
                    {!activo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReactivar(p.id);
                        }}
                        className="text-brand-600 hover:underline"
                      >
                        Reactivar
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!window.confirm(`¿Borrar ${p.nombre}? No se puede deshacer.`)) return;
                        onBorrar(p.id);
                      }}
                      className="text-slate-400 hover:text-red-600"
                    >
                      Borrar
                    </button>
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  {r && <AnilloMacros pct={r.pct} />}
                  <p className="tnum flex flex-1 flex-wrap gap-x-3 text-xs">
                    {r ? (
                      <>
                        <span>
                          <span style={{ color: COLOR.hc }} className="font-semibold">H</span>{' '}
                          {fmt(r.pct.hc)}%
                        </span>
                        <span>
                          <span style={{ color: COLOR.proteina }} className="font-semibold">P</span>{' '}
                          {fmt(r.pct.proteina)}%
                        </span>
                        <span>
                          <span style={{ color: COLOR.grasa }} className="font-semibold">G</span>{' '}
                          {fmt(r.pct.grasa)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">Sin grilla pautada</span>
                    )}
                  </p>
                  <p className="tnum shrink-0 text-right">
                    <span className="text-base font-semibold text-brand-900">{fmt(kcal)}</span>{' '}
                    <span className="text-[10px] tracking-wide text-slate-400 uppercase">kcal</span>
                  </p>
                </div>

                <p className="mt-1.5 text-[11px] text-slate-400">
                  Fase {p.fase} · {p.dayTypes.length}{' '}
                  {p.dayTypes.length === 1 ? 'tipo de día' : 'tipos de día'}
                  {p.notas ? ` · ${p.notas}` : ''}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {p.dayTypes.map((d) => d.nombre).join(' · ')}
                </p>
              </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
