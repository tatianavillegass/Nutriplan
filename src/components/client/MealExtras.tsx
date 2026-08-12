import { useState } from 'react';
import type { Alimento } from '../../types/food';
import type { Extra } from '../../types/diary';
import { ExtraForm, ExtraRow } from './ExtraForm';
import { fmt } from '../common/ui';

interface Props {
  /** Comida en la que se apunta: es lo que dice cuándo se comió. */
  mealId: string;
  mealNombre: string;
  /** Los extras ya apuntados en esta comida. */
  extras: Extra[];
  foods: Alimento[];
  onAnadir: (extra: Extra) => void;
  onQuitar: (id: string) => void;
  soloLectura?: boolean;
}

/**
 * EXTRA EN UNA COMIDA
 *
 * Antes aquí había un panel de «Personalizar» que dejaba quitar ingredientes,
 * cambiarlos y completar huecos: demasiadas cosas a la vez para el momento en
 * que uno está comiendo. Ahora hace una sola: apuntar lo que te has tomado de
 * más, en la comida en la que te lo tomaste.
 *
 * No corrige ni recorta nada del plan. Suma a las calorías del día y el
 * resumen del pie dice si el desvío importa.
 */
export function MealExtras({
  mealId,
  mealNombre,
  extras,
  foods,
  onAnadir,
  onQuitar,
  soloLectura = false,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const kcal = extras.reduce((s, e) => s + e.kcal, 0);

  if (soloLectura && !extras.length) return null;

  return (
    <div className="mt-1.5 no-print">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {kcal > 0 && (
          <span className="tnum text-[11px] text-amber-700">
            {fmt(kcal)} kcal de extra en {mealNombre.toLowerCase()}
          </span>
        )}
        {!soloLectura && (
          <button
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              abierto
                ? 'border-amber-400 bg-amber-100 text-amber-900'
                : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {abierto ? 'Cancelar' : '+ Añadir extra'}
          </button>
        )}
      </div>

      {abierto && !soloLectura && (
        <div className="mt-2">
          <ExtraForm
            foods={foods}
            momento={mealId}
            placeholder="Lo que te hayas tomado de más…"
            onAnadir={onAnadir}
            onCerrar={() => setAbierto(false)}
          />
        </div>
      )}

      {extras.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50/40 p-1.5">
          {extras.map((e) => (
            <ExtraRow key={e.id} extra={e} onQuitar={soloLectura ? undefined : onQuitar} />
          ))}
        </ul>
      )}
    </div>
  );
}
