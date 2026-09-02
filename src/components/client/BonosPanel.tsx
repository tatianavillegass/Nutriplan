import { useState } from "react";
import type {
  Bono,
  Client,
  LineaDeBono,
  Modalidad,
  Pago,
  Sesion,
} from "../../types/client";
import { LABEL_MODALIDAD } from "../../types/client";
import { uid } from "../../utils/storage";
import { comoVaElBono, type ComoVaElBono, type Estado } from "../../utils/bonos";
import { descuentoDelBono, valorDeSesion } from "../../utils/consulta";
import { Badge, Button, Card, Field, Input, Select, fmt } from "../common/ui";

/**
 * CITAS Y PAGOS, EN UNA SOLA PANTALLA
 *
 * «Contrató el trimestral de 270, ha pagado 180, le faltan 90, y lleva 2 de 3
 * consultas.» Todo eso vive aquí: lo contratado, lo cobrado, lo que falta y las
 * consultas con su fecha.
 *
 * ANTES ESTABA EN DOS SITIOS Y NO SE HABLABAN
 * ===========================================
 * Había una tarjeta de bonos y otra de tarifa y pagos. Apuntar un pago abajo no
 * lo colgaba de ningún bono, así que el «faltan 90» no se enteraba; y la tarifa
 * pedía una periodicidad —«cuánto paga al mes»— que ya no la usa nadie desde
 * que existen los bonos, pero seguía ahí preguntando. Ahora es una sola
 * tarjeta y un pago siempre sabe de qué es.
 *
 * LA FECHA SE ESCRIBE, NO SE ADIVINA
 * ==================================
 * Una consulta se apunta con la fecha de hoy, pero se apunta cuando se acuerda
 * —a veces semanas después— y entonces la de hoy es mentira: la consulta de
 * agosto acababa contando en septiembre y el resumen del mes salía torcido. Por
 * eso cada consulta y cada pago llevan su fecha a la vista y se puede cambiar.
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

const aNumero = (t: string) => Number(t.replace(",", ".")) || 0;

export function BonosPanel({ client, onChange }: Props) {
  const bonos = client.bonos ?? [];
  const sesiones = client.sesiones ?? [];
  const pagos = client.pagos ?? [];
  const moneda = client.tarifa?.moneda?.trim() || "€";
  const [creando, setCreando] = useState(false);

  const guardarBono = (b: Bono) =>
    onChange({ bonos: [...bonos.filter((x) => x.id !== b.id), b] });

  const borrarBono = (id: string) => {
    if (
      !window.confirm(
        "¿Borrar este bono? También se quitan sus pagos y sus consultas. Si sólo quieres darlo por terminado, usa «Cerrar».",
      )
    )
      return;
    onChange({
      bonos: bonos.filter((b) => b.id !== id),
      pagos: pagos.filter((p) => p.bonoId !== id),
      sesiones: sesiones.filter((s) => s.bonoId !== id),
    });
  };

  /**
   * La modalidad se hereda de la ficha y sólo se guarda en la sesión cuando es
   * la excepción: si un día la ves en el consultorio y normalmente es online.
   * Guardarla siempre convertiría cada cambio de la ficha en una mentira sobre
   * el pasado — y no guardarla nunca haría imposible la excepción.
   */
  const apuntarSesion = (bonoId?: string, lineaId?: string) => {
    const s: Sesion = {
      id: uid("se_"),
      fecha: hoyIso(),
      ...(bonoId ? { bonoId, lineaId } : {}),
      /*
       * Si su tarifa es por sesión ya sabemos lo que vale una consulta suelta:
       * se pone solo y ella lo cambia si ese día cobró otra cosa.
       */
      ...(!bonoId && client.tarifa?.periodicidad === "sesion" && client.tarifa.importe
        ? { importe: client.tarifa.importe }
        : {}),
    };
    onChange({ sesiones: [...sesiones, s] });
  };

  const editarSesion = (id: string, patch: Partial<Sesion>) =>
    onChange({ sesiones: sesiones.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const quitarSesion = (id: string) =>
    onChange({ sesiones: sesiones.filter((s) => s.id !== id) });

  const apuntarPago = (bonoId?: string, importe = 0) => {
    const p: Pago = {
      id: uid("pg_"),
      fecha: hoyIso(),
      importe,
      ...(bonoId ? { bonoId } : {}),
    };
    onChange({ pagos: [...pagos, p] });
  };

  const editarPago = (id: string, patch: Partial<Pago>) =>
    onChange({ pagos: pagos.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const quitarPago = (id: string) =>
    onChange({ pagos: pagos.filter((p) => p.id !== id) });

  const sueltas = sesiones
    .filter((s) => !s.bonoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const pagosSueltos = pagos
    .filter((p) => !p.bonoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <Card
      title="Citas y pagos"
      subtitle="Lo que tiene contratado, lo que ha pagado y las consultas que lleva"
      actions={
        <Button variant="outline" onClick={() => setCreando(!creando)}>
          {creando ? "Cancelar" : "+ Contratar bono"}
        </Button>
      }
    >
      {/*
        CÓMO LA VES Y CUÁNTO COBRAS POR UNA SUELTA
        Dos datos y en una línea. Antes esto era una tarjeta entera que además
        preguntaba «cuánto paga al mes», que es de cuando no había bonos: con un
        bono contratado, esa pregunta ya está contestada y sólo confundía.
      */}
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
        <Field label="Cómo la ves" className="w-36">
          <Select
            value={client.modalidad ?? ""}
            onChange={(e) =>
              onChange({ modalidad: (e.target.value || undefined) as Modalidad })
            }
          >
            <option value="">Sin decir</option>
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
          </Select>
        </Field>
        <Field label="Una consulta suelta" className="w-32">
          <Input
            value={client.tarifa?.importe || ""}
            onChange={(e) =>
              onChange({
                tarifa: {
                  ...(client.tarifa ?? { nombre: "" }),
                  importe: aNumero(e.target.value),
                  periodicidad: "sesion",
                },
              })
            }
            inputMode="decimal"
            placeholder="60"
          />
        </Field>
        <Field label="Moneda" className="w-20">
          <Input
            value={client.tarifa?.moneda ?? ""}
            onChange={(e) =>
              onChange({
                tarifa: {
                  ...(client.tarifa ?? { nombre: "", importe: 0, periodicidad: "sesion" }),
                  moneda: e.target.value,
                },
              })
            }
            placeholder="€"
          />
        </Field>
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-slate-500">
          La modalidad vale para todas sus consultas; en cada una se puede poner la
          excepción.
        </p>
      </div>

      {creando && (
        <NuevoBono
          moneda={client.tarifa?.moneda}
          onGuardar={(b) => {
            guardarBono(b);
            setCreando(false);
          }}
          onCancelar={() => setCreando(false)}
        />
      )}

      {!bonos.length && !creando ? (
        <p className="text-sm text-slate-400">
          Sin bonos todavía. Un bono es lo que te contrata: «Online trimestral, 270 €, 3
          consultas y 3 llamadas». Con eso ya se puede saber cuánto le falta por pagar y
          cuándo toca renovar.
        </p>
      ) : (
        <div className="space-y-4">
          {[...bonos]
            .sort((a, b) => b.inicio.localeCompare(a.inicio))
            .map((b) => (
              <UnBono
                key={b.id}
                como={comoVaElBono(b, client)}
                sesiones={sesiones.filter((s) => s.bonoId === b.id)}
                pagos={pagos.filter((p) => p.bonoId === b.id)}
                modalidadHabitual={client.modalidad}
                onSesion={(lineaId) => apuntarSesion(b.id, lineaId)}
                onEditarSesion={editarSesion}
                onQuitarSesion={quitarSesion}
                onPago={(importe) => apuntarPago(b.id, importe)}
                onEditarPago={editarPago}
                onQuitarPago={quitarPago}
                onCerrar={() => guardarBono({ ...b, cerrado: !b.cerrado })}
                onBorrar={() => borrarBono(b.id)}
              />
            ))}
        </div>
      )}

      {/* ── Fuera de bono ─────────────────────────────────────── */}
      <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
        <Bloque
          titulo={bonos.length ? "Consultas fuera de bono" : "Consultas sueltas"}
          boton="+ Consulta hecha"
          onAnadir={() => apuntarSesion()}
          vacio={
            bonos.length
              ? "Para las que no entran en ningún bono."
              : "Apunta aquí las consultas que le hagas: cuentan en el resumen del mes."
          }
          hay={sueltas.length > 0}
        >
          {sueltas.map((s) => (
            <FilaDeSesion
              key={s.id}
              sesion={s}
              moneda={moneda}
              modalidadHabitual={client.modalidad}
              conImporte
              onEditar={(patch) => editarSesion(s.id, patch)}
              onQuitar={() => quitarSesion(s.id)}
            />
          ))}
        </Bloque>

        <Bloque
          titulo="Pagos fuera de bono"
          boton="+ Pago"
          onAnadir={() => apuntarPago()}
          vacio="Lo que te pague sin colgar de un bono."
          hay={pagosSueltos.length > 0}
        >
          {pagosSueltos.map((p) => (
            <FilaDePago
              key={p.id}
              pago={p}
              moneda={moneda}
              onEditar={(patch) => editarPago(p.id, patch)}
              onQuitar={() => quitarPago(p.id)}
            />
          ))}
        </Bloque>
      </div>
    </Card>
  );
}

function Bloque({
  titulo,
  boton,
  onAnadir,
  vacio,
  hay,
  children,
}: {
  titulo: string;
  boton: string;
  onAnadir: () => void;
  vacio: string;
  hay: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm font-medium text-slate-700">{titulo}</span>
        <button
          onClick={onAnadir}
          className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 transition hover:bg-brand-100"
        >
          {boton}
        </button>
      </div>
      {hay ? (
        <ul className="mt-1.5 divide-y divide-slate-50">{children}</ul>
      ) : (
        <p className="mt-1 text-xs text-slate-400">{vacio}</p>
      )}
    </div>
  );
}

/**
 * UNA CONSULTA, CON SU FECHA A LA VISTA
 *
 * La fecha es un campo, no un texto. Se apunta con la de hoy porque es lo
 * normal, pero cuando se apunta tarde hay que poder corregirla: si no, la
 * consulta de agosto cuenta en septiembre y el resumen del mes miente.
 */
function FilaDeSesion({
  sesion,
  moneda,
  modalidadHabitual,
  conImporte,
  onEditar,
  onQuitar,
}: {
  sesion: Sesion;
  moneda: string;
  modalidadHabitual?: Modalidad;
  conImporte?: boolean;
  onEditar: (patch: Partial<Sesion>) => void;
  onQuitar: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
      <Input
        type="date"
        value={sesion.fecha}
        onChange={(e) => onEditar({ fecha: e.target.value })}
        aria-label="Fecha de la consulta"
        className="w-36 shrink-0 py-1 text-xs"
      />
      <Select
        value={sesion.modalidad ?? ""}
        onChange={(e) =>
          onEditar({ modalidad: (e.target.value || undefined) as Modalidad })
        }
        aria-label="Cómo fue esta consulta"
        className="w-28 shrink-0 py-1 text-xs"
      >
        <option value="">
          {modalidadHabitual ? LABEL_MODALIDAD[modalidadHabitual] : "Sin decir"}
        </option>
        <option value="online">Online</option>
        <option value="presencial">Presencial</option>
      </Select>
      {/*
        Lo que cobraste por ella. En un bono el precio se reparte solo; aquí hay
        que decirlo, o esta consulta valdría cero y el mes saldría como si no
        hubieras trabajado.
      */}
      {conImporte && (
        <>
          <Input
            value={sesion.importe ?? ""}
            onChange={(e) => {
              const n = aNumero(e.target.value);
              onEditar({ importe: n > 0 ? n : undefined });
            }}
            inputMode="decimal"
            placeholder="Cobrado"
            aria-label="Lo que cobraste por esta consulta"
            className={`tnum w-24 shrink-0 py-1 text-right text-xs ${
              sesion.importe ? "" : "border-amber-300 bg-amber-50/40"
            }`}
          />
          <span className="shrink-0 text-xs text-slate-400">{moneda}</span>
        </>
      )}
      <button
        onClick={onQuitar}
        className="ml-auto shrink-0 text-xs text-slate-400 underline hover:text-slate-700"
      >
        Quitar
      </button>
    </li>
  );
}

function FilaDePago({
  pago,
  moneda,
  onEditar,
  onQuitar,
}: {
  pago: Pago;
  moneda: string;
  onEditar: (patch: Partial<Pago>) => void;
  onQuitar: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
      <Input
        type="date"
        value={pago.fecha}
        onChange={(e) => onEditar({ fecha: e.target.value })}
        aria-label="Fecha del pago"
        className="w-36 shrink-0 py-1 text-xs"
      />
      <Input
        value={pago.importe || ""}
        onChange={(e) => onEditar({ importe: aNumero(e.target.value) })}
        inputMode="decimal"
        placeholder="Importe"
        aria-label="Importe del pago"
        className={`tnum w-24 shrink-0 py-1 text-right text-xs ${
          pago.importe ? "" : "border-amber-300 bg-amber-50/40"
        }`}
      />
      <span className="shrink-0 text-xs text-slate-400">{moneda}</span>
      <Input
        value={pago.concepto ?? ""}
        onChange={(e) => onEditar({ concepto: e.target.value || undefined })}
        placeholder="Nota (bizum, efectivo…)"
        aria-label="Nota del pago"
        className="min-w-0 flex-1 py-1 text-xs"
      />
      <button
        onClick={onQuitar}
        className="shrink-0 text-xs text-slate-400 underline hover:text-slate-700"
      >
        Quitar
      </button>
    </li>
  );
}

function UnBono({
  como,
  sesiones,
  pagos,
  modalidadHabitual,
  onSesion,
  onEditarSesion,
  onQuitarSesion,
  onPago,
  onEditarPago,
  onQuitarPago,
  onCerrar,
  onBorrar,
}: {
  como: ComoVaElBono;
  sesiones: Sesion[];
  pagos: Pago[];
  modalidadHabitual?: Modalidad;
  onSesion: (lineaId: string) => void;
  onEditarSesion: (id: string, patch: Partial<Sesion>) => void;
  onQuitarSesion: (id: string) => void;
  onPago: (importe: number) => void;
  onEditarPago: (id: string, patch: Partial<Pago>) => void;
  onQuitarPago: (id: string) => void;
  onCerrar: () => void;
  onBorrar: () => void;
}) {
  const { bono, pagado, pendiente, lineas, estado, diasParaVencer } = como;
  const moneda = bono.moneda || "€";
  const dinero = (n: number) => `${fmt(n, n % 1 ? 2 : 0)} ${moneda}`;
  const etiqueta = TONO[estado];

  return (
    <div className="rounded-xl border border-brand-100 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm font-semibold text-brand-900">{bono.nombre}</span>
        <Badge tone={etiqueta.tono}>{etiqueta.texto}</Badge>
      </div>

      <p className="mt-1.5 text-sm text-slate-700">
        <span className="tnum font-medium">{dinero(pagado)}</span>
        <span className="text-slate-400"> de {dinero(bono.importe)}</span>
        {/*
          De aquí sale el «trabajo hecho» del resumen del mes: el precio del
          bono repartido entre las sesiones que incluye.
        */}
        {valorDeSesion(bono) > 0 && (
          <span className="text-slate-400"> · {dinero(valorDeSesion(bono))} por sesión</span>
        )}
        {pendiente > 0 ? (
          /*
           * Aquí sí se dice lo que falta. En los pagos sueltos sería inventar
           * —no sabemos qué se pactó— pero el importe de un bono lo escribió
           * ella: «faltan 90» es una resta.
           */
          <span className="ml-2 font-medium text-amber-700">faltan {dinero(pendiente)}</span>
        ) : (
          <span className="ml-2 text-emerald-700">pagado</span>
        )}
      </p>

      {descuentoDelBono(bono) > 0 && (
        <p className="mt-0.5 text-xs text-violet-700">
          Con descuento: {dinero(descuentoDelBono(bono))} menos que tu tarifa de{" "}
          {dinero(bono.precioBase ?? 0)}
          {bono.motivoDescuento ? ` · ${bono.motivoDescuento}` : ""}
        </p>
      )}

      <p className="mt-1 text-xs text-slate-400">
        Desde {bono.inicio}
        {bono.vence && ` · vence el ${bono.vence}`}
        {diasParaVencer !== undefined &&
          diasParaVencer >= 0 &&
          diasParaVencer <= 30 &&
          ` (quedan ${diasParaVencer} días)`}
      </p>

      {/* ── Las consultas, una a una y con su fecha ───────────── */}
      {lineas.map(({ linea, hechas }) => {
        const suyas = sesiones
          .filter((s) => s.lineaId === linea.id)
          .sort((a, b) => b.fecha.localeCompare(a.fecha));
        return (
          <div key={linea.id} className="mt-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tnum w-14 shrink-0 text-sm font-medium text-brand-900">
                {hechas} de {linea.cuantas}
              </span>
              <span className="flex-1 text-sm text-slate-600">{linea.concepto}</span>
              {!bono.cerrado && (
                <button
                  onClick={() => onSesion(linea.id)}
                  className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
                >
                  + Apuntar
                </button>
              )}
            </div>
            {suyas.length > 0 && (
              <ul className="mt-1 divide-y divide-slate-50 pl-1">
                {suyas.map((s) => (
                  <FilaDeSesion
                    key={s.id}
                    sesion={s}
                    moneda={moneda}
                    modalidadHabitual={modalidadHabitual}
                    onEditar={(patch) => onEditarSesion(s.id, patch)}
                    onQuitar={() => onQuitarSesion(s.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {/* ── Sus pagos ─────────────────────────────────────────── */}
      <div className="mt-3 border-t border-slate-100 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-sm font-medium text-slate-700">Pagos</span>
          {!bono.cerrado && (
            <button
              onClick={() => onPago(pendiente > 0 ? pendiente : 0)}
              className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
            >
              + Apuntar pago
            </button>
          )}
        </div>
        {pagos.length > 0 ? (
          <ul className="mt-1 divide-y divide-slate-50">
            {[...pagos]
              .sort((a, b) => b.fecha.localeCompare(a.fecha))
              .map((p) => (
                <FilaDePago
                  key={p.id}
                  pago={p}
                  moneda={moneda}
                  onEditar={(patch) => onEditarPago(p.id, patch)}
                  onQuitar={() => onQuitarPago(p.id)}
                />
              ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-400">Todavía no ha pagado nada.</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/*
          Cerrar, no borrar: un bono cerrado se queda con sus pagos y sus
          consultas, que es lo que hace que el año pasado siga cuadrando.
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
  onGuardar,
  onCancelar,
}: {
  moneda?: string;
  onGuardar: (b: Bono) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [importe, setImporte] = useState("");
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
    const n = aNumero(importe);
    if (!nombre.trim() || n <= 0) return;
    const base = aNumero(precioBase);
    onGuardar({
      id: uid("bn_"),
      nombre: nombre.trim(),
      importe: n,
      /* Sólo es descuento si de verdad está por debajo de la tarifa. */
      ...(base > n ? { precioBase: base } : {}),
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
          onClick={() => setLineas([...lineas, { id: uid("ln_"), concepto: "", cuantas: 1 }])}
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
