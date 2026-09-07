import type { MenuSemana } from '../../types/diary';
import { BUCKET_LABEL, textoItem, type OpcionEscalada } from '../../utils/mealOptions';
import {
  DIAS_DE_LA_SEMANA,
  comoVaLaComida,
  ponerVeces,
  vecesDe,
} from '../../utils/vecesSemana';

export interface ComidaConOpciones {
  mealId: string;
  nombre: string;
  columnas: { bucket: OpcionEscalada['bucket']; opciones: OpcionEscalada[] }[];
}

interface Props {
  menu: MenuSemana;
  comidas: ComidaConOpciones[];
  onCambiar: (menu: MenuSemana) => void;
}

/**
 * CUÁNTAS VECES COMES CADA COSA
 *
 * La forma de organizar la semana en fase 2. Ahí no se comen platos: se comen
 * combinaciones que ella elige cada mañana entre las que le salen calculadas,
 * así que pedirle que diga «el martes huevos» le quitaría justo la libertad
 * que esa fase existe para darle — y sin saber qué come el jueves no hay lista
 * de la compra.
 *
 * Con «huevos tres veces» se resuelven las dos cosas: la compra sale de una
 * multiplicación y ella sigue eligiendo cada día. Son tres o cuatro números
 * por comida en vez de siete casillas por opción.
 *
 * SE CUENTA POR MACRO, NO POR COMIDA
 * ==================================
 * Las columnas de fase 2 son independientes —se elige una proteína, un
 * carbohidrato y una grasa—, así que cada una tiene que llegar a siete por su
 * cuenta. Sumarlas todas juntas daría un número que no significa nada.
 *
 * Y LO QUE FALTA SE DICE, NO SE RIÑE
 * ==================================
 * Dejar dos desayunos sueltos para improvisar es una decisión legítima. Se
 * dice cuántos quedan y ya: ni bloquea, ni pone nada en rojo.
 */
export function CuantasVeces({ menu, comidas, onCambiar }: Props) {
  const conOpciones = comidas.filter((c) => c.columnas.some((x) => x.opciones.length));

  if (!conOpciones.length)
    return (
      <p className="mt-3 text-xs leading-snug text-slate-500">
        Todavía no hay opciones que repartir. En cuanto tu nutricionista te reparta las
        porciones, aquí podrás decir cuántas veces comes cada cosa.
      </p>
    );

  return (
    <div className="mt-3 space-y-4">
      {conOpciones.map((comida) => {
        const como = comoVaLaComida(menu, comida.mealId, comida.columnas);

        return (
          <div key={comida.mealId}>
            <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium text-slate-800">{comida.nombre}</span>
              <span className="text-[11px] text-slate-400">
                {DIAS_DE_LA_SEMANA} días
              </span>
            </div>

            <div className="space-y-2.5">
              {comida.columnas.map((col, i) => {
                if (!col.opciones.length) return null;
                const { faltan } = como[i];

                return (
                  <div key={col.bucket}>
                    <div className="mb-1 flex flex-wrap items-baseline gap-2">
                      <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                        {BUCKET_LABEL[col.bucket]}
                      </span>
                      {/*
                        Ni rojo ni bloqueo: dejar días sueltos para improvisar
                        es una decisión, no un fallo.
                      */}
                      <span
                        className={`text-[11px] ${
                          faltan === 0
                            ? 'text-emerald-700'
                            : faltan > 0
                              ? 'text-slate-500'
                              : 'text-amber-700'
                        }`}
                      >
                        {faltan === 0
                          ? `los ${DIAS_DE_LA_SEMANA} puestos`
                          : faltan > 0
                            ? `${faltan} sin decidir`
                            : `${Math.abs(faltan)} de más`}
                      </span>
                    </div>

                    <ul className="space-y-1">
                      {col.opciones.map((o) => {
                        const n = vecesDe(menu, comida.mealId, o.id);
                        const cambiar = (delta: number) =>
                          onCambiar(
                            ponerVeces(menu, comida.mealId, o.id, n + delta),
                          );

                        return (
                          <li
                            key={o.id}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                              n > 0
                                ? 'border-brand-300 bg-brand-50/50'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <span
                              className={`min-w-0 flex-1 text-[13px] leading-snug ${
                                n > 0 ? 'text-slate-800' : 'text-slate-500'
                              }`}
                            >
                              {o.items.map((it, k) => (
                                <span key={it.foodId}>
                                  {k > 0 && <span className="text-slate-400"> + </span>}
                                  {textoItem(it)}
                                </span>
                              ))}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              <button
                                onClick={() => cambiar(-1)}
                                disabled={n === 0}
                                aria-label={`Una vez menos de ${o.texto}`}
                                className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 transition hover:border-brand-400 disabled:opacity-30"
                              >
                                −
                              </button>
                              <span
                                className={`tnum w-9 text-center text-[13px] ${
                                  n > 0 ? 'font-medium text-brand-800' : 'text-slate-300'
                                }`}
                              >
                                {n > 0 ? `${n}×` : '—'}
                              </span>
                              <button
                                onClick={() => cambiar(1)}
                                disabled={n >= DIAS_DE_LA_SEMANA}
                                aria-label={`Una vez más de ${o.texto}`}
                                className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 transition hover:border-brand-400 disabled:opacity-30"
                              >
                                +
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-[11px] leading-snug text-slate-500">
        Esto es para la compra, no un menú: nadie te va a decir qué toca hoy. Si un día
        te apetece otra cosa, la eliges y ya.
      </p>
    </div>
  );
}
