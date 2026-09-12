import type { Avituallamiento, DayType, Meal } from '../../types/plan';
import {
  RITMO_ELITE,
  RITMO_UNA_FUENTE,
  avisoDeRitmo,
  gramosDelAvituallamiento,
  repartoDelAvituallamiento,
  ritmoDelAvituallamiento,
} from '../../utils/avituallamiento';
import { Field, Input, fmt } from '../common/ui';
import { PautaDelAvituallamiento } from './PautaDelAvituallamiento';
import { alimentosDeComida } from '../../utils/pantry';
import type { Alimento } from '../../types/food';

interface Props {
  dayType: DayType;
  meal: Meal;
  /** Para poder pautar con qué: los geles salen de la despensa de esa comida. */
  foods?: Alimento[];
  onChange: (patch: Partial<DayType>) => void;
}

/**
 * PAUTAR UN AVITUALLAMIENTO
 *
 * Lo que se come encima de la bici no se elige como un plato: se pauta en
 * gramos de hidrato y se reparte a lo largo de la salida. Aquí se dice cuántos
 * y de qué manera, y las fuentes salen de la despensa de esa comida.
 *
 * AL PAUTARLO SE ESCRIBE EL REPARTO
 * =================================
 * 150 g de hidrato son 150 g de hidrato, se coman en la mesa o en la bici, así
 * que cuentan en el día como todo lo demás. Al cambiar el objetivo se escriben
 * sus porciones en el reparto de esa comida: si no, el día de bici saldría
 * corto de carbohidrato en pantalla cuando no lo está. Después se puede
 * retocar a mano y esto no se lo vuelve a pisar.
 */
export function AvituallamientoDeComida({ dayType, meal, foods = [], onChange }: Props) {
  const actual = dayType.avituallamientos?.[meal.id];

  /** Se escribe el avituallamiento y, con él, las porciones que le tocan. */
  const guardar = (a: Avituallamiento | undefined) => {
    const avituallamientos = { ...(dayType.avituallamientos ?? {}) };
    if (a) avituallamientos[meal.id] = a;
    else delete avituallamientos[meal.id];

    onChange({
      avituallamientos,
      ...(a
        ? {
            grid: {
              ...dayType.grid,
              [meal.id]: {
                // Lo que no sea hidrato de la comida se queda: puede llevar
                // proteína pautada aparte para un recuperador.
                ...Object.fromEntries(
                  Object.entries(dayType.grid[meal.id] ?? {}).filter(
                    ([g]) => g !== 'azucares' && g !== 'almidones' && g !== 'fruta',
                  ),
                ),
                ...repartoDelAvituallamiento(a),
              },
            },
          }
        : {}),
    });
  };

  if (!actual)
    return (
      <div className="mt-2 rounded-xl border border-dashed border-slate-200 p-3">
        <p className="text-xs leading-snug text-slate-600">
          <strong className="font-medium">¿Es un avituallamiento?</strong> Lo que se come
          durante el entreno no se elige como un plato: se pauta en gramos de hidrato y se
          reparte a lo largo de la sesión. En esta comida no habrá recetas — habrá un
          objetivo y las fuentes que le pongas en la despensa.
        </p>
        <button
          onClick={() => guardar({ modo: 'hora', porHora: 60, horas: 2 })}
          className="mt-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 transition hover:bg-brand-100"
        >
          Convertir en avituallamiento
        </button>
      </div>
    );

  const gramos = gramosDelAvituallamiento(actual);
  const gh = ritmoDelAvituallamiento(actual);

  return (
    <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm font-medium text-brand-900">Avituallamiento</span>
        {/*
          Total para quien sale hora y media; por hora en cuanto se alarga. No
          son intercambiables, y por eso se elige persona a persona.
        */}
        <div className="flex gap-1">
          {(
            [
              ['total', 'Total'],
              ['hora', 'Por hora'],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              onClick={() =>
                guardar(
                  id === 'total'
                    ? { modo: 'total', gramos: gramos || 60 }
                    : {
                        modo: 'hora',
                        porHora: actual.porHora ?? 60,
                        horas: actual.horas ?? 2,
                      },
                )
              }
              aria-pressed={actual.modo === id}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                actual.modo === id
                  ? 'border-brand-500 bg-brand-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {actual.modo === 'total' ? (
        <div className="mt-2.5 flex flex-wrap items-end gap-2">
          <Field label="Hidrato en total" className="w-32">
            <Input
              value={actual.gramos ?? ''}
              onChange={(e) =>
                guardar({ modo: 'total', gramos: Number(e.target.value) || 0 })
              }
              inputMode="numeric"
              placeholder="60"
            />
          </Field>
          <span className="pb-2 text-xs text-slate-500">g</span>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-end gap-2">
          <Field label="Ritmo" className="w-24">
            <Input
              value={actual.porHora ?? ''}
              onChange={(e) =>
                guardar({ ...actual, modo: 'hora', porHora: Number(e.target.value) || 0 })
              }
              inputMode="numeric"
              placeholder="60"
            />
          </Field>
          <span className="pb-2 text-xs text-slate-500">g/h ×</span>
          <Field label="Duración" className="w-24">
            <Input
              value={actual.horas ?? ''}
              onChange={(e) =>
                guardar({
                  ...actual,
                  modo: 'hora',
                  horas: Number(e.target.value.replace(',', '.')) || 0,
                })
              }
              inputMode="decimal"
              placeholder="2,5"
            />
          </Field>
          <span className="pb-2 text-xs text-slate-500">h</span>
          <span className="tnum pb-2 text-sm font-medium text-brand-900">= {gramos} g</span>
        </div>
      )}

      {/*
        El aviso cambia con el umbral: hasta 60 una fuente basta, por encima hay
        que mezclar, y por encima de 90 hace falta intestino entrenado. Es lo
        que separa a quien compite de quien sale los domingos.
      */}
      <p
        className={`mt-2 text-[11px] leading-snug ${
          gh !== undefined && gh > RITMO_ELITE ? 'text-amber-700' : 'text-slate-600'
        }`}
      >
        {avisoDeRitmo(gh)}
      </p>

      <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
        Son{' '}
        <strong className="font-medium">
          {fmt(repartoDelAvituallamiento(actual).azucares ?? 0, 1)} porciones de azúcares
        </strong>{' '}
        y ya están puestas en el reparto de esta comida, así que cuentan en su día. Las
        fuentes salen de la despensa: geles, isotónica, dátiles, plátano.
      </p>

      {/*
        EL RELOJ, SÓLO SI ELLA LO QUIERE
        En bici se elige sobre la marcha; corriendo hace falta pautar el cuándo.
        Vacío es lo de siempre. Ver `PautaDelAvituallamiento`.
      */}
      <PautaDelAvituallamiento
        avituallamiento={actual}
        fuentes={alimentosDeComida(dayType, meal, foods)}
        onChange={guardar}
      />

      <button
        onClick={() => guardar(undefined)}
        className="mt-2 text-[11px] text-slate-500 underline hover:text-slate-800"
      >
        Volver a comida normal
      </button>

      {gh !== undefined && gh > RITMO_UNA_FUENTE && (
        <p className="mt-2 rounded-lg bg-white px-2 py-1.5 text-[11px] leading-snug text-slate-600">
          A este ritmo, marca <strong className="font-medium">«aporta fructosa»</strong> en
          los geles y bebidas de su despensa: así la app le recuerda mezclar si sólo elige
          glucosa.
        </p>
      )}
    </div>
  );
}
