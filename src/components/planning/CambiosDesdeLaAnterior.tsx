import { useMemo, useState } from 'react';
import type { Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import {
  compararPlanes,
  hayCambios,
  type CambioDeNumero,
  type Comparacion,
} from '../../utils/compararPlanes';
import { fmt } from '../common/ui';

interface Props {
  /** La que se está montando. */
  plan: Plan;
  /** La de la revisión pasada. Sin ella no hay nada que comparar. */
  anterior?: Plan;
  recetas: Receta[];
}

/**
 * DE DÓNDE VIENE Y ADÓNDE VA
 *
 * En una revisión mensual se vuelven a tomar medidas y sale una planificación
 * nueva. Como **nace clonada de la anterior**, en pantalla las dos son
 * idénticas hasta que se toca algo: lo que hace falta tener delante no es el
 * plan —ése ya se está mirando— sino la diferencia.
 *
 * Va **fija arriba y no plegada**: se mira mientras se retoca el reparto, que
 * es cuando se decide. Una tarjeta que hay que abrir se abre una vez y no se
 * vuelve a mirar.
 *
 * **Se calla cuando no hay nada que decir** (`hayCambios`): recién creada la
 * planificación es idéntica a la anterior, y una barra que dice «0 kcal, sin
 * cambios» ocupa sitio para no informar de nada. En cuanto se toca el reparto
 * aparece sola.
 */

/** «1.520 → 1.428» con el salto en verde o en ámbar según suba o baje. */
function Salto({
  c,
  unidad = '',
  decimales = 0,
}: {
  c: CambioDeNumero;
  unidad?: string;
  decimales?: number;
}) {
  const sube = c.delta > 0;
  const quieto = Math.abs(c.delta) < 0.5;
  return (
    <span className="tnum whitespace-nowrap">
      <span className="text-slate-400">{fmt(c.antes, decimales)}</span>
      <span className="mx-1 text-slate-300" aria-hidden>
        →
      </span>
      <span className="font-semibold text-slate-800">
        {fmt(c.ahora, decimales)}
        {unidad}
      </span>
      {!quieto && (
        /*
         * Ni verde ni rojo: subir no es bueno ni malo, depende de a quién. El
         * color aquí sólo dice hacia dónde, que es lo que se lee de un vistazo.
         */
        <span className={`ml-1 text-[10px] ${sube ? 'text-brand-700' : 'text-amber-700'}`}>
          {sube ? '+' : '−'}
          {fmt(Math.abs(c.delta), decimales)}
        </span>
      )}
    </span>
  );
}

export function CambiosDesdeLaAnterior({ plan, anterior, recetas }: Props) {
  const [abierto, setAbierto] = useState(false);

  const comparacion: Comparacion | undefined = useMemo(
    () => (anterior ? compararPlanes(anterior, plan, recetas) : undefined),
    [anterior, plan, recetas],
  );

  if (!anterior || !comparacion || !hayCambios(comparacion)) return null;

  const { kcal, pct, comidas, recetas: r, fase } = comparacion;
  const tocadas = comidas.filter((m) => Math.abs(m.delta) >= 1);

  return (
    <div className="sticky top-0 z-20 -mx-1 mb-3 rounded-xl border border-brand-200 bg-brand-50/90 px-4 py-2.5 backdrop-blur no-print">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-[11px] font-medium tracking-wide text-brand-800 uppercase">
          {anterior.nombre} → {plan.nombre}
        </span>

        <span className="text-xs text-slate-700">
          <Salto c={kcal} unidad=" kcal" />
        </span>

        <span className="flex flex-wrap gap-x-3 text-[11px] text-slate-600">
          <span>
            H <Salto c={pct.hc} unidad="%" />
          </span>
          <span>
            P <Salto c={pct.proteina} unidad="%" />
          </span>
          <span>
            G <Salto c={pct.grasa} unidad="%" />
          </span>
        </span>

        {fase && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">
            Fase {fase.antes} → {fase.ahora}
          </span>
        )}

        <button
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="ml-auto text-[11px] text-brand-700 underline"
        >
          {abierto ? 'ocultar el detalle' : 'ver comida a comida'}
        </button>
      </div>

      {abierto && (
        <div className="mt-2 grid gap-3 border-t border-brand-200/70 pt-2 md:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] tracking-wide text-slate-500 uppercase">
              Dónde se ha movido
            </p>
            {tocadas.length ? (
              <ul className="space-y-0.5">
                {tocadas.map((m) => (
                  <li key={m.slot} className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="text-slate-600">{m.nombre}</span>
                    <Salto c={m} unidad=" kcal" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-500">
                Las mismas calorías en cada comida: lo que cambia son las recetas.
              </p>
            )}
          </div>

          <div>
            <p className="mb-1 text-[10px] tracking-wide text-slate-500 uppercase">Las recetas</p>
            <p className="text-[11px] leading-snug text-slate-600">
              Siguen <strong className="tnum text-slate-800">{r.siguen.length}</strong>
              {r.fuera.length > 0 && (
                <>
                  {' · '}se van{' '}
                  <strong className="tnum text-amber-800">{r.fuera.length}</strong>
                </>
              )}
              {r.nuevas.length > 0 && (
                <>
                  {' · '}entran{' '}
                  <strong className="tnum text-brand-800">{r.nuevas.length}</strong>
                </>
              )}
            </p>
            {r.fuera.length > 0 && (
              <p className="mt-1 text-[11px] leading-snug text-amber-800">
                Le quitas: {r.fuera.join(', ')}.
              </p>
            )}
            {r.nuevas.length > 0 && (
              <p className="mt-0.5 text-[11px] leading-snug text-brand-800">
                Le pones: {r.nuevas.join(', ')}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
