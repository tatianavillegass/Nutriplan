import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { DURACIONES, type RecetaDeReto, type Reto } from "../types/reto";
import type { MealSlot } from "../types/food";
import { fotoDelPlan, type Plan } from "../types/plan";
import {
  diaDelReto,
  diasQueQuedan,
  estadoDelReto,
  fechaFinal,
  primerDiaDeSemana,
  proximaApertura,
  recetasAbiertas,
  semanaDeDia,
  textoDelDia,
} from "../utils/retos";
import { recursosVisibles } from "../types/recursos";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
} from "../components/common/ui";
import { uid, nowIso } from "../utils/storage";
import { avisosDeSolicitud, type Solicitud } from "../types/solicitud";
import { borrarSolicitud, leerSolicitudes } from "../utils/solicitudes";
import { EntrenosDelReto } from "../components/retos/EntrenosDelReto";
import { ParticipantesDelReto } from "../components/retos/ParticipantesDelReto";
import { SeguimientoDelReto } from "../components/retos/SeguimientoDelReto";
import { clienteDeSolicitud, comidasDelPlan } from "../utils/altaDeSolicitud";

const hoyIso = () => new Date().toISOString().slice(0, 10);

/** Los momentos del día, en el orden en que se comen. */
const SLOTS: MealSlot[] = [
  "desayuno",
  "almuerzo",
  "comida",
  "merienda",
  "cena",
  "extra",
];

const LABEL_SLOT: Record<MealSlot, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  comida: "Comida",
  merienda: "Merienda",
  cena: "Cena",
  extra: "Extra",
};

const TONO_ESTADO: Record<string, string> = {
  proximo: "border-amber-200 bg-amber-50 text-amber-800",
  "en-marcha": "border-emerald-200 bg-emerald-50 text-emerald-800",
  terminado: "border-slate-200 bg-slate-50 text-slate-500",
};

const nuevoReto = (): Reto => ({
  id: uid("rt_"),
  nombre: "",
  descripcion: "",
  fechaInicio: hoyIso(),
  dias: 30,
  participantes: [],
  recursos: [],
  recetas: [],
  createdAt: nowIso(),
});

/**
 * RETOS
 *
 * Un grupo que empieza el mismo día y hace el mismo camino. Lo que lo separa
 * del trabajo de siempre es el calendario: ahí cada clienta va a su ritmo,
 * aquí la fecha es de todas.
 *
 * Se comparten el banco de recetas y los recursos; las porciones no. Cada
 * participante tiene su plan con sus intercambios y las mismas recetas se le
 * escalan a sus números — por eso veinte cuestan casi lo mismo de montar
 * que una.
 */
