import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import type { Cita, Client } from '../types/client';
import { LABEL_MODO_CITA, MODOS_CITA } from '../types/client';
import {
  anular,
  citasDelDia,
  cobrarDeLaCita,
  comoVaLaSemana,
  conLaCita,
  citasSinMarcar,
  desmarcar,
  diasDeLaSemana,
  iso,
  lunesDe,
  marcarRealizada,
  otraSemana,
  sinLaCita,
  sinProximaCita,
} from '../utils/citas';
import { mesDeConsulta } from '../utils/consulta';
import { mesDe, monedaDeLaConsulta, nombreDelMes } from '../utils/finanzas';
import { DetalleDeCita } from '../components/agenda/DetalleDeCita';
import { Button, Card, Field, Input, Select, Stat } from '../components/common/ui';

/**
 * LA AGENDA
 *
 * La semana delante, como en el programa de la clínica, pero conectada a las
 * fichas: **marcar una cita como realizada descuenta la sesión de su bono**, y
 * el botón de cobrar apunta el pago colgado de ese mismo bono. Ésas son las dos
 * cosas que se quedaban sin hacer, porque había que acordarse de entrar en la
 * ficha de cada una después de un jueves de quince consultas.
 *
 * Arriba, lo que se olvidó: citas que ya pasaron y siguen sin marcar, y quién
 * se fue sin la siguiente puesta. Abajo, el mes en dos números —consultas
 * hechas y lo que entró en caja—, que es el resumen que ella hace a mano.
 */

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const dinero = (n: number, moneda: string) =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} ${moneda}`;

export function AgendaPage() {
  const clients = useAppStore((s) => s.clients);
  const gastos = useAppStore((s) => s.gastos);
  const updateClient = useAppStore((s) => s.updateClient);

  const hoy = new Date();
  const [lunes, setLunes] = useState(() => lunesDe(hoy));
  /** Qué cita está abierta: `clientId` + id de la cita. */
  const [abierta, setAbierta] = useState<{ clientId: string; citaId: string } | null>(null);
  const [poniendo, setPoniendo] = useState(false);

  const dias = diasDeLaSemana(lunes);
  const semana = comoVaLaSemana(clients, lunes, hoy);
  const moneda = monedaDeLaConsulta(clients);

  const olvidadas = useMemo(() => citasSinMarcar(clients, hoy), [clients]);
  const sinSiguiente = useMemo(() => sinProximaCita(clients, hoy), [clients]);
  const mes = useMemo(
    () => mesDeConsulta(clients, gastos, mesDe(iso(hoy))),
    [clients, gastos],
  );

  const elegida = abierta
    ? (() => {
        const client = clients.find((c) => c.id === abierta.clientId);
        if (!client) return null;
        const enEseDia = dias
          .flatMap((d) => citasDelDia([client], d))
          .concat(citasSinMarcar([client], hoy))
          .find((x) => x.id === abierta.citaId);
        return enEseDia ? { client, cita: enEseDia.cita } : null;
      })()
    : null;

  /** Todo lo que se escribe pasa por aquí: un parche sobre la ficha. */
  const escribir = (client: Client, patch: Partial<Client>) => {
    if (Object.keys(patch).length) updateClient(client.id, patch);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Agenda</h1>
          <p className="text-xs text-slate-500">
            {semana.citas} {semana.citas === 1 ? 'cita' : 'citas'} esta semana
            {semana.realizadas > 0 && ` · ${semana.realizadas} ya marcadas`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" onClick={() => setLunes((l) => otraSemana(l, -1))}>
            ← Anterior
          </Button>
          <Button variant="ghost" onClick={() => setLunes(lunesDe(hoy))}>
            Esta semana
          </Button>
          <Button variant="ghost" onClick={() => setLunes((l) => otraSemana(l, 1))}>
            Siguiente →
          </Button>
          <Button onClick={() => setPoniendo(true)}>Nueva cita</Button>
        </div>
      </div>

      {/* ── Lo que se olvidó ────────────────────────────── */}
      {olvidadas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-900">
            {olvidadas.length}{' '}
            {olvidadas.length === 1 ? 'cita ya pasó y sigue' : 'citas ya pasaron y siguen'} sin
            marcar
          </p>
          <p className="mb-2 text-[11px] text-amber-800">
            Hasta que las marques, sus bonos van atrasados y el mes sale corto de consultas.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {olvidadas.slice(0, 12).map((x) => (
              <button
                key={`${x.client.id}-${x.id}`}
                onClick={() => {
                  setLunes(lunesDe(x.cita.fecha));
                  setAbierta({ clientId: x.client.id, citaId: x.id });
                }}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-900 hover:border-amber-500"
              >
                {x.client.nombre.split(' ')[0]} · {x.cita.fecha}
              </button>
            ))}
          </div>
        </div>
      )}

      {sinSiguiente.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-slate-700">
            {sinSiguiente.length}{' '}
            {sinSiguiente.length === 1 ? 'clienta no tiene' : 'clientas no tienen'} la siguiente
            cita puesta
          </p>
          <p className="mb-2 text-[11px] text-slate-500">
            Les queda bono por gastar, así que no es que hayan terminado.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sinSiguiente.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                to={`/clientes/${c.id}`}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:border-brand-400 hover:text-brand-700"
              >
                {c.nombre}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── La semana ───────────────────────────────────── */}
      <div className="grid gap-2 md:grid-cols-7">
        {dias.map((dia, i) => {
          const delDia = citasDelDia(clients, dia);
          const cuentan = delDia.filter((x) => x.cita.estado !== 'anulada');
          const esHoy = dia === iso(hoy);
          return (
            <div
              key={dia}
              className={`rounded-xl border p-2 ${
                esHoy ? 'border-brand-400 bg-brand-50/40' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                  {DIAS[i]} {Number(dia.slice(-2))}
                </span>
                <span
                  className={`rounded px-1.5 text-[10px] ${
                    cuentan.length
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {cuentan.length}
                </span>
              </div>

              <div className="space-y-1">
                {delDia.map((x) => {
                  const hecha = x.cita.estado === 'realizada';
                  const anulada = x.cita.estado === 'anulada';
                  return (
                    <button
                      key={`${x.client.id}-${x.id}`}
                      onClick={() => setAbierta({ clientId: x.client.id, citaId: x.id })}
                      className={`block w-full rounded-lg border-l-4 px-2 py-1 text-left text-[11px] transition ${
                        anulada
                          ? 'border-l-slate-200 bg-slate-50 text-slate-400 line-through'
                          : hecha
                            ? 'border-l-emerald-500 bg-emerald-50/60 text-slate-700'
                            : 'border-l-brand-500 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="tnum text-slate-500">{x.cita.hora ?? '—'}</span>{' '}
                      <span className="font-medium">{x.client.nombre}</span>
                      {hecha && <span className="ml-1 text-emerald-600">✓</span>}
                    </button>
                  );
                })}
                {!delDia.length && <p className="py-2 text-center text-[10px] text-slate-300">—</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── La cita abierta ─────────────────────────────── */}
      {elegida && (
        <DetalleDeCita
          client={elegida.client}
          cita={elegida.cita}
          hoy={hoy}
          onGuardar={(c) => escribir(elegida.client, conLaCita(elegida.client, c, hoy))}
          onRealizada={() =>
            escribir(elegida.client, marcarRealizada(elegida.client, elegida.cita.id!, hoy))
          }
          onDesmarcar={() =>
            escribir(elegida.client, desmarcar(elegida.client, elegida.cita.id!, hoy))
          }
          onAnular={() => escribir(elegida.client, anular(elegida.client, elegida.cita.id!, hoy))}
          onCobrar={(importe, metodo) =>
            escribir(
              elegida.client,
              cobrarDeLaCita(elegida.client, elegida.cita.id!, importe, { metodo }, hoy),
            )
          }
          onQuitar={() => {
            escribir(elegida.client, sinLaCita(elegida.client, elegida.cita.id!, hoy));
            setAbierta(null);
          }}
          onCerrar={() => setAbierta(null)}
        />
      )}

      {poniendo && (
        <NuevaCita
          clients={clients}
          dia={iso(hoy)}
          onCerrar={() => setPoniendo(false)}
          onPoner={(client, cita) => {
            escribir(client, conLaCita(client, cita, hoy));
            setLunes(lunesDe(cita.fecha));
            setPoniendo(false);
          }}
        />
      )}

      {/* ── El mes ──────────────────────────────────────── */}
      <Card
        title={`Cómo va ${nombreDelMes(mesDe(iso(hoy)))}`}
        subtitle="Sale de las citas que has marcado y de los pagos apuntados. El detalle está en Mi cuenta."
        actions={
          <Link to="/perfil" className="text-xs text-brand-700 underline">
            Ver el año
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Consultas hechas" value={mes.consultas} />
          <Stat label="Entró en caja" value={dinero(mes.cobrado, moneda)} emphasis />
          <Stat label="Trabajo hecho" value={dinero(mes.devengado, moneda)} />
          <Stat label="Gastos" value={dinero(mes.gastos, moneda)} />
        </div>
        {mes.consultas === 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            Todavía ninguna consulta marcada este mes.
          </p>
        )}
      </Card>
    </div>
  );
}

