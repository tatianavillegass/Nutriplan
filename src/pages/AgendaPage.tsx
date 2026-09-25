import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import type { Client } from '../types/client';
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
import { SemanaDeCitas } from '../components/agenda/SemanaDeCitas';
import { AgendarCita } from '../components/agenda/AgendarCita';
import { Button, Card, Stat } from '../components/common/ui';

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
  /** El hueco que se acaba de pulsar: día y hora de la cita nueva. */
  const [hueco, setHueco] = useState<{ fecha: string; hora: string } | null>(null);
  /**
   * LO QUE SE ABRE, SE VE
   *
   * La cita y la ficha de agendar se pintan **debajo** de la rejilla, y la
   * rejilla ocupa toda la pantalla: al pulsar una consulta no pasaba nada a la
   * vista y había que bajar a mano a buscarla. Se lleva la vista ahí, igual que
   * al cerrar una comida en el selector de recetas.
   */
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierta && !hueco) return;
    /* El `typeof` es por los tests: jsdom no implementa scrollIntoView. */
    if (typeof panel.current?.scrollIntoView === 'function')
      panel.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [abierta, hueco]);

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
          <Button onClick={() => setHueco({ fecha: iso(hoy), hora: '10:00' })}>
            Nueva cita
          </Button>
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
      <SemanaDeCitas
        clients={clients}
        dias={dias}
        hoy={hoy}
        onAbrir={(clientId, citaId) => {
          setHueco(null);
          setAbierta({ clientId, citaId });
        }}
        onHueco={(fecha, hora) => {
          setAbierta(null);
          setHueco({ fecha, hora });
        }}
      />

      {/* ── La cita abierta ─────────────────────────────── */}
      <div ref={panel} className="scroll-mt-4">
      {elegida && (
        <DetalleDeCita
          client={elegida.client}
          clients={clients}
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

      {hueco && (
        <AgendarCita
          clients={clients}
          fecha={hueco.fecha}
          hora={hueco.hora}
          hoy={hoy}
          onCerrar={() => setHueco(null)}
          onPoner={(client, cita) => {
            escribir(client, conLaCita(client, cita, hoy));
            setLunes(lunesDe(cita.fecha));
            setHueco(null);
          }}
        />
      )}

      </div>

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
