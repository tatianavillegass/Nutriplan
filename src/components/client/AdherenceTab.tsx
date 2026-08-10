import { useMemo } from 'react';
import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import type { Alimento } from '../../types/food';
import type { RegistroDia } from '../../types/diary';
import { fechaLegible } from '../../types/diary';
import { adherenciaDelDia, balanceDelDia, totalExtras } from '../../utils/diary';
import { Card, EmptyState, fmt } from '../common/ui';

interface Props {
  client: Client;
  plan: Plan;
  registros: RegistroDia[];
  foods: Alimento[];
}

/**
 * Lo que la nutricionista ve del día a día del cliente: qué días ha cumplido,
 * qué se ha tomado fuera del plan y cuánto le ha movido las calorías.
 */
export function AdherenceTab({ plan, registros, foods }: Props) {
  const filas = useMemo(
    () =>
      [...registros]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 30)
        .map((r) => {
          const dayType = plan.dayTypes.find((d) => d.id === r.dayTypeId) ?? plan.dayTypes[0];
          return {
            registro: r,
            dayType,
            adherencia: adherenciaDelDia(r, dayType),
            balance: balanceDelDia(dayType, r, foods, { asumirPlanCumplido: true }),
          };
        }),
    [registros, plan.dayTypes, foods],
  );

  const resumen = useMemo(() => {
    if (!filas.length) return undefined;
    const dias = filas.length;
    const media = filas.reduce((s, f) => s + f.adherencia.porcentaje, 0) / dias;
    const conExtras = filas.filter((f) => f.adherencia.extras > 0).length;
    const kcalExtras = filas.reduce((s, f) => s + f.adherencia.kcalExtras, 0);
    return { dias, media, conExtras, kcalExtras, kcalExtrasDia: kcalExtras / dias };
  }, [filas]);

  if (!filas.length) {
    return (
      <Card title="Seguimiento" subtitle="Lo que el cliente va registrando en su vista">
        <EmptyState title="Todavía no hay días registrados">
          En cuanto el cliente marque comidas o apunte algún extra, aparecerá aquí.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {resumen && (
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            ['Días registrados', fmt(resumen.dias), ''],
            ['Cumplimiento medio', fmt(resumen.media, 0), '%'],
            ['Días con extras', `${resumen.conExtras}/${resumen.dias}`, ''],
            ['Extras al día', fmt(resumen.kcalExtrasDia), 'kcal'],
          ].map(([label, valor, unidad]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">{label}</p>
              <p className="tnum mt-0.5 text-lg font-medium text-slate-800">
                {valor}
                {unidad && <span className="ml-0.5 text-xs text-slate-500">{unidad}</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      <Card title="Últimos días" subtitle="Lo más reciente primero">
        <div className="space-y-2">
          {filas.map(({ registro, dayType, adherencia, balance }) => {
            const { kcal: kcalExtras } = totalExtras(registro.extras);
            return (
              <div
                key={registro.id}
                className="rounded-lg border border-slate-100 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-slate-800">
                    {fechaLegible(registro.fecha)}
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {dayType?.nombre ?? 'sin tipo de día'}
                    </span>
                  </p>
                  <p className="tnum text-xs text-slate-500">
                    <span
                      className={
                        adherencia.porcentaje >= 80
                          ? 'text-emerald-700'
                          : adherencia.porcentaje >= 50
                            ? 'text-amber-700'
                            : 'text-slate-500'
                      }
                    >
                      {adherencia.comidasCumplidas}/{adherencia.comidasTotales} comidas
                    </span>
                    <span className="mx-2 text-slate-300">·</span>
                    {fmt(balance.kcalTotal)} de {fmt(balance.kcalPautado)} kcal
                  </p>
                </div>

                {registro.extras.length > 0 && (
                  <p className="tnum mt-1 text-[11px] text-amber-800">
                    Extras: {registro.extras.map((e) => e.nombre).join(', ')} ({fmt(kcalExtras)}{' '}
                    kcal, {fmt(balance.pesoExtras, 0)} % del día)
                  </p>
                )}

                {registro.notas && (
                  <p className="mt-1 text-[11px] text-slate-500 italic">{registro.notas}</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
