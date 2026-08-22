import type { RegistroDia } from '../../types/diary';
import { checkInsDe, comoVaCambiando, PREGUNTAS } from '../../utils/checkin';

interface Props {
  registros: RegistroDia[];
}

const FLECHA = { sube: '↑', baja: '↓', igual: '=' } as const;

/**
 * LO QUE TE CUENTA CADA DOS SEMANAS
 *
 * Es material de consulta, no una nota. Se enseña el último con su cambio
 * respecto al anterior —lo que importa no es el número suelto sino hacia dónde
 * va— y el histórico debajo para poder decir «llevas tres quincenas durmiendo
 * mal», que es una conversación distinta a «¿qué tal el sueño?».
 *
 * Y lo primero de todo, lo que haya escrito: casi siempre es lo más útil.
 */
export function CheckInsDelPrograma({ registros }: Props) {
  const todos = checkInsDe(registros);
  if (!todos.length) return null;

  const tendencias = comoVaCambiando(registros);
  const ultimo = todos[todos.length - 1];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Sus check-ins</h3>
        <span className="text-[11px] text-slate-400">
          Último: {ultimo.fecha} · quincena {ultimo.numero}
        </span>
      </div>

      {ultimo.nota && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-900">
          «{ultimo.nota}»
        </p>
      )}

      <ul className="mt-3 space-y-1">
        {tendencias.map((t) => (
          <li
            key={t.id}
            className="flex items-baseline gap-2 rounded bg-slate-50 px-2 py-1.5 text-sm"
          >
            <span className="min-w-0 flex-1 text-slate-700">{t.texto}</span>
            <span className="tnum font-medium text-slate-800">{t.ahora}/5</span>
            {t.antes != null && (
              <span
                className={`tnum w-14 text-right text-xs ${
                  t.cambio === 'sube'
                    ? 'text-emerald-700'
                    : t.cambio === 'baja'
                      ? 'text-amber-700'
                      : 'text-slate-400'
                }`}
              >
                {FLECHA[t.cambio]} antes {t.antes}
              </span>
            )}
          </li>
        ))}
      </ul>

      {todos.length > 1 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="py-1 pr-2 font-medium">Quincena</th>
                {PREGUNTAS.map((p) => (
                  <th key={p.id} className="py-1 pr-2 font-medium capitalize">
                    {p.id === 'sueno' ? 'sueño' : p.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todos.map((c) => (
                <tr key={`${c.numero}-${c.fecha}`} className="border-t border-slate-100">
                  <td className="tnum py-1 pr-2 text-slate-600">{c.numero}</td>
                  {PREGUNTAS.map((p) => (
                    <td key={p.id} className="tnum py-1 pr-2 text-slate-700">
                      {c.respuestas[p.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
