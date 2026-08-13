import { useEffect, useMemo, useState } from 'react';
import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import { comidasConPauta, recetasDeComida } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import type { RegistroDia } from '../../types/diary';
import { claveFecha, fechaLegible } from '../../types/diary';
import { balanceDelDia, extrasDeComida } from '../../utils/diary';
import { observarRegistrosEnVivo } from '../../utils/sincronizacion';
import { Card, fmt } from '../common/ui';

interface Props {
  client: Client;
  plan: Plan;
  registros: RegistroDia[];
  recipes: Receta[];
  foods: Alimento[];
}

/** «hace 2 min», que es lo que dice si la señal está viva. */
function haceCuanto(desde: number): string {
  const s = Math.round((Date.now() - desde) / 1000);
  if (s < 60) return 'ahora mismo';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}

/**
 * EL DÍA DE LA CLIENTA, MIENTRAS PASA
 *
 * Qué ha elegido, qué ha marcado como hecho y qué se ha comido de más, sin
 * recargar. El servidor avisa en cuanto ella toca algo en su móvil.
 *
 * Antes esto no existía: los datos se bajaban una sola vez al entrar, así que
 * la nutricionista podía tener la ficha abierta toda la mañana sin ver nada.
 */
export function DiaEnVivo({ client, plan, registros, recipes, foods }: Props) {
  const hoy = claveFecha(new Date());
  const [ultimaSenal, setUltimaSenal] = useState<number | null>(null);
  const [, setTic] = useState(0);

  // Se repinta el «hace X» aunque no llegue nada nuevo.
  useEffect(() => {
    const t = setInterval(() => setTic((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    observarRegistrosEnVivo((r) => {
      if (r.clientId === client.id) setUltimaSenal(Date.now());
    });
    return () => observarRegistrosEnVivo(null);
  }, [client.id]);

  const registro = registros.find((r) => r.fecha === hoy);

  const dayType = useMemo(
    () => plan.dayTypes.find((d) => d.id === registro?.dayTypeId) ?? plan.dayTypes[0],
    [plan.dayTypes, registro?.dayTypeId],
  );

  const balance = useMemo(
    () => balanceDelDia(dayType, registro, foods, { asumirPlanCumplido: true }),
    [dayType, registro, foods],
  );

  if (!dayType) return null;

  const comidas = comidasConPauta(dayType);
  const hechas = comidas.filter((m) => (registro?.cumplidas ?? []).includes(m.id)).length;
  const extras = registro?.extras ?? [];

  return (
    <Card
      title="Hoy, en directo"
      actions={
        <span className="text-[11px] text-slate-400">
          {ultimaSenal ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {haceCuanto(ultimaSenal)}
            </span>
          ) : (
            'esperando señal'
          )}
        </span>
      }
    >
      <p className="mb-3 text-[11px] text-slate-500">
        {fechaLegible(hoy)} · {dayType.nombre} ·{' '}
        <strong className="font-medium text-slate-700">
          {hechas} de {comidas.length} comidas hechas
        </strong>
      </p>

      {!registro ? (
        <p className="text-xs text-slate-500">
          {client.nombre.split(' ')[0]} todavía no ha abierto su plan hoy.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {comidas.map((m) => {
            const hecha = (registro.cumplidas ?? []).includes(m.id);
            const opciones = recetasDeComida(dayType.recetasAsignadas, m.id);
            const elegidaId = registro.recetaElegida?.[m.id] ?? opciones[0];
            const elegida = recipes.find((r) => r.id === elegidaId);
            const susExtras = extrasDeComida(extras, m.id);

            return (
              <li
                key={m.id}
                className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                  hecha ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'
                }`}
              >
                <span className="w-20 shrink-0 text-[10px] tracking-wide text-slate-400 uppercase">
                  {m.nombre}
                </span>
                <span className="flex-1 text-slate-700">
                  {elegida?.nombre ?? <span className="text-slate-400">sin elegir</span>}
                </span>
                {susExtras.length > 0 && (
                  <span className="tnum text-[11px] text-amber-700">
                    +{susExtras.map((e) => e.nombre).join(', ')}
                  </span>
                )}
                <span
                  className={`shrink-0 text-[11px] ${hecha ? 'text-emerald-700' : 'text-slate-300'}`}
                >
                  {hecha ? '✓ hecha' : '—'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {(registro?.extras?.length ?? 0) > 0 && (
        <p className="tnum mt-2 text-[11px] text-amber-700">
          {fmt(extras.reduce((s, e) => s + e.kcal, 0))} kcal de extras, un{' '}
          {fmt(balance.pesoExtras, 0)} % sobre lo pautado.
        </p>
      )}
    </Card>
  );
}
