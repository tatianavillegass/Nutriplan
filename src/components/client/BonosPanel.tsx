import { useState } from "react";
import type { Bono, Client, LineaDeBono, Pago, Sesion } from "../../types/client";
import { uid } from "../../utils/storage";
import {
  comoVaElBono,
  type ComoVaElBono,
  type Estado,
} from "../../utils/bonos";
import { Badge, Button, Card, Field, Input, fmt } from "../common/ui";

/**
 * LOS BONOS DE UNA CLIENTA
 *
 * «Contrató el trimestral de 270, ha pagado 180, le faltan 90, y lleva 2 de 3
 * consultas.» Es lo que hacía falta para saber a quién llamar para renovar, y
 * lo que ni la tarifa ni los pagos sueltos podían decir.
 *
 * Sólo lo ve la nutricionista. Enseñarle a la clienta «te queda 1 consulta» en
 * la misma app en la que come mete presión donde no toca.
 */

const hoyIso = () => new Date().toISOString().slice(0, 10);

const TONO: Record<Estado, { texto: string; tono: "neutral" | "brand" | "warn" }> = {
  "al-dia": { texto: "En marcha", tono: "brand" },
  "por-terminar": { texto: "Se le acaba", tono: "warn" },
  terminado: { texto: "Terminado", tono: "warn" },
  vencido: { texto: "Vencido", tono: "warn" },
  cerrado: { texto: "Cerrado", tono: "neutral" },
};

interface Props {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
}

export function BonosPanel({ client, onChange }: Props) {
  const bonos = client.bonos ?? [];
  const [creando, setCreando] = useState(false);

  const guardarBono = (b: Bono) => {
    onChange({ bonos: [...bonos.filter((x) => x.id !== b.id), b] });
  };

  const borrarBono = (id: string) => {
    if (
      !window.confirm(
        "¿Borrar este bono? También se quitan sus pagos y sus sesiones. Si sólo quieres darlo por terminado, usa «Cerrar».",
      )
    )
      return;
    onChange({
      bonos: bonos.filter((b) => b.id !== id),
      pagos: (client.pagos ?? []).filter((p) => p.bonoId !== id),
      sesiones: (client.sesiones ?? []).filter((s) => s.bonoId !== id),
    });
  };

  const cobrar = (bonoId: string, importe: number, fecha: string) => {
    const pago: Pago = { id: uid("pg_"), fecha, importe, bonoId };
    onChange({ pagos: [...(client.pagos ?? []), pago] });
  };

  const marcarSesion = (bonoId: string, lineaId: string) => {
    const s: Sesion = { id: uid("se_"), fecha: hoyIso(), bonoId, lineaId };
    onChange({ sesiones: [...(client.sesiones ?? []), s] });
  };

  const quitarUltimaSesion = (bonoId: string, lineaId: string) => {
    const suyas = (client.sesiones ?? []).filter(
      (s) => s.bonoId === bonoId && s.lineaId === lineaId,
    );
    const ultima = suyas[suyas.length - 1];
    if (!ultima) return;
    onChange({ sesiones: (client.sesiones ?? []).filter((s) => s.id !== ultima.id) });
  };

  return (
    <Card
      title="Bonos"
      subtitle="Lo que tiene contratado, lo que ha pagado y lo que lleva consumido"
      actions={
        <Button variant="outline" onClick={() => setCreando(!creando)}>
          {creando ? "Cancelar" : "+ Contratar bono"}
        </Button>
      }
    >
      {creando && (
        <NuevoBono
          moneda={client.tarifa?.moneda}
          sugerencia={client.tarifa}
          onGuardar={(b) => {
            guardarBono(b);
            setCreando(false);
          }}
          onCancelar={() => setCreando(false)}
        />
      )}

      {!bonos.length && !creando ? (
        <p className="text-sm text-slate-400">
          Sin bonos todavía. Un bono es lo que te contrata: «Online trimestral, 270 €,
          3 consultas y 3 llamadas». Con eso ya se puede saber cuánto le falta por
          pagar y cuándo toca renovar.
        </p>
      ) : (
        <div className="mt-2 space-y-4">
          {[...bonos]
            .sort((a, b) => b.inicio.localeCompare(a.inicio))
            .map((b) => (
              <UnBono
                key={b.id}
                como={comoVaElBono(b, client)}
                onCobrar={(importe, fecha) => cobrar(b.id, importe, fecha)}
                onSesion={(lineaId) => marcarSesion(b.id, lineaId)}
                onQuitarSesion={(lineaId) => quitarUltimaSesion(b.id, lineaId)}
                onCerrar={() => guardarBono({ ...b, cerrado: !b.cerrado })}
                onBorrar={() => borrarBono(b.id)}
              />
            ))}
        </div>
      )}
    </Card>
  );
}