export function RetosPage() {
  const retos = useAppStore((s) => s.retos);
  const clients = useAppStore((s) => s.clients);
  const recetas = useAppStore((s) => s.recipes);
  const recursos = useAppStore((s) => s.recursos);
  const plans = useAppStore((s) => s.plans);
  const registros = useAppStore((s) => s.registros);
  const mediciones = useAppStore((s) => s.mediciones);
  const upsertReto = useAppStore((s) => s.upsertReto);
  const borrarReto = useAppStore((s) => s.borrarReto);
  const addClient = useAppStore((s) => s.addClient);
  const ensurePlan = useAppStore((s) => s.ensurePlan);
  const updateDayType = useAppStore((s) => s.updateDayType);
  const updatePlan = useAppStore((s) => s.updatePlan);
  const addMedicion = useAppStore((s) => s.addMedicion);

  /**
   * LAS SOLICITUDES DEL ENLACE PÚBLICO
   *
   * Viven en el servidor, no en el estado de la app: las escribe gente sin
   * cuenta. Se leen al abrir la pantalla y se vuelven a leer al dar de alta.
   */
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const refrescarSolicitudes = () =>
    void leerSolicitudes().then(setSolicitudes);
  useEffect(refrescarSolicitudes, []);

  /**
   * DE SOLICITUD A PARTICIPANTE
   *
   * Se crea la clienta con sus datos, se le monta el plan con las comidas que
   * dijo que hace, y se la apunta al reto. A partir de ahí es una clienta más:
   * entra con su correo y tiene su seguimiento.
   */
  const darDeAlta = async (reto: Reto, s: Solicitud) => {
    const cliente = addClient(clienteDeSolicitud(s));
    const plan = ensurePlan(cliente.id);
    const dia = plan.dayTypes[0];
    if (dia) {
      updateDayType(plan.id, dia.id, { meals: comidasDelPlan(s.comidasDia) });
    }
    /**
     * Lo que se midió mientras esperaba no se puede perder al borrar la
     * solicitud: pasa a ser su primera medición, que es el punto de partida
     * con el que se compara todo lo demás.
     */
    if (s.preparacion?.cintura || s.preparacion?.cadera || s.peso) {
      addMedicion({
        clientId: cliente.id,
        fecha: hoy,
        peso: s.peso,
        talla: s.altura,
        pliegues: {},
        diametros: {},
        perimetros: {
          cintura: s.preparacion?.cintura,
          cadera: s.preparacion?.cadera,
        },
        notas: s.preparacion?.foto
          ? "Se midió ella al apuntarse. Subió foto del primer día."
          : "Se midió ella al apuntarse.",
      });
    }

    editar(reto, { participantes: [...reto.participantes, cliente.id] });
    await borrarSolicitud(s.id);
    refrescarSolicitudes();
  };

  const hoy = hoyIso();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [creando, setCreando] = useState<Reto | null>(null);

  const ordenados = useMemo(
    () => [...retos].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)),
    [retos],
  );

  const editar = (reto: Reto, patch: Partial<Reto>) =>
    upsertReto({ ...reto, ...patch });

  /**
   * Publicar el plan de una participante. Es lo mismo que hace el botón de su
   * ficha: se guarda la foto de lo que se manda, que es lo único que verá ella.
   */
  const enviarPlan = (plan: Plan) =>
    updatePlan(plan.id, {
      publicado: fotoDelPlan(plan),
      envio: { fecha: new Date().toISOString() },
    });

  const alternarParticipante = (reto: Reto, clientId: string) =>
    editar(reto, {
      participantes: reto.participantes.includes(clientId)
        ? reto.participantes.filter((x) => x !== clientId)
        : [...reto.participantes, clientId],
    });

  const alternarRecurso = (reto: Reto, recursoId: string) =>
    editar(reto, {
      recursos: reto.recursos.includes(recursoId)
        ? reto.recursos.filter((x) => x !== recursoId)
        : [...reto.recursos, recursoId],
    });

  const anadirReceta = (
    reto: Reto,
    recetaId: string,
    slot: MealSlot,
    desdeDia: number,
  ) => {
    const ya = reto.recetas.some(
      (r) => r.recetaId === recetaId && r.slot === slot,
    );
    if (ya) return;
    editar(reto, { recetas: [...reto.recetas, { recetaId, slot, desdeDia }] });
  };

  const quitarReceta = (reto: Reto, r: RecetaDeReto) =>
    editar(reto, {
      recetas: reto.recetas.filter(
        (x) => !(x.recetaId === r.recetaId && x.slot === r.slot),
      ),
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-900">
            Retos
          </h1>
          <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
            Un grupo que empieza el mismo día. Comparten las recetas y los
            recursos; las porciones de cada una salen de su propio plan, como
            siempre.
          </p>
        </div>
        {!creando && (
          <Button onClick={() => setCreando(nuevoReto())}>+ Nuevo reto</Button>
        )}
      </div>

      {creando && (
        <Card title="Nuevo reto">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" className="sm:col-span-2">
              <Input
                value={creando.nombre}
                onChange={(e) =>
                  setCreando({ ...creando, nombre: e.target.value })
                }
                placeholder="UPGRADE 1.0"
                autoFocus
              />
            </Field>
            <Field label="Empieza el">
              <Input
                type="date"
                value={creando.fechaInicio}
                onChange={(e) =>
                  setCreando({ ...creando, fechaInicio: e.target.value })
                }
              />
            </Field>
            <Field label="Duración">
              <Select
                value={String(creando.dias)}
                onChange={(e) =>
                  setCreando({ ...creando, dias: Number(e.target.value) })
                }
              >
                {DURACIONES.map((d) => (
                  <option key={d} value={d}>
                    {d} días
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="De qué va (opcional)" className="sm:col-span-2">
              <Input
                value={creando.descripcion ?? ""}
                onChange={(e) =>
                  setCreando({ ...creando, descripcion: e.target.value })
                }
                placeholder="30 días para ordenar la comida y coger el hábito"
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setCreando(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!creando.nombre.trim() || !creando.fechaInicio}
              onClick={() => {
                upsertReto({ ...creando, nombre: creando.nombre.trim() });
                setAbierto(creando.id);
                setCreando(null);
              }}
            >
              Crear reto
            </Button>
          </div>
        </Card>
      )}

      {!ordenados.length && !creando ? (
        <EmptyState title="Todavía no hay retos">
          Un reto es un grupo que empieza el mismo día y comparte plan, recetas
          y recursos. Las participantes son clientas como las demás: entran con
          su correo y tienen sus porciones.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {ordenados.map((reto) => {
            const estado = estadoDelReto(reto, hoy);
            const desplegado = abierto === reto.id;
            const abiertas = recetasAbiertas(reto, hoy);
            const proxima = proximaApertura(reto, hoy);

            return (
              <div
                key={reto.id}
                className="rounded-xl border border-slate-200 bg-white"
              >
                <button
                  onClick={() => setAbierto(desplegado ? null : reto.id)}
                  aria-expanded={desplegado}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-brand-900">
                      {reto.nombre}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {reto.fechaInicio} → {fechaFinal(reto)} ·{" "}
                      {reto.participantes.length}{" "}
                      {reto.participantes.length === 1
                        ? "participante"
                        : "participantes"}{" "}
                      · {abiertas.length} de {reto.recetas.length} recetas
                      abiertas
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONO_ESTADO[estado]}`}
                  >
                    {textoDelDia(reto, hoy)}
                  </span>
                  <span aria-hidden className="shrink-0 text-slate-300">
                    {desplegado ? "⌃" : "⌄"}
                  </span>
                </button>

                {desplegado && (
                  <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                    {estado === "en-marcha" && (
                      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                        Día {diaDelReto(reto, hoy)} de {reto.dias} · quedan{" "}
                        {diasQueQuedan(reto, hoy)}
                        {proxima
                          ? `. En la semana ${semanaDeDia(proxima.dia)} se abren ${proxima.cuantas} recetas más.`
                          : "."}
                      </p>
                    )}

                    {/* ── Datos ─────────────────────────────── */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Empieza el">
                        <Input
                          type="date"
                          value={reto.fechaInicio}
                          onChange={(e) =>
                            editar(reto, { fechaInicio: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Duración">
                        <Select
                          value={String(reto.dias)}
                          onChange={(e) =>
                            editar(reto, { dias: Number(e.target.value) })
                          }
                        >
                          {DURACIONES.map((d) => (
                            <option key={d} value={d}>
                              {d} días
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Nombre">
                        <Input
                          value={reto.nombre}
                          onChange={(e) =>
                            editar(reto, { nombre: e.target.value })
                          }
                        />
                      </Field>
                    </div>

                    {/* ── Solicitudes ───────────────────────── */}
                    {(() => {
                      const suyas = solicitudes.filter(
                        (x) => x.retoId === reto.id,
                      );
                      if (!suyas.length) return null;
                      return (
                        <div>
                          <h3 className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
                            Solicitudes
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 normal-case">
                              {suyas.length} sin dar de alta
                            </span>
                          </h3>
                          <p className="mb-2 text-[11px] leading-snug text-slate-500">
                            Llegan del enlace público, ya pagadas. Mira los
                            avisos antes de darlas de alta: es para eso que este
                            paso lo das tú.
                          </p>

                          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                            {suyas.map((s) => {
                              const avisos = avisosDeSolicitud(s);
                              const para = avisos.some(
                                (a) => a.gravedad === "para",
                              );
                              return (
                                <li
                                  key={s.id}
                                  className="flex flex-wrap items-start gap-3 px-3 py-2.5"
                                >
                                  <div className="min-w-48 flex-1">
                                    <p className="text-sm font-medium text-slate-800">
                                      {s.nombre}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                      {s.email} · {s.creada.slice(0, 10)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-600">
                                      {s.peso} kg · {s.altura} cm ·{" "}
                                      {s.comidasDia} comidas
                                      {s.cintura
                                        ? ` · cintura ${s.cintura} cm`
                                        : ""}
                                    </p>
                                    {avisos.map((a, i) => (
                                      <p
                                        key={i}
                                        className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug ${
                                          a.gravedad === "para"
                                            ? "bg-rose-50 text-rose-800"
                                            : "bg-amber-50 text-amber-800"
                                        }`}
                                      >
                                        {a.texto}
                                      </p>
                                    ))}
                                  </div>
                                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                                    <Button
                                      variant={para ? "outline" : "primary"}
                                      onClick={() => void darDeAlta(reto, s)}
                                    >
                                      {para
                                        ? "Dar de alta igualmente"
                                        : "Dar de alta"}
                                    </Button>
                                    <button
                                      onClick={() => {
                                        void borrarSolicitud(s.id).then(
                                          refrescarSolicitudes,
                                        );
                                      }}
                                      className="rounded px-2 py-1 text-[11px] text-slate-400 hover:text-rose-600"
                                    >
                                      Descartar
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* ── El enlace para compartir ───────────── */}
                    <div>
                      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
                        Enlace para apuntarse
                      </h3>
                      <p className="mb-2 text-[11px] leading-snug text-slate-500">
                        Este es el enlace que va en Stripe como página de
                        destino después del pago. Quien llegue aquí ya ha
                        pagado.
                      </p>
                      <code className="block overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        {`${window.location.origin}/#/apuntarse/${reto.id}`}
                      </code>
                    </div>

                    {/* ── Las participantes, una a una ──────── */}
                    <div>
                      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
                        Participantes
                      </h3>
                      <p className="mb-2 text-[11px] leading-snug text-slate-500">
                        Despliega una y verás su gasto, su preparación y en qué
                        estado está su plan. Móntalos según van llegando y
                        publícalos todos el día que empieza el reto.
                      </p>
                      <ParticipantesDelReto
                        reto={reto}
                        hoy={hoy}
                        clients={clients}
                        plans={plans}
                        registros={registros}
                        onEnviarPlan={enviarPlan}
                      />
                    </div>

                    {/* ── Cómo va el grupo ──────────────────── */}
                    <div>
                      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
                        Cómo va el grupo
                      </h3>
                      <SeguimientoDelReto
                        reto={reto}
                        hoy={hoy}
                        clients={clients}
                        plans={plans}
                        registros={registros}
                        mediciones={mediciones}
                      />
                    </div>

                    {/* ── Participantes ─────────────────────── */}
                    <div>
                      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
                        Quién está dentro
                      </h3>
                      <p className="mb-2 text-[11px] leading-snug text-slate-500">
                        Las que llegan por el enlace se apuntan solas al darlas
                        de alta y sólo se ven aquí. Una clienta de consulta
                        puede entrar sin dejar de ser tu clienta: hereda su
                        acceso, sus porciones y su seguimiento.
                      </p>
                      {clients.length ? (
                        <ul className="grid gap-1.5 sm:grid-cols-2">
                          {clients.map((c) => {
                            const dentro = reto.participantes.includes(c.id);
                            return (
                              <li key={c.id}>
                                <label
                                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition ${
                                    dentro
                                      ? "border-brand-300 bg-brand-50"
                                      : "border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={dentro}
                                    onChange={() =>
                                      alternarParticipante(reto, c.id)
                                    }
                                    className="h-4 w-4 shrink-0 accent-brand-600"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm text-slate-800">
                                      {c.nombre}
                                    </span>
                                    {c.email && (
                                      <span className="block truncate text-[11px] text-slate-400">
                                        {c.email}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Da de alta a las personas en «Clientes» y aquí las
                          apuntas al reto.
                        </p>
                      )}
                    </div>

                    {/* ── Recetas ───────────────────────────── */}
                    <div>
                      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
                        Recetas del reto
                      </h3>
                      <p className="mb-2 text-[11px] leading-snug text-slate-500">
                        Con el día en que se abren. El reto se va abriendo, no
                        se entrega entero el primer día: diez recetas de golpe
                        se leen como un PDF y se cierran, tres cada semana se
                        cocinan.
                      </p>

                      <ElegirRecetas
                        recetas={recetas.map((r) => ({
                          id: r.id,
                          nombre: r.nombre,
                          categorias: r.categorias,
                          foto: r.foto_url,
                        }))}
                        puestas={reto.recetas}
                        onAnadir={(recetaId, slot, dia) =>
                          anadirReceta(reto, recetaId, slot, dia)
                        }
                        onQuitar={(r) => quitarReceta(reto, r)}
                      />

                      {reto.recetas.length > 0 && (
                        <ul className="mt-2 divide-y divide-slate-100">
                          {[...reto.recetas]
                            .sort((a, b) => a.desdeDia - b.desdeDia)
                            .map((r) => {
                              const receta = recetas.find(
                                (x) => x.id === r.recetaId,
                              );
                              const abierta =
                                r.desdeDia <=
                                Math.max(1, diaDelReto(reto, hoy));
                              return (
                                <li
                                  key={`${r.recetaId}-${r.slot}`}
                                  className="flex items-center gap-3 py-2"
                                >
                                  <span
                                    className={`tnum w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] ${
                                      abierta &&
                                      estadoDelReto(reto, hoy) === "en-marcha"
                                        ? "bg-emerald-50 text-emerald-800"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    Semana {semanaDeDia(r.desdeDia)}
                                  </span>
                                  <span className="w-24 shrink-0 text-xs text-slate-500">
                                    {LABEL_SLOT[r.slot] ?? r.slot}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                                    {receta?.nombre ?? (
                                      <span className="text-rose-600">
                                        receta borrada
                                      </span>
                                    )}
                                  </span>
                                  <button
                                    onClick={() => quitarReceta(reto, r)}
                                    className="shrink-0 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                                  >
                                    Quitar
                                  </button>
                                </li>
                              );
                            })}
                        </ul>
                      )}
                    </div>

                    {/* ── Entrenos ──────────────────────────── */}
                    <div>
                      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
                        Entrenos del reto
                      </h3>
                      <EntrenosDelReto
                        entrenos={reto.entrenos ?? []}
                        onCambiar={(entrenos) => editar(reto, { entrenos })}
                      />
                    </div>

                    {/* ── Recursos ──────────────────────────── */}
                    <div>
                      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
                        Recursos del reto
                      </h3>
                      {recursosVisibles(recursos).length ? (
                        <ul className="grid gap-1.5 sm:grid-cols-2">
                          {recursosVisibles(recursos).map((r) => {
                            const dado = reto.recursos.includes(r.id);
                            return (
                              <li key={r.id}>
                                <label
                                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition ${
                                    dado
                                      ? "border-brand-300 bg-brand-50"
                                      : "border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={dado}
                                    onChange={() => alternarRecurso(reto, r.id)}
                                    className="h-4 w-4 shrink-0 accent-brand-600"
                                  />
                                  <span className="truncate text-sm text-slate-800">
                                    {r.titulo}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Se escriben en «Recursos» y desde aquí eliges cuáles
                          ven las participantes.
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end border-t border-slate-100 pt-3">
                      <button
                        onClick={() => borrarReto(reto.id)}
                        className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        Borrar el reto
                      </button>
                    </div>
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

/**
 * ELEGIR RECETAS COMO SE ELIGEN AL PAUTAR
 *
 * Se mira la comida, se ven las recetas que valen para esa comida y se toca la
 * que se quiere. Un desplegable con cuarenta nombres obliga a acordarse de cómo
 * se llamaba cada una; una rejilla se reconoce de un vistazo.
 *
 * El día de apertura se pone arriba y se queda puesto: lo normal es abrir tres
 * o cuatro del mismo día seguidas, no una de cada.
 */
function ElegirRecetas({
  recetas,
  puestas,
  onAnadir,
  onQuitar,
}: {
  recetas: {
    id: string;
    nombre: string;
    categorias: MealSlot[];
    foto?: string;
  }[];
  puestas: RecetaDeReto[];
  onAnadir: (recetaId: string, slot: MealSlot, desdeDia: number) => void;
  onQuitar: (r: RecetaDeReto) => void;
}) {
  const [slot, setSlot] = useState<MealSlot>("desayuno");
  /**
   * Se elige la SEMANA, no el día: «la semana 1 tiene cuatro desayunos entre
   * los que elegir» es como se piensa un reto. Por dentro se sigue guardando
   * el día, que es lo que ya sabe calcular todo lo demás.
   */
  const [semana, setSemana] = useState(1);
  const [busca, setBusca] = useState("");

  const deEsaComida = useMemo(() => {
    const texto = busca.trim().toLowerCase();
    return recetas.filter(
      (r) =>
        r.categorias?.includes(slot) &&
        (!texto || r.nombre.toLowerCase().includes(texto)),
    );
  }, [recetas, slot, busca]);

  const puestaEn = (recetaId: string) =>
    puestas.find((p) => p.recetaId === recetaId && p.slot === slot);

  if (!recetas.length) {
    return (
      <p className="text-sm text-slate-500">
        Primero crea recetas en el banco y aquí las repartes por días.
      </p>
    );
  }

  return (
    <div>
      {/* Qué comida se está montando */}
      <div className="flex flex-wrap gap-1.5">
        {SLOTS.map((sl) => {
          const cuantas = puestas.filter((p) => p.slot === sl).length;
          return (
            <button
              key={sl}
              onClick={() => setSlot(sl)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                slot === sl
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
              }`}
            >
              {LABEL_SLOT[sl]}
              {cuantas > 0 && (
                <span
                  className={`tnum ml-1.5 text-[11px] ${slot === sl ? "text-white/70" : "text-slate-400"}`}
                >
                  {cuantas}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Field label="Las que elija ahora se abren en la semana">
          <Input
            type="number"
            min={1}
            value={semana}
            onChange={(e) => setSemana(Math.max(1, Number(e.target.value) || 1))}
            className="w-24"
          />
        </Field>
        <Field label="Buscar" className="min-w-40 flex-1">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nombre de la receta…"
          />
        </Field>
      </div>

      {deEsaComida.length ? (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {deEsaComida.map((r) => {
            const ya = puestaEn(r.id);
            return (
              <li key={r.id}>
                <button
                  onClick={() =>
                    ya ? onQuitar(ya) : onAnadir(r.id, slot, primerDiaDeSemana(semana))
                  }
                  aria-pressed={!!ya}
                  className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition ${
                    ya
                      ? "border-brand-400 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-brand-300"
                  }`}
                >
                  {r.foto ? (
                    <img
                      src={r.foto}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400"
                    >
                      sin foto
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {r.nombre}
                    </span>
                    <span
                      className={`tnum text-[11px] ${ya ? "text-brand-700" : "text-slate-400"}`}
                    >
                      {ya
                        ? `Semana ${semanaDeDia(ya.desdeDia)} · toca para quitar`
                        : "Toca para añadir"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Ninguna receta del banco está marcada para{" "}
          {LABEL_SLOT[slot].toLowerCase()}. Se marca en el banco de recetas, en
          «tipo de comida».
        </p>
      )}
    </div>
  );
}
