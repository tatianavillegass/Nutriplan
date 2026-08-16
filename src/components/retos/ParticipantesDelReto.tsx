import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import type { RegistroDia } from '../../types/diary';
import type { Medicion } from '../../types/anthropometry';
import type { Reto } from '../../types/reto';
import { hayCambiosSinEnviar } from '../../types/plan';
import { useEnergy } from '../../hooks/useEnergy';
import { entrenosAbiertos } from '../../utils/retos';
import { PASOS_DE_PREPARACION, preparacionDe } from '../../utils/preparacion';
import { medidasDe, tendenciaDePeso, ultimasMedidas } from '../../utils/misMedidas';
import { Button, fmt } from '../common/ui';

interface Props {
  reto: Reto;
  hoy: string;
  clients: Client[];
  plans: Plan[];
  registros: RegistroDia[];
  mediciones: Medicion[];
  onEnviarPlan: (plan: Plan) => void;
}

/**
 * LAS PARTICIPANTES, UNA A UNA
 *
 * Se despliega el nombre y sale lo que hace falta para trabajar con ella: su
 * gasto calculado, cómo va su preparación, qué ha subido y en qué estado está
 * su plan. Lo que no está aquí es el editor de porciones: eso vive en su ficha
 * y no tiene sentido tenerlo dos veces.
 *
 * EL PLAN SE PUBLICA A TODAS EL MISMO DÍA
 * =======================================
 * Se van montando los planes con calma según van llegando, y el día que
 * empieza el reto se mandan todos de una vez. Sin ese botón habría que entrar
 * en veinte fichas la misma mañana, que es justo el trabajo que hace que un
 * reto de veinte personas no salga rentable.
 */
export function ParticipantesDelReto({
  reto,
  hoy,
  clients,
  plans,
  registros,
  mediciones,
  onEnviarPlan,
}: Props) {
  const [abierta, setAbierta] = useState<string | null>(null);

  const dentro = reto.participantes
    .map((id) => clients.find((c) => c.id === id))
    .filter(Boolean) as Client[];

  const planDe = (id: string) => plans.find((p) => p.clientId === id && !p.archivado);
  const sinEnviar = dentro.filter((c) => {
    const p = planDe(c.id);
    return p && hayCambiosSinEnviar(p);
  });

  if (!dentro.length) {
    return (
      <p className="text-sm text-slate-500">
        Da de alta una solicitud y aparecerá aquí para montarle el plan.
      </p>
    );
  }

  return (
    <div>
      {sinEnviar.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="min-w-0 flex-1 text-xs leading-snug text-amber-900">
            <strong className="font-semibold">
              {sinEnviar.length} {sinEnviar.length === 1 ? 'plan' : 'planes'} sin enviar.
            </strong>{' '}
            Móntalos con calma: no les llega nada hasta que los publiques.
          </p>
          <Button onClick={() => sinEnviar.forEach((c) => onEnviarPlan(planDe(c.id) as Plan))}>
            Publicar a todas
          </Button>
        </div>
      )}

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {dentro.map((c) => (
          <Participante
            key={c.id}
            client={c}
            reto={reto}
            hoy={hoy}
            plan={planDe(c.id)}
            registros={registros.filter((r) => r.clientId === c.id)}
            mediciones={mediciones}
            abierta={abierta === c.id}
            onAbrir={() => setAbierta(abierta === c.id ? null : c.id)}
            onEnviarPlan={onEnviarPlan}
          />
        ))}
      </ul>
    </div>
  );
}

