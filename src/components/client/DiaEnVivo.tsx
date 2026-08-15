import { useEffect, useMemo, useState } from 'react';
import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import { comidasConPauta, recetasDeComida } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import type { RegistroDia } from '../../types/diary';
import { claveFecha, fechaLegible } from '../../types/diary';
import { balanceDelDia, extrasDeComida, gramosMarcados } from '../../utils/diary';
import { bocadosPorComida, objetivoDelDia, totalContado } from '../../utils/conteo';
import {
  observarRegistrosEnVivo,
  observarEstadoVivo,
  refrescarRegistros,
  type EstadoVivo,
} from '../../utils/sincronizacion';
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
  const [estado, setEstado] = useState<EstadoVivo>('conectando');
  const [, setTic] = useState(0);

  useEffect(() => {
    observarEstadoVivo(setEstado);
    return () => observarEstadoVivo(null);
  }, []);

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

  /** Fase 4: lo que ha apuntado hoy, con el objetivo del día para compararlo. */
  const bocados = registro?.bocados ?? [];
  const contado = totalContado(bocados);
  const objetivo = objetivoDelDia(dayType);
  const porComida = bocadosPorComida(dayType.meals, bocados);

  return (
    <Card
      title="Hoy, en directo"
      actions={
        <span className="flex items-center gap-2 text-[11px]">
          {/*
            El estado de la conexión se enseña siempre. Antes ponía «esperando
            señal» tanto si la clienta no había marcado nada como si la escucha
            estaba caída, y no había forma de distinguirlo.
          */}
          <span
            className={`inline-flex items-center gap-1.5 ${
              estado === 'en-directo' ? 'text-emerald-700' : 'text-amber-700'
            }`}
            title={
              estado === 'en-directo'
                ? 'Conectada: lo que marque aparece al momento'
                : 'Sin conexión en directo; se pregunta cada 20 segundos'
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                estado === 'en-directo' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {estado === 'en-directo'
              ? ultimaSenal
                ? haceCuanto(ultimaSenal)
                : 'en directo'
              : estado === 'conectando'
                ? 'conectando…'
                : 'cada 20 s'}
          </span>
          <button
            onClick={() => void refrescarRegistros()}
            className="text-slate-400 underline hover:text-slate-600"
          >
            Actualizar
          </button>
        </span>
      }
    >
      <p className="mb-3 text-[11px] text-slate-500">
        {fechaLegible(hoy)} · <strong className="font-medium text-slate-700">{dayType.nombre}</strong>{' '}
        · Fase {plan.fase} ·{' '}
        <strong className="font-medium text-slate-700">
          {plan.fase === 4
            ? `${bocados.length} ${bocados.length === 1 ? 'cosa apuntada' : 'cosas apuntadas'}`
            : `${hechas} de ${comidas.length} comidas hechas`}
        </strong>
      </p>

      {/*
        En fase 4 no hay comidas que marcar: lo que hay es una lista de lo que
        ha comido y sus gramos. Leyendo comidas, esta tarjeta se quedaba en
        blanco justo con las clientas que más al día están.
      */}
      {plan.fase === 4 ? (
        !bocados.length ? (
          <p className="text-xs text-slate-500">
            {client.nombre.split(' ')[0]} todavía no ha apuntado nada hoy.
          </p>
        ) : (
          <>
            <p className="tnum mb-2 text-xs text-slate-700">
              {fmt(contado.kcal)} kcal de {fmt(objetivo.kcal)} · P {fmt(contado.proteina)}/
              {fmt(objetivo.proteina)} · HC {fmt(contado.hc)}/{fmt(objetivo.hc)} · G{' '}
              {fmt(contado.grasa)}/{fmt(objetivo.grasa)} g
            </p>
            {/* Por comidas, igual que lo ve ella: así se compara sin traducir. */}
            <ul className="space-y-1">
              {porComida
                .filter((c) => c.bocados.length > 0)
                .map(({ meal, bocados: suyos, total }) => (
                  <li key={meal.id} className="rounded-lg border border-slate-200 px-2.5 py-1.5">
                    <p className="flex items-baseline gap-2 text-[10px] tracking-wide text-slate-400 uppercase">
                      <span className="flex-1">{meal.nombre}</span>
                      <span className="tnum">{fmt(total.kcal)} kcal</span>
                    </p>
                    {suyos.map((b) => (
                      <p key={b.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        {b.hora && (
                          <span className="tnum w-10 shrink-0 text-[10px] text-slate-400">
                            {b.hora}
                          </span>
                        )}
                        <span className="flex-1 text-slate-700">
                          {b.nombre}
                          <span className="tnum ml-1 text-slate-400">
                            {fmt(b.cantidad)} {b.unidad ?? 'g'}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-[11px] text-slate-500">
                          {fmt(b.kcal)} kcal
                        </span>
                      </p>
                    ))}
                  </li>
                ))}
            </ul>
          </>
        )
      ) : !registro ? (
        <p className="text-xs text-slate-500">
          {client.nombre.split(' ')[0]} todavía no ha abierto su plan hoy.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {comidas.map((m) => {
            const hecha = (registro.cumplidas ?? []).includes(m.id);
            const susExtras = extrasDeComida(extras, m.id);
            const libre = registro.libres?.[m.id];

            /**
             * QUÉ SE ENSEÑA DEPENDE DE LA FASE
             *
             * En fase 1 la clienta elige una receta de las tres. En fase 2 y 3
             * no hay recetas: va marcando alimentos y porciones. La tarjeta
             * sólo sabía leer lo primero, así que al pasar a fase 2 el
             * seguimiento se quedaba en blanco aunque estuviera marcando.
             */
            let queHaComido: string | null = null;
            if (plan.fase === 1) {
              const opciones = recetasDeComida(dayType.recetasAsignadas, m.id);
              const elegidaId = registro.recetaElegida?.[m.id] ?? opciones[0];
              queHaComido = recipes.find((r) => r.id === elegidaId)?.nombre ?? null;
            } else {
              const marcado = Object.entries(registro.porciones?.[m.id] ?? {})
                .filter(([, n]) => (n ?? 0) > 0)
                .map(([foodId, n]) => {
                  const f = foods.find((x) => x.id === foodId);
                  if (!f) return null;
                  const g = gramosMarcados(f, n);
                  return g ? `${f.nombre} ${g} ${f.unidad ?? 'g'}` : f.nombre;
                })
                .filter(Boolean) as string[];
              queHaComido = marcado.length ? marcado.join(' · ') : null;
            }

            return (
              <li
                key={m.id}
                className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                  libre
                    ? 'border-violet-200 bg-violet-50/50'
                    : hecha
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-slate-200'
                }`}
              >
                <span className="w-20 shrink-0 text-[10px] tracking-wide text-slate-400 uppercase">
                  {m.nombre}
                </span>
                <span className="flex-1 text-slate-700">
                  {libre ? (
                    <span className="text-violet-800">
                      Comida libre
                      {libre.nota && (
                        <span className="ml-1.5 text-slate-500 italic">«{libre.nota}»</span>
                      )}
                    </span>
                  ) : (
                    (queHaComido ?? (
                      <span className="text-slate-400">
                        {plan.fase === 1 ? 'sin elegir' : 'sin marcar'}
                      </span>
                    ))
                  )}
                </span>
                {susExtras.length > 0 && (
                  <span className="tnum text-[11px] text-amber-700">
                    +{susExtras.map((e) => e.nombre).join(', ')}
                  </span>
                )}
                <span
                  className={`shrink-0 text-[11px] ${
                    libre ? 'text-violet-700' : hecha ? 'text-emerald-700' : 'text-slate-300'
                  }`}
                >
                  {libre ? 'libre' : hecha ? '✓ hecha' : '—'}
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
