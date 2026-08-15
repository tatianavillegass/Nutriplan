import type { Meta } from "../../types/client";

interface Props {
  metas: Meta[];
  /** Ids de las que ya están marcadas hoy. */
  hechas: string[];
  onAlternar: (metaId: string) => void;
  soloLectura?: boolean;
}

/**
 * LAS METAS DE HOY
 *
 * La comida es la mitad del trabajo; la otra mitad es andar, beber agua y
 * dormir. Se marcan con un gesto y no piden número: «2 litros» es la meta, no
 * hace falta apuntar cuántos vasos van.
 *
 * Van arriba, con el día, porque se cumplen durante el día — no al final,
 * cuando ya no se puede hacer nada al respecto.
 */
export function MetasDiarias({
  metas,
  hechas,
  onAlternar,
  soloLectura = false,
}: Props) {
  if (!metas.length) return null;

  const marcada = (id: string) => hechas.includes(id);
  const cuantas = metas.filter((m) => marcada(m.id)).length;
  const todas = cuantas === metas.length;

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 no-print">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-sky-900 uppercase">
          Tus metas de hoy
        </h2>
        <span
          className={`tnum text-xs ${todas ? "text-emerald-700" : "text-sky-700"}`}
        >
          {cuantas} de {metas.length}
          {todas && " ✓"}
        </span>
      </div>

      <ul className="space-y-1.5">
        {metas.map((m) => {
          const hecha = marcada(m.id);
          return (
            <li key={m.id}>
              <button
                onClick={() => !soloLectura && onAlternar(m.id)}
                disabled={soloLectura}
                aria-pressed={hecha}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                  hecha
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-sky-200 bg-white hover:border-sky-300"
                } ${soloLectura ? "cursor-default" : ""}`}
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm ${
                    hecha
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-sky-300 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span
                  className={`text-sm ${hecha ? "text-emerald-900 line-through decoration-emerald-400" : "text-slate-700"}`}
                >
                  {m.texto}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/*
        Las metas no tocan las comidas. Decirlo evita que un día de poca agua
        se lea como que el plan de comer se ha roto.
      */}
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Van por su cuenta: no cuentan en las comidas ni en las calorías del día.
      </p>
    </section>
  );
}
