import type { ReactNode } from 'react';
import type { Receta } from '../../types/recipe';
import { RecipeMeta } from '../common/RecipeMeta';

interface Props {
  receta: Receta;
  seleccionada?: boolean;
  /** Vetada por una patología, una alergia o una aversión: se ve, no se elige. */
  bloqueada?: boolean;
  onClick?: () => void;
  /** Lo que cubre, lo que le falta, el motivo del bloqueo… */
  pie?: ReactNode;
  /** Esquina superior derecha: «exacta», «ya usada». */
  esquina?: ReactNode;
  /** Guarnición o postre: la foto va más baja porque caben más por fila. */
  pequena?: boolean;
}

/**
 * UNA RECETA, CON SU FOTO
 *
 * Al pautar no se lee una lista de nombres: se mira. Una nutricionista que
 * lleva doscientas recetas en el banco reconoce el bowl de avena por la foto
 * mucho antes que por «Porridge de avena con bebida de soja y proteína», y
 * elegir mirando es lo que hace que el plan se monte en minutos y no en media
 * hora.
 *
 * LA FOTO SIEMPRE OCUPA SU SITIO
 * ==============================
 * Una receta sin foto deja un hueco gris con un plato dibujado, no una tarjeta
 * más baja: en una cuadrícula, las alturas distintas hacen que las filas bailen
 * y el ojo pierde la pista. Y el hueco gris además avisa de que a esa receta le
 * falta la foto, que es la única forma de acordarse de ponerla.
 *
 * Estaba escrito a mano en cinco sitios —el banco, el recomendador, la vista de
 * la clienta—, así que cada retoque había que hacerlo cinco veces y ya se
 * habían separado entre sí.
 */
export function RecipeCard({
  receta,
  seleccionada = false,
  bloqueada = false,
  onClick,
  pie,
  esquina,
  pequena = false,
}: Props) {
  return (
    <button
      onClick={onClick}
      disabled={bloqueada}
      aria-pressed={seleccionada}
      className={`flex w-full flex-col overflow-hidden rounded-xl border text-left transition disabled:cursor-not-allowed ${
        seleccionada
          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400'
          : bloqueada
            ? 'border-slate-200 bg-slate-50 opacity-60'
            : 'border-slate-200 bg-white hover:border-brand-400 hover:shadow-sm'
      }`}
    >
      <span className="relative block">
        {receta.foto_url ? (
          <img
            src={receta.foto_url}
            alt={receta.nombre}
            loading="lazy"
            className={`w-full object-cover ${pequena ? 'h-20' : 'h-28'}`}
          />
        ) : (
          <span
            aria-hidden
            className={`flex w-full items-center justify-center bg-slate-100 text-2xl text-slate-300 ${
              pequena ? 'h-20' : 'h-28'
            }`}
          >
            🍽
          </span>
        )}

        {/* La marca de elegida va encima de la foto: en una cuadrícula de
            treinta tarjetas hay que verla sin leer nada. */}
        {seleccionada && (
          <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white shadow">
            ✓
          </span>
        )}
        {esquina && !seleccionada && (
          <span className="absolute top-1.5 left-1.5">{esquina}</span>
        )}
      </span>

      <span className="flex flex-1 flex-col p-2.5">
        <span className="text-[13px] leading-snug font-medium text-slate-800">
          {receta.nombre}
        </span>
        <RecipeMeta receta={receta} className="mt-1 gap-x-2.5 text-[10px]" />
        {pie && <span className="mt-1 block">{pie}</span>}
      </span>
    </button>
  );
}
