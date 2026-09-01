import { useState } from 'react';
import type { Meal, MenuPropuesto, Plan, SemanaPropuesta } from '../../types/plan';
import { comidasDeLaSemana, recetasDelPlan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import { lunesDe } from '../../utils/menuSemana';
import { Button, Card } from '../common/ui';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_LARGO = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

interface Props {
  plan: Plan;
  recetas: Receta[];
  onChange: (menuPropuesto: MenuPropuesto | undefined) => void;
}

const VACIA: SemanaPropuesta = { dias: {} };

/**
 * DEJARLE LA SEMANA HECHA
 *
 * Organizarse la semana es lo que hace posible la lista de la compra y el batch
 * cooking, pero a mucha gente le da pereza y acaba sin hacerlo — y entonces no
 * hay ni compra ni batch cooking. Aquí la nutricionista se la reparte.
 *
 * SE PIENSA POR RECETA, NO POR DÍA
 * ================================
 * «Pan con huevo: lunes, miércoles y viernes». Es como se habla y son siete
 * pantallas menos que ir día por día.
 *
 * UNA RECETA POR DÍA Y COMIDA
 * ===========================
 * Marcar el martes en la avena quita la tostada del martes. Si no, un día
 * podría acabar con tres desayunos y esto dejaría de ser un reparto.
 *
 * DOS SEMANAS QUE SE ALTERNAN
 * ===========================
 * Con una sola, se come lo mismo cada siete días. Con dos ya no, y no cuesta
 * más trabajo: en la segunda salen los mismos platos y sólo hay que repartirlos
 * distinto.
 *
 * Y LOS HUECOS NO SON UN ERROR
 * ============================
 * Lo que se deje vacío lo elige ella ese día, como hasta ahora. Se le puede
 * dejar hecha la semana de diario y el fin de semana suelto.
 */
export function RepartirLaSemana({ plan, recetas, onChange }: Props) {
  const [semana, setSemana] = useState(0);

  const menu = plan.menuPropuesto;
  const semanas = menu?.semanas ?? [];
  const comidas = comidasDeLaSemana(plan);
  const asignadas = recetasDelPlan(plan);
  const porId = new Map(recetas.map((r) => [r.id, r]));

  const encender = () =>
    onChange({ desde: lunesDe(new Date().toISOString().slice(0, 10)), semanas: [VACIA] });

  if (!menu) {
    return (
      <Card
        title="Su semana"
        subtitle="Repartirle tú los platos por días, para quien no se lo organiza"
      >
        <p className="text-xs leading-snug text-slate-600">
          Sin esto, ella elige cada día entre sus recetas y no hay forma de saber qué va a
          comer el jueves — así que tampoco hay lista de la compra ni batch cooking.
          Repartiéndoselo tú, lo tiene todo hecho y puede cambiar lo que quiera.
        </p>
        <div className="mt-3">
          <Button onClick={encender} disabled={!comidas.length}>
            Repartirle la semana
          </Button>
        </div>
      </Card>
    );
  }

  const actual = semanas[semana] ?? VACIA;

  const guardar = (nueva: SemanaPropuesta) =>
    onChange({
      ...menu,
      semanas: semanas.map((s, i) => (i === semana ? nueva : s)),
    });

  const poner = (dia: number, mealId: string, recetaId: string) => {
    const d = actual.dias[dia] ?? { comidas: {} };
    const comidasDelDia = { ...d.comidas };
    // Una por día y comida: volver a pulsar la quita.
    if (comidasDelDia[mealId] === recetaId) delete comidasDelDia[mealId];
    else comidasDelDia[mealId] = recetaId;
    guardar({ dias: { ...actual.dias, [dia]: { ...d, comidas: comidasDelDia } } });
  };

  const ponerTipo = (dia: number, dayTypeId: string) => {
    const d = actual.dias[dia] ?? { comidas: {} };
    guardar({
      dias: {
        ...actual.dias,
        [dia]: { ...d, dayTypeId: d.dayTypeId === dayTypeId ? undefined : dayTypeId },
      },
    });
  };

  const huecos = comidas.reduce(
    (s, m) => s + DIAS.filter((_, i) => !actual.dias[i]?.comidas?.[m.id]).length,
    0,
  );

  return (
    <Card
      title="Su semana"
      subtitle="Marca los días de cada plato. Lo que dejes vacío lo elige ella"
      actions={
        semanas.length > 1 ? (
          <div className="flex gap-1">
            {semanas.map((_, i) => (
              <button
                key={i}
                onClick={() => setSemana(i)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                  i === semana
                    ? 'border-brand-500 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                }`}
              >
                Semana {i + 1}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {/*
        LOS DÍAS DE ENTRENO, ARRIBA DEL TODO
        Quien entrena los lunes come lo mismo con más arroz. Diciéndolo aquí las
        cantidades salen solas y ella no tiene que acordarse cada día.
      */}
      {plan.dayTypes.length > 1 && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Qué día es cada uno
          </p>
          <div className="mt-1.5 space-y-1">
            {plan.dayTypes.map((dt, k) => (
              <div key={dt.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                  {dt.nombre}
                </span>
                <span className="flex gap-1">
                  {DIAS.map((d, i) => {
                    // Sin decir nada, manda el primero: es el día normal.
                    const puesto = actual.dias[i]?.dayTypeId ?? plan.dayTypes[0].id;
                    const on = puesto === dt.id;
                    return (
                      <button
                        key={i}
                        onClick={() => ponerTipo(i, dt.id)}
                        aria-pressed={on}
                        aria-label={`${dt.nombre} el ${DIAS_LARGO[i]}`}
                        className={`h-7 w-7 rounded-md border text-[11px] transition ${
                          on
                            ? 'border-slate-500 bg-slate-700 text-white'
                            : 'border-slate-200 bg-white text-slate-400 hover:border-slate-400'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </span>
                {k === 0 && (
                  <span className="w-16 shrink-0 text-[10px] text-slate-400">
                    por defecto
                  </span>
                )}
                {k > 0 && <span className="w-16 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {comidas.map((m: Meal) => {
          const suyas = (asignadas[m.id] ?? [])
            .map((id) => porId.get(id))
            .filter(Boolean) as Receta[];

          if (!suyas.length)
            return (
              <div key={m.id}>
                <Titulo>{m.nombre}</Titulo>
                <p className="text-[11px] text-slate-400">
                  Todavía no le has asignado recetas a esta comida.
                </p>
              </div>
            );

          return (
            <div key={m.id}>
              <Titulo>{m.nombre}</Titulo>
              <div className="space-y-1">
                {suyas.map((r) => {
                  const dias = DIAS.map((_, i) =>
                    actual.dias[i]?.comidas?.[m.id] === r.id ? i : -1,
                  ).filter((i) => i >= 0);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5"
                    >
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          dias.length ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {r.nombre}
                      </span>
                      <span className="flex gap-1">
                        {DIAS.map((d, i) => {
                          const on = dias.includes(i);
                          return (
                            <button
                              key={i}
                              onClick={() => poner(i, m.id, r.id)}
                              aria-pressed={on}
                              aria-label={`${r.nombre} el ${DIAS_LARGO[i]}`}
                              className={`h-7 w-7 rounded-md border text-[11px] transition ${
                                on
                                  ? 'border-brand-500 bg-brand-600 text-white'
                                  : 'border-slate-200 bg-white text-slate-400 hover:border-brand-400'
                              }`}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cómo va quedando: es lo que hace que se vea si la semana repite mucho. */}
      {comidas.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="mb-1.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Cómo va quedando
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] whitespace-nowrap">
              <thead>
                <tr className="text-slate-400">
                  <th />
                  {DIAS.map((d, i) => (
                    <th key={i} className="px-1 pb-1 font-medium">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comidas.map((m) => (
                  <tr key={m.id}>
                    <td className="py-0.5 pr-2 text-slate-500">{m.nombre}</td>
                    {DIAS.map((_, i) => {
                      const id = actual.dias[i]?.comidas?.[m.id];
                      const r = id ? porId.get(id) : undefined;
                      return (
                        <td key={i} className="px-0.5 py-0.5">
                          <span
                            title={r?.nombre}
                            className={`block truncate rounded px-1 py-1 text-center ${
                              r
                                ? 'bg-brand-50 text-brand-800'
                                : 'bg-slate-50 text-slate-300'
                            }`}
                          >
                            {r ? r.nombre.split(' ')[0] : '·'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            {huecos === 0
              ? 'La semana está completa.'
              : `${huecos} ${huecos === 1 ? 'hueco' : 'huecos'} sin plato. Esos días elige ella, como siempre.`}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
        {semanas.length === 1 ? (
          <Button
            variant="outline"
            onClick={() => {
              onChange({ ...menu, semanas: [...semanas, VACIA] });
              setSemana(1);
            }}
          >
            + Segunda semana
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => {
              onChange({ ...menu, semanas: [semanas[0]] });
              setSemana(0);
            }}
          >
            Quitar la semana 2
          </Button>
        )}
        <Button variant="ghost" onClick={() => onChange(undefined)}>
          Dejar que se la organice ella
        </Button>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Es una propuesta: ella la ve puesta y puede cambiar lo que quiera sin que la app
        le diga nada. La lista de la compra y el batch cooking salen de lo que quede.
        {semanas.length > 1 && ' Las dos semanas se van alternando.'}
      </p>
    </Card>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
      {children}
    </p>
  );
}
