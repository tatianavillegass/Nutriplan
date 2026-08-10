import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import { recetasDeComida } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { exchangesToMacros } from '../../utils/exchanges';
import { kcalFromMacros } from '../../utils/macros';
import { fmt } from '../common/ui';
import { fechaLarga } from './printing';

/**
 * FASE 1 — recetario del cliente: una página por tipo de día con las recetas
 * ya escaladas (gramajes finales) para cada comida.
 */
export function RecipeSheetPDF({
  client,
  plan,
  recipes,
  foods,
}: {
  client: Client;
  plan: Plan;
  recipes: Receta[];
  foods: Alimento[];
}) {
  return (
    <div className="print-doc">
      {plan.dayTypes.map((d) => {
        const total = exchangesToMacros(
          d.meals.reduce<Record<string, number>>((acc, m) => {
            for (const [g, v] of Object.entries(d.grid[m.id] ?? {})) acc[g] = (acc[g] ?? 0) + (v ?? 0);
            return acc;
          }, {}),
        );

        return (
          <section key={d.id} className="print-page">
            <header className="mb-5 border-b-2 border-brand-700 pb-3">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-brand-600 uppercase">
                Plan de alimentación · {d.nombre}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">
                {client.nombre}
              </h1>
              <p className="tnum mt-1 text-xs text-slate-500">
                {fmt(kcalFromMacros(total))} kcal · P {fmt(total.proteina, 0)} g · HC{' '}
                {fmt(total.hc, 0)} g · G {fmt(total.grasa, 0)} g · {fechaLarga()}
              </p>
            </header>

            <div className="space-y-5">
              {d.meals.map((m) => {
                const opciones = recetasDeComida(d.recetasAsignadas, m.id)
                  .map((id) => recipes.find((r) => r.id === id))
                  .filter(Boolean) as Receta[];
                if (!opciones.length) return null;
                return (
                  <div key={m.id} className="break-inside-avoid">
                    <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-brand-700 uppercase">
                      {m.nombre}
                      {opciones.length > 1 && (
                        <span className="ml-1.5 font-normal text-slate-400 normal-case">
                          — elige una de {opciones.length}
                        </span>
                      )}
                    </p>
                    <div className="space-y-3">
                      {opciones.map((receta) => (
                        <ScaledRecipeView
                          key={receta.id}
                          receta={receta}
                          requeridos={d.grid[m.id] ?? {}}
                          foods={foods}
                          soloLectura
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-6 text-[10px] leading-snug text-slate-400">
              Los gramajes ya están escalados a tus intercambios. La verdura es libre: mínimo 200 g
              (medio plato) en comida y cena.
            </p>
          </section>
        );
      })}
    </div>
  );
}
