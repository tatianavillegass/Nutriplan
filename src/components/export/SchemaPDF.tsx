import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import { PlanSchemaTable } from '../phase2/PlanSchemaTable';
import { fechaLarga } from './printing';

/**
 * §6.1 — Hoja "ESQUEMA DEL PLAN": una tabla por tipo de día.
 * Es la primera página del entregable de Fase 2 y también se puede imprimir sola.
 */
export function SchemaPDF({ client, plan }: { client: Client; plan: Plan }) {
  return (
    <section className="print-page">
      <header className="mb-6 border-b-2 border-brand-700 pb-3">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-brand-600 uppercase">
          Plan de alimentación
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">{client.nombre}</h1>
        <p className="tnum mt-1 text-xs text-slate-500">
          {client.peso} kg · {client.altura} cm · {client.edad} años · {fechaLarga()}
        </p>
      </header>

      <h2 className="mb-4 text-center text-sm font-bold tracking-[0.15em] text-brand-800 uppercase">
        Esquema del plan
      </h2>

      <div className="space-y-6">
        {plan.dayTypes.map((d) => (
          <PlanSchemaTable key={d.id} dayType={d} />
        ))}
      </div>

      <p className="mt-6 text-[10px] leading-snug text-slate-400">
        Las cifras indican intercambios (porciones), no gramos. Cada intercambio equivale a la
        cantidad indicada en las listas de opciones de las páginas siguientes.
      </p>
    </section>
  );
}
