import { useMemo } from 'react';
import type { Client } from '../../types/client';
import { edadDe } from '../../types/client';
import type { Plan } from '../../types/plan';
import type { RegistroDia } from '../../types/diary';
import type { Alimento } from '../../types/food';
import type { Medicion } from '../../types/anthropometry';
import {
  evolucionCorporal,
  resumenAdherencia,
  usoDeAlimentos,
  type PuntoEvolucion,
} from '../../utils/seguimiento';
import { Card, EmptyState, fmt } from '../common/ui';

interface Props {
  client: Client;
  plan: Plan;
  registros: RegistroDia[];
  mediciones: Medicion[];
  foods: Alimento[];
}

const DIA_MES = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

function colorAdherencia(p: number): string {
  if (p >= 90) return '#059669';
  if (p >= 70) return '#84cc16';
  if (p >= 40) return '#f59e0b';
  return '#ef4444';
}

/** Barras de los últimos 30 días: alto = % de comidas marcadas. */
function BarrasAdherencia({ dias }: { dias: ReturnType<typeof resumenAdherencia>['dias'] }) {
  return (
    <div className="flex h-24 items-end gap-[3px]">
      {dias.map((d) => {
        const p = d.porcentaje;
        return (
          <div key={d.fecha} className="group relative flex flex-1 items-end" style={{ height: '100%' }}>
            <div
              className="w-full rounded-sm transition"
              style={{
                height: p === undefined ? '4px' : `${Math.max(6, p)}%`,
                backgroundColor: p === undefined ? '#e2e8f0' : colorAdherencia(p),
              }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white group-hover:block">
              {DIA_MES(d.fecha)} · {p === undefined ? 'sin registro' : `${p}%`}
              {d.extras > 0 ? ` · ${d.extras} extras` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Línea de evolución de una métrica, con su primer y último valor. */
function Linea({
  puntos,
  campo,
  etiqueta,
  unidad,
  color,
  bajarEsMejor,
}: {
  puntos: PuntoEvolucion[];
  campo: keyof PuntoEvolucion;
  etiqueta: string;
  unidad: string;
  color: string;
  bajarEsMejor?: boolean;
}) {
  const datos = puntos
    .map((p) => ({ fecha: p.fecha, v: p[campo] as number | undefined }))
    .filter((p): p is { fecha: string; v: number } => typeof p.v === 'number');

  if (datos.length < 1) return null;

  const min = Math.min(...datos.map((d) => d.v));
  const max = Math.max(...datos.map((d) => d.v));
  const rango = max - min || 1;
  const path = datos
    .map((d, i) => {
      const x = datos.length === 1 ? 50 : (i / (datos.length - 1)) * 100;
      const y = 28 - ((d.v - min) / rango) * 24;
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const delta = datos.length > 1 ? datos[datos.length - 1].v - datos[0].v : undefined;
  const bien = delta === undefined ? undefined : bajarEsMejor ? delta < 0 : delta > 0;

  return (
    <div className="rounded-lg border border-slate-100 p-2.5">
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-slate-500">{etiqueta}</span>
        <span className="tnum text-sm font-semibold text-slate-800">
          {fmt(datos[datos.length - 1].v, 1)}
          <span className="ml-0.5 text-[10px] font-normal text-slate-400">{unidad}</span>
        </span>
      </p>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="mt-1 h-8 w-full">
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {datos.map((d, i) => (
          <circle
            key={d.fecha}
            cx={datos.length === 1 ? 50 : (i / (datos.length - 1)) * 100}
            cy={28 - ((d.v - min) / rango) * 24}
            r="1.6"
            fill={color}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {delta !== undefined && (
        <p className={`tnum text-[10px] ${bien ? 'text-emerald-600' : 'text-slate-500'}`}>
          {delta > 0 ? '+' : ''}
          {fmt(delta, 1)} {unidad} desde {DIA_MES(datos[0].fecha)}
        </p>
      )}
    </div>
  );
}

/**
 * El bloque de la derecha del resumen: cumplimiento, cuerpo y qué come.
 * Todo sale de lo que el cliente ya registra, sin pedir nada nuevo.
 */
export function FollowUpPanel({ client, plan, registros, mediciones, foods }: Props) {
  const adherencia = useMemo(() => resumenAdherencia(plan, registros), [plan, registros]);
  const evolucion = useMemo(
    () => evolucionCorporal(mediciones, client.sexo, edadDe(client)),
    [mediciones, client.sexo, edadDe(client)],
  );
  const uso = useMemo(
    () => usoDeAlimentos(registros, plan.dayTypes, foods),
    [registros, plan.dayTypes, foods],
  );

  const sinNada = !adherencia.registrados && !evolucion.length;

  return (
    <div className="space-y-4">
      <Card title="Cumplimiento" subtitle="Últimos 30 días">
        {adherencia.registrados === 0 ? (
          <EmptyState title="Aún no hay días registrados">
            En cuanto el cliente marque comidas en su vista, aparecerán aquí.
          </EmptyState>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1">
              <p>
                <span className="tnum text-2xl font-semibold text-brand-900">
                  {fmt(adherencia.media ?? 0)}%
                </span>
                <span className="ml-1.5 text-xs text-slate-500">de media</span>
              </p>
              <p className="tnum self-end text-xs text-slate-500">
                {adherencia.registrados}/{adherencia.totalDias} días apuntados ·{' '}
                {adherencia.completos} completos
                {adherencia.kcalExtrasDia
                  ? ` · +${fmt(adherencia.kcalExtrasDia)} kcal/día en extras`
                  : ''}
              </p>
            </div>
            <BarrasAdherencia dias={adherencia.dias} />
            <p className="mt-1.5 flex justify-between text-[10px] text-slate-400">
              <span>{DIA_MES(adherencia.dias[0].fecha)}</span>
              <span>hoy</span>
            </p>
          </>
        )}
      </Card>

      <Card title="Composición corporal" subtitle="Con las mediciones que has registrado">
        {!evolucion.length ? (
          <EmptyState title="Aún no hay mediciones">
            Registra antropometría para ver aquí la evolución.
          </EmptyState>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            <Linea puntos={evolucion} campo="peso" etiqueta="Peso" unidad="kg" color="#0ea5e9" />
            <Linea
              puntos={evolucion}
              campo="grasaPct"
              etiqueta="Grasa"
              unidad="%"
              color="#f472b6"
              bajarEsMejor
            />
            <Linea
              puntos={evolucion}
              campo="masaMuscularKg"
              etiqueta="Masa muscular"
              unidad="kg"
              color="#818cf8"
            />
          </div>
        )}
      </Card>

      {!sinNada && (
        <Card title="Qué elige de verdad" subtitle="Para ajustar la despensa que le ofreces">
          {!uso.elegidos.length ? (
            <p className="text-xs text-slate-500">
              Todavía no ha marcado porciones alimento a alimento.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-slate-500">Lo que más repite</p>
                <ul className="space-y-1">
                  {uso.elegidos.slice(0, 5).map((u) => (
                    <li key={u.foodId} className="flex items-baseline gap-2 text-xs">
                      <span className="flex-1 truncate text-slate-700">{u.nombre}</span>
                      <span className="tnum shrink-0 text-slate-400">
                        {fmt(u.porciones, u.porciones % 1 ? 1 : 0)} porc. · {u.dias} d
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-slate-500">
                  Se lo ofreces y no lo toca
                </p>
                {uso.sinTocar.length ? (
                  <ul className="space-y-1">
                    {uso.sinTocar.slice(0, 5).map((u) => (
                      <li key={u.foodId} className="truncate text-xs text-amber-700">
                        {u.nombre}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-emerald-700">
                    Usa todo lo que le has puesto en la despensa.
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
