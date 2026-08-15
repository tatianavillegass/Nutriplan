import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { MealOptionsBoard } from "../components/phase2/MealOptionsBoard";
import { ScaledOptionsBoard } from "../components/phase2/ScaledOptionsBoard";
import { FoodPortionPicker } from "../components/phase3/FoodPortionPicker";
import { PresupuestoDia } from "../components/phase3/PresupuestoDia";
import { CalculadoraPorciones } from "../components/phase3/CalculadoraPorciones";
import { ScaledRecipeView } from "../components/phase1/ScaledRecipeView";
import { MealCard } from "../components/client/MealCard";
import { WeekStrip } from "../components/client/WeekStrip";
import { DayProgressBar } from "../components/client/DayProgressBar";
import { RecipeShortcuts } from "../components/client/RecipeShortcuts";
import { ExtrasPanel } from "../components/client/ExtrasPanel";
import { MealExtras } from "../components/client/MealExtras";
import { ComidaLibre } from "../components/client/ComidaLibre";
import { ResumenTab } from "../components/client/ResumenTab";
import { MetasDiarias } from "../components/client/MetasDiarias";
import { RecursosTab } from "../components/client/RecursosTab";
import { PlanDocument } from "../components/export/PlanDocument";
import { usePrintDocument } from "../components/export/printing";
import { Button, EmptyState, fmt } from "../components/common/ui";
import {
  recetasDeComida,
  comidasConPauta,
  ajustesDeReceta,
  acompanamientosDeReceta,
  FASE_POR_NUMERO,
} from "../types/plan";
import { claveFecha, fechaLegible } from "../types/diary";
import { LABEL_MODO_CITA, metasActivas } from "../types/client";
import { citaLegible, citaPasada } from "../utils/agenda";
import { estadoDelReto, retoDe, textoDelDia } from "../utils/retos";
import {
  balanceDelDia,
  extrasDeComida,
  hayAlgoMarcado,
  vaciarLoMarcado,
} from "../utils/diary";
import {
  elegirOpcion,
  fijarAlimento,
  marcarAlimento,
  seleccionPorBucket,
  seleccionPorGrupo,
} from "../utils/marcado";
import { comidaCubierta } from "../utils/dailyBudget";

/**
 * ICONOS DE LÍNEA, NO EMOJIS
 *
 * El emoji lo dibuja el sistema, así que cada móvil lo pinta a su manera y con
 * sus colores: al lado de un texto sobrio cantan como un adorno pegado. Un
 * trazo fino del mismo color que la letra se lee como parte de la interfaz.
 */
