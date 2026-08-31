import { useState } from 'react';
import type { RegistroDia } from '../../types/diary';
import { fechaLegible } from '../../types/diary';
import { QUE_HIZO_LABELS, pausasDe, type QueHizo } from '../../utils/hambreEmocional';

interface Props {
  registros: RegistroDia[];
}

/**
 * LO QUE HAS IDO ESCRIBIENDO
 *
 * Releerlo ES el ejercicio 5: el diario de emociones sirve cuando se mira
 * entero y aparecen los patrones que de uno en uno no se ven. La diferencia con
 * el papel es que aquí ya está escrito, sin haberse sentado a rellenar la tabla
 * el domingo.
 *
 * AQUÍ NO HAY NINGÚN NÚMERO, Y ES A PROPÓSITO
 * ===========================================
 * Ni cuántas van, ni si suben o bajan, ni racha. Un contador de episodios es un
 * marcador de fracasos, y a quien tiene mala relación con la comida eso le hace
 * daño — es lo mismo que ya se rechazó con el porcentaje de adherencia del día
 * y con ordenar a las clientas por peso. Los números los ve la nutricionista,
 * que sabe qué hacer con ellos.
 *
 * Las señales de alarma tampoco salen aquí. Se preguntaron para ella, y
 * devolvérselas marcadas sería convertir una confidencia en un diagnóstico.
 */
export function MisPausas({ registros }: Props) {
  const [abierto, setAbierto] = useState(false);
  const pausas = pausasDe(registros);

  if (!pausas.length) return null;

  return (
    <section className="rounded-2xl border border-teal-200 bg-white p-4">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-baseline justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold text-teal-900">Tus pausas</span>
        <span className="text-xs text-slate-400">{abierto ? 'Cerrar' : 'Ver'}</span>
      </button>
      <p className="mt-1 text-xs leading-snug text-slate-500">
        Lo que escribiste cada vez. Leerlo del tirón es donde se ven las cosas que se
        repiten.
      </p>

      {abierto && (
        <ul className="mt-3 space-y-2">
          {pausas.slice(0, 40).map((p) => (
            <li key={p.id} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-slate-800">
                  {p.emocion ?? 'Sin nombre'}
                </span>
                {p.intensidad ? (
                  <span className="tnum text-[11px] text-slate-500">{p.intensidad}/10</span>
                ) : null}
                <span className="ml-auto text-[11px] text-slate-400">
                  {fechaLegible(p.hora.slice(0, 10))}
                </span>
              </div>
              {p.contexto && (
                <p className="mt-0.5 text-xs leading-snug text-slate-600">{p.contexto}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {p.queHizo && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-600">
                    {QUE_HIZO_LABELS[p.queHizo as QueHizo] ?? p.queHizo}
                  </span>
                )}
                {p.actividad && (
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] text-teal-800">
                    {p.actividad}
                  </span>
                )}
              </div>
              {p.despues && (
                <p className="mt-1 text-xs leading-snug text-slate-500 italic">
                  Después: {p.despues}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
