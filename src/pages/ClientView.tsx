import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { MealOptionsBoard } from '../components/phase2/MealOptionsBoard';
import { ScaledOptionsBoard } from '../components/phase2/ScaledOptionsBoard';
import { FoodPortionPicker } from '../components/phase3/FoodPortionPicker';
import { PresupuestoDia } from '../components/phase3/PresupuestoDia';
import { ScaledRecipeView } from '../components/phase1/ScaledRecipeView';
import { MealCard } from '../components/client/MealCard';
import { WeekStrip } from '../components/client/WeekStrip';
import { DayProgressBar } from '../components/client/DayProgressBar';
import { RecipeShortcuts } from '../components/client/RecipeShortcuts';
import { ExtrasPanel } from '../components/client/ExtrasPanel';
import { MealExtras } from '../components/client/MealExtras';
import { PlanDocument } from '../components/export/PlanDocument';
import { usePrintDocument } from '../components/export/printing';
import { Button, EmptyState, fmt } from '../components/common/ui';
import {
  recetasDeComida,
  comidasConPauta,
  ajustesDeReceta,
  acompanamientosDeReceta,
  FASE_POR_NUMERO,
} from '../types/plan';
import { claveFecha, fechaLegible } from '../types/diary';
import { balanceDelDia, extrasDeComida, hayAlgoMarcado, vaciarLoMarcado } from '../utils/diary';
import { elegirOpcion, fijarAlimento, marcarAlimento, seleccionPorGrupo } from '../utils/marcado';

