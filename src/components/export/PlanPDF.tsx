import type { Client } from '../../types/client';
import type { Alimento } from '../../types/food';
import type { Plan } from '../../types/plan';
import { MealOptionsBoard } from '../phase2/MealOptionsBoard';
import { SchemaPDF } from './SchemaPDF';

/**
 * FASE 2 — documento completo para el cliente:
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
  return (
    <div className="print-doc">
      <SchemaPDF client={client} plan={plan} />

      {plan.dayTypes.map((d) => (
        <section key={d.id} className="print-page">
          <h2 className="mb-4 border-b border-brand-200 pb-2 text-sm font-bold tracking-[0.15em] text-brand-800 uppercase">
            {d.nombre} — opciones por comida
          </h2>
          <div className="space-y-5">
            {d.meals.map((m) => (
              <MealOptionsBoard key={m.id} dayType={d} meal={m} foods={foods} mode="documento" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