function Participante({
  client,
  reto,
  hoy,
  plan,
  registros,
  mediciones,
  abierta,
  onAbrir,
  onEnviarPlan,
}: {
  client: Client;
  reto: Reto;
  hoy: string;
  plan?: Plan;
  registros: RegistroDia[];
  mediciones: Medicion[];
  abierta: boolean;
  onAbrir: () => void;
  onEnviarPlan: (plan: Plan) => void;
}) {
  const calc = useEnergy(client);
  const preparacion = preparacionDe(registros);
  const pendiente = !!plan && hayCambiosSinEnviar(plan);

  /** Cuántos de los entrenos que ya están abiertos ha marcado como hechos. */
  const abiertos = entrenosAbiertos(reto, hoy);
  const hechos = new Set(registros.flatMap((r) => r.entrenos ?? []));
  const entrenosHechos = abiertos.filter((e) => hechos.has(e.id)).length;

  /** La foto del primer día: puede haberla subido antes de tener cuenta. */
  const fotoDeSusMediciones = mediciones.find((m) => m.clientId === client.id && m.foto)?.foto;

  /** Lo que se mide ella: en un reto online no hay báscula en consulta. */
  const susMedidas = medidasDe(registros);
  const suyas = ultimasMedidas(susMedidas);
  const tendencia = tendenciaDePeso(susMedidas);

  return (
    <li>
      <button
        onClick={onAbrir}
        aria-expanded={abierta}
        className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-800">{client.nombre}</span>
          <span className="block text-[11px] text-slate-400">{client.email}</span>
        </span>
        <span className="tnum shrink-0 text-xs text-slate-500">
          {fmt(calc?.energy.caloriasObjetivo ?? 0)} kcal
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            !plan?.publicado && !plan?.envio
              ? 'bg-amber-100 text-amber-800'
              : pendiente
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {!plan?.publicado && !plan?.envio
            ? 'Sin enviar'
            : pendiente
              ? 'Cambios sin enviar'
              : 'Enviado'}
        </span>
        <span aria-hidden className="shrink-0 text-slate-300">
          {abierta ? '⌃' : '⌄'}
        </span>
      </button>

      {abierta && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-3 py-3">
          {/* ── Lo que hace falta para pautarla ───────────── */}
          <div className="grid gap-2 text-xs sm:grid-cols-4">
            <Dato titulo="Gasto (GET)" valor={`${fmt(calc?.energy.get ?? 0)} kcal`} />
            <Dato
              titulo="Objetivo"
              valor={`${fmt(calc?.energy.caloriasObjetivo ?? 0)} kcal`}
            />
            <Dato titulo="Peso" valor={`${fmt(client.peso, 1)} kg`} />
            <Dato titulo="Altura" valor={`${client.altura} cm`} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to={`/clientes/${client.id}`}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
            >
              Montarle el plan
            </Link>
            {plan && pendiente && (
              <Button variant="outline" onClick={() => onEnviarPlan(plan)}>
                Enviarle el plan
              </Button>
            )}
          </div>

          {/* ── Su preparación ────────────────────────────── */}
          <div>
            <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
              Preparación · {preparacion.hechos.length} de {PASOS_DE_PREPARACION.length}
            </p>
            <ul className="space-y-0.5 text-xs">
              {PASOS_DE_PREPARACION.map((p) => (
                <li key={p.id} className="flex items-baseline gap-2">
                  <span className={preparacion.hechos.includes(p.id) ? 'text-emerald-600' : 'text-slate-300'}>
                    ✓
                  </span>
                  <span className="text-slate-600">{p.titulo}</span>
                </li>
              ))}
            </ul>

            {(preparacion.cintura || preparacion.cadera) && (
              <p className="tnum mt-1 text-xs text-slate-700">
                {preparacion.cintura ? `Cintura ${preparacion.cintura} cm` : ''}
                {preparacion.cintura && preparacion.cadera ? ' · ' : ''}
                {preparacion.cadera ? `Cadera ${preparacion.cadera} cm` : ''}
              </p>
            )}

            {(preparacion.foto ?? fotoDeSusMediciones) && (
              <img
                src={preparacion.foto ?? fotoDeSusMediciones}
                alt={`Foto del primer día de ${client.nombre}`}
                className="mt-2 max-h-48 rounded-lg border border-slate-200"
              />
            )}
          </div>

          {/* ── Lo que se ha medido ella ──────────────────── */}
          <div>
            <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
              Lo que se ha medido
            </p>
            {suyas.peso || suyas.cintura || suyas.cadera ? (
              <p className="tnum text-xs text-slate-700">
                {suyas.peso ? `${fmt(suyas.peso, 1)} kg` : ''}
                {suyas.peso && (suyas.cintura || suyas.cadera) ? ' · ' : ''}
                {suyas.cintura ? `cintura ${fmt(suyas.cintura, 0)} cm` : ''}
                {suyas.cintura && suyas.cadera ? ' · ' : ''}
                {suyas.cadera ? `cadera ${fmt(suyas.cadera, 0)} cm` : ''}
                {suyas.fecha && (
                  <span className="text-slate-400"> · {suyas.fecha}</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-slate-400">Todavía no ha apuntado nada.</p>
            )}

            {/*
              La media de la semana y no el peso de hoy: el de un día son dos
              kilos de agua y de lo que quedó de la cena, y sobre eso no se
              cambia un plan.
            */}
            {tendencia && (
              <p className="tnum mt-0.5 text-xs text-slate-600">
                Tendencia: {tendencia.porSemana > 0 ? '+' : '−'}
                {fmt(Math.abs(tendencia.porSemana), 1)} kg/semana
                <span className="text-slate-400"> · {tendencia.semanas} semanas</span>
              </p>
            )}
          </div>

          {abiertos.length > 0 && (
            <p className="text-xs text-slate-600">
              Entrenos: {entrenosHechos} de {abiertos.length} abiertos
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg bg-white px-2.5 py-1.5">
      <p className="text-[10px] text-slate-400">{titulo}</p>
      <p className="tnum text-sm text-slate-800">{valor}</p>
    </div>
  );
}
