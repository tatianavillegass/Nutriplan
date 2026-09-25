import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Cita, Client } from '../../types/client';
import { LABEL_MODO_CITA, MODOS_CITA } from '../../types/client';
import { bonoVigente, pagosDelBono } from '../../utils/bonos';
import { DURACION_MAX, duracionDe, loQueTocaCobrar, seSolapanCon } from '../../utils/citas';
import { Button, Field, Input, Select } from '../common/ui';

interface Props {
  client: Client;
  cita: Cita;
  /** Para avisar si esa hora choca con otra consulta. */
  clients?: Client[];
  onGuardar: (cita: Cita) => void;
  onRealizada: () => void;
  onDesmarcar: () => void;
  onAnular: () => void;
  onCobrar: (importe: number, metodo?: string) => void;
  onQuitar: () => void;
  onCerrar: () => void;
  hoy?: Date;
}

const dinero = (n: number, moneda = '€') =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${moneda}`;

/**
 * LA CITA, ABIERTA
 *
 * Lo que hace falta tener delante cuando termina una consulta es siempre lo
 * mismo: marcarla, ver cómo va su bono y cobrar. Los tres en la misma tarjeta,
 * porque son el mismo momento — si cobrar obliga a irse a su ficha, se hace
 * «luego» y luego es nunca.
 *
 * El «2 de 3» y el «faltan 90 €» se leen de los mismos sitios que la ficha
 * (`comoVaElBono`), así que no hay dos cuentas que puedan discrepar.
 */
export function DetalleDeCita({
  client,
  cita,
  clients = [],
  onGuardar,
  onRealizada,
  onDesmarcar,
  onAnular,
  onCobrar,
  onQuitar,
  onCerrar,
  hoy = new Date(),
}: Props) {
  const bono = bonoVigente(client, hoy);
  const moneda = client.tarifa?.moneda?.trim() || bono?.bono.moneda || '€';
  const [importe, setImporte] = useState(() => loQueTocaCobrar(client, hoy));
  const [cobrando, setCobrando] = useState(false);

  const hecha = cita.estado === 'realizada';
  const anulada = cita.estado === 'anulada';

  return (
    <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{client.nombre}</p>
          <p className="text-[11px] text-slate-500">
            {cita.fecha}
            {cita.hora && ` · ${cita.hora}`} · {LABEL_MODO_CITA[cita.modo]}
            {anulada && ' · anulada'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/*
            UN BOTÓN, NO UN NOMBRE SUBRAYADO
            El nombre era el enlace a su ficha y no se veía como tal, así que
            desde la cita parecía que no había forma de llegar a ella.
          */}
          <Link
            to={`/clientes/${client.id}`}
            className="rounded-lg border border-brand-300 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition hover:bg-brand-50"
          >
            Abrir su ficha →
          </Link>
          <button onClick={onCerrar} className="text-xs text-slate-400 hover:text-slate-600">
            Cerrar
          </button>
        </div>
      </div>

      {/*
        SU BONO Y SUS PAGOS, AQUÍ MISMO
        Al terminar la consulta las preguntas son dos —¿por cuántas va? y ¿me
        debe algo?— y las dos se contestaban abriendo su ficha. Es lo mismo que
        ya está en «Citas y pagos»: se lee de ahí (`comoVaElBono`), no se
        calcula otra vez, para que no haya dos cuentas que puedan discrepar.
      */}
      {bono ? (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">{bono.bono.nombre}</p>

          {/* Qué incluye y por cuántas va. */}
          <ul className="mb-1.5 space-y-0.5">
            {bono.lineas.map((l) => (
              <li
                key={l.linea.id}
                className="flex items-baseline justify-between gap-3 text-[11px]"
              >
                <span className="text-slate-600">{l.linea.concepto}</span>
                <span className={`tnum ${l.quedan > 0 ? 'text-slate-700' : 'text-amber-700'}`}>
                  {l.hechas} de {l.linea.cuantas}
                  {l.quedan > 0 ? ` · quedan ${l.quedan}` : ' · agotadas'}
                </span>
              </li>
            ))}
          </ul>

          {/* Lo que ha ido pagando, con su fecha. */}
          {pagosDelBono(client.pagos, bono.bono.id).length > 0 && (
            <ul className="mb-1.5 space-y-0.5 border-t border-slate-200 pt-1.5">
              {pagosDelBono(client.pagos, bono.bono.id)
                .slice()
                .sort((a, b) => a.fecha.localeCompare(b.fecha))
                .map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 text-[11px] text-slate-500">
                    <span>{p.fecha}{p.metodo ? ` · ${p.metodo}` : ''}</span>
                    <span className="tnum">{dinero(p.importe, moneda)}</span>
                  </li>
                ))}
            </ul>
          )}

          {/* Y la línea de siempre: total, pagado y lo que debe. */}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-t border-slate-200 pt-1.5 text-[11px]">
            <span className="text-slate-500">
              Total <span className="tnum text-slate-700">{dinero(bono.importe, moneda)}</span>
            </span>
            <span className="text-slate-500">
              Pagado <span className="tnum text-slate-700">{dinero(bono.pagado, moneda)}</span>
            </span>
            <span className={bono.pendiente > 0 ? 'text-amber-700' : 'text-emerald-700'}>
              {bono.pendiente > 0 ? (
                <>
                  Debe <span className="tnum font-semibold">{dinero(bono.pendiente, moneda)}</span>
                </>
              ) : (
                'Pagado del todo'
              )}
            </span>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-slate-500">
          Sin bono contratado. Al marcarla se apunta como consulta suelta.
        </p>
      )}

      {/* ── Marcarla ────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap gap-2">
        {hecha ? (
          <>
            <span className="rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
              Realizada · descontada de su bono
            </span>
            <Button variant="ghost" onClick={onDesmarcar} className="text-[11px]">
              Deshacer
            </Button>
          </>
        ) : (
          <Button onClick={onRealizada} className="text-xs">
            Marcar realizada
          </Button>
        )}
        {!anulada && (
          <Button variant="ghost" onClick={onAnular} className="text-[11px] text-slate-500">
            No se dio
          </Button>
        )}
        <Button variant="ghost" onClick={onQuitar} className="text-[11px] text-slate-400">
          Borrar
        </Button>
      </div>

      {/* ── Cobrar ──────────────────────────────────────── */}
      {cobrando ? (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-brand-50 p-2">
          <Field label={`Cuánto cobras (${moneda})`} className="w-36">
            <Input
              type="number"
              value={importe}
              onChange={(e) => setImporte(Number(e.target.value))}
            />
          </Field>
          <Button
            onClick={() => {
              onCobrar(importe);
              setCobrando(false);
            }}
            className="text-xs"
          >
            Apuntar el pago
          </Button>
          <Button variant="ghost" onClick={() => setCobrando(false)} className="text-[11px]">
            Ahora no
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setCobrando(true)} className="mb-3 text-xs">
          Cobrar
          {loQueTocaCobrar(client, hoy) > 0 && ` · faltan ${dinero(loQueTocaCobrar(client, hoy), moneda)}`}
        </Button>
      )}

      {/* ── Cambiarla de día o de hora ──────────────────── */}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
        <Field label="Día">
          <Input
            type="date"
            value={cita.fecha}
            onChange={(e) => onGuardar({ ...cita, fecha: e.target.value })}
          />
        </Field>
        <Field label="Hora">
          <Input
            type="time"
            value={cita.hora ?? ''}
            onChange={(e) => onGuardar({ ...cita, hora: e.target.value || undefined })}
          />
        </Field>
        <Field label="Dura (min)">
          <Input
            type="number"
            min={5}
            max={DURACION_MAX}
            value={cita.duracionMin ?? 60}
            onChange={(e) =>
              onGuardar({
                ...cita,
                /* Con tope: un 600 donde iba un 60 deformaba la semana entera. */
                duracionMin: Math.min(DURACION_MAX, Number(e.target.value)) || undefined,
              })
            }
          />
        </Field>
        <Field label="Cómo">
          <Select
            value={cita.modo}
            onChange={(e) => onGuardar({ ...cita, modo: e.target.value as Cita['modo'] })}
          >
            {MODOS_CITA.map((m) => (
              <option key={m} value={m}>
                {LABEL_MODO_CITA[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {(() => {
        const chocan = seSolapanCon(
          clients,
          cita.fecha,
          cita.hora ?? '',
          duracionDe(cita),
          cita.id,
        );
        if (!chocan.length) return null;
        return (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            ⚠️ A esa hora también tienes a{' '}
            {chocan.map((x) => `${x.client.nombre} (${x.cita.hora})`).join(', ')}.
          </p>
        );
      })()}

      <Field label="Nota" className="mt-2">
        <Input
          value={cita.nota ?? ''}
          placeholder="Traer la analítica"
          onChange={(e) => onGuardar({ ...cita, nota: e.target.value || undefined })}
        />
      </Field>
    </div>
  );
}
