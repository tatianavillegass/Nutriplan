import { useState } from "react";
import { edadDe } from "../types/client";
import { Link, useParams } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useEnergy } from "../hooks/useEnergy";
import { CalorieCalculator } from "../components/common/CalorieCalculator";
import { PhaseSelector } from "../components/common/PhaseSelector";
import { ValidationPanel } from "../components/common/ValidationPanel";
import { MacroTargets } from "../components/planning/MacroTargets";
import { pesoDeReferencia } from "../utils/pesoReferencia";
import { ExchangeGrid } from "../components/planning/ExchangeGrid";
import { PlanSchemaTable } from "../components/phase2/PlanSchemaTable";
import { ScaledOptionsBoard } from "../components/phase2/ScaledOptionsBoard";
import { RecipeRecommender } from "../components/phase1/RecipeRecommender";
import { AnthroTab } from "../components/anthro/AnthroTab";
import { AdherenceTab } from "../components/client/AdherenceTab";
import { SeguimientoResumen } from "../components/client/SeguimientoResumen";
import { CitaPanel, PagosPanel } from "../components/client/AgendaPanel";
import {
  RecursosDeCliente,
  MetasDeCliente,
} from "../components/planning/RecursosYMetas";
import { PlanHistory } from "../components/client/PlanHistory";
import { FollowUpPanel } from "../components/client/FollowUpPanel";
import { DiaEnVivo } from "../components/client/DiaEnVivo";
import {
  NewPlanWizard,
  type MedidasNuevoPlan,
} from "../components/client/NewPlanWizard";
import { SendPlanPanel } from "../components/client/SendPlanPanel";
import { ClientAccountPanel } from "../components/client/ClientAccountPanel";
import { RestrictionsPanel } from "../components/common/RestrictionsPanel";
import { SuggestedDistribution } from "../components/planning/SuggestedDistribution";
import { MealPantryEditor } from "../components/planning/MealPantryEditor";
import { DayTemplateBar } from "../components/planning/DayTemplateBar";
import { ComboEditor } from "../components/phase2/ComboEditor";
import { catalogoPermitido, evaluarAlimento } from "../utils/restrictions";
import {
  RECETAS_POR_COMIDA,
  recetasDeComida,
  fotoDelPlan,
} from "../types/plan";
import { gridMacros } from "../utils/exchanges";
import { planTargets } from "../utils/macros";
import { Button, Card, EmptyState, Input, fmt } from "../components/common/ui";

type Tab =
  | "resumen"
  | "get"
  | "antropometria"
  | "restricciones"
  | "plan"
  | "entrega"
  | "seguimiento"
  | "agenda";