// ── Poner una cita ───────────────────────────────────────────────────

function NuevaCita({
  clients,
  dia,
  onPoner,
  onCerrar,
}: {
  clients: Client[];
  dia: string;
  onPoner: (client: Client, cita: Cita) => void;
  onCerrar: () => void;
}) {
  const conFicha = clients.filter((c) => !c.soloReto);
  const [clientId, setClientId] = useState(conFicha[0]?.id ?? '');
  const [cita, setCita] = useState<Cita>({ fecha: dia, hora: '10:00', duracionMin: 60, modo: 'consulta' });

  const client = clients.find((c) => c.id === clientId);

  return (
    <Card title="Nueva cita">
      <div className="grid gap-2 sm:grid-cols-5">
        <Field label="Quién" className="sm:col-span-2">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {conFicha.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Día">
          <Input
            type="date"
            value={cita.fecha}
            onChange={(e) => setCita((c) => ({ ...c, fecha: e.target.value }))}
          />
        </Field>
        <Field label="Hora">
          <Input
            type="time"
            value={cita.hora ?? ''}
            onChange={(e) => setCita((c) => ({ ...c, hora: e.target.value }))}
          />
        </Field>
        <Field label="Cómo">
          <Select
            value={cita.modo}
            onChange={(e) => setCita((c) => ({ ...c, modo: e.target.value as Cita['modo'] }))}
          >
            {MODOS_CITA.map((m) => (
              <option key={m} value={m}>
                {LABEL_MODO_CITA[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          onClick={() => client && cita.fecha && onPoner(client, cita)}
          disabled={!client || !cita.fecha}
        >
          Ponerla
        </Button>
        <Button variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
      {!conFicha.length && (
        <p className="mt-2 text-[11px] text-slate-500">
          Todavía no hay clientas de consulta a las que citar.
        </p>
      )}
    </Card>
  );
}
