import { useState } from "react";
import type {
  Cita,
  Client,
  ModoCita,
  Pago,
  Periodicidad,
} from "../../types/client";
import {
  LABEL_MODO_CITA,
  LABEL_PERIODICIDAD,
  MODOS_CITA,
  PERIODICIDADES,
} from "../../types/client";
import {
  citaComoIcs,
  citaLegible,
  citaPasada,
  icsComoEnlace,
  resumenDePagos,
} from "../../utils/agenda";
import { Button, Card, Field, Input, Select, fmt } from "../common/ui";
import { uid } from "../../utils/storage";

interface Props {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
}

const hoyIso = () => new Date().toISOString().slice(0, 10);

/**
 * LA PRÓXIMA CITA
 *
 * Se guarda una sola: la que viene. El historial de consultas ya está en las
 * mediciones y en los planes, y llevar dos listas de lo mismo garantiza que
 * una de las dos se quede vieja.
 *
 * El botón de calendario descarga un archivo .ics, que entienden Google, Apple
 * y Outlook por igual. Conectar la cuenta de Google pediría permisos y claves
 * para ahorrar dos clics: no compensa con cuatro citas al mes.
 */
export function CitaPanel({ client, onChange }: Props) {
  const cita = client.cita;
  const [editando, setEditando] = useState(!cita);
  const [borrador, setBorrador] = useState<Cita>(
    cita ?? {
      fecha: hoyIso(),
      hora: "17:00",
      duracionMin: 60,
      modo: "videollamada",
    },
  );

  const editar = (patch: Partial<Cita>) =>
    setBorrador((b) => ({ ...b, ...patch }));

  const guardar = () => {
    onChange({
      cita: { ...borrador, donde: borrador.donde?.trim() || undefined },
    });
    setEditando(false);
  };

  const titulo = `Consulta de nutrición · ${client.nombre.split(" ")[0]}`;

  if (cita && !editando) {
    const pasada = citaPasada(cita);
    return (
      <Card title="Próxima cita">
        <div
          className={`rounded-xl border px-4 py-3 ${
            pasada
              ? "border-amber-200 bg-amber-50"
              : "border-brand-200 bg-brand-50/60"
          }`}
        >
          <p className="text-sm font-semibold text-brand-900">
            {citaLegible(cita)}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {LABEL_MODO_CITA[cita.modo]}
            {cita.donde && ` · ${cita.donde}`}
          </p>
          {cita.nota && (
            <p className="mt-1 text-xs text-slate-600">{cita.nota}</p>
          )}
          {pasada && (
            <p className="mt-1 text-xs font-medium text-amber-800">
              Esta cita ya pasó. Pon la siguiente para que le siga apareciendo.
            </p>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={icsComoEnlace(citaComoIcs(cita, titulo))}
            download={`cita-${cita.fecha}.ics`}
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-800"
          >
            Añadir a mi calendario
          </a>
          <Button variant="outline" onClick={() => setEditando(true)}>
            Cambiar
          </Button>
          <Button
            variant="outline"
            onClick={() => onChange({ cita: undefined })}
          >
            Quitar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Próxima cita" subtitle="La ve ella también, en su pantalla">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Día">
          <Input
            type="date"
            value={borrador.fecha}
            onChange={(e) => editar({ fecha: e.target.value })}
          />
        </Field>
        <Field label="Hora">
          <Input
            type="time"
            value={borrador.hora ?? ""}
            onChange={(e) => editar({ hora: e.target.value })}
          />
        </Field>
        <Field label="Cómo">
          <Select
            value={borrador.modo}
            onChange={(e) => editar({ modo: e.target.value as ModoCita })}
          >
            {MODOS_CITA.map((m) => (
              <option key={m} value={m}>
                {LABEL_MODO_CITA[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duración (min)">
          <Input
            type="number"
            min={15}
            step={15}
            value={borrador.duracionMin ?? 60}
            onChange={(e) =>
              editar({ duracionMin: Number(e.target.value) || 60 })
            }
          />
        </Field>
        <Field
          label={borrador.modo === "consulta" ? "Dirección" : "Enlace"}
          className="sm:col-span-2"
        >
          <Input
            value={borrador.donde ?? ""}
            onChange={(e) => editar({ donde: e.target.value })}
            placeholder={
              borrador.modo === "consulta"
                ? "Calle, número, planta…"
                : "https://meet.google.com/…"
            }
          />
        </Field>
        <Field label="Nota (opcional)" className="sm:col-span-2">
          <Input
            value={borrador.nota ?? ""}
            onChange={(e) => editar({ nota: e.target.value })}
            placeholder="Traer la analítica"
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {cita && (
          <Button variant="outline" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
        )}
        <Button onClick={guardar} disabled={!borrador.fecha}>
          Guardar cita
        </Button>
      </div>
    </Card>
  );
}

/**
 * TARIFA Y PAGOS
 *
 * Sólo lo ve la nutricionista. Se suma lo cobrado y se enseña el último pago,
 * y nada más: la app no sabe cuántos periodos han pasado ni qué se pactó de
 * palabra, así que un «debe X» en rojo sería un número inventado.
 */
export function PagosPanel({ client, onChange }: Props) {
  const pagos = client.pagos ?? [];
  const tarifa = client.tarifa;
  const resumen = resumenDePagos(pagos, tarifa);

  const [nuevo, setNuevo] = useState<Pago>({
    id: "",
    fecha: hoyIso(),
    importe: tarifa?.importe ?? 0,
    concepto: "",
  });

  const anadir = () => {
    if (!nuevo.importe) return;
    onChange({
      pagos: [
        ...pagos,
        {
          ...nuevo,
          id: uid("pg_"),
          concepto: nuevo.concepto?.trim() || undefined,
        },
      ],
    });
    setNuevo({
      id: "",
      fecha: hoyIso(),
      importe: tarifa?.importe ?? 0,
      concepto: "",
    });
  };

  const editarTarifa = (patch: Partial<NonNullable<Client["tarifa"]>>) =>
    onChange({
      tarifa: {
        nombre: tarifa?.nombre ?? "",
        importe: tarifa?.importe ?? 0,
        periodicidad: tarifa?.periodicidad ?? "mensual",
        moneda: tarifa?.moneda,
        ...patch,
      },
    });

  const dinero = (n: number) => `${fmt(n, n % 1 ? 2 : 0)} ${resumen.moneda}`;

  return (
    <>
      <Card
        title="Tarifa contratada"
        subtitle="Sólo lo ves tú: no aparece en su pantalla"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qué tiene contratado" className="sm:col-span-2">
            <Input
              value={tarifa?.nombre ?? ""}
              onChange={(e) => editarTarifa({ nombre: e.target.value })}
              placeholder="Seguimiento mensual"
            />
          </Field>
          <Field label="Importe">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={tarifa?.importe ?? ""}
              onChange={(e) =>
                editarTarifa({ importe: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Cada cuánto">
            <Select
              value={tarifa?.periodicidad ?? "mensual"}
              onChange={(e) =>
                editarTarifa({ periodicidad: e.target.value as Periodicidad })
              }
            >
              {PERIODICIDADES.map((p) => (
                <option key={p} value={p}>
                  {LABEL_PERIODICIDAD[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Moneda">
            <Input
              value={tarifa?.moneda ?? ""}
              onChange={(e) => editarTarifa({ moneda: e.target.value })}
              placeholder="€"
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Pagos"
        subtitle={
          pagos.length
            ? `${pagos.length} ${pagos.length === 1 ? "apunte" : "apuntes"} · ${dinero(resumen.total)} en total`
            : "Se apuntan a mano, según los vayas cobrando"
        }
      >
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Fecha">
            <Input
              type="date"
              value={nuevo.fecha}
              onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })}
            />
          </Field>
          <Field label="Importe">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={nuevo.importe || ""}
              onChange={(e) =>
                setNuevo({ ...nuevo, importe: Number(e.target.value) || 0 })
              }
              className="w-28"
            />
          </Field>
          <Field label="Concepto" className="min-w-40 flex-1">
            <Input
              value={nuevo.concepto ?? ""}
              onChange={(e) => setNuevo({ ...nuevo, concepto: e.target.value })}
              placeholder="Agosto"
            />
          </Field>
          <Button onClick={anadir} disabled={!nuevo.importe}>
            Apuntar pago
          </Button>
        </div>

        {pagos.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100">
            {[...pagos]
              .sort((a, b) => b.fecha.localeCompare(a.fecha))
              .map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <span className="tnum w-24 shrink-0 text-xs text-slate-500">
                    {p.fecha}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    {p.concepto ?? "—"}
                  </span>
                  <span className="tnum shrink-0 text-sm font-medium text-brand-900">
                    {dinero(p.importe)}
                  </span>
                  <button
                    onClick={() =>
                      onChange({ pagos: pagos.filter((x) => x.id !== p.id) })
                    }
                    className="shrink-0 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    Borrar
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </>
  );
}