function Icono({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/** Cubiertos, barras y un libro abierto. */
const ICONOS = {
  hoy: "M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-1.5 1.5-2 3.5-2 5.5 0 1.5.5 2.5 2 2.5V3zm0 8v10",
  resumen: "M5 20V10M12 20V4M19 20v-6",
  recursos:
    "M12 7c-1.5-1.3-3.5-2-6-2H4v13h2c2.5 0 4.5.7 6 2m0-13c1.5-1.3 3.5-2 6-2h2v13h-2c-2.5 0-4.5.7-6 2m0-13v13",
} as const;

/**
 * Las tres pestañas de la clienta. El icono sólo se usa en la barra del móvil,
 * donde el texto solo se lee peor de reojo.
 */
const PESTANAS = [
  ["hoy", "Hoy", ICONOS.hoy],
  ["resumen", "Resumen", ICONOS.resumen],
  ["recursos", "Recursos", ICONOS.recursos],
] as const;

/** Lo que ve el cliente: su día, lo pautado y lo que va cumpliendo. */
export function ClientView() {
  const { id = "" } = useParams();
  const client = useAppStore((s) => s.clients.find((c) => c.id === id));
  // El cliente sólo ve la planificación en uso, nunca las archivadas.
  const plan = useAppStore((s) =>
    s.plans.find((p) => p.clientId === id && !p.archivado),
  );
  const catalogo = useAppStore((s) => s.foods);
  const recipes = useAppStore((s) => s.recipes);
  const registros = useAppStore((s) => s.registros);
  const todasMediciones = useAppStore((s) => s.mediciones);
  const recursos = useAppStore((s) => s.recursos);
  const retos = useAppStore((s) => s.retos);
  const upsertRegistro = useAppStore((s) => s.upsertRegistro);

  const [fecha, setFecha] = useState(claveFecha(new Date()));
  const [interactivo, setInteractivo] = useState(true);
  /** Tipo de día al que se quiere cambiar cuando ya hay cosas marcadas. */
  const [cambioPendiente, setCambioPendiente] = useState<string | null>(null);
  /** Comida cuyo formulario de «comida libre» está abierto, si hay alguno. */
  const [pidiendoLibre, setPidiendoLibre] = useState<string | null>(null);
  /**
   * En qué pestaña está. «Hoy» es lo primero y lo que se abre siempre: lo
   * demás se consulta de vez en cuando, la comida es todos los días.
   */
  const [tab, setTab] = useState<"hoy" | "resumen" | "recursos">("hoy");

  /** Las costumbres de hoy y los recursos que su nutricionista le ha abierto. */
  const metas = useMemo(() => (client ? metasActivas(client) : []), [client]);
  /**
   * EL RETO EN EL QUE ESTÁ, SI ESTÁ EN ALGUNO
   *
   * Una participante es una clienta más: sigue teniendo su plan y sus
   * porciones. Lo que le añade el reto es un calendario compartido y unos
   * recursos comunes.
   */
  const reto = useMemo(
    () => (client ? retoDe(retos, client.id, fecha) : undefined),
    [retos, client, fecha],
  );

  /** Los suyos más los del reto, sin repetir. */
  const susRecursos = useMemo(() => {
    const dados = new Set([
      ...(client?.recursos ?? []),
      ...(reto?.recursos ?? []),
    ]);
    return recursos.filter((r) => dados.has(r.id));
  }, [recursos, client, reto]);

  const imprimir = usePrintDocument(
    `Plan ${client?.nombre ?? ""} — Fase ${plan?.fase ?? ""}`.trim(),
  );

  const mios = useMemo(
    () => registros.filter((r) => r.clientId === id),
    [registros, id],
  );
  /**
   * Filtrar DENTRO del selector devolvía una lista nueva en cada pintada y la
   * pantalla del cliente se quedaba en blanco: el store cree que ha cambiado
   * algo, vuelve a pintar, vuelve a filtrar, y así hasta que React corta. Se
   * selecciona la lista entera y se filtra aquí, como con los registros.
   */
  const mediciones = useMemo(
    () => todasMediciones.filter((m) => m.clientId === id),
    [todasMediciones, id],
  );
  const registro = mios.find((r) => r.fecha === fecha);

  const dayType = useMemo(() => {
    if (!plan) return undefined;
    return (
      plan.dayTypes.find((d) => d.id === registro?.dayTypeId) ??
      plan.dayTypes[0]
    );
  }, [plan, registro?.dayTypeId]);

  const balance = useMemo(
    () =>
      balanceDelDia(
        dayType,
        registro,
        [...catalogo, ...(registro?.alimentosPropios ?? [])],
        {
          asumirPlanCumplido: true,
        },
      ),
    [dayType, registro, catalogo],
  );

  if (!client || !plan || !dayType)
    return <EmptyState title="Plan no disponible" />;

  // Hasta que la nutricionista lo envía, aquí no hay nada que ver.
  if (!plan.envio) {
    return (
      <EmptyState title="Tu plan todavía se está preparando">
        En cuanto tu nutricionista lo envíe, aparecerá aquí con las comidas del
        día.
      </EmptyState>
    );
  }

  const guardar = (patch: Parameters<typeof upsertRegistro>[2]) =>
    upsertRegistro(client.id, fecha, { dayTypeId: dayType.id, ...patch });

  /**
   * El catálogo de la nutricionista más lo que la clienta se haya calculado
   * hoy. Al ir juntos, todo lo que cuenta porciones los trata igual.
   */
  const foods = [...catalogo, ...(registro?.alimentosPropios ?? [])];

  const porciones = registro?.porciones ?? {};
  /** Lo escogido por subgrupo: es la base del presupuesto del día. */
  const porGrupo = seleccionPorGrupo(porciones, foods);

  const marcarPorcion = (mealId: string, foodId: string, delta: number) =>
    guardar({ porciones: marcarAlimento(porciones, mealId, foodId, delta) });

  /** Fase 2: al pulsar una opción sustituye lo que hubiera de ese macro. */
  const elegirOpcionComida = (
    mealId: string,
    opcion: Parameters<typeof elegirOpcion>[2],
  ) => guardar({ porciones: elegirOpcion(porciones, mealId, opcion, foods) });

  /** Recetas sugeridas: marcan de golpe todos sus ingredientes. */
  const usarReceta = (
    mealId: string,
    aportes: { foodId: string; intercambios: number }[],
  ) => {
    let out = porciones;
    for (const a of aportes)
      out = fijarAlimento(out, mealId, a.foodId, a.intercambios);
    guardar({ porciones: out });
  };

  const alternarCumplida = (mealId: string) => {
    const actual = registro?.cumplidas ?? [];
    guardar({
      cumplidas: actual.includes(mealId)
        ? actual.filter((x) => x !== mealId)
        : [...actual, mealId],
    });
  };

  const cumplida = (mealId: string) =>
    (registro?.cumplidas ?? []).includes(mealId);

  /**
   * LA COMIDA SE MARCA SOLA AL COMPLETARLA
   *
   * En fases 2 y 3, marcar las porciones YA es decir lo que se ha comido.
   * Pedir después un «marcar hecha» es hacer repetir lo mismo con otro botón,
   * y lo que pasaba de verdad es que se quedaba sin pulsar: el día salía a
   * medias con el plato entero registrado.
   *
   * Se marca sólo al pasar de incompleta a completa. Si después ella lo
   * deshace a mano, no se vuelve a marcar: no hay otro cruce que lo dispare,
   * así que la app no le lleva la contraria.
   *
   * En fase 1 no aplica: ahí no se elige nada, se sigue la receta, y lo único
   * que dice que se la ha comido es el botón.
   */
  const completasAntes = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!plan || plan.fase === 1 || !dayType) return;

    const seleccion = seleccionPorBucket(porciones, foods);
    const yaHechas = registro?.cumplidas ?? [];
    const nuevas: string[] = [];

    for (const m of comidasConPauta(dayType)) {
      const clave = `${fecha}:${m.id}`;
      const completa = comidaCubierta(dayType, m, seleccion);
      const antes = completasAntes.current[clave] ?? false;
      completasAntes.current[clave] = completa;

      if (completa && !antes && !yaHechas.includes(m.id) && !libres[m.id]) {
        nuevas.push(m.id);
      }
    }

    if (nuevas.length) guardar({ cumplidas: [...yaHechas, ...nuevas] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porciones, dayType, fecha, plan?.fase, foods]);

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
  const anadirExtra = (extra: (typeof extras)[number]) =>
    guardar({ extras: [...extras, extra] });
  const quitarExtra = (extraId: string) =>
    guardar({ extras: extras.filter((e) => e.id !== extraId) });

  /**
   * Marcar una comida como libre. No borra lo que hubiera marcado —puede haber
   * desayunado en casa y salido a comer— simplemente dice que esa comida no se
   * mide.
   */
  const libres = registro?.libres ?? {};
  const marcarLibre = (mealId: string, nota?: string) =>
    guardar({ libres: { ...libres, [mealId]: { nota } } });
  const quitarLibre = (mealId: string) => {
    const { [mealId]: _fuera, ...resto } = libres;
    guardar({ libres: resto });
  };

  /**
   * Marcar una meta del día. Va en el registro, como las comidas hechas: es de
   * hoy, no de la ficha.
   */
  const alternarMeta = (metaId: string) => {
    const hechas = registro?.metas ?? [];
    guardar({
      metas: hechas.includes(metaId)
        ? hechas.filter((x) => x !== metaId)
        : [...hechas, metaId],
    });
  };

  /**
   * La comida libre va en todas las fases: comer fuera pasa siempre.
   *
   * El botón está en la cabecera de la comida y lo que sale aquí es sólo el
   * formulario cuando se pulsa, o el aviso de que ya está marcada. Antes había
   * un botón suelto al final de cada bloque y no se sabía si era de la comida
   * de arriba o de la que empezaba justo debajo.
   */
  const libreDe = (mealId: string, nombre: string) => (
    <ComidaLibre
      mealNombre={nombre}
      libre={libres[mealId]}
      onMarcar={(nota) => marcarLibre(mealId, nota)}
      onQuitar={() => quitarLibre(mealId)}
      sinBoton
      abierto={pidiendoLibre === mealId}
      onCerrar={() => setPidiendoLibre(null)}
    />
  );

  /**
   * LOS DOS BOTONES DE CADA COMIDA, EN SU CABECERA
   *
   * Estaban al final del bloque y no se sabía si el «marcar como hecha» era de
   * la merienda o de la cena. Junto al nombre de la comida no hay duda posible.
   */
  const accionesDe = (mealId: string, nombre: string) => (
    <>
      <button
        onClick={() => alternarCumplida(mealId)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          cumplida(mealId)
            ? "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700"
            : "border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100"
        }`}
      >
        {cumplida(mealId) ? "Hecha ✓" : "Marcar hecha"}
      </button>
      {!libres[mealId] && (
        <button
          onClick={() => setPidiendoLibre(mealId)}
          className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-50"
          title={`Marcar ${nombre.toLowerCase()} como comida libre`}
        >
          Libre
        </button>
      )}
    </>
  );

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
      <div className="screen-only space-y-5 pb-24 sm:pb-0">
        <div className="flex flex-wrap items-end justify-between gap-3 no-print">
          <div>
            <Link
              to={`/clientes/${client.id}`}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ← Volver al plan
            </Link>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-brand-900">
              Hola, {client.nombre.split(" ")[0]}
            </h1>
            <p className="text-sm text-slate-500">
              {fechaLegible(fecha)} · Fase {plan.fase} —{" "}
              {FASE_POR_NUMERO[plan.fase].titulo.toLowerCase()}
            </p>
          </div>
          <div className="flex gap-2">
            {plan.fase === 3 && (
              <Button
                variant="outline"
                onClick={() => setInteractivo((v) => !v)}
              >
                {interactivo ? "Ver como documento" : "Marcar lo que como"}
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
            <p className="mt-1 text-sm leading-snug text-brand-900">
              {plan.envio.mensaje}
            </p>
          </div>
        )}

        {/*
          TRES PESTAÑAS
          ==========================================================
          «Hoy» es la app: lo que se abre y lo que se usa. Las otras dos se
          miran de vez en cuando, así que van al lado y no encima.
        */}
        {/*
          En pantalla ancha van arriba, junto al título, que es donde el ojo
          las busca.
        */}
        <div className="hidden gap-1 border-b border-slate-200 no-print sm:flex">
          {PESTANAS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition ${
                tab === id
                  ? "border-brand-600 text-brand-800"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "resumen" && (
          <ResumenTab
            client={client}
            dayTypes={plan.dayTypes}
            registros={mios}
            mediciones={mediciones}
            fecha={fecha}
          />
        )}

        {tab === "recursos" && <RecursosTab recursos={susRecursos} />}

        {tab === "hoy" && (
          <div className="space-y-5">
            {/*
              EL RETO, LO PRIMERO
              ==========================================================
              Quien está en un reto lo está viviendo como un reto: el día en el
              que va es la mitad de la motivación. Va arriba del todo y en una
              línea, sin robarle sitio a la comida.
            */}
            {reto && estadoDelReto(reto, fecha) !== "terminado" && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-brand-300 bg-brand-600 px-4 py-2.5 no-print">
                <span className="text-sm font-semibold text-white">
                  {reto.nombre}
                </span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
                  {textoDelDia(reto, fecha)}
                </span>
                {reto.descripcion && (
                  <span className="min-w-0 flex-1 truncate text-xs text-white/80">
                    {reto.descripcion}
                  </span>
                )}
              </div>
            )}

            {/*
              La cita va arriba y en una línea: es lo único de la app que pasa
              fuera de la app, y enterarse el día después no sirve de nada.
            */}
            {client.cita && !citaPasada(client.cita) && (
              <p className="rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm text-brand-900 no-print">
                <span className="font-medium">Próxima cita:</span>{" "}
                {citaLegible(client.cita)}
                <span className="text-slate-500">
                  {" · "}
                  {LABEL_MODO_CITA[client.cita.modo]}
                  {client.cita.donde ? ` · ${client.cita.donde}` : ""}
                </span>
              </p>
            )}

            <MetasDiarias
              metas={metas}
              hechas={registro?.metas ?? []}
              onAlternar={alternarMeta}
            />

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
                          ? "border-brand-500 bg-brand-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
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
                      Si lo de esta mañana ya te lo has comido, consérvalo. Si
                      te habías equivocado de día, empieza de cero para que las
                      cuentas salgan bien.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          guardar({
                            dayTypeId: cambioPendiente,
                            ...vaciarLoMarcado(),
                          });
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
                      <Button
                        variant="outline"
                        onClick={() => setCambioPendiente(null)}
                      >
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
            {plan.fase === 3 && (
              <PresupuestoDia dayType={dayType} seleccion={porGrupo} />
            )}

            {/* Las comidas del día, que se van llenando */}
            {plan.fase !== 3 && (
              <DayProgressBar
                dayType={dayType}
                porciones={porciones}
                cumplidas={registro?.cumplidas ?? []}
                libres={libres}
                onIr={(mealId) =>
                  document
                    .getElementById(`comida-${mealId}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
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
                P {fmt(balance.total.proteina, 0)} · HC{" "}
                {fmt(balance.total.hc, 0)} · G {fmt(balance.total.grasa, 0)} g
              </span>
              <span className="text-slate-500">
                {comidas.filter((m) => cumplida(m.id)).length}/{comidas.length}{" "}
                comidas hechas
              </span>
              {Math.abs(balance.kcalDiferencia) > 20 && (
                <span
                  className={
                    balance.kcalDiferencia > 0
                      ? "text-amber-700"
                      : "text-slate-500"
                  }
                >
                  {balance.kcalDiferencia > 0 ? "+" : "−"}
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
                  const opciones = recetasDeComida(
                    dayType.recetasAsignadas,
                    m.id,
                  )
                    .map((rid) => recipes.find((r) => r.id === rid))
                    .filter(Boolean) as typeof recipes;
                  if (!opciones.length) return null;

                  const elegida =
                    registro?.recetaElegida?.[m.id] ?? opciones[0].id;
                  const receta =
                    opciones.find((r) => r.id === elegida) ?? opciones[0];
                  const hecha = cumplida(m.id);

                  return (
                    <div
                      key={m.id}
                      id={`comida-${m.id}`}
                      className="scroll-mt-20"
                    >
                      <MealCard
                        meal={m}
                        receta={receta}
                        opciones={opciones}
                        hecha={hecha}
                        onElegir={(id) =>
                          guardar({
                            recetaElegida: {
                              ...(registro?.recetaElegida ?? {}),
                              [m.id]: id,
                            },
                          })
                        }
                        onAlternarHecha={() => alternarCumplida(m.id)}
                      >
                        <ScaledRecipeView
                          receta={receta}
                          requeridos={dayType.grid[m.id] ?? {}}
                          foods={foods}
                          ajustes={ajustesDeReceta(dayType, m.id, receta.id)}
                          acompanamientos={acompanamientosDeReceta(
                            dayType,
                            m.id,
                            receta.id,
                          )}
                          sinCabecera
                          equivalentes={registro?.sustituciones?.[m.id] ?? {}}
                          onEquivalente={(ingId, foodId) => {
                            const porComida = {
                              ...(registro?.sustituciones?.[m.id] ?? {}),
                            };
                            if (foodId) porComida[ingId] = foodId;
                            else delete porComida[ingId];
                            guardar({
                              sustituciones: {
                                ...(registro?.sustituciones ?? {}),
                                [m.id]: porComida,
                              },
                            });
                          }}
                        />
                      </MealCard>
                      {extrasDe(m.id, m.nombre)}
                      {libreDe(m.id, m.nombre)}
                    </div>
                  );
                })}
                {!comidas.some(
                  (m) => recetasDeComida(dayType.recetasAsignadas, m.id).length,
                ) && (
                  <EmptyState title="Aún no hay recetas asignadas">
                    Tu nutricionista todavía no ha elegido las recetas de este
                    día.
                  </EmptyState>
                )}
              </div>
            )}

            {/* ── FASE 2 ─────────────────────────────── */}
            {plan.fase === 2 && (
              <div className="space-y-4">
                {comidas.map((m) => (
                  <div
                    key={m.id}
                    id={`comida-${m.id}`}
                    className="scroll-mt-20"
                  >
                    <ScaledOptionsBoard
                      dayType={dayType}
                      meal={m}
                      foods={foods}
                      porciones={porciones}
                      onElegir={(o) => elegirOpcionComida(m.id, o)}
                      acciones={accionesDe(m.id, m.nombre)}
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
                    {extrasDe(m.id, m.nombre)}
                    {libreDe(m.id, m.nombre)}
                  </div>
                ))}
              </div>
            )}

            {/* ── FASE 3 ─────────────────────────────── */}
            {plan.fase === 3 &&
              (interactivo ? (
                <div className="space-y-4">
                  {comidas.map((m) => (
                    <div
                      key={m.id}
                      id={`comida-${m.id}`}
                      className="scroll-mt-20"
                    >
                      <FoodPortionPicker
                        dayType={dayType}
                        meal={m}
                        foods={foods}
                        porciones={porciones}
                        onMarcar={marcarPorcion}
                        acciones={accionesDe(m.id, m.nombre)}
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
                      {extrasDe(m.id, m.nombre)}
                      {libreDe(m.id, m.nombre)}
                    </div>
                  ))}

                  {/*
                Para lo que no está en su despensa: la granola del armario, un
                bote con etiqueta. Va al final, cerca del resumen, porque es
                una consulta puntual y no parte del día.
              */}
                  <CalculadoraPorciones
                    comidas={comidas.map((m) => ({
                      id: m.id,
                      nombre: m.nombre,
                    }))}
                    onAnadir={(alimento, mealId) =>
                      guardar({
                        alimentosPropios: [
                          ...(registro?.alimentosPropios ?? []),
                          alimento,
                        ],
                        porciones: fijarAlimento(
                          porciones,
                          mealId,
                          alimento.id,
                          1,
                        ),
                      })
                    }
                  />

                  {/* Cómo va cada comida, ya al final: informa, no manda. */}
                  <div>
                    <h2 className="mb-2 text-sm font-bold tracking-widest text-brand-800 uppercase">
                      Completado
                    </h2>
                    <DayProgressBar
                      dayType={dayType}
                      porciones={porciones}
                      cumplidas={registro?.cumplidas ?? []}
                      libres={libres}
                      onIr={(mealId) =>
                        document
                          .getElementById(`comida-${mealId}`)
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          })
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
        )}
      </div>

      {/*
        Y EN EL MÓVIL, ABAJO
        ==============================================================
        La app se usa de pie en la cocina, con una mano y el móvil en la otra.
        Arriba del todo no llega el pulgar sin recolocar el teléfono, y encima
        la barra se va con el scroll justo cuando hace falta.

        Abajo está siempre, se alcanza sin mirar y es donde la gente ya la
        busca por costumbre de otras aplicaciones. En pantalla ancha no: ahí el
        ojo va arriba y una barra pegada al borde inferior queda perdida.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] no-print sm:hidden">
        {/*
          Pastilla flotante, no una barra pegada al borde: separada del fondo
          se lee como algo que está por encima del contenido, y el contenido se
          ve pasar por debajo en vez de quedar cortado en seco.
        */}
        <nav className="flex w-full max-w-sm items-stretch gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-lg shadow-slate-900/10 backdrop-blur">
          {PESTANAS.map(([id, label, icono]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-current={tab === id}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition ${
                tab === id
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icono d={icono} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Documento que sale al imprimir / exportar a PDF */}
      <PlanDocument
        client={client}
        plan={plan}
        recipes={recipes}
        foods={foods}
      />
    </>
  );
}
