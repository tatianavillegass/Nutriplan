import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useEnergy } from '../hooks/useEnergy';
import { CalorieCalculator } from '../components/common/CalorieCalculator';
import { PhaseSelector } from '../components/common/PhaseSelector';
import { ValidationPanel } from '../components/common/ValidationPanel';
import { MacroTargets } from '../components/planning/MacroTargets';
import { ExchangeGrid } from '../components/planning/ExchangeGrid';
import { PlanSchemaTable } from '../components/phase2/PlanSchemaTable';
import { MealOptionsBoard } from '../components/phase2/MealOptionsBoard';
import { RecipeRecommender } from '../components/phase1/RecipeRecommender';
import { gridMacros } from '../utils/exchanges';
import { planTargets } from '../utils/macros';
import { Button, Card, EmptyState, Input, fmt } from '../components/common/ui';

type Tab = 'get' | 'plan' | 'entrega';

export function ClientDetail() {
  const { id = '' } = useParams();
  const client = useAppStore((s) => s.clients.find((c) => c.id === id));
  const updateClient = useAppStore((s) => s.updateClient);
  const plans = useAppStore((s) => s.plans);
  const ensurePlan = useAppStore((s) => s.ensurePlan);
  const recipes = useAppStore((s) => s.recipes);
  const foods = useAppStore((s) => s.foods);
  const {
    setPhase,
    addDayType,
    updateDayType,
    deleteDayType,
    setCell,
    renameMeal,
    removeMeal,
    addMeal,
  } = useAppStore();

  const [tab, setTab] = useState<Tab>('get');
  const [dtIndex, setDtIndex] = useState(0);
  const calc = useEnergy(client);

  if (!client) return <EmptyState title="Cliente no encontrado" />;

  const plan = plans.find((p) => p.clientId === client.id) ?? ensurePlan(client.id);
  const dayType = plan.dayTypes[Math.min(dtIndex, plan.dayTypes.length - 1)];
  const caloriasBase = calc?.energy.caloriasObjetivo ?? 0;
  const kcalDia = dayType.caloriasOverride ?? caloriasBase;

  const planeado = planTargets(kcalDia, client.peso, dayType.proteinaGkg, dayType.hcGkg);
  const pautado = gridMacros(dayType.grid, dayType.meals);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'get', label: 'Cálculo GET' },
    { id: 'plan', label: 'Cálculo plan' },
    { id: 'entrega', label: `Entrega — Fase ${plan.fase}` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <Link to="/clientes" className="text-xs text-slate-400 hover:text-slate-600">
            ← Clientes
          </Link>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-brand-900">{client.nombre}</h1>
          <p className="tnum text-sm text-slate-500">
            {client.peso} kg · {client.altura} cm · {client.edad} años ·{' '}
            <strong className="text-brand-700">{fmt(caloriasBase)} kcal objetivo</strong>
          </p>
        </div>
        <Link to={`/clientes/${client.id}/vista`}>
          <Button variant="outline">Vista del cliente →</Button>
        </Link>
      </div>

      <div className="flex gap-1 border-b border-slate-200 no-print">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
              tab === t.id
                ? 'border-brand-600 font-medium text-brand-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'get' && (
        <CalorieCalculator client={client} onChange={(patch) => updateClient(client.id, patch)} />
      )}

      {tab !== 'get' && (
        <div className="flex flex-wrap items-center gap-1.5 no-print">
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
          <button
            onClick={() => addDayType(plan.id, `Tipo de día ${plan.dayTypes.length + 1}`)}
            className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-700"
          >
            + Tipo de día
          </button>
        </div>
      )}

      {tab === 'plan' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
            <MacroTargets
              dayType={dayType}
              peso={client.peso}
              caloriasBase={caloriasBase}
              onChange={(patch) => updateDayType(plan.id, dayType.id, patch)}
            />
            <ValidationPanel planeado={planeado} pautado={pautado} />
          </div>

          <Card
            title="Reparto de intercambios"
            subtitle="Pasos de medio intercambio · edita el nombre de una comida haciendo clic"
            actions={
              <div className="flex items-center gap-2">
                <Input
                  value={dayType.nombre}
                  onChange={(e) => updateDayType(plan.id, dayType.id, { nombre: e.target.value })}
                  className="w-44 text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    addMeal(plan.id, dayType.id, {
                      nombre: 'Extra',
                      slot: 'extra',
                      orden: dayType.meals.length + 1,
                    })
                  }
                >
                  + Comida
                </Button>
                {plan.dayTypes.length > 1 && (
                  <Button variant="danger" onClick={() => { deleteDayType(plan.id, dayType.id); setDtIndex(0); }}>
                    Eliminar día
                  </Button>
                )}
              </div>
            }
          >
            <ExchangeGrid
              dayType={dayType}
              peso={client.peso}
              onCell={(mealId, group, value) => setCell(plan.id, dayType.id, mealId, group, value)}
              onRenameMeal={(mealId, nombre) => renameMeal(plan.id, dayType.id, mealId, nombre)}
              onRemoveMeal={(mealId) => removeMeal(plan.id, dayType.id, mealId)}
            />
          </Card>
        </div>
      )}

      {tab === 'entrega' && (
        <div className="space-y-5">
          <Card title="Fase de entrega" subtitle="Se aplica a todo el plan del cliente">
            <PhaseSelector value={plan.fase} onChange={(f) => setPhase(plan.id, f)} />
          </Card>

          {plan.fase === 2 ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {plan.dayTypes.map((d) => (
                  <PlanSchemaTable key={d.id} dayType={d} />
                ))}
              </div>

              <Card
                title="Opciones que verá el cliente"
                subtitle="Desmarca lo que no tolere o no le guste"
              >
                <div className="space-y-4">
                  {dayType.meals.map((m) => (
                    <MealOptionsBoard
                      key={m.id}
                      dayType={dayType}
                      meal={m}
                      foods={foods}
                      mode="editor"
                      onToggleExcluir={(fid) => {
                        const cur = dayType.alimentosExcluidos ?? [];
                        updateDayType(plan.id, dayType.id, {
                          alimentosExcluidos: cur.includes(fid)
                            ? cur.filter((x) => x !== fid)
                            : [...cur, fid],
                        });
                      }}
                      onNota={(t) =>
                        updateDayType(plan.id, dayType.id, { notas: { ...dayType.notas, [m.id]: t } })
                      }
                      onPostre={(t) => updateDayType(plan.id, dayType.id, { postre: t })}
                    />
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card title="Recetas recomendadas" subtitle="3–4 opciones por comida según el reparto">
              <div className="space-y-6">
                {dayType.meals.map((m) => (
                  <RecipeRecommender
                    key={m.id}
                    dayType={dayType}
                    meal={m}
                    recetas={recipes}
                    client={client}
                    foods={foods}
                    asignada={dayType.recetasAsignadas?.[m.id]}
                    yaAsignadas={Object.values(dayType.recetasAsignadas ?? {})}
                    onAsignar={(rid) =>
                      updateDayType(plan.id, dayType.id, {
                        recetasAsignadas: { ...(dayType.recetasAsignadas ?? {}), [m.id]: rid ?? '' },
                      })
                    }
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
