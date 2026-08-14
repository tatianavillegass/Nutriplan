import type { Recurso } from "../../types/recursos";
import { recursosVisibles } from "../../types/recursos";

/**
 * RECURSOS
 *
 * Lo que la nutricionista deja preparado y no cabe en el plan del día: la guía
 * visual de raciones, marcas que recomienda, cómo leer una etiqueta.
 *
 * Se lee, no se marca. Aquí no hay nada que cumplir.
 */
export function RecursosTab({ recursos }: { recursos: Recurso[] }) {
  const lista = recursosVisibles(recursos);

  if (!lista.length) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        Tu nutricionista todavía no ha dejado nada por aquí. Cuando lo haga, lo
        verás en esta pestaña.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {lista.map((r) => (
        <article
          key={r.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          {r.imagen && (
            <img
              src={r.imagen}
              alt=""
              className="max-h-64 w-full object-cover"
              loading="lazy"
            />
          )}
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-900">{r.titulo}</h3>
            {r.descripcion && (
              <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-slate-600">
                {r.descripcion}
              </p>
            )}
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-block text-xs font-medium text-brand-700 underline decoration-dotted underline-offset-2 hover:text-brand-900"
              >
                Abrir →
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
