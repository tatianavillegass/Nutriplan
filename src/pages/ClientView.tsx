import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { PlanSchemaTable } from '../components/phase2/PlanSchemaTable';
import { MealOptionsBoard } from '../components/phase2/MealOptionsBoard';
import { ScaledRecipeView } from '../components/phase1/ScaledRecipeView';
import { PlanDocument } from '../components/export/PlanDocument';
import { usePrintDocument } from '../components/export/printing';
import { Button, EmptyState } from '../components/common/ui';

/** Lo que ve el cliente. Fase 1 → recetas escaladas · Fase 2 → esquema + "escoge X". */
export function ClientView() {
  const { id = '' } = useParams();
  const client = useAppStore((s) => s.clients.find((c) => c.id === id));
  const plan = useAppStore((s) => s.plans.find((p) => p.clientId === id));
  const foods = useAppStore((s) => s.foods);
  const recipes = useAppStore((s) => s.recipes);

  const [dtIndex, setDtIndex] = useState(0);
  const [interactivo, setInteractivo] = useState(true);
  const imprimir = usePrintDocument(
    `Plan ${client?.nombre ?? ''} — Fase ${plan?.fase ?? ''}`.trim(),
  );

  if (!client || !plan) return <EmptyState title="Plan no disponible" />;
  const dayType = plan.dayTypes[Math.min(dtIndex, plan.dayTypes.length - 1)];

  return (
    <>
      <div className="screen-only space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 no-print">
          <div>
            <Link
              to={`/clientes/${client.id}`}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ← Volver al plan
            </Link>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-brand-900">
              Plan de {client.nombre}
            </h1>
            <p className="text-sm text-slate-500">
              Fase {plan.fase} — {plan.fase === 1 ? 'recetas cerradas' : 'intercambios abiertos'}
            </p>
          </div>
          <div className="flex gap-2">
            {plan.fase === 2 && (
              <Button variant="outline" onClick={() => setInteractivo((v) => !v)}>
                {interactivo ? 'Modo documento' : 'Modo interactivo'}
              </Button>
            )}
            <Button onClick={imprimir}>Exportar PDF</Button>
          </div>
        </div>

        {plan.dayTypes.length > 1 && (
          <div className="flex flex-wrap gap-1.5 no-print">
            {plan.dayTypes.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setDtIndex(i)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  d.id === dayType.id
                    ? 'border-brand-500 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                }`}
              >
                {d.nombre}
              </button>
            ))}
          </div>
        )}

        {plan.fase === 2 ? (
          <div className="space-y-5">
            <div>
              <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-800 uppercase">
                Esquema del plan
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {plan.dayTypes.map((d) => (
                  <PlanSchemaTable key={d.id} dayType={d} />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {dayType.meals.map((m) => (
                <MealOptionsBoard
                  key={m.id}
                  dayType={dayType}
                  meal={m}
                  foods={foods}
                  mode={interactivo ? 'interactivo' : 'documento'}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {dayType.meals.map((m) => {
              const rid = dayType.recetasAsignadas?.[m.id];
              const receta = recipes.find((r) => r.id === rid);
              if (!receta) return null;
              return (
                <div key={m.id}>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {m.nombre}
                  </p>
                  <ScaledRecipeView
                    receta={receta}
                    requeridos={dayType.grid[m.id] ?? {}}
                    foods={foods}
                  />
                </div>
              );
            })}
            {!Object.values(dayType.recetasAsignadas ?? {}).some(Boolean) && (
              <EmptyState title="Aún no hay recetas asignadas">
                La nutricionista debe elegir una receta por comida en la pestaña de entrega.
              </EmptyState>
            )}
          </div>
        )}
      </div>

      {/* Documento que sale al imprimir / exportar a PDF */}
      <PlanDocument client={client} plan={plan} recipes={recipes} foods={foods} />
    </>
  );
}