/** Lo que ve el cliente: su día, lo pautado y lo que va cumpliendo. */
export function ClientView() {
  const { id = '' } = useParams();
  const client = useAppStore((s) => s.clients.find((c) => c.id === id));
  // El cliente sólo ve la planificación en uso, nunca las archivadas.
  const plan = useAppStore((s) => s.plans.find((p) => p.clientId === id && !p.archivado));
  const foods = useAppStore((s) => s.foods);
  const recipes = useAppStore((s) => s.recipes);
  const registros = useAppStore((s) => s.registros);
  const upsertRegistro = useAppStore((s) => s.upsertRegistro);

  const [fecha, setFecha] = useState(claveFecha(new Date()));
  const [interactivo, setInteractivo] = useState(true);
  /** Tipo de día al que se quiere cambiar cuando ya hay cosas marcadas. */
  const [cambioPendiente, setCambioPendiente] = useState<string | null>(null);

  const imprimir = usePrintDocument(
    `Plan ${client?.nombre ?? ''} — Fase ${plan?.fase ?? ''}`.trim(),
  );

  const mios = useMemo(() => registros.filter((r) => r.clientId === id), [registros, id]);
  const registro = mios.find((r) => r.fecha === fecha);

  const dayType = useMemo(() => {
    if (!plan) return undefined;
    return plan.dayTypes.find((d) => d.id === registro?.dayTypeId) ?? plan.dayTypes[0];
  }, [plan, registro?.dayTypeId]);

  const balance = useMemo(
    () => balanceDelDia(dayType, registro, foods, { asumirPlanCumplido: true }),
    [dayType, registro, foods],
  );

  if (!client || !plan || !dayType) return <EmptyState title="Plan no disponible" />;

  // Hasta que la nutricionista lo envía, aquí no hay nada que ver.
  if (!plan.envio) {
    return (
      <EmptyState title="Tu plan todavía se está preparando">
        En cuanto tu nutricionista lo envíe, aparecerá aquí con las comidas del día.
      </EmptyState>
    );
  }

  const guardar = (patch: Parameters<typeof upsertRegistro>[2]) =>
    upsertRegistro(client.id, fecha, { dayTypeId: dayType.id, ...patch });

  const porciones = registro?.porciones ?? {};
  /** Lo escogido por subgrupo: es la base del presupuesto del día. */
  const porGrupo = seleccionPorGrupo(porciones, foods);

  const marcarPorcion = (mealId: string, foodId: string, delta: number) =>
    guardar({ porciones: marcarAlimento(porciones, mealId, foodId, delta) });

  /** Fase 2: al pulsar una opción sustituye lo que hubiera de ese macro. */
  const elegirOpcionComida = (mealId: string, opcion: Parameters<typeof elegirOpcion>[2]) =>
    guardar({ porciones: elegirOpcion(porciones, mealId, opcion, foods) });

  /** Recetas sugeridas: marcan de golpe todos sus ingredientes. */
  const usarReceta = (mealId: string, aportes: { foodId: string; intercambios: number }[]) => {
    let out = porciones;
    for (const a of aportes) out = fijarAlimento(out, mealId, a.foodId, a.intercambios);
    guardar({ porciones: out });
  };

  const alternarCumplida = (mealId: string) => {
    const actual = registro?.cumplidas ?? [];
    guardar({
      cumplidas: actual.includes(mealId) ? actual.filter((x) => x !== mealId) : [...actual, mealId],
    });
  };

  const cumplida = (mealId: string) => (registro?.cumplidas ?? []).includes(mealId);

  /** Cambiar de día en blanco es directo; con cosas marcadas hay que preguntar. */
  const pedirCambioDeDia = (dayTypeId: string) => {
    if (dayTypeId === dayType.id) return;
    if (hayAlgoMarcado(registro)) setCambioPendiente(dayTypeId);
    else guardar({ dayTypeId });
  };

  /**
   * Los extras se apuntan en la comida en la que se tomaron. Todos viven en la
   * misma lista del día: el `momento` es lo único que dice cuándo fue, y por
   * eso el resumen del pie sigue sumándolos todos sin enterarse del cambio.
   */
  const extras = registro?.extras ?? [];
  const anadirExtra = (extra: (typeof extras)[number]) => guardar({ extras: [...extras, extra] });
  const quitarExtra = (extraId: string) =>
    guardar({ extras: extras.filter((e) => e.id !== extraId) });

  /** El «+ Añadir extra» de una comida: el mismo en las tres fases. */
  const extrasDe = (mealId: string, nombre: string) => (
    <MealExtras
      mealId={mealId}
      mealNombre={nombre}
      extras={extrasDeComida(extras, mealId)}
      foods={foods}
      onAnadir={anadirExtra}
      onQuitar={quitarExtra}
    />
  );

  const nombreMomento = (momento: string) =>
    dayType.meals.find((m) => m.id === momento)?.nombre;

  /**
   * Las comidas de hoy: las que llevan algo pautado. Si un día no tiene
   * merienda, no se enseña ni cuenta para el «3 de 3 hechas».
   */
  const comidas = comidasConPauta(dayType);

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
              Hola, {client.nombre.split(' ')[0]}
            </h1>
            <p className="text-sm text-slate-500">
              {fechaLegible(fecha)} · Fase {plan.fase} —{' '}
              {FASE_POR_NUMERO[plan.fase].titulo.toLowerCase()}
            </p>
          </div>
          <div className="flex gap-2">
            {plan.fase === 3 && (
              <Button variant="outline" onClick={() => setInteractivo((v) => !v)}>
                {interactivo ? 'Ver como documento' : 'Marcar lo que como'}
              </Button>
            )}
            <Button onClick={imprimir}>Exportar PDF</Button>
          </div>
        </div>

        {plan.envio.mensaje && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 no-print">
            <p className="text-[10px] font-medium tracking-wide text-brand-700 uppercase">
              Mensaje de tu nutricionista
            </p>
            <p className="mt-1 text-sm leading-snug text-brand-900">{plan.envio.mensaje}</p>
          </div>
        )}

        <WeekStrip
          fecha={fecha}
          onFecha={setFecha}
          dayTypes={plan.dayTypes}
          registros={mios}
          inicioPlan={plan.createdAt?.slice(0, 10)}
        />

        {/* Tipo de día */}
        {plan.dayTypes.length > 1 && (
          <div className="no-print">
            <p className="mb-1.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
              ¿Qué día tienes hoy?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {plan.dayTypes.map((d) => (
                <button
                  key={d.id}
                  onClick={() => pedirCambioDeDia(d.id)}
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

            {/*
              Cambiar de día con cosas ya marcadas se llevaba lo marcado al día
              nuevo, y al volver a marcar las porciones se sumaban a las de
              antes. Ahora se pregunta, porque las dos respuestas son legítimas:
              me equivoqué de día al empezar, o he cambiado de plan a media
              mañana y lo de esta mañana cuenta igual.
            */}
            {cambioPendiente && (
              <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3">
                <p className="text-sm font-medium text-amber-900">
                  Ya tienes cosas marcadas hoy en {dayType.nombre}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-amber-800">
                  Si lo de esta mañana ya te lo has comido, consérvalo. Si te habías equivocado de
                  día, empieza de cero para que las cuentas salgan bien.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      guardar({ dayTypeId: cambioPendiente, ...vaciarLoMarcado() });
                      setCambioPendiente(null);
                    }}
                  >
                    Empezar de cero
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      guardar({ dayTypeId: cambioPendiente });
                      setCambioPendiente(null);
                    }}
                  >
                    Conservar lo marcado
                  </Button>
                  <Button variant="outline" onClick={() => setCambioPendiente(null)}>
                    Dejarlo como está
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/*
          En fase 3 lo que manda es el total del día, así que va lo primero.
          El desglose por comidas baja al final: sigue estando —el reparto está
          pensado— pero deja de parecer la regla.
        */}
        {plan.fase === 3 && <PresupuestoDia dayType={dayType} seleccion={porGrupo} />}

        {/* Las comidas del día, que se van llenando */}
        {plan.fase !== 3 && (
          <DayProgressBar
            dayType={dayType}
            porciones={porciones}
            cumplidas={registro?.cumplidas ?? []}
            onIr={(mealId) =>
              document.getElementById(`comida-${mealId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />
        )}

        {/* Cómo va el día */}
        <div className="tnum flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-slate-50 px-4 py-2.5 text-xs no-print">
          <span className="font-medium text-slate-700">
            {fmt(balance.kcalTotal)} kcal
            <span className="ml-1 font-normal text-slate-400">
              de {fmt(balance.kcalPautado)} pautadas
            </span>
          </span>
          <span className="text-slate-500">
            P {fmt(balance.total.proteina, 0)} · HC {fmt(balance.total.hc, 0)} · G{' '}
            {fmt(balance.total.grasa, 0)} g
          </span>
          <span className="text-slate-500">
            {comidas.filter((m) => cumplida(m.id)).length}/{comidas.length} comidas hechas
          </span>
          {Math.abs(balance.kcalDiferencia) > 20 && (
            <span
              className={balance.kcalDiferencia > 0 ? 'text-amber-700' : 'text-slate-500'}
            >
              {balance.kcalDiferencia > 0 ? '+' : '−'}
              {fmt(Math.abs(balance.kcalDiferencia))} kcal sobre lo pautado
            </span>
          )}
        </div>

        {/*
          El esquema decía lo mismo tres veces: el total del día ya está arriba
          y el reparto de cada comida está en su propia tarjeta. Se queda en el
          PDF y en la pantalla de la nutricionista, que es donde sirve para
          repasar el plan entero de un vistazo.
        */}

        {/* ── FASE 1 ─────────────────────────────── */}
        {plan.fase === 1 && (
          <div className="space-y-5">
            {comidas.map((m) => {
              const opciones = recetasDeComida(dayType.recetasAsignadas, m.id)
                .map((rid) => recipes.find((r) => r.id === rid))
                .filter(Boolean) as typeof recipes;
              if (!opciones.length) return null;

              const elegida = registro?.recetaElegida?.[m.id] ?? opciones[0].id;
              const receta = opciones.find((r) => r.id === elegida) ?? opciones[0];
              const hecha = cumplida(m.id);

              return (
                <div key={m.id} id={`comida-${m.id}`} className="scroll-mt-20">
                  <MealCard
                    meal={m}
                    receta={receta}
                    opciones={opciones}
                    hecha={hecha}
                    onElegir={(id) =>
                      guardar({
                        recetaElegida: { ...(registro?.recetaElegida ?? {}), [m.id]: id },
                      })
                    }
                    onAlternarHecha={() => alternarCumplida(m.id)}
                  >
                    <ScaledRecipeView
                      receta={receta}
                      requeridos={dayType.grid[m.id] ?? {}}
                      foods={foods}
                      ajustes={ajustesDeReceta(dayType, m.id, receta.id)}
                      acompanamientos={acompanamientosDeReceta(dayType, m.id, receta.id)}
                      sinCabecera
                      equivalentes={registro?.sustituciones?.[m.id] ?? {}}
                      onEquivalente={(ingId, foodId) => {
                        const porComida = { ...(registro?.sustituciones?.[m.id] ?? {}) };
                        if (foodId) porComida[ingId] = foodId;
                        else delete porComida[ingId];
                        guardar({
                          sustituciones: { ...(registro?.sustituciones ?? {}), [m.id]: porComida },
                        });
                      }}
                    />
                  </MealCard>
                  {extrasDe(m.id, m.nombre)}
                </div>
              );
            })}
            {!comidas.some((m) => recetasDeComida(dayType.recetasAsignadas, m.id).length) && (
              <EmptyState title="Aún no hay recetas asignadas">
                Tu nutricionista todavía no ha elegido las recetas de este día.
              </EmptyState>
            )}
          </div>
        )}

        {/* ── FASE 2 ─────────────────────────────── */}
        {plan.fase === 2 && (
          <div className="space-y-4">
            {comidas.map((m) => (
              <div key={m.id} id={`comida-${m.id}`} className="scroll-mt-20">
                <ScaledOptionsBoard
                  dayType={dayType}
                  meal={m}
                  foods={foods}
                  porciones={porciones}
                  onElegir={(o) => elegirOpcionComida(m.id, o)}
                />
                <RecipeShortcuts
                  dayType={dayType}
                  meal={m}
                  recetas={recipes}
                  foods={foods}
                  client={client}
                  porciones={porciones}
                  onUsar={usarReceta}
                />
                <div className="mt-1.5 flex justify-end no-print">
                  <button
                    onClick={() => alternarCumplida(m.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      cumplida(m.id)
                        ? 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100'
                    }`}
                  >
                    {cumplida(m.id) ? 'Hecha ✓' : 'Marcar como hecha'}
                  </button>
                </div>
                {extrasDe(m.id, m.nombre)}
              </div>
            ))}
          </div>
        )}

        {/* ── FASE 3 ─────────────────────────────── */}
        {plan.fase === 3 &&
          (interactivo ? (
            <div className="space-y-4">
              {comidas.map((m) => (
                <div key={m.id} id={`comida-${m.id}`} className="scroll-mt-20">
                  <FoodPortionPicker
                    dayType={dayType}
                    meal={m}
                    foods={foods}
                    porciones={porciones}
                    onMarcar={marcarPorcion}
                  />
                  <RecipeShortcuts
                    dayType={dayType}
                    meal={m}
                    recetas={recipes}
                    foods={foods}
                    client={client}
                    porciones={porciones}
                    onUsar={usarReceta}
                  />
                  <div className="mt-1.5 flex justify-end no-print">
                    <button
                      onClick={() => alternarCumplida(m.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        cumplida(m.id)
                          ? 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100'
                      }`}
                    >
                      {cumplida(m.id) ? 'Hecha ✓' : 'Marcar como hecha'}
                    </button>
                  </div>
                  {extrasDe(m.id, m.nombre)}
                </div>
              ))}

              {/* Cómo va cada comida, ya al final: informa, no manda. */}
              <div>
                <h2 className="mb-2 text-sm font-bold tracking-widest text-brand-800 uppercase">
                  Completado
                </h2>
                <DayProgressBar
                  dayType={dayType}
                  porciones={porciones}
                  cumplidas={registro?.cumplidas ?? []}
                  onIr={(mealId) =>
                    document
                      .getElementById(`comida-${mealId}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {comidas.map((m) => (
                <MealOptionsBoard
                  key={m.id}
                  dayType={dayType}
                  meal={m}
                  foods={foods}
                  mode="documento"
                />
              ))}
            </div>
          ))}

        <ExtrasPanel
          extras={extras}
          foods={foods}
          balance={balance}
          nombreMomento={nombreMomento}
          onChange={(nuevos) => guardar({ extras: nuevos })}
        />
      </div>

      {/* Documento que sale al imprimir / exportar a PDF */}
      <PlanDocument client={client} plan={plan} recipes={recipes} foods={foods} />
    </>
  );
}
