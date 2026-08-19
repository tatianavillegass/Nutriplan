import { useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { MacroBucket } from '../../data/exchangeGroups';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { costeDelPostre } from '../../utils/postres';
import { exchangesToMacros } from '../../utils/exchanges';
import { kcalFromMacros } from '../../utils/macros';
import { nombreBucket } from '../../utils/dailyBudget';
import { Button, fmt } from '../common/ui';

export interface PostreConEstado {
  postre: Receta;
  cabe: boolean;
  seLePasa: MacroBucket[];
}

interface Props {
  postres: PostreConEstado[];
  /** En fase 1 no hay porciones que gastar: sólo cabe apuntarlo como extra. */
  soloExtra?: boolean;
  onEnPlan: (postre: Receta) => void;
  onComoExtra: (postre: Receta) => void;
}

/**
 * ALGO DULCE
 *
 * Ideas que escribe la nutricionista para toda la consulta. Van plegadas y
 * fuera de las comidas a propósito: el antojo no tiene hora, y meterlas dentro
 * de la merienda sería decirle cuándo le toca querer algo dulce.
 *
 * SE VEN TODOS, MARCANDO CUÁLES CUADRAN
 * =====================================
 * Esconder un postre porque «hoy no le toca» es la app dando lecciones. Lo que
 * ayuda es que sepa cuál le cuadra con lo que le queda del día; lo que hace
 * daño es que la app decida por ella.
 *
 * Y AL AÑADIRLO, ELIGE QUIÉN LO PAGA
 * ==================================
 * Guardarse el hidrato de la cena para el postre es planificar. Comérselo
 * después de haber cenado es un extra, y el día dirá si el desvío importa.
 * Las dos son verdad y sólo ella sabe cuál es la suya.
 */
export function AlgoDulce({ postres, soloExtra = false, onEnPlan, onComoExtra }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);

  if (!postres.length) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <button
        onClick={() => {
          setAbierto((v) => !v);
          setElegido(null);
        }}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="text-sm font-semibold text-slate-800">¿Algo dulce?</span>
        <span className="tnum rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
          {postres.length}
        </span>
        <span className="ml-auto text-xs text-slate-400">{abierto ? 'Cerrar' : 'Ver ideas'}</span>
      </button>

      {abierto && (
        <>
          <p className="mt-1 text-xs leading-snug text-slate-500">
            Ideas de tu nutricionista. Puedes contarlas en tu plan o apuntarlas como un extra.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {postres.map(({ postre, cabe, seLePasa }) => (
              <button
                key={postre.id}
                onClick={() => setElegido(elegido === postre.id ? null : postre.id)}
                className={`overflow-hidden rounded-xl border text-left transition ${
                  elegido === postre.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 bg-white hover:border-brand-300'
                }`}
              >
                {postre.foto_url ? (
                  <img src={postre.foto_url} alt="" className="h-20 w-full object-cover" />
                ) : (
                  <span className="block h-20 w-full bg-brand-50" />
                )}
                <span className="block px-2 py-1.5">
                  <span className="block text-xs leading-snug text-slate-800">{postre.nombre}</span>
                  {!soloExtra && (
                    <span
                      className={`mt-0.5 block text-[10px] ${
                        cabe ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {cabe
                        ? 'Te cuadra hoy'
                        : `Se te pasaría de ${seLePasa
                            .map((b) => nombreBucket(b).toLowerCase())
                            .join(' y ')}`}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {elegido && (
            <Detalle
              entrada={postres.find((p) => p.postre.id === elegido)!}
              soloExtra={soloExtra}
              onEnPlan={(r) => {
                onEnPlan(r);
                setElegido(null);
              }}
              onComoExtra={(r) => {
                onComoExtra(r);
                setElegido(null);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

function Detalle({
  entrada,
  soloExtra,
  onEnPlan,
  onComoExtra,
}: {
  entrada: PostreConEstado;
  soloExtra: boolean;
  onEnPlan: (r: Receta) => void;
  onComoExtra: (r: Receta) => void;
}) {
  const { postre, cabe } = entrada;
  const coste = costeDelPostre(postre);
  const macros = exchangesToMacros(coste);
  const kcal = kcalFromMacros(macros);

  const enPorciones = (Object.entries(coste) as [keyof typeof EXCHANGE_GROUPS, number][])
    .map(([g, n]) => `${n} ${EXCHANGE_GROUPS[g].nombre.toLowerCase()}`)
    .join(' · ');

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-800">{postre.nombre}</p>
      <p className="tnum mt-0.5 text-xs text-slate-600">
        {enPorciones || 'Sin porciones que gastar'} · {fmt(kcal, 0)} kcal
      </p>

      {postre.ingredientes.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {postre.ingredientes.map((i) => (
            <li key={i.id} className="flex items-baseline gap-2 text-xs text-slate-600">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
              <span>
                {i.nombre}
                {i.cantidad_base != null && (
                  <span className="tnum ml-1.5 text-slate-500">
                    {i.cantidad_base} {i.unidad}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {postre.preparacion && (
        <p className="mt-2 text-xs leading-snug text-slate-600">{postre.preparacion}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!soloExtra && (
          <Button onClick={() => onEnPlan(postre)}>
            {cabe ? 'Contarlo en mi plan' : 'Contarlo igual en mi plan'}
          </Button>
        )}
        <Button variant="outline" onClick={() => onComoExtra(postre)}>
          Apuntarlo como extra
        </Button>
      </div>
      {!soloExtra && !cabe && (
        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
          Contarlo en el plan hará que el día se pase un poco. No pasa nada: se ve y se sigue.
        </p>
      )}
    </div>
  );
}
