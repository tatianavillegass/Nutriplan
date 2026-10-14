import { useMemo, useState } from 'react';
import type { Plan } from '../../types/plan';
import type { RegistroDia } from '../../types/diary';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import { loQueRepitePorComida, cuantoRepite } from '../../utils/loQueRepite';
import { Card } from '../common/ui';

interface Props {
  plan: Plan | undefined;
  registros: RegistroDia[];
  recipes: Receta[];
  foods: Alimento[];
}

/** Cuántas se ven de entrada en cada comida. El resto, con «ver más». */
const ASOMAN = 4;

/**
 * QUÉ DESAYUNA, QUÉ COME, QUÉ CENA
 *
 * La pregunta de consulta no es «¿qué alimentos repite?» sino «¿qué desayuna
 * normalmente?». Aquí está, comida a comida y con su frecuencia, leído de lo
 * que ya registra: en fase 1 las recetas que elige, en fase 2 las
 * combinaciones y en fases 3 y 4 los alimentos que apunta en esa comida.
 *
 * NO SE JUZGA NADA
 * ================
 * Ni «variedad baja», ni colores, ni avisos. Comer siempre lo mismo le va bien
 * a mucha gente y es justo lo que algunas necesitan para no tener que decidir
 * cada mañana. Lo que hace la tarjeta es enseñar el dato para poder
 * preguntarle; el juicio es de la consulta, no de la app.
 */
export function QueRepite({ plan, registros, recipes, foods }: Props) {
  const comidas = useMemo(
    () => loQueRepitePorComida(plan, registros, recipes, foods),
    [plan, registros, recipes, foods],
  );
  const [abiertas, setAbiertas] = useState<string[]>([]);

  if (!comidas.length) return null;

  return (
    <Card
      title="Qué repite en cada comida"
      subtitle="Lo que de verdad elige, para saber qué conservar y qué cambiar"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {comidas.map((c) => {
          const abierta = abiertas.includes(c.mealId);
          const visibles = abierta ? c.lista : c.lista.slice(0, ASOMAN);
          const repite = cuantoRepite(c);

          return (
            <div key={c.mealId}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-medium text-slate-500">{c.nombre}</p>
                <span className="tnum text-[10px] text-slate-400">
                  {c.diasConAlgo} {c.diasConAlgo === 1 ? 'día' : 'días'}
                </span>
              </div>

              <ul className="space-y-1">
                {visibles.map((l) => (
                  <li key={l.nombre} className="flex items-baseline gap-2 text-xs">
                    <span className="flex-1 truncate text-slate-700" title={l.nombre}>
                      {l.nombre}
                    </span>
                    <span className="tnum shrink-0 text-slate-400">
                      {l.veces} ×{l.dias !== l.veces ? ` · ${l.dias} d` : ''}
                    </span>
                  </li>
                ))}
              </ul>

              {c.lista.length > ASOMAN && (
                <button
                  onClick={() =>
                    setAbiertas((p) =>
                      p.includes(c.mealId) ? p.filter((x) => x !== c.mealId) : [...p, c.mealId],
                    )
                  }
                  className="mt-1 text-[11px] text-brand-600 hover:underline"
                >
                  {abierta ? 'Ver menos' : `Ver las ${c.lista.length}`}
                </button>
              )}

              {/*
                Sólo cuando una se lleva casi todo y hay de dónde comparar: con
                tres días apuntados, «el 100 % de las veces» no dice nada.
              */}
              {repite >= 0.7 && c.diasConAlgo >= 7 && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Casi siempre lo mismo: {Math.round(repite * 100)} % de las veces.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
