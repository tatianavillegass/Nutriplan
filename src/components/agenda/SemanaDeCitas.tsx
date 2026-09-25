import { useState } from 'react';
import type { Client } from '../../types/client';
import {
  PASO_MIN,
  carrilesDelDia,
  citasDelDia,
  comoHora,
  duracionDe,
  enMinutos,
  franjasDeLaSemana,
  iso,
} from '../../utils/citas';

interface Props {
  clients: Client[];
  /** Lunes de la semana que se pinta. */
  dias: string[];
  hoy: Date;
  onAbrir: (clientId: string, citaId: string) => void;
  /** Pulsar un hueco libre: se agenda ahí. */
  onHueco: (fecha: string, hora: string) => void;
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Alto de un cuarto de hora, en píxeles. Al pasar de media hora a cuarto se
 * duplicaron las filas, así que cada una baja a la mitad: la jornada entera
 * sigue entrando en una pantalla.
 */
const ALTO = 16;

/**
 * LA SEMANA CON SUS HORAS
 *
 * Antes era una lista por día y servía para mirar, pero no para **agendar**:
 * para poner una cita había que abrir un formulario aparte y escribir el día y
 * la hora a mano, cuando lo que ella hace es mirar dónde tiene hueco el viernes
 * y pulsarlo. Ahora cada media hora libre es un botón, y la cita se abre con
 * ese día y esa hora ya puestos.
 *
 * **Media hora de paso, no un cuarto**: las consultas duran 30, 45 o 60 minutos
 * y ninguna empieza a y cuarto; con franjas de quince la semana se va a
 * cincuenta filas y encontrar el hueco cuesta más que ponerlo.
 *
 * **Cada cita ocupa lo que dura**, así que se ve de un vistazo que el jueves
 * está lleno y el viernes no — que es la pregunta de verdad cuando alguien
 * pide hora por teléfono.
 */
export function SemanaDeCitas({ clients, dias, hoy, onAbrir, onHueco }: Props) {
  /**
   * De seis de la mañana a diez de la noche, que es la jornada. Las 24 horas
   * están a un botón para el caso raro, pero **la rejilla nunca se sale del
   * día**: estirándose sin tope, un dedazo en los minutos de una cita la
   * mandaba a «las 78:00».
   */
  const [todoElDia, setTodoElDia] = useState(false);
  const franjas = franjasDeLaSemana(clients, dias, todoElDia);
  const arranca = enMinutos(franjas[0] ?? '08:00');
  const alto = franjas.length * ALTO;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="min-w-[46rem]">
        {/* ── Cabecera de los días ─────────────────────── */}
        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-slate-200">
          <div />
          {dias.map((dia, i) => {
            const cuentan = citasDelDia(clients, dia).filter(
              (x) => x.cita.estado !== 'anulada',
            ).length;
            const esHoy = dia === iso(hoy);
            return (
              <div
                key={dia}
                className={`border-l border-slate-100 px-1.5 py-1.5 text-center ${
                  esHoy ? 'bg-brand-50/60' : ''
                }`}
              >
                <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                  {DIAS[i]} {Number(dia.slice(-2))}
                </p>
                <p
                  className={`text-[10px] ${
                    cuentan ? 'text-emerald-700' : 'text-slate-300'
                  }`}
                >
                  {cuentan} {cuentan === 1 ? 'cita' : 'citas'}
                </p>
              </div>
            );
          })}
        </div>

        {/* ── Las horas ────────────────────────────────── */}
        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
          {/* Columna de la hora: sólo en punto, que a y media se sobreentiende. */}
          <div style={{ height: alto }} className="relative">
            {franjas.map((h, i) => (
              <div
                key={h}
                style={{ top: i * ALTO, height: ALTO }}
                className="absolute right-1.5 left-0 text-right"
              >
                {h.endsWith(':00') && (
                  <span className="tnum text-[10px] text-slate-400">{h}</span>
                )}
              </div>
            ))}
          </div>

          {dias.map((dia) => {
            const delDia = citasDelDia(clients, dia);
            /* Las que caen a la vez se reparten el ancho, o la de abajo
               desaparece y parece que la agenda se ha comido una cita. */
            const carriles = carrilesDelDia(delDia);
            const esHoy = dia === iso(hoy);
            return (
              <div
                key={dia}
                style={{ height: alto }}
                className={`relative border-l border-slate-100 ${esHoy ? 'bg-brand-50/30' : ''}`}
              >
                {/* Los huecos: uno por franja, y pulsarlos agenda ahí. */}
                {franjas.map((h, i) => (
                  <button
                    key={h}
                    onClick={() => onHueco(dia, h)}
                    title={`Agendar el ${dia} a las ${h}`}
                    aria-label={`Agendar el ${dia} a las ${h}`}
                    style={{ top: i * ALTO, height: ALTO }}
                    className={`absolute inset-x-0 text-[10px] text-transparent transition hover:bg-brand-100/70 hover:text-brand-700 ${
                      h.endsWith(':00')
                        ? 'border-b border-slate-200'
                        : h.endsWith(':30')
                          ? 'border-b border-slate-100'
                          : ''
                    }`}
                  >
                    +
                  </button>
                ))}

                {/* Y encima, lo que ya hay. */}
                {delDia.map((x) => {
                  const hecha = x.cita.estado === 'realizada';
                  const anulada = x.cita.estado === 'anulada';
                  const empieza = x.cita.hora ? enMinutos(x.cita.hora) : arranca;
                  const dura = duracionDe(x.cita);
                  const { carril, de } = carriles.get(x.id) ?? { carril: 0, de: 1 };
                  return (
                    <button
                      key={`${x.client.id}-${x.id}`}
                      onClick={() => onAbrir(x.client.id, x.id)}
                      style={{
                        top: ((empieza - arranca) / PASO_MIN) * ALTO,
                        height: Math.max(18, (dura / PASO_MIN) * ALTO - 2),
                        left: `calc(${(carril / de) * 100}% + 2px)`,
                        width: `calc(${100 / de}% - 4px)`,
                      }}
                      className={`absolute overflow-hidden rounded border-l-4 px-1.5 text-left text-[11px] leading-tight transition ${
                        anulada
                          ? 'border-l-slate-200 bg-slate-50 text-slate-400 line-through'
                          : hecha
                            ? 'border-l-emerald-500 bg-emerald-50 text-slate-700'
                            : 'border-l-brand-500 bg-brand-50 text-slate-700 hover:bg-brand-100'
                      }`}
                    >
                      <span className="tnum text-[10px] text-slate-500">
                        {x.cita.hora ?? '—'}
                      </span>{' '}
                      <span className="font-medium">{x.client.nombre.split(' ')[0]}</span>
                      {hecha && <span className="ml-0.5 text-emerald-600">✓</span>}
                    </button>
                  );
                })}

                {/* La raya de ahora mismo, sólo en el día de hoy. */}
                {esHoy && (() => {
                  const ahora = hoy.getHours() * 60 + hoy.getMinutes();
                  if (ahora < arranca || ahora > arranca + franjas.length * PASO_MIN) return null;
                  return (
                    <div
                      aria-hidden
                      style={{ top: ((ahora - arranca) / PASO_MIN) * ALTO }}
                      className="pointer-events-none absolute inset-x-0 h-px bg-brand-500"
                    />
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5">
        <p className="text-[10px] text-slate-400">
          Pulsa un hueco para agendar ahí — van de cuarto en cuarto de hora. De{' '}
          {franjas[0]} a {comoHora(arranca + franjas.length * PASO_MIN)}.
        </p>
        <button
          onClick={() => setTodoElDia((v) => !v)}
          className="text-[10px] text-brand-700 underline"
        >
          {todoElDia ? 'Ver sólo el horario de consulta' : 'Ver las 24 horas'}
        </button>
      </div>
    </div>
  );
}