export function ClientDetail() {
  const { id = "" } = useParams();
  const client = useAppStore((s) => s.clients.find((c) => c.id === id));
  const updateClient = useAppStore((s) => s.updateClient);
  const plans = useAppStore((s) => s.plans);
  const ensurePlan = useAppStore((s) => s.ensurePlan);
  const recipes = useAppStore((s) => s.recipes);
  const updateRecipe = useAppStore((s) => s.updateRecipe);
  const registros = useAppStore((s) => s.registros);
  const retos = useAppStore((s) => s.retos);
  const foods = useAppStore((s) => s.foods);
  const recursos = useAppStore((s) => s.recursos);
  const mediciones = useAppStore((s) => s.mediciones);
  const {
    setPhase,
    addDayType,
    updateDayType,
    deleteDayType,
    setCell,
    renameMeal,
    removeMeal,
    addMeal,
    nuevaPlanificacion,
    reactivarPlan,
    deletePlan,
    updatePlan,
    addMedicion,
  } = useAppStore();

  const [tab, setTab] = useState<Tab>("resumen");
  const [verPlanId, setVerPlanId] = useState<string | null>(null);
  const [creandoPlan, setCreandoPlan] = useState(false);
  const [dtIndex, setDtIndex] = useState(0);
  const calc = useEnergy(client);

  if (!client) return <EmptyState title="Cliente no encontrado" />;

  const planActivo =
    plans.find((p) => p.clientId === client.id && !p.archivado) ??
    ensurePlan(client.id);
  // Al abrir una archivada desde el historial se edita esa; si no, la de uso.
  const plan =
    (verPlanId && plans.find((p) => p.id === verPlanId)) || planActivo;
  const planesCliente = plans
    .filter((p) => p.clientId === client.id)
    .sort((a, b) =>
      (b.fecha ?? b.createdAt).localeCompare(a.fecha ?? a.createdAt),
    );
  const dayType = plan.dayTypes[Math.min(dtIndex, plan.dayTypes.length - 1)];
  const caloriasBase = calc?.energy.caloriasObjetivo ?? 0;
  const kcalDia = dayType.caloriasOverride ?? caloriasBase;

  const foodsPermitidos = catalogoPermitido(foods, client);
  /**
   * Para los buscadores de la nutricionista se pasa el catálogo entero: un
   * alimento vetado se enseña en ámbar con el motivo en vez de desaparecer,
   * que era lo que hacía pensar que la app no dejaba añadirlo.
   */
  const motivoBloqueo = (f: (typeof foods)[number]) => {
    const b = evaluarAlimento(f, client);
    return b.bloqueado ? b.motivos.join(" · ") : undefined;
  };
  const registrosCliente = registros.filter((r) => r.clientId === client.id);
  /** Si está en un reto, aquí sólo se calcula y se reparte: lo demás es del reto. */
  const suReto = retos.find((r) => r.participantes.includes(client.id));
  const medicionesCliente = mediciones.filter((m) => m.clientId === client.id);
  /**
   * Los g/kg se multiplican por el peso de referencia, no siempre por el total:
   * pautar sobre 110 kg da 220 g de proteína, que no necesita nadie.
   */
  const planeado = planTargets(
    kcalDia,
    pesoDeReferencia(client, medicionesCliente).kg,
    dayType.proteinaGkg,
    dayType.hcGkg,
  );
  const pautado = gridMacros(dayType.grid, dayType.meals);

  /**
   * El plan nuevo sale de datos nuevos: se guarda el peso y la actividad en la
   * ficha, la medición queda registrada para el seguimiento y la planificación
   * nace con las kcal que se acaban de calcular.
   */
  const crearPlanificacion = (m: MedidasNuevoPlan, kcal: number) => {
    updateClient(client.id, {
      peso: m.peso,
      altura: m.altura ?? client.altura,
      activityFactorId: m.activityFactorId,
      goalMultiplier: m.goalMultiplier,
    });

    addMedicion({
      clientId: client.id,
      fecha: new Date().toISOString().slice(0, 10),
      peso: m.peso,
      talla: m.altura ?? client.altura,
      pliegues: {},
      perimetros: { cintura: m.cintura, cadera: m.cadera },
      diametros: {},
    });

    const nuevo = nuevaPlanificacion(client.id, kcal);
    if (m.notas) updatePlan(nuevo.id, { notas: m.notas });
    setCreandoPlan(false);
    setVerPlanId(null);
    setDtIndex(0);
    setTab("plan");
  };

  const tabs: { id: Tab; label: string }[] = [
    // El orden es el del trabajo real: primero se mide, luego se calcula,
    // después se pauta y al final se entrega.
    { id: "resumen", label: "Resumen" },
    { id: "antropometria", label: "Antropometría" },
    { id: "get", label: "Cálculo GET" },
    { id: "restricciones", label: "Restricciones" },
    { id: "plan", label: "Cálculo plan" },
    { id: "entrega", label: `Entrega — Fase ${plan.fase}` },
    { id: "seguimiento", label: "Seguimiento" },
    { id: "agenda", label: "Citas y pagos" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <Link
            to="/clientes"
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            ← Clientes
          </Link>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-brand-900">
            {client.nombre}
          </h1>
          <p className="tnum text-sm text-slate-500">
            {client.peso} kg · {client.altura} cm · {edadDe(client)} años ·{" "}
            <strong className="text-brand-700">
              {fmt(caloriasBase)} kcal objetivo
            </strong>
          </p>
        </div>
        <Link to={`/clientes/${client.id}/vista`}>
          <Button variant="outline">Vista del cliente →</Button>
        </Link>
      </div>

      {plan.archivado && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900 no-print">
          <span>
            Estás viendo <strong>{plan.nombre}</strong>, una planificación
            archivada. Los cambios que hagas aquí no son los que ve el cliente.
          </span>
          <button
            onClick={() => setVerPlanId(null)}
            className="ml-auto font-medium text-amber-900 underline"
          >
            Volver a la que está en uso
          </button>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 no-print">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
              tab === t.id
                ? "border-brand-600 font-medium text-brand-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumen" && creandoPlan && (
        <NewPlanWizard
          client={client}
          onCancelar={() => setCreandoPlan(false)}
          onCrear={(medidas, kcal) => crearPlanificacion(medidas, kcal)}
        />
      )}

      {tab === "resumen" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PlanHistory
            planes={planesCliente}
            activoId={planActivo.id}
            kcalObjetivo={caloriasBase}
            onNueva={() => setCreandoPlan(true)}
            onVer={(planId) => {
              setVerPlanId(planId === planActivo.id ? null : planId);
              setDtIndex(0);
              setTab("plan");
            }}
            onReactivar={(planId) => {
              reactivarPlan(planId);
              setVerPlanId(null);
            }}
            onBorrar={(planId) => {
              deletePlan(planId);
              if (verPlanId === planId) setVerPlanId(null);
            }}
          />
          {planActivo?.envio && (
            <DiaEnVivo
              client={client}
              plan={planActivo}
              registros={registrosCliente}
              recipes={recipes}
              foods={foods}
            />
          )}
          <FollowUpPanel
            client={client}
            plan={planActivo}
            registros={registrosCliente}
            mediciones={mediciones.filter((m) => m.clientId === client.id)}
            foods={foods}
          />
        </div>
      )}

      {tab === "get" && (
        <CalorieCalculator
          client={client}
          onChange={(patch) => updateClient(client.id, patch)}
        />
      )}

      {tab === "seguimiento" && (
        <div className="space-y-5">
          {/*
            Lo primero, lo que hace falta antes de una consulta: si aparece, si
            cumple sus metas, cuántas veces ha comido fuera y cómo va su cuerpo.
            El día a día detallado va debajo, para cuando hay que mirar fino.
          */}
          <SeguimientoResumen
            client={client}
            dayTypes={plan.dayTypes}
            registros={registrosCliente}
            mediciones={medicionesCliente}
          />
          <AdherenceTab
            client={client}
            plan={plan}
            registros={registrosCliente}
            foods={foods}
          />
        </div>
      )}

      {tab === "antropometria" && (
        <AnthroTab
          client={client}
          onClientChange={(patch) => updateClient(client.id, patch)}
        />
      )}

      {tab === "restricciones" && (
        <Card
          title="Restricciones y gustos"
          subtitle="Filtran el catálogo y las recetas que puede recibir este cliente"
        >
          <RestrictionsPanel
            client={client}
            foods={foods}
            onChange={(patch) => updateClient(client.id, patch)}
          />
        </Card>
      )}

      {tab !== "get" && tab !== "resumen" && (
        <div className="flex flex-wrap items-center gap-1.5 no-print">
          {plan.dayTypes.map((d, i) => {
            const activo = d.id === dayType.id;
            return (
              <span
                key={d.id}
                className={`flex items-center rounded-lg border text-sm transition ${
                  activo
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
                }`}
              >
                <button onClick={() => setDtIndex(i)} className="px-3 py-1.5">
                  {d.nombre}
                </button>
                {/* Nunca se borra el último: un plan sin tipos de día no existe. */}
                {plan.dayTypes.length > 1 && (
                  <button
                    onClick={() => {
                      if (
                        !window.confirm(
                          `¿Quitar "${d.nombre}" de ${plan.nombre}? Se borra su reparto de intercambios y sus combinaciones.`,
                        )
                      )
                        return;
                      deleteDayType(plan.id, d.id);
                      setDtIndex((idx) =>
                        Math.max(0, Math.min(idx, plan.dayTypes.length - 2)),
                      );
                    }}
                    aria-label={`Quitar ${d.nombre}`}
                    title={`Quitar ${d.nombre}`}
                    className={`px-2 py-1.5 text-xs transition ${
                      activo
                        ? "text-white/60 hover:text-white"
                        : "text-slate-300 hover:text-red-600"
                    }`}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
          <button
            onClick={() =>
              addDayType(plan.id, `Tipo de día ${plan.dayTypes.length + 1}`)
            }
            className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-700"
          >
            + Tipo de día
          </button>
        </div>
      )}

      {tab === "plan" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
            <MacroTargets
              dayType={dayType}
              client={client}
              mediciones={medicionesCliente}
              caloriasBase={caloriasBase}
              onChange={(patch) => updateDayType(plan.id, dayType.id, patch)}
              onCliente={(patch) => updateClient(client.id, patch)}
            />
            <ValidationPanel planeado={planeado} pautado={pautado} />
          </div>

          <SuggestedDistribution
            planeado={planeado}
            meals={dayType.meals}
            hayReparto={Object.values(dayType.grid).some(
              (c) => Object.keys(c ?? {}).length > 0,
            )}
            onAplicar={(grid) => updateDayType(plan.id, dayType.id, { grid })}
          />

          <Card
            title="Reparto de intercambios"
            subtitle="Pasos de medio intercambio · edita el nombre de una comida haciendo clic"
            actions={
              <div className="flex items-center gap-2">
                <Input
                  value={dayType.nombre}
                  onChange={(e) =>
                    updateDayType(plan.id, dayType.id, {
                      nombre: e.target.value,
                    })
                  }
                  className="w-44 text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    addMeal(plan.id, dayType.id, {
                      nombre: "Extra",
                      slot: "extra",
                      orden: dayType.meals.length + 1,
                    })
                  }
                >
                  + Comida
                </Button>
                {plan.dayTypes.length > 1 && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `¿Quitar "${dayType.nombre}" de ${plan.nombre}? Se borra su reparto de intercambios y sus combinaciones.`,
                        )
                      )
                        return;
                      deleteDayType(plan.id, dayType.id);
                      setDtIndex(0);
                    }}
                  >
                    Eliminar día
                  </Button>
                )}
              </div>
            }
          >
            <ExchangeGrid
              dayType={dayType}
              peso={client.peso}
              onCell={(mealId, group, value) =>
                setCell(plan.id, dayType.id, mealId, group, value)
              }
              onRenameMeal={(mealId, nombre) =>
                renameMeal(plan.id, dayType.id, mealId, nombre)
              }
              onRemoveMeal={(mealId) => removeMeal(plan.id, dayType.id, mealId)}
            />
          </Card>
        </div>
      )}

      {tab === "agenda" && (
        <div className="space-y-5">
          <CitaPanel
            client={client}
            onChange={(patch) => updateClient(client.id, patch)}
          />
          <PagosPanel
            client={client}
            onChange={(patch) => updateClient(client.id, patch)}
          />
        </div>
      )}

      {tab === "entrega" && (
        <div className="space-y-5">
          <Card
            title="Fase de entrega"
            subtitle="Se aplica a todo el plan del cliente"
          >
            <PhaseSelector
              value={plan.fase}
              onChange={(f) => setPhase(plan.id, f)}
            />
          </Card>

          {/*
            Lo que se le abre además del plan: los recursos que ya puede leer y
            las costumbres que va a marcar cada día.
          */}
          <div className="grid gap-4 lg:grid-cols-2">
            <RecursosDeCliente
              client={client}
              recursos={recursos}
              onChange={(patch) => updateClient(client.id, patch)}
            />
            <MetasDeCliente
              client={client}
              onChange={(patch) => updateClient(client.id, patch)}
            />
          </div>

          {plan.fase >= 2 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {plan.dayTypes.map((d) => (
                <PlanSchemaTable key={d.id} dayType={d} />
              ))}
            </div>
          )}

          {/*
            EN UN RETO NO HAY QUE ASIGNAR RECETAS
            ==========================================================
            Son las mismas para todo el grupo: se eligen una vez en la pantalla
            del reto y se abren solas en la comida que les toca, escaladas a
            las porciones de cada una. Repetir aquí ese trabajo por cada
            participante es justo lo que un reto viene a evitar.
          */}
          {suReto && (
            <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs leading-snug text-brand-900">
              <strong className="font-semibold">
                Está en «{suReto.nombre}».
              </strong>{" "}
              Sus recetas salen del reto y ya se le abren solas con estos
              gramos: aquí sólo hay que calcular y repartir las porciones.
              {dayType.meals.length > 0 && (
                <>
                  {" "}
                  Come <strong>{dayType.meals.length} veces al día</strong>, que
                  es lo que dijo al apuntarse.
                </>
              )}
            </p>
          )}

          {plan.fase === 1 && !suReto && (
            <Card
              title="Recetas por comida"
              subtitle={`Elige ${RECETAS_POR_COMIDA} opciones por comida: el cliente escoge entre ellas`}
            >
              <div className="space-y-6">
                {dayType.meals.map((m) => (
                  <RecipeRecommender
                    key={m.id}
                    dayType={dayType}
                    meal={m}
                    recetas={recipes}
                    client={client}
                    foods={foodsPermitidos}
                    seleccionadas={recetasDeComida(
                      dayType.recetasAsignadas,
                      m.id,
                    )}
                    yaAsignadas={dayType.meals
                      .filter((otra) => otra.id !== m.id)
                      .flatMap((otra) =>
                        recetasDeComida(dayType.recetasAsignadas, otra.id),
                      )}
                    onEditarReceta={(rid, patch) => updateRecipe(rid, patch)}
                    /**
                     * Los gramos a mano viven en el plan de esta clienta, no
                     * en la receta del banco: la misma receta se cuadra
                     * distinto según a quién se le pauta.
                     */
                    onAjustarCantidades={(rid, ajustes, acompanamientos) =>
                      updateDayType(plan.id, dayType.id, {
                        ajustesReceta: {
                          ...(dayType.ajustesReceta ?? {}),
                          [m.id]: {
                            ...(dayType.ajustesReceta?.[m.id] ?? {}),
                            [rid]: ajustes,
                          },
                        },
                        acompanamientos: {
                          ...(dayType.acompanamientos ?? {}),
                          [m.id]: {
                            ...(dayType.acompanamientos?.[m.id] ?? {}),
                            [rid]: acompanamientos,
                          },
                        },
                      })
                    }
                    onToggle={(rid) => {
                      const actuales = recetasDeComida(
                        dayType.recetasAsignadas,
                        m.id,
                      );
                      const nuevas = actuales.includes(rid)
                        ? actuales.filter((x) => x !== rid)
                        : [...actuales, rid].slice(0, RECETAS_POR_COMIDA);
                      updateDayType(plan.id, dayType.id, {
                        recetasAsignadas: {
                          ...(dayType.recetasAsignadas ?? {}),
                          [m.id]: nuevas,
                        },
                      });
                    }}
                  />
                ))}
              </div>
            </Card>
          )}

          {plan.fase === 3 && (
            <Card
              title="Qué puede elegir el cliente"
              subtitle="Comida a comida: escribe los alimentos que quieras incluir y se colocan solos en su grupo. Lo que quede aquí es exactamente lo que verá."
              actions={
                <Input
                  value={dayType.postre ?? ""}
                  onChange={(e) =>
                    updateDayType(plan.id, dayType.id, {
                      postre: e.target.value,
                    })
                  }
                  placeholder="Postre del día (opcional)"
                  className="w-56 text-xs"
                />
              }
            >
              <div className="space-y-2">
                <DayTemplateBar
                  dayType={dayType}
                  onDespensa={(despensa) =>
                    updateDayType(plan.id, dayType.id, { despensa })
                  }
                />
                {dayType.meals.map((m) => (
                  <MealPantryEditor
                    key={m.id}
                    dayType={dayType}
                    meal={m}
                    foods={foods}
                    motivoBloqueo={motivoBloqueo}
                    onDespensa={(despensa) =>
                      updateDayType(plan.id, dayType.id, { despensa })
                    }
                    onAceite={(porciones) =>
                      updateDayType(plan.id, dayType.id, {
                        aceiteCoccion: {
                          ...(dayType.aceiteCoccion ?? {}),
                          [m.id]: porciones,
                        },
                      })
                    }
                    onNota={(t) =>
                      updateDayType(plan.id, dayType.id, {
                        notas: { ...dayType.notas, [m.id]: t },
                      })
                    }
                  />
                ))}
              </div>
            </Card>
          )}

          {plan.fase === 2 && (
            <Card
              title="Combinaciones que verá el cliente"
              subtitle="Acepta las propuestas o busca cualquier alimento y compón la tuya"
            >
              <div className="space-y-2">
                {dayType.meals.map((m) => (
                  <ComboEditor
                    key={m.id}
                    dayType={dayType}
                    meal={m}
                    foods={foods}
                    motivoBloqueo={motivoBloqueo}
                    onCombinaciones={(combinaciones) =>
                      updateDayType(plan.id, dayType.id, { combinaciones })
                    }
                    onAceite={(porciones) =>
                      updateDayType(plan.id, dayType.id, {
                        aceiteCoccion: {
                          ...(dayType.aceiteCoccion ?? {}),
                          [m.id]: porciones,
                        },
                      })
                    }
                    onNota={(t) =>
                      updateDayType(plan.id, dayType.id, {
                        notas: { ...dayType.notas, [m.id]: t },
                      })
                    }
                  />
                ))}
              </div>
            </Card>
          )}

          {plan.fase === 2 && (
            <Card
              title="Vista previa del cliente"
              subtitle="Así queda cada comida"
            >
              <div className="space-y-4">
                {dayType.meals.map((m) => (
                  <ScaledOptionsBoard
                    key={m.id}
                    dayType={dayType}
                    meal={m}
                    foods={foodsPermitidos}
                    modo="editor"
                    onNota={(t) =>
                      updateDayType(plan.id, dayType.id, {
                        notas: { ...dayType.notas, [m.id]: t },
                      })
                    }
                    onPostre={(t) =>
                      updateDayType(plan.id, dayType.id, { postre: t })
                    }
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Lo último de la entrega: darle acceso y mandárselo */}
          <ClientAccountPanel
            client={client}
            onEmail={(email) => updateClient(client.id, { email })}
          />
          <SendPlanPanel
            plan={plan}
            client={client}
            onEnviar={(mensaje) =>
              updatePlan(plan.id, {
                // La foto de lo que se manda: es lo único que verá ella.
                publicado: fotoDelPlan(plan),
                envio: {
                  fecha: new Date().toISOString(),
                  mensaje: mensaje || undefined,
                },
              })
            }
            onRetirar={() =>
              updatePlan(plan.id, { publicado: undefined, envio: undefined })
            }
          />
        </div>
      )}
    </div>
  );
}
