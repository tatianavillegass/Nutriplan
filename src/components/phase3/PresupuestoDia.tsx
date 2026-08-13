import type { DayType } from '../../types/plan';
import type { MacroBucket } from '../../data/exchangeGroups';
import { presupuestoDelDia, type SeleccionGrupos } from '../../utils/dailyBudget';
import { BUCKET_LABEL } from '../../utils/mealOptions';

interface Props {
  dayType: DayType;
  seleccion: SeleccionGrupos;
}

const TONO: Record<MacroBucket, { barra: string; fondo: string; texto: string }> = {
  proteina: { barra: 'bg-brand-600', fondo: 'bg-brand-100', texto: 'text-brand-800' },
  carbohidrato: { barra: 'bg-amber-500', fondo: 'bg-amber-100', texto: 'text-amber-800' },
  grasa: { barra: 'bg-rose-400', fondo: 'bg-rose-100', texto: 'text-rose-800' },
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
  const macros = presupuestoDelDia(dayType, seleccion);
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

      <div className="grid gap-3 sm:grid-cols-3">
        {macros.map((m) => {
          const t = TONO[m.bucket];
          const pct = m.pautado > 0 ? Math.min(100, (m.elegido / m.pautado) * 100) : 0;
          const pasado = m.restante < -0.01;

          return (
            <div key={m.bucket} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-xs font-semibold ${t.texto}`}>
                  {BUCKET_LABEL[m.bucket]}
                </span>
                <span className="tnum text-[11px] text-slate-500">
                  {porciones(m.elegido)} de {porciones(m.pautado)}
                </span>
              </div>

              <div className={`mt-1.5 h-2 w-full overflow-hidden rounded-full ${t.fondo}`}>
                <div
                  className={`h-full rounded-full transition-all ${pasado ? 'bg-rose-500' : t.barra}`}
                  style={{ width: `${pasado ? 100 : pct}%` }}
                />
              </div>

              <p
                className={`tnum mt-1 text-[11px] ${pasado ? 'text-rose-700' : 'text-slate-500'}`}
              >
                {pasado
                  ? `te has pasado ${porciones(Math.abs(m.restante))}`
                  : m.restante < 0.01
                    ? 'completo'
                    : `te quedan ${porciones(m.restante)}`}
              </p>

              {/* El desglose: es lo que de verdad escoge de su despensa. */}
              {m.grupos.length > 0 && (
                <ul className="mt-2 space-y-0.5 border-t border-slate-100 pt-1.5">
                  {m.grupos.map((g) => (
                    <li key={g.grupo} className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11px] text-slate-500">{g.nombre}</span>
                      <span
                        className={`tnum shrink-0 text-[11px] ${
                          g.restante < -0.01
                            ? 'text-rose-700'
                            : g.restante < 0.01
                              ? 'text-emerald-700'
                              : 'text-slate-600'
                        }`}
                      >
                        {porciones(g.elegido)}/{porciones(g.pautado)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-emerald-700">
        La verdura va aparte: al gusto y sin contar.
      </p>
    </section>
  );
}
