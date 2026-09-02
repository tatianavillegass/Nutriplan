import { useMemo, useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import type { Client } from '../../types/client';
import type { DayType, Meal } from '../../types/plan';
import type { PorcionesMarcadas } from '../../types/diary';
import { matchRecipes } from '../../utils/recipeMatcher';
import { scaleRecipe } from '../../utils/recipeScaling';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { exchangesToMacros } from '../../utils/exchanges';
import { kcalFromMacros } from '../../utils/macros';
import { fmt } from '../common/ui';

interface Props {
  dayType: DayType;
  meal: Meal;
  recetas: Receta[];
  foods: Alimento[];
  client: Client;
  porciones: PorcionesMarcadas;
  /** Marca los alimentos de la receta como consumidos en esa comida. */
  onUsar: (mealId: string, aportes: { foodId: string; intercambios: number }[]) => void;
}

/**
 * RECETAS SUGERIDAS (fases 2 y 3)
 *
 * Atajo opcional: en vez de componer el plato alimento a alimento, el cliente
 * coge una receta del banco que encaje con lo pautado en esa comida y se le
 * marcan de golpe todos sus ingredientes.
 */
export function RecipeShortcuts({
  dayType,
  meal,
  recetas,
  foods,
  client,
  porciones,
  onUsar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  /** De qué receta se está leyendo la preparación. Sólo una a la vez. */
  const [como, setComo] = useState<string | null>(null);
  const reparto = dayType.grid[meal.id] ?? {};

  const sugerencias = useMemo(
    () =>
      matchRecipes(recetas, reparto, {
        slot: meal.slot,
        preferencias: client.preferencias,
        limite: 4,
        client,
        foods,
      }),
    [recetas, reparto, meal.slot, client, foods],
  );

  const vacio = Object.values(reparto).every((v) => !v);
  if (vacio || !sugerencias.length) return null;

  const usar = (receta: Receta) => {
    const escalada = scaleRecipe(receta, reparto);
    const aportes = escalada.ingredientes
      .filter((i) => i.foodId && i.escalable && i.cantidad_final != null)
      .map((i) => ({
        foodId: i.foodId as string,
        intercambios: reparto[i.grupo as keyof typeof reparto] ?? 0,
      }))
      .filter((a) => a.intercambios > 0);
    onUsar(meal.id, aportes);
    /*
     * No se cierra el panel: al elegirla se abre su preparación, que es lo
     * siguiente que hace falta. Cerrándolo había que volver a buscarla.
     */
    setComo(receta.preparacion?.trim() ? receta.id : null);
  };

  const yaMarcado = (receta: Receta) => {
    const escalada = scaleRecipe(receta, reparto);
    const comida = porciones[meal.id] ?? {};
    const conFood = escalada.ingredientes.filter((i) => i.foodId && i.escalable);
    return (
      conFood.length > 0 &&
      conFood.every((i) => (comida[i.foodId as string] ?? 0) > 0)
    );
  };

  return (
    <div className="mt-1.5 no-print">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="text-[11px] text-brand-600 underline decoration-dotted"
      >
        {abierto ? 'Ocultar recetas' : `¿Sin ideas? ${sugerencias.length} recetas que encajan`}
      </button>

      {abierto && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {sugerencias.map((s) => {
            const escalada = scaleRecipe(s.receta, reparto);
            const macros = exchangesToMacros(reparto);
            const usada = yaMarcado(s.receta);

            const abiertaLaPreparacion = como === s.receta.id;
            const hayPreparacion = !!s.receta.preparacion?.trim();

            return (
              <div
                key={s.receta.id}
                className={`rounded-xl border transition ${
                  usada
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-slate-200 bg-white hover:border-brand-300'
                }`}
              >
                <button
                  onClick={() => usar(s.receta)}
                  className="block w-full p-3 text-left"
                >
                {/*
                  LA FOTO, PEQUEÑA Y A LA IZQUIERDA
                  Con sólo el nombre hay que leerse las cuatro para decidir. Un
                  plato se reconoce de un vistazo, que es de lo que va esto:
                  estás delante de la nevera y no se te ocurre nada.

                  Las que no tienen foto llevan un hueco del mismo tamaño: si
                  no, las tarjetas de la fila se descuadran entre sí.
                */}
                <div className="flex items-start gap-2.5">
                  {s.receta.foto_url ? (
                    <img
                      src={s.receta.foto_url}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="block h-12 w-12 shrink-0 rounded-lg bg-brand-50" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <h4 className="text-[13px] leading-snug font-medium text-slate-800">
                        {s.receta.nombre}
                      </h4>
                      {usada && <span className="text-[10px] text-brand-700">usada ✓</span>}
                    </span>

                    <span className="tnum mt-0.5 block text-[10px] text-slate-500">
                      {fmt(kcalFromMacros(macros))} kcal · P {fmt(macros.proteina, 0)} · HC{' '}
                      {fmt(macros.hc, 0)} · G {fmt(macros.grasa, 0)} g
                    </span>
                  </span>
                </div>

                <ul className="mt-1.5 space-y-0.5">
                  {escalada.ingredientes
                    .filter((i) => i.cantidad_final != null)
                    .slice(0, 4)
                    .map((i) => (
                      <li key={i.id} className="text-[11px] leading-snug text-slate-600">
                        {i.nombre} <span className="tnum text-slate-500">{i.display}</span>
                      </li>
                    ))}
                </ul>

                  {!!s.faltantes.length && (
                    <p className="mt-1 text-[10px] text-amber-600">
                      No cubre{' '}
                      {s.faltantes.map((g) => EXCHANGE_GROUPS[g].nombre.toLowerCase()).join(', ')}
                    </p>
                  )}
                </button>

                {/*
                  CÓMO SE HACE
                  ============
                  Se abre sola al elegirla, que es cuando hace falta: acabas de
                  decidir qué cenas y lo siguiente es cocinarlo. Y se puede
                  abrir antes, porque a veces lo que decide no son los gramos
                  sino si hay que encender el horno.

                  Va aquí y no en una pantalla aparte porque esto se lee de pie
                  en la cocina: sacarla de aquí serían dos toques y una vuelta.
                */}
                {hayPreparacion && (
                  <div className="border-t border-slate-100 px-3 pt-1.5 pb-2">
                    <button
                      onClick={() => setComo(abiertaLaPreparacion ? null : s.receta.id)}
                      aria-expanded={abiertaLaPreparacion}
                      className="text-[10px] text-brand-600 underline decoration-dotted"
                    >
                      {abiertaLaPreparacion ? 'Ocultar cómo se hace' : 'Cómo se hace'}
                    </button>
                    {abiertaLaPreparacion && (
                      <p className="mt-1 text-[11px] leading-snug whitespace-pre-line text-slate-600">
                        {s.receta.preparacion.trim()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
