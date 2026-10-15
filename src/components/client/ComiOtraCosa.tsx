import { useState } from 'react';
import type { Alimento } from '../../types/food';
import type { Bocado } from '../../types/diary';
import { AnadirBocado } from '../phase4/AnadirBocado';
import { ConNumeros } from './SinNumeros';
import { Button, fmt } from '../common/ui';

interface Props {
  mealId: string;
  mealNombre: string;
  foods: Alimento[];
  /** Lo que ya ha apuntado en esta comida. */
  bocados: Bocado[];
  /** Si ya dijo que aquí comió otra cosa (o que no comió nada). */
  activa: boolean;
  nota?: string;
  onAbrir: () => void;
  onCerrar: () => void;
  onAnadir: (bocado: Bocado, alimentoNuevo?: Alimento) => void;
  onQuitar: (bocadoId: string) => void;
  onNota: (nota: string) => void;
}

/**
 * COMÍ OTRA COSA
 *
 * La queja que más se repetía: «no comí ninguna de las recetas que me pusiste,
 * pero comí sano — no quiero marcarlo libre». Y sus hermanas: «comí menos de
 * lo que me pusiste» y «no merendé, pero comí otra cosa». Las tres acababan
 * igual de mal: o se marcaba hecha una comida que no se hizo, o se apuntaba
 * como extra — y entonces un día en que comió MENOS salía pasado de calorías,
 * porque el extra se sumaba encima de una merienda que nunca se comió.
 *
 * Aquí apunta lo que comió de verdad, con el mismo buscador de la fase 4, y
 * eso **sustituye** a esa comida en las cuentas del día en vez de sumarse.
 *
 * SIN BOCADOS ES «NO COMÍ NADA»
 * =============================
 * Saltarse una comida es una respuesta tan válida como las demás, y hasta
 * ahora no había forma de decirlo: una comida sin marcar era lo mismo que una
 * que se olvidó de apuntar, y eso ensuciaba el seguimiento.
 *
 * ES PARA USARLO POCO, Y SE NOTA
 * ==============================
 * Va donde «Libre», con el mismo peso: un enlace pequeño, no un botón. Si
 * apuntar lo que come por su cuenta fuera tan cómodo como seguir el plan,
 * dejaría de ser un plan.
 */
export function ComiOtraCosa({
  mealId,
  mealNombre,
  foods,
  bocados,
  activa,
  nota,
  onAbrir,
  onCerrar,
  onAnadir,
  onQuitar,
  onNota,
}: Props) {
  const [anadiendo, setAnadiendo] = useState(false);
  const [texto, setTexto] = useState(nota ?? '');

  if (!activa) {
    return (
      <button
        onClick={onAbrir}
        className="text-[11px] text-slate-400 underline transition hover:text-brand-700"
      >
        Comí otra cosa
      </button>
    );
  }

  const total = bocados.reduce((s, b) => s + b.kcal, 0);

  return (
    <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-sky-900">
          En {mealNombre.toLowerCase()} comiste otra cosa
        </p>
        <button
          onClick={onCerrar}
          className="text-[11px] text-slate-500 underline hover:text-slate-800"
        >
          Deshacer
        </button>
      </div>

      {bocados.length ? (
        <ul className="mb-2 space-y-1">
          {bocados.map((b) => (
            <li key={b.id} className="flex items-baseline gap-2 text-xs">
              <span className="flex-1 truncate text-slate-700">
                {b.nombre}
                <span className="tnum ml-1.5 text-slate-500">
                  {fmt(b.cantidad)} {b.unidad}
                </span>
              </span>
              <ConNumeros>
                <span className="tnum shrink-0 text-[11px] text-slate-400">{fmt(b.kcal)} kcal</span>
              </ConNumeros>
              <button
                onClick={() => onQuitar(b.id)}
                aria-label={`Quitar ${b.nombre}`}
                className="shrink-0 text-slate-300 transition hover:text-red-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        /*
         * No es un hueco a rellenar: es una de las respuestas. Quien no
         * merendó ya ha terminado aquí.
         */
        <p className="mb-2 text-[11px] leading-snug text-slate-600">
          Si no comiste nada en esta comida, déjalo así: queda contestada y no
          suma nada al día.
        </p>
      )}

      {anadiendo ? (
        <AnadirBocado
          foods={foods}
          momento={mealId}
          onAnadir={(b, nuevo) => {
            onAnadir(b, nuevo);
            setAnadiendo(false);
          }}
        />
      ) : (
        <Button variant="outline" onClick={() => setAnadiendo(true)} className="text-xs">
          + Apuntar lo que comiste
        </Button>
      )}

      {bocados.length > 0 && (
        <ConNumeros>
          <p className="tnum mt-2 text-[11px] text-slate-500">{fmt(total)} kcal en total</p>
        </ConNumeros>
      )}

      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => onNota(texto.trim())}
        placeholder="Si quieres, cuéntame qué fue (opcional)"
        className="mt-2 w-full rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky-400"
      />
    </div>
  );
}
