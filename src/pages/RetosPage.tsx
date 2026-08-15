import { useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { DURACIONES, type RecetaDeReto, type Reto } from "../types/reto";
import type { MealSlot } from "../types/food";
import {
  diaDelReto,
  diasQueQuedan,
  estadoDelReto,
  fechaFinal,
  proximaApertura,
  recetasAbiertas,
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
  const upsertReto = useAppStore((s) => s.upsertReto);
  const borrarReto = useAppStore((s) => s.borrarReto);

  const hoy = hoyIso();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [creando, setCreando] = useState<Reto | null>(null);

  const ordenados = useMemo(
    () => [...retos].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)),
    [retos],
  );

  const editar = (reto: Reto, patch: Partial<Reto>) =>
    upsertReto({ ...reto, ...patch });

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
                          ? `. El día ${proxima.dia} se abren ${proxima.cuantas} recetas más.`
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

                    {/* ── Participantes ─────────────────────── */}
                    <div>
                      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
                        Participantes
                      </h3>
                      <p className="mb-2 text-[11px] leading-snug text-slate-500">
                        Se apuntan desde tus clientas. Una clienta de siempre
                        puede estar en el reto sin dejar de tener su plan:
                        hereda su acceso, sus porciones y su seguimiento.
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

                      <AnadirReceta
                        recetas={recetas.map((r) => ({
                          id: r.id,
                          nombre: r.nombre,
                        }))}
                        onAnadir={(recetaId, slot, dia) =>
                          anadirReceta(reto, recetaId, slot, dia)
                        }
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
                                    Día {r.desdeDia}
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

/** Añadir una receta al reto: cuál, para qué comida y desde qué día. */
function AnadirReceta({
  recetas,
  onAnadir,
}: {
  recetas: { id: string; nombre: string }[];
  onAnadir: (recetaId: string, slot: MealSlot, desdeDia: number) => void;
}) {
  const [recetaId, setRecetaId] = useState("");
  const [slot, setSlot] = useState<MealSlot>("desayuno");
  const [dia, setDia] = useState(1);

  if (!recetas.length) {
    return (
      <p className="text-sm text-slate-500">
        Primero crea recetas en el banco y aquí las repartes por días.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Receta" className="min-w-48 flex-1">
        <Select value={recetaId} onChange={(e) => setRecetaId(e.target.value)}>
          <option value="">Elige una…</option>
          {recetas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Comida">
        <Select
          value={slot}
          onChange={(e) => setSlot(e.target.value as MealSlot)}
        >
          {SLOTS.map((s) => (
            <option key={s} value={s}>
              {LABEL_SLOT[s] ?? s}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Desde el día">
        <Input
          type="number"
          min={1}
          value={dia}
          onChange={(e) => setDia(Math.max(1, Number(e.target.value) || 1))}
          className="w-24"
        />
      </Field>
      <Button
        disabled={!recetaId}
        onClick={() => {
          onAnadir(recetaId, slot, dia);
          setRecetaId("");
        }}
      >
        Añadir
      </Button>
    </div>
  );
}
