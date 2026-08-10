import { useMemo } from 'react';
import type { DayType } from '../../types/plan';
import type { RegistroDia } from '../../types/diary';
import {
  DIAS_CORTOS,
  claveFecha,
  desdeClave,
  inicioSemana,
  sumarDias,
} from '../../types/diary';
import { adherenciaDelDia, kcalDelDia } from '../../utils/diary';
import { fmt } from '../common/ui';

interface Props {
  /** Día seleccionado, en formato YYYY-MM-DD. */
  fecha: string;
  onFecha: (f: string) => void;
  dayTypes: DayType[];
  registros: RegistroDia[];
  /** Fecha de inicio del plan, para numerar las semanas. */
  inicioPlan?: string;
}

/** Anillo de progreso del día: comidas cumplidas sobre el total. */
function Anillo({ pct, activo }: { pct: number; activo: boolean }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const avance = Math.min(100, Math.max(0, pct));
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={activo ? '#34674e' : '#94bea7'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(c * avance) / 100} ${c}`}
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
}

/**
 * Tira de días de la semana. El cliente ve de un vistazo qué le toca cada día,
 * cuánto lleva cumplido y cuántas calorías tiene pautadas.
 */
export function WeekStrip({ fecha, onFecha, dayTypes, registros, inicioPlan }: Props) {
  const hoy = claveFecha(new Date());
  const lunes = useMemo(() => inicioSemana(desdeClave(fecha)), [fecha]);

  const dias = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = sumarDias(lunes, i);
        const clave = claveFecha(d);
        const registro = registros.find((r) => r.fecha === clave);
        const dayType =
          dayTypes.find((dt) => dt.id === registro?.dayTypeId) ?? dayTypes[0];
        return {
          clave,
          fecha: d,
          registro,
          dayType,
          adherencia: adherenciaDelDia(registro, dayType),
          kcal: kcalDelDia(dayType),
        };
      }),
    [lunes, dayTypes, registros],
  );

  const semana = useMemo(() => {
    if (!inicioPlan) return undefined;
    const base = inicioSemana(desdeClave(inicioPlan));
    const diff = Math.round((lunes.getTime() - base.getTime()) / (7 * 86400000));
    return diff + 1;
  }, [inicioPlan, lunes]);

  const mover = (semanas: number) => onFecha(claveFecha(sumarDias(desdeClave(fecha), semanas * 7)));

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4 no-print">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => mover(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Semana anterior"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-slate-800">
          {semana ? `Semana ${semana}` : 'Semana del'}{' '}
          <span className="font-normal text-slate-500">
            {lunes.getDate()} — {sumarDias(lunes, 6).getDate()}{' '}
            {sumarDias(lunes, 6).toLocaleDateString('es-ES', { month: 'long' })}
          </span>
        </p>
        <button
          onClick={() => mover(1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Semana siguiente"
        >
          ›
        </button>
        {!dias.some((d) => d.clave === hoy) && (
          <button
            onClick={() => onFecha(hoy)}
            className="ml-auto text-[11px] text-brand-600 underline"
          >
            Ir a hoy
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const activo = d.clave === fecha;
          const esHoy = d.clave === hoy;
          return (
            <button
              key={d.clave}
              onClick={() => onFecha(d.clave)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition ${
                activo ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50'
              }`}
            >
              <span
                className={`text-[10px] font-medium tracking-wide uppercase ${
                  esHoy ? 'text-brand-700' : 'text-slate-400'
                }`}
              >
                {DIAS_CORTOS[d.fecha.getDay()]}
              </span>

              <span className="relative flex items-center justify-center">
                <Anillo pct={d.adherencia.porcentaje} activo={activo} />
                <span className="tnum absolute text-[11px] font-medium text-slate-600">
                  {d.fecha.getDate()}
                </span>
                {d.adherencia.extras > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400"
                    title={`${d.adherencia.extras} extra(s)`}
                  />
                )}
              </span>

              <span
                className={`max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] ${
                  activo ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {d.dayType?.nombre ?? '—'}
              </span>
              <span className="tnum text-[10px] text-slate-400">{fmt(d.kcal)} kcal</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
