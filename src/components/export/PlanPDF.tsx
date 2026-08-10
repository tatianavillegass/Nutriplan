import type { Client } from '../../types/client';
import type { Alimento } from '../../types/food';
import type { Plan } from '../../types/plan';
import { MealOptionsBoard } from '../phase2/MealOptionsBoard';
import { ScaledOptionsBoard } from '../phase2/ScaledOptionsBoard';
import { SchemaPDF } from './SchemaPDF';

/**
 * FASES 2 y 3 — documento completo para el cliente:
 *   pág. 1  Esquema del plan (una tabla por tipo de día)
 *   pág. 2+ Listas "escoge X" por comida, un tipo de día por página.
 */
export function PlanPDF({
  client,
  plan,
  foods,
}: {
  client: Client;
  plan: Plan;
  foods: Alimento[];
}) {
  const escalado = plan.fase === 2;
  return (
    <div className="print-doc">
      {/* La tabla de porciones sólo tiene sentido cuando el cliente cuenta
          intercambios; en fase 2 las cantidades ya vienen hechas. */}
      {!escalado && <SchemaPDF client={client} plan={plan} />}

      {plan.dayTypes.map((d, i) => (
        <section key={d.id} className="print-page">
          {escalado && i === 0 && (
            <header className="mb-5 border-b-2 border-brand-700 pb-3">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-brand-600 uppercase">
                Plan de alimentación
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">
                {client.nombre}
              </h1>
            </header>
          )}
          <h2 className="mb-4 border-b border-brand-200 pb-2 text-sm font-bold tracking-[0.15em] text-brand-800 uppercase">
            {d.nombre} — {escalado ? 'tus cantidades por comida' : 'opciones por comida'}
          </h2>
          <div className="space-y-5">
            {d.meals.map((m) =>
              escalado ? (
                <ScaledOptionsBoard key={m.id} dayType={d} meal={m} foods={foods} />
              ) : (
                <MealOptionsBoard key={m.id} dayType={d} meal={m} foods={foods} mode="documento" />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
