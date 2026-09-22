import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Cita, Client } from '../../types/client';
import { LABEL_MODO_CITA, MODOS_CITA } from '../../types/client';
import { bonoVigente, resumenDeSesiones } from '../../utils/bonos';
import { loQueTocaCobrar } from '../../utils/citas';
import { Button, Field, Input, Select } from '../common/ui';

interface Props {
  client: Client;
  cita: Cita;
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
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <Link
            to={`/clientes/${client.id}`}
            className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline"
          >
            {client.nombre}
          </Link>
          <p className="text-[11px] text-slate-500">
            {cita.fecha}
            {cita.hora && ` · ${cita.hora}`} · {LABEL_MODO_CITA[cita.modo]}
            {anulada && ' · anulada'}
          </p>
        </div>
        <button onClick={onCerrar} className="text-xs text-slate-400 hover:text-slate-600">
          Cerrar
        </button>
      </div>

      {/* ── Cómo va su bono ─────────────────────────────── */}
      {bono ? (
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          <p className="font-medium text-slate-700">{bono.bono.nombre}</p>
          <p>{resumenDeSesiones(bono)}</p>
          <p className={bono.pendiente > 0 ? 'text-amber-700' : 'text-emerald-700'}>
            {dinero(bono.pagado, moneda)} de {dinero(bono.importe, moneda)}
            {bono.pendiente > 0 ? ` · faltan ${dinero(bono.pendiente, moneda)}` : ' · pagado'}
          </p>
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
        <Field label="Minutos">
          <Input
            type="number"
            value={cita.duracionMin ?? 60}
            onChange={(e) => onGuardar({ ...cita, duracionMin: Number(e.target.value) || undefined })}
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
