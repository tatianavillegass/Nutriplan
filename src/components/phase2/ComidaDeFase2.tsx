import { useState } from 'react';
import type { Alimento } from '../../types/food';
import type { CombinacionGuardada, DayType, DespensaComida, Meal } from '../../types/plan';
import { alimentosDeComida, repartoElegible } from '../../utils/pantry';
import { guardadasDe } from '../../utils/combosGuardados';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { MealPantryEditor } from '../planning/MealPantryEditor';
import { ComboEditor } from './ComboEditor';
import { fmt } from '../common/ui';

interface Props {
  dayType: DayType;
  meal: Meal;
  foods: Alimento[];
  onDespensa: (despensa: Record<string, DespensaComida>) => void;
  onCombinaciones: (c: Record<string, CombinacionGuardada[]>) => void;
  onAceite: (porciones: number) => void;
  onNota: (texto: string) => void;
  motivoBloqueo?: (food: Alimento) => string | undefined;
}

/**
 * UNA COMIDA DE FASE 2, DE PRINCIPIO A FIN
 *
 * Eran dos tarjetas: «Qué puede elegir el cliente» con la despensa y
 * «Combinaciones que verá el cliente» con los combos. Dos listas de las mismas
 * comidas, una debajo de otra, en las que había que abrir el desayuno dos veces
 * en dos sitios distintos para montarlo entero — y sin que nada dijera que la
 * primera alimenta a la segunda.
 *
 * Son **dos pasos de lo mismo** y por eso van en la misma fila, numerados:
 * primero qué alimentos tiene esa comida, y con ellos, qué combinaciones se le
 * proponen. De la despensa salen además las alternativas que le aparecen a la
 * clienta al pulsar un alimento para cambiarlo, así que el orden importa: lo de
 * arriba es lo que hace posible lo de abajo.
 *
 * La cabecera dice **cómo está la comida sin abrirla**: cuántos alimentos tiene
 * y si las combinaciones son las suyas o las que propone la app.
 */
export function ComidaDeFase2({
  dayType,
  meal,
  foods,
  onDespensa,
  onCombinaciones,
  onAceite,
  onNota,
  motivoBloqueo,
}: Props) {
  const [abierto, setAbierto] = useState(false);

  const { reparto } = repartoElegible(dayType, meal);
  const cuantos = alimentosDeComida(dayType, meal, foods).length;
  const propias = (['proteina', 'carbohidrato', 'grasa'] as const).reduce(
    (s, b) => s + guardadasDe(dayType, meal.id, b).length,
    0,
  );

  /** Lo pautado, que es el contexto de todo lo de dentro. */
  const loPautado = (Object.entries(reparto) as [keyof typeof EXCHANGE_GROUPS, number][])
    .filter(([, n]) => n > 0)
    .map(([g, n]) => `${fmt(n, n % 1 ? 1 : 0)} ${EXCHANGE_GROUPS[g].nombre.toLowerCase()}`)
    .join(' · ');

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full px-4 py-2.5 text-left"
      >
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="flex items-baseline gap-2">
            <span aria-hidden className="text-[10px] text-slate-400">
              {abierto ? '▾' : '▸'}
            </span>
            <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
              {meal.nombre}
            </span>
          </span>
          <span className="text-[11px] text-slate-400">
            {cuantos} {cuantos === 1 ? 'alimento' : 'alimentos'} ·{' '}
            {propias > 0 ? (
              <span className="text-brand-600">
                {propias} {propias === 1 ? 'combinación tuya' : 'combinaciones tuyas'}
              </span>
            ) : (
              'combinaciones automáticas'
            )}
            <span className="ml-2 text-brand-600">{abierto ? 'ocultar' : 'editar'}</span>
          </span>
        </span>
        {loPautado && (
          <span className="tnum mt-0.5 block text-[11px] text-slate-400">{loPautado}</span>
        )}
      </button>

      {abierto && (
        <div className="space-y-5 border-t border-slate-100 px-4 py-3">
          <div>
            <p className="mb-0.5 text-[11px] font-semibold text-slate-700">
              1 · Qué alimentos tiene en esta comida
            </p>
            <p className="mb-2 text-[11px] leading-snug text-slate-500">
              De aquí salen las combinaciones de abajo y las alternativas que ve al pulsar un
              alimento para cambiarlo. Cuantas más frutas pongas, más podrá variar.
            </p>
            <MealPantryEditor
              sinCabecera
              dayType={dayType}
              meal={meal}
              foods={foods}
              motivoBloqueo={motivoBloqueo}
              onDespensa={onDespensa}
              onAceite={onAceite}
              onNota={onNota}
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-0.5 text-[11px] font-semibold text-slate-700">
              2 · Qué combinaciones le propones
            </p>
            <p className="mb-2 text-[11px] leading-snug text-slate-500">
              Puedes quedarte con las que propone la app o componer las tuyas. Si guardas alguna
              propia, son las únicas que verá — pero podrá cambiarle un alimento por otro de
              arriba.
            </p>
            <ComboEditor
              sinCabecera
              dayType={dayType}
              meal={meal}
              foods={foods}
              motivoBloqueo={motivoBloqueo}
              onCombinaciones={onCombinaciones}
              onAceite={onAceite}
              onNota={onNota}
            />
          </div>
        </div>
      )}
    </div>
  );
}
