import { useMemo } from 'react';
import type { Alimento } from '../../types/food';
import type { DayType, Meal } from '../../types/plan';
import type { PorcionesMarcadas } from '../../types/diary';
import { MIN_VERDURA_G } from '../../data/exchangeGroups';
import { BUCKET_LABEL, describirReparto, textoItem, type OpcionEscalada } from '../../utils/mealOptions';
import { columnasDeComida } from '../../utils/combosGuardados';
import { notaAceite, repartoElegible } from '../../utils/pantry';
import { marcadoDeBucket, opcionElegida } from '../../utils/marcado';
import { fmt } from '../common/ui';

interface Props {
  dayType: DayType;
  meal: Meal;
  foods: Alimento[];
  /** 'documento' para imprimir · 'editor' para la nutricionista. */
  modo?: 'documento' | 'editor';
  /** Si se pasa, las opciones son pulsables y se marcan. */
  porciones?: PorcionesMarcadas;
  onElegir?: (opcion: OpcionEscalada) => void;
  onNota?: (texto: string) => void;
  onPostre?: (texto: string) => void;
}

/**
 * FASE 2 — cada opción trae los gramos ya multiplicados por lo que le toca
 * al cliente en esa comida. Si es interactiva, pulsar una la deja marcada
 * y sustituye a la que hubiera de ese mismo macro.
 */
export function ScaledOptionsBoard({
  dayType,
  meal,
  foods,
  modo = 'documento',
  porciones,
  onElegir,
  onNota,
  onPostre,
}: Props) {
  const interactivo = !!porciones && !!onElegir;

  /** El aceite de cocción sale del reparto antes de generar opciones. */
  const { reserva } = useMemo(() => repartoElegible(dayType, meal), [dayType, meal]);
  const aceite = notaAceite(foods, reserva);

  /** Si la nutricionista ha guardado combinaciones, mandan las suyas. */
  const columnas = useMemo(
    () =>
      columnasDeComida(dayType, meal, foods).map((c) => ({
        bucket: c.bucket,
        total: c.objetivo.porciones,
        porSubgrupo: c.objetivo.porSubgrupo,
        kcalMaximas: c.objetivo.kcalMaximas,
        opciones: c.opciones,
        propias: c.propias,
      })),
    [dayType, meal, foods],
  );

  const esPrincipal = meal.slot === 'comida' || meal.slot === 'cena';

  if (!columnas.length) return null;

  return (
    <section className="print-sheet break-inside-avoid rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-2.5">
        <h3 className="text-base font-bold tracking-wide text-slate-300 uppercase">{meal.nombre}</h3>
      </header>

      <div className="grid gap-5 p-5 md:grid-cols-3">
        {columnas.map((col) => {
          const marcado = porciones
            ? marcadoDeBucket(porciones, meal.id, col.bucket, foods)
            : 0;
          const completo = interactivo && Math.abs(marcado - col.total) < 0.01;

          return (
            <div key={col.bucket}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">{BUCKET_LABEL[col.bucket]}</p>
                {interactivo && (
                  <span
                    className={`tnum rounded px-1.5 py-0.5 text-[10px] ${
                      completo
                        ? 'bg-emerald-50 text-emerald-700'
                        : marcado > 0
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {completo ? 'elegido ✓' : marcado > 0 ? 'a medias' : 'sin elegir'}
                  </span>
                )}
              </div>
              <p className="tnum mb-2 text-[10px] text-slate-400">
                {fmt(col.total, col.total % 1 ? 1 : 0)}{' '}
                {col.total === 1 ? 'porción' : 'porciones'} · {describirReparto(col.porSubgrupo)}
                {modo === 'editor' && (
                  <>
                    {' '}
                    · hasta {fmt(col.kcalMaximas)} kcal
                    {col.propias && <span className="text-brand-600"> · tus combinaciones</span>}
                  </>
                )}
              </p>

              {col.opciones.length === 0 ? (
                <p className="text-[11px] text-amber-700">
                  Sin combinaciones posibles para {meal.nombre.toLowerCase()}. Revisa la despensa de
                  esta comida.
                </p>
              ) : (
                <ul className="space-y-1">
                  {col.opciones.map((o) => {
                    const elegida = porciones ? opcionElegida(porciones, meal.id, o) : false;

                    const contenido = (
                      <>
                        {o.items.map((it, i) => (
                          <span key={it.foodId}>
                            {i > 0 && <span className="text-slate-400">, </span>}
                            {textoItem(it)}
                          </span>
                        ))}
                        {o.unificada && modo === 'editor' && (
                          <span className="ml-1 text-[10px] text-amber-600">
                            (todo de un alimento)
                          </span>
                        )}
                      </>
                    );

                    if (!interactivo) {
                      return (
                        <li
                          key={o.id}
                          className="flex items-baseline gap-1.5 text-[13px] leading-snug"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                          <span className="text-slate-700">{contenido}</span>
                        </li>
                      );
                    }

                    return (
                      <li key={o.id}>
                        <button
                          onClick={() => onElegir?.(o)}
                          className={`flex w-full items-baseline gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug transition ${
                            elegida
                              ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-300'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] ${
                              elegida
                                ? 'bg-brand-600 text-white'
                                : 'border border-slate-300 text-transparent'
                            }`}
                            aria-hidden
                          >
                            ✓
                          </span>
                          <span>{contenido}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <footer className="space-y-1 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-600">
        {aceite && (
          <p className="text-amber-800">
            <strong className="font-medium">{aceite}</strong> — ya reservado, no hace falta elegirlo.
          </p>
        )}

        {esPrincipal && (
          <p>
            <strong className="font-medium">Nota:</strong> verdura ilimitada (mínimo ½ plato:{' '}
            {MIN_VERDURA_G} g)
          </p>
        )}

        {modo === 'editor' ? (
          <>
            <label className="block">
              <span className="text-slate-500">Nota para esta comida</span>
              <input
                value={dayType.notas?.[meal.id] ?? ''}
                onChange={(e) => onNota?.(e.target.value)}
                placeholder="Complemento, bebida, indicaciones…"
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand-400"
              />
            </label>
            {meal.slot === 'cena' && (
              <label className="block">
                <span className="text-slate-500">Postre</span>
                <input
                  value={dayType.postre ?? ''}
                  onChange={(e) => onPostre?.(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand-400"
                />
              </label>
            )}
          </>
        ) : (
          <>
            {dayType.notas?.[meal.id] && <p>{dayType.notas[meal.id]}</p>}
            {meal.slot === 'cena' && dayType.postre && (
              <p>
                <strong className="font-medium">Postre:</strong> {dayType.postre}
              </p>
            )}
          </>
        )}
      </footer>
    </section>
  );
}
