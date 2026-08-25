import { useState } from "react";
import type { Bono, Client, LineaDeBono, Modalidad, Pago, Sesion } from "../../types/client";
import { LABEL_MODALIDAD } from "../../types/client";
import { uid } from "../../utils/storage";
import {
  comoVaElBono,
  type ComoVaElBono,
  type Estado,
} from "../../utils/bonos";
import { descuentoDelBono, valorDeSesion } from "../../utils/consulta";
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

  /**
   * La modalidad se hereda de la ficha y sólo se guarda en la sesión cuando es
   * la excepción: si un día la ves en el consultorio y normalmente es online.
   * Guardarla siempre convertiría cada cambio de la ficha en una mentira sobre
   * el pasado — y no guardarla nunca haría imposible la excepción.
   */
  const marcarSesion = (bonoId: string, lineaId: string, modalidad?: Modalidad) => {
    const s: Sesion = {
      id: uid("se_"),
      fecha: hoyIso(),
      bonoId,
      lineaId,
      ...(modalidad && modalidad !== client.modalidad ? { modalidad } : {}),
    };
    onChange({ sesiones: [...(client.sesiones ?? []), s] });
  };

  /**
   * UNA CONSULTA SIN BONO
   *
   * Los botones de «hecha» vivían sólo dentro de un bono, así que a quien no
   * tenía bono contratado no había forma de marcarle nada: ni un botón en toda
   * la ficha. Y eso es media consulta de las de verdad — la primera visita, una
   * revisión suelta, alguien que paga por sesión.
   *
   * Cuenta en el número de consultas del mes, pero no devenga: sin bono no hay
   * precio que repartir, y el resumen lo dice en vez de callárselo.
   */
  const marcarSuelta = (modalidad?: Modalidad) => {
    /*
     * Si su tarifa es por sesión, ya sabemos lo que vale: se pone solo y ella
     * lo cambia si ese día cobró otra cosa.
     */
    const porSesion =
      client.tarifa?.periodicidad === "sesion" ? client.tarifa.importe : undefined;
    const s: Sesion = {
      id: uid("se_"),
      fecha: hoyIso(),
      ...(porSesion ? { importe: porSesion } : {}),
      ...(modalidad && modalidad !== client.modalidad ? { modalidad } : {}),
    };
    onChange({ sesiones: [...(client.sesiones ?? []), s] });
  };

  const ponerImporte = (id: string, importe: number) => {
    onChange({
      sesiones: (client.sesiones ?? []).map((s) =>
        s.id === id ? { ...s, importe: importe > 0 ? importe : undefined } : s,
      ),
    });
  };

  const quitarSesion = (id: string) => {
    onChange({ sesiones: (client.sesiones ?? []).filter((s) => s.id !== id) });
  };

  const sueltas = (client.sesiones ?? [])
    .filter((s) => !s.bonoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

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
      title="Bonos y consultas"
      subtitle="Lo que tiene contratado, lo que ha pagado y las consultas que lleva"
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
                modalidadHabitual={client.modalidad}
                onCobrar={(importe, fecha) => cobrar(b.id, importe, fecha)}
                onSesion={(lineaId, modalidad) => marcarSesion(b.id, lineaId, modalidad)}
                onQuitarSesion={(lineaId) => quitarUltimaSesion(b.id, lineaId)}
                onCerrar={() => guardarBono({ ...b, cerrado: !b.cerrado })}
                onBorrar={() => borrarBono(b.id)}
              />
            ))}
        </div>
      )}

      {/* ── Consultas sueltas ─────────────────────────────────── */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-sm font-medium text-slate-700">
            {bonos.length ? "Consultas fuera de bono" : "Consultas sueltas"}
          </span>
          <button
            onClick={() => marcarSuelta(client.modalidad)}
            className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 transition hover:bg-brand-100"
          >
            + Consulta hecha
          </button>
        </div>

        {sueltas.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">
            {bonos.length
              ? "Para las que no entran en ningún bono."
              : "Si todavía no tiene bono, apunta aquí las consultas que le hagas: cuentan en el resumen del mes."}
          </p>
        ) : (
          <ul className="mt-1.5 divide-y divide-slate-50">
            {sueltas.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                <span className="w-24 shrink-0 text-xs text-slate-400">{s.fecha}</span>
                <span className="flex-1 text-slate-700">
                  Consulta
                  {s.modalidad ? ` · ${LABEL_MODALIDAD[s.modalidad].toLowerCase()}` : ""}
                </span>
                {/*
                  Lo que cobraste por ella. En un bono el precio se reparte solo;
                  aquí hay que decirlo, o esta consulta valdría cero y el mes
                  saldría como si no hubieras trabajado.
                */}
                <input
                  value={s.importe ?? ""}
                  onChange={(e) =>
                    ponerImporte(s.id, Number(e.target.value.replace(",", ".")) || 0)
                  }
                  inputMode="decimal"
                  placeholder="Cobrado"
                  aria-label={`Lo que cobraste por la consulta del ${s.fecha}`}
                  className={`tnum w-24 rounded-lg border px-2 py-1 text-right text-sm outline-none focus:border-brand-400 ${
                    s.importe ? "border-slate-200" : "border-amber-300 bg-amber-50/40"
                  }`}
                />
                <span className="text-xs text-slate-400">
                  {client.tarifa?.moneda || "€"}
                </span>
                <button
                  onClick={() => quitarSesion(s.id)}
                  className="text-xs text-slate-400 underline hover:text-slate-700"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function UnBono({
  como,
  modalidadHabitual,
  onCobrar,
  onSesion,
  onQuitarSesion,
  onCerrar,
  onBorrar,
}: {
  como: ComoVaElBono;
  modalidadHabitual?: Modalidad;
  onCobrar: (importe: number, fecha: string) => void;
  onSesion: (lineaId: string, modalidad?: Modalidad) => void;
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
        {/*
          De aquí sale el «trabajo hecho» del resumen del mes: el precio del
          bono repartido entre las sesiones que incluye. Sin enseñarlo, en el
          resumen aparecía una cifra en euros que no se podía rastrear.
        */}
        {valorDeSesion(bono) > 0 && (
          <span className="text-slate-400">
            {" "}
            · {dinero(valorDeSesion(bono))} por sesión
          </span>
        )}
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

      {descuentoDelBono(bono) > 0 && (
        <p className="mt-0.5 text-xs text-violet-700">
          Con descuento: {dinero(descuentoDelBono(bono))} menos que tu tarifa de{' '}
          {dinero(bono.precioBase ?? 0)}
          {bono.motivoDescuento ? ` · ${bono.motivoDescuento}` : ''}
        </p>
      )}

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
                    onClick={() => onSesion(linea.id, modalidadHabitual)}
                    className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
                    title={
                      modalidadHabitual
                        ? `Se apunta como ${LABEL_MODALIDAD[modalidadHabitual].toLowerCase()}`
                        : 'Sin modalidad: ponla en su ficha para que cuente en el resumen'
                    }
                  >
                    + Hecha
                  </button>
                  {/*
                    La excepción. Casi nadie alterna, así que el botón normal es
                    el de arriba y esto es el «hoy vino al consultorio».
                  */}
                  {modalidadHabitual && (
                    <button
                      onClick={() =>
                        onSesion(
                          linea.id,
                          modalidadHabitual === 'online' ? 'presencial' : 'online',
                        )
                      }
                      className="text-xs text-slate-400 underline hover:text-slate-700"
                      title={`Esta vez fue ${
                        modalidadHabitual === 'online' ? 'presencial' : 'online'
                      }`}
                    >
                      {modalidadHabitual === 'online' ? '+ presencial' : '+ online'}
                    </button>
                  )}
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
  const [precioBase, setPrecioBase] = useState("");
  const [motivo, setMotivo] = useState("");
  const [lineas, setLineas] = useState<LineaDeBono[]>([
    { id: uid("ln_"), concepto: "Consultas", cuantas: 3 },
    { id: uid("ln_"), concepto: "Llamadas", cuantas: 3 },
  ]);

  const cambiar = (id: string, patch: Partial<LineaDeBono>) =>
    setLineas(lineas.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const guardar = () => {
    const n = Number(importe.replace(",", "."));
    if (!nombre.trim() || !Number.isFinite(n) || n <= 0) return;
    const base = Number(precioBase.replace(",", "."));
    onGuardar({
      id: uid("bn_"),
      nombre: nombre.trim(),
      importe: n,
      /* Sólo es descuento si de verdad está por debajo de la tarifa. */
      ...(Number.isFinite(base) && base > n ? { precioBase: base } : {}),
      ...(motivo.trim() ? { motivoDescuento: motivo.trim() } : {}),
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
        {/*
          El descuento va en el bono y no en la ficha: la misma persona puede
          entrar con rebaja por una derivación y renovar al precio de siempre.
        */}
        <Field label="Tu tarifa normal (si le haces descuento)">
          <Input
            value={precioBase}
            onChange={(e) => setPrecioBase(e.target.value)}
            inputMode="decimal"
            placeholder="270"
          />
        </Field>
        <Field label="Por qué">
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Derivación de Marta"
          />
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
