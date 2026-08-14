import { useState } from 'react';
import type { DayType } from '../../types/plan';
import type { MacroBucket } from '../../data/exchangeGroups';
import {
  presupuestoDelDia,
  reservaAceiteDelDia,
  type SeleccionGrupos,
} from '../../utils/dailyBudget';
import { BUCKET_LABEL } from '../../utils/mealOptions';

interface Props {
  dayType: DayType;
  seleccion: SeleccionGrupos;
}

const TONO: Record<MacroBucket, { arco: string; pista: string; texto: string }> = {
  proteina: { arco: 'stroke-brand-600', pista: 'stroke-brand-100', texto: 'text-brand-800' },
  carbohidrato: { arco: 'stroke-amber-500', pista: 'stroke-amber-100', texto: 'text-amber-800' },
  grasa: { arco: 'stroke-rose-400', pista: 'stroke-rose-100', texto: 'text-rose-800' },
};

/** «3», «3½». Las medias porciones son parte del sistema. */
const porciones = (n: number): string => {
  const entero = Math.floor(n);
  const media = n - entero >= 0.5;
  if (!media) return String(entero);
  return entero === 0 ? '½' : `${entero}½`;
};

/**
 * LO QUE TIENES PARA HOY
 *
 * En fase 3 lo que cuenta es el total del día. El reparto por comidas está
 * pensado y tiene una intención —la proteína repartida cunde más, el hidrato
 * alrededor del entreno— pero no es una jaula: si un día se come la fruta de
 * la merienda en el desayuno, no ha roto nada.
 *
 * Por eso el presupuesto va arriba del todo y el desglose por comidas debajo:
 * el orden de la pantalla dice qué es lo que manda.
 */
export function PresupuestoDia({ dayType, seleccion }: Props) {
  /** El desglose empieza plegado: en el móvil es lo que ahorra el scroll. */
  const [detalle, setDetalle] = useState(false);

  const macros = presupuestoDelDia(dayType, seleccion);
  const reserva = reservaAceiteDelDia(dayType);
  if (!macros.length) return null;

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-4 no-print sm:p-5">
      <div className="mb-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">
          Lo que tienes para hoy
        </h2>
        <p className="mt-1 text-xs leading-snug text-slate-600">
          Esto es el total del día y lo repartes como te venga mejor. El orden por comidas de abajo
          está pensado con una intención, así que si puedes seguirlo, mejor — pero lo que no puede
          faltar ni sobrar es esta cuenta.
        </p>
      </div>

      {/*
        Tres anillos en fila. Dentro va «2/6», igual que en los anillos de cada
        comida: puesto sólo lo que queda, no se sabía si el número era lo que
        llevas o lo que te falta. Lo que queda se dice debajo con palabras, que
        para eso no hace falta interpretar nada.

        El desglose por subgrupo se despliega, porque hace falta al ir a elegir
        y no todo el rato — y en un móvil eso son tres pantallas de scroll
        menos.
      */}
      <div className="flex items-start justify-around gap-2">
        {macros.map((m) => {
          const t = TONO[m.bucket];
          const pct = m.pautado > 0 ? Math.min(1, m.elegido / m.pautado) : 0;
          const pasado = m.restante < -0.01;
          const completo = !pasado && m.restante < 0.01;
          const r = 18;
          const circunferencia = 2 * Math.PI * r;

          return (
            <div key={m.bucket} className="min-w-0 text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg viewBox="0 0 44 44" className="h-20 w-20" aria-hidden>
                  <circle cx="22" cy="22" r={r} fill="none" className={t.pista} strokeWidth="5" />
                  <circle
                    cx="22"
                    cy="22"
                    r={r}
                    fill="none"
                    className={pasado ? 'stroke-rose-500' : t.arco}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${circunferencia * (pasado ? 1 : pct)} ${circunferencia}`}
                    transform="rotate(-90 22 22)"
                  />
                </svg>
                <span
                  className={`tnum absolute text-base font-bold ${
                    pasado ? 'text-rose-700' : completo ? 'text-emerald-700' : t.texto
                  }`}
                >
                  {porciones(m.elegido)}
                  <span className="font-normal text-slate-300">/</span>
                  {porciones(m.pautado)}
                </span>
              </div>

              <p className={`mt-0.5 truncate text-[11px] font-medium ${t.texto}`}>
                {BUCKET_LABEL[m.bucket]}
              </p>
              <p
                className={`text-[10px] ${
                  pasado ? 'text-rose-700' : completo ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {pasado
                  ? `${porciones(Math.abs(m.restante))} de más`
                  : completo
                    ? 'completo ✓'
                    : `te quedan ${porciones(m.restante)}`}
              </p>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setDetalle((v) => !v)}
        aria-expanded={detalle}
        className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
      >
        {detalle ? 'Ocultar el desglose ⌃' : 'Ver de qué te queda ⌄'}
      </button>

      {detalle && (
        <div className="mt-2 space-y-2.5">
          {macros.map((m) => (
            <div key={m.bucket}>
              <p className={`text-[10px] font-medium tracking-wide uppercase ${TONO[m.bucket].texto}`}>
                {BUCKET_LABEL[m.bucket]}
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {m.grupos.map((g) => (
                  <li key={g.grupo} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs text-slate-600">{g.nombre}</span>
                    <span
                      className={`tnum shrink-0 text-xs ${
                        g.restante < -0.01
                          ? 'text-rose-700'
                          : g.restante < 0.01
                            ? 'text-emerald-700'
                            : 'text-slate-700'
                      }`}
                    >
                      {porciones(g.elegido)} de {porciones(g.pautado)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-emerald-700">
        La verdura va aparte: al gusto y sin contar.
      </p>

      {/*
        Sin esto, la clienta llenaba todas sus comidas y el día seguía
        diciéndole que le faltaban grasas, sin nada que pudiera escoger para
        completarlas: eran las del aceite, que no se elige.
      */}
      {reserva > 0 && (
        <p className="tnum mt-1 text-[11px] text-slate-500">
          Aparte va el aceite de cocinar: {porciones(reserva)}{' '}
          {reserva === 1 ? 'porción de grasa ya contada' : 'porciones de grasa ya contadas'} en tu
          plan, que no tienes que elegir.
        </p>
      )}
    </section>
  );
}