function UnBono({
  como,
  onCobrar,
  onSesion,
  onQuitarSesion,
  onCerrar,
  onBorrar,
}: {
  como: ComoVaElBono;
  onCobrar: (importe: number, fecha: string) => void;
  onSesion: (lineaId: string) => void;
  onQuitarSesion: (lineaId: string) => void;
  onCerrar: () => void;
  onBorrar: () => void;
}) {
  const { bono, pagado, pendiente, lineas, estado, diasParaVencer } = como;
  const moneda = bono.moneda || "€";
  const dinero = (n: number) => `${fmt(n, n % 1 ? 2 : 0)} ${moneda}`;

  const [cobrando, setCobrando] = useState(false);
  const [importe, setImporte] = useState(String(pendiente || bono.importe));
  const [fecha, setFecha] = useState(hoyIso());

  const etiqueta = TONO[estado];

  return (
    <div className="rounded-xl border border-brand-100 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm font-semibold text-brand-900">{bono.nombre}</span>
        <Badge tone={etiqueta.tono}>{etiqueta.texto}</Badge>
      </div>

      {/* ── Lo pagado ─────────────────────────────────────────── */}
      <p className="mt-1.5 text-sm text-slate-700">
        <span className="tnum font-medium">{dinero(pagado)}</span>
        <span className="text-slate-400"> de {dinero(bono.importe)}</span>
        {pendiente > 0 ? (
          /*
           * Aquí sí se dice lo que falta. En los pagos sueltos sería inventar
           * —no sabemos qué se pactó— pero el importe de un bono lo escribió
           * ella: «faltan 90» es una resta.
           */
          <span className="ml-2 font-medium text-amber-700">
            faltan {dinero(pendiente)}
          </span>
        ) : (
          <span className="ml-2 text-emerald-700">pagado</span>
        )}
      </p>

      {/* ── Las sesiones ──────────────────────────────────────── */}
      {lineas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {lineas.map(({ linea, hechas }) => (
            <li key={linea.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="tnum w-14 font-medium text-brand-900">
                {hechas} de {linea.cuantas}
              </span>
              <span className="flex-1 text-slate-600">{linea.concepto}</span>
              {!bono.cerrado && (
                <>
                  <button
                    onClick={() => onSesion(linea.id)}
                    className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
                  >
                    + Hecha
                  </button>
                  {hechas > 0 && (
                    <button
                      onClick={() => onQuitarSesion(linea.id)}
                      className="text-xs text-slate-400 underline hover:text-slate-700"
                    >
                      Deshacer
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-slate-400">
        Desde {bono.inicio}
        {bono.vence && ` · vence el ${bono.vence}`}
        {diasParaVencer !== undefined &&
          diasParaVencer >= 0 &&
          diasParaVencer <= 30 &&
          ` (quedan ${diasParaVencer} días)`}
      </p>

      {cobrando && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Field label="Cobrado">
            <Input
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Button
            onClick={() => {
              const n = Number(importe.replace(",", "."));
              if (!Number.isFinite(n) || n <= 0) return;
              onCobrar(n, fecha);
              setCobrando(false);
            }}
          >
            Apuntar
          </Button>
          <Button variant="outline" onClick={() => setCobrando(false)}>
            Cancelar
          </Button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {!bono.cerrado && !cobrando && (
          <Button variant="outline" onClick={() => setCobrando(true)}>
            Apuntar un pago
          </Button>
        )}
        {/*
          Cerrar, no borrar: un bono cerrado se queda con sus pagos y sus
          sesiones, que es lo que hace que el año pasado siga cuadrando.
        */}
        <button
          onClick={onCerrar}
          className="text-xs text-slate-500 underline hover:text-slate-800"
        >
          {bono.cerrado ? "Reabrir" : "Cerrar bono"}
        </button>
        <button
          onClick={onBorrar}
          className="text-xs text-rose-400 underline hover:text-rose-700"
        >
          Borrar
        </button>
      </div>
    </div>
  );
}

/** El alta. Las líneas las escribe ella: cada quien vende lo suyo. */
function NuevoBono({
  moneda,
  sugerencia,
  onGuardar,
  onCancelar,
}: {
  moneda?: string;
  sugerencia?: Client["tarifa"];
  onGuardar: (b: Bono) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(sugerencia?.nombre ?? "");
  const [importe, setImporte] = useState(String(sugerencia?.importe ?? ""));
  const [inicio, setInicio] = useState(hoyIso());
  const [vence, setVence] = useState("");
  const [lineas, setLineas] = useState<LineaDeBono[]>([
    { id: uid("ln_"), concepto: "Consultas", cuantas: 3 },
    { id: uid("ln_"), concepto: "Llamadas", cuantas: 3 },
  ]);

  const cambiar = (id: string, patch: Partial<LineaDeBono>) =>
    setLineas(lineas.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const guardar = () => {
    const n = Number(importe.replace(",", "."));
    if (!nombre.trim() || !Number.isFinite(n) || n <= 0) return;
    onGuardar({
      id: uid("bn_"),
      nombre: nombre.trim(),
      importe: n,
      moneda,
      inicio,
      ...(vence ? { vence } : {}),
      incluye: lineas.filter((l) => l.concepto.trim() && l.cuantas > 0),
    });
  };

  return (
    <div className="mb-3 space-y-3 rounded-xl border border-brand-100 bg-brand-50/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Qué contrata" className="sm:col-span-2">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Online trimestral"
          />
        </Field>
        <Field label="Precio del bono">
          <Input
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            inputMode="decimal"
            placeholder="270"
          />
        </Field>
        <Field label="Desde">
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </Field>
        <Field label="Vence (si tiene plazo)" className="sm:col-span-2">
          <Input type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
        </Field>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Qué incluye</p>
        <div className="space-y-2">
          {lineas.map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <Input
                value={String(l.cuantas)}
                onChange={(e) => cambiar(l.id, { cuantas: Number(e.target.value) || 0 })}
                inputMode="numeric"
                className="w-16"
              />
              <Input
                value={l.concepto}
                onChange={(e) => cambiar(l.id, { concepto: e.target.value })}
                placeholder="Consultas"
              />
              <button
                onClick={() => setLineas(lineas.filter((x) => x.id !== l.id))}
                className="text-xs text-slate-400 underline hover:text-slate-700"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            setLineas([...lineas, { id: uid("ln_"), concepto: "", cuantas: 1 }])
          }
          className="mt-2 text-xs text-brand-700 underline hover:text-brand-900"
        >
          + Añadir línea
        </button>
      </div>

      <div className="flex gap-2">
        <Button onClick={guardar}>Contratar</Button>
        <Button variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
