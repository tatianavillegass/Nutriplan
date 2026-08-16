import { useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import type { DayType } from '../../types/plan';
import type { EntrenoDeReto, Reto } from '../../types/reto';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { diaDelReto, entrenosAbiertos, proximaApertura, recetasAbiertas } from '../../utils/retos';
import type { MealSlot } from '../../types/food';

const LABEL_SLOT: Record<MealSlot, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
  extra: 'Extra',
};

interface Props {
  reto: Reto;
  hoy: string;
  recetas: Receta[];
  /** Su tipo de día: es lo que escala la receta compartida a SUS porciones. */
  dayType: DayType;
  foods: Alimento[];
  /** Entrenos que ya ha dado por hechos hoy. */
  hechos: string[];
  onEntreno: (entrenoId: string) => void;
}

/**
 * EL RETO, DENTRO DE SU APP
 *
 * Antes de esto la participante veía una línea con el nombre del reto y ya: las
 * recetas que se iban abriendo y los entrenos no llegaban a ninguna parte, así
 * que el reto era una etiqueta de color en la pantalla de otra cosa.
 *
 * Se abre por días y lo abierto se queda abierto: el reto suma, no rota. Diez
 * recetas de golpe se leen como un PDF y se cierran; tres cada semana se
 * cocinan.
 */
export function RetoDelDia({
  reto,
  hoy,
  recetas,
  dayType,
  foods,
  hechos,
  onEntreno,
}: Props) {
  const [pestana, setPestana] = useState<'recetas' | 'entrenos'>('recetas');
  const [viendo, setViendo] = useState<string | null>(null);
  const dia = diaDelReto(reto, hoy);
  const abiertas = recetasAbiertas(reto, hoy);
  const entrenos = entrenosAbiertos(reto, hoy);
  const proxima = proximaApertura(reto, hoy);

  if (!abiertas.length && !entrenos.length) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 no-print">
        Todavía no hay nada abierto del reto. {proxima ? `El día ${proxima.dia} se abre lo primero.` : ''}
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-4 no-print sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">
          Tu reto · día {Math.max(1, dia)}
        </h2>
        {proxima && (
          <span className="text-[11px] text-slate-500">
            El día {proxima.dia} se abren {proxima.cuantas} recetas más
          </span>
        )}
      </div>

      {entrenos.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {(['recetas', 'entrenos'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPestana(p)}
              aria-pressed={pestana === p}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                pestana === p
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p === 'recetas' ? `Recetas (${abiertas.length})` : `Entrenos (${entrenos.length})`}
            </button>
          ))}
        </div>
      )}

      {pestana === 'recetas' || !entrenos.length ? (
        <ul className="mt-2 divide-y divide-slate-100">
          {abiertas.map((r) => {
            const receta = recetas.find((x) => x.id === r.recetaId);
            if (!receta) return null;
            const clave = `${r.recetaId}-${r.slot}`;
            /**
             * Las recetas del reto son las mismas para todas, pero los gramos
             * no: se escalan con lo que tenga pautado ella en la comida de ese
             * momento. Un reto no es «todas comiendo lo mismo», es todas
             * cocinando lo mismo en la cantidad que le toca a cada una.
             */
            const suComida = dayType.meals.find((m) => m.slot === r.slot);
            return (
              <li key={clave}>
                <button
                  onClick={() => setViendo(viendo === clave ? null : clave)}
                  aria-expanded={viendo === clave}
                  className="flex w-full items-center gap-3 py-2 text-left"
                >
                  <span className="w-20 shrink-0 text-[11px] text-slate-400">
                    {LABEL_SLOT[r.slot] ?? r.slot}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                    {receta.nombre}
                  </span>
                  <span aria-hidden className="shrink-0 text-slate-300">
                    {viendo === clave ? '⌃' : '›'}
                  </span>
                </button>

                {viendo === clave && (
                  <div className="pb-2">
                    <ScaledRecipeView
                      receta={receta}
                      requeridos={(suComida && dayType.grid[suComida.id]) ?? {}}
                      foods={foods}
                      soloLectura
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-2 space-y-2">
          {entrenos.map((e) => (
            <EntrenoAbierto
              key={e.id}
              entreno={e}
              hecho={hechos.includes(e.id)}
              onHecho={() => onEntreno(e.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Un entreno: el vídeo enseña a hacerlo y la lista dice cuántas vueltas van. */
function EntrenoAbierto({
  entreno,
  hecho,
  onHecho,
}: {
  entreno: EntrenoDeReto;
  hecho: boolean;
  onHecho: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <li className="rounded-lg border border-slate-200">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-800">{entreno.nombre}</span>
          {entreno.descripcion && (
            <span className="block text-[11px] leading-snug text-slate-500">
              {entreno.descripcion}
            </span>
          )}
        </span>
        {hecho && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            hecho ✓
          </span>
        )}
        <span aria-hidden className="shrink-0 text-slate-300">
          {abierto ? '⌃' : '⌄'}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-slate-100 px-3 py-2">
          {entreno.videoUrl && (
            <a
              href={entreno.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-2 inline-block text-xs font-medium text-brand-700 underline"
            >
              Ver el vídeo
            </a>
          )}
          {entreno.ejercicios.length > 0 && (
            <ul className="divide-y divide-slate-50">
              {entreno.ejercicios.map((ej) => (
                <li key={ej.id} className="flex flex-wrap items-baseline gap-x-2 py-1 text-xs">
                  <span className="min-w-0 flex-1 text-slate-700">{ej.nombre}</span>
                  <span className="tnum shrink-0 text-slate-500">
                    {[
                      ej.series ? `${ej.series} series` : '',
                      ej.repeticiones ? `× ${ej.repeticiones}` : '',
                      ej.descanso ? `· ${ej.descanso}` : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                  {ej.nota && (
                    <span className="w-full text-[11px] leading-snug text-slate-400">{ej.nota}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Marcarlo es lo que deja ver a la nutricionista si se entrena. */}
          <div className="mt-2 flex justify-end">
            <button
              onClick={onHecho}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                hecho
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100'
              }`}
            >
              {hecho ? 'Hecho ✓' : 'Marcar hecho'}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
