import type { Alimento } from '../../types/food';
import type { Avituallamiento, Meal } from '../../types/plan';
import {
  comoVa,
  convieneMezclar,
  gramosDelAvituallamiento,
  gramosMarcados,
  hcDeUnaMedida,
  ritmoDelAvituallamiento,
  unidadesMarcadas,
} from '../../utils/avituallamiento';
import { fmt } from '../common/ui';

interface Props {
  meal: Meal;
  avituallamiento: Avituallamiento;
  /** Las fuentes que le montó su nutricionista en la despensa de esa comida. */
  fuentes: Alimento[];
  /** foodId → porciones marcadas en esa comida. */
  marcado: Record<string, number>;
  onMarcar: (foodId: string, delta: number) => void;
  acciones?: React.ReactNode;
}

/**
 * LO QUE LLEVAS PARA LA SALIDA
 *
 * En el avituallamiento no se elige un plato: se suman fuentes hasta llegar a
 * los gramos de hidrato pautados. Un gel son 25 g, un dátil 15, un bidón 30, y
 * se ven como lo que son —unidades— aunque por dentro se guarden como
 * porciones, igual que todo lo demás.
 *
 * SE ENSEÑA LO QUE LLEVA, NO LO QUE LE QUEDA
 * ==========================================
 * Como el contador de fase 4: un número que baja hasta cero convierte el
 * avituallamiento en un descubierto. Aquí se suma.
 *
 * Y NO SE BLOQUEA NADA
 * ====================
 * Pasarse un poco es información, no un error: en la bici se lleva de más a
 * propósito. Se dice y ya, con el mismo margen del 10 % que el resto del día.
 */
export function AvituallamientoDelDia({
  meal,
  avituallamiento,
  fuentes,
  marcado,
  onMarcar,
  acciones,
}: Props) {
  const objetivo = gramosDelAvituallamiento(avituallamiento);
  const gh = ritmoDelAvituallamiento(avituallamiento);
  const lleva = gramosMarcados(marcado, fuentes);
  const estado = comoVa(lleva, objetivo);
  const mezclar = convieneMezclar(gh, marcado, fuentes);

  const pct = objetivo > 0 ? Math.min(100, Math.round((lleva / objetivo) * 100)) : 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-2.5">
        <h3 className="text-base font-bold tracking-wide text-slate-300 uppercase">
          {meal.nombre}
        </h3>
        {acciones && (
          <div className="flex flex-wrap items-center gap-1.5 no-print">{acciones}</div>
        )}
      </header>

      <div className="p-5">
        <p className="text-xs leading-snug text-slate-500">
          {gh
            ? `Para ${fmt(avituallamiento.horas ?? 0, 1)} h a ${gh} g de hidrato por hora. Repártelo a lo largo de la salida, empezando en los primeros 20 minutos.`
            : 'Lo que llevas para la salida. Repártelo a lo largo del entreno.'}
        </p>

        {/* Se enseña lo que lleva, nunca lo que le queda. */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all ${
              estado === 'pasado' ? 'bg-amber-500' : 'bg-brand-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p
          className={`tnum mt-1 text-sm ${
            estado === 'bien'
              ? 'text-emerald-700'
              : estado === 'pasado'
                ? 'text-amber-700'
                : 'text-slate-700'
          }`}
        >
          {Math.round(lleva)} de {objetivo} g de hidrato
        </p>

        <ul className="mt-3 space-y-1.5">
          {fuentes.map((f) => {
            const unidades = unidadesMarcadas(f, marcado[f.id] ?? 0);
            const porUnidad = Math.round(hcDeUnaMedida(f));
            const paso = f.intercambios || 1;

            return (
              <li
                key={f.id}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                  unidades > 0 ? 'border-brand-300 bg-brand-50/50' : 'border-slate-200'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={`text-[13px] ${
                      unidades > 0 ? 'text-slate-800' : 'text-slate-600'
                    }`}
                  >
                    {f.nombre}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {' · '}
                    {f.medida_casera} · {porUnidad} g
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => onMarcar(f.id, -paso)}
                    disabled={unidades === 0}
                    aria-label={`Uno menos de ${f.nombre}`}
                    className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 transition hover:border-brand-400 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span
                    className={`tnum w-8 text-center text-[13px] ${
                      unidades > 0 ? 'font-medium text-brand-800' : 'text-slate-300'
                    }`}
                  >
                    {unidades > 0 ? `×${unidades}` : '—'}
                  </span>
                  <button
                    onClick={() => onMarcar(f.id, paso)}
                    aria-label={`Uno más de ${f.nombre}`}
                    className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 transition hover:border-brand-400"
                  >
                    +
                  </button>
                </span>
              </li>
            );
          })}
        </ul>

        {!fuentes.length && (
          <p className="mt-3 text-[11px] text-amber-700">
            Tu nutricionista todavía no te ha puesto fuentes para esta toma.
          </p>
        )}

        {/*
          Por encima de 60 g/h una sola fuente satura el transportador. Es un
          recordatorio, no una alarma: no se bloquea nada.
        */}
        {mezclar && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
            A este ritmo conviene que alguna fuente lleve fructosa —un gel, la bebida o las
            gominolas—: se absorbe por otra vía y sienta mejor.
          </p>
        )}

        {estado === 'pasado' && (
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Llevas más de lo pautado. No pasa nada, pero pesa.
          </p>
        )}
      </div>
    </section>
  );
}
