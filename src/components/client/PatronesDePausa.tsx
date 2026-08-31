import { useState } from 'react';
import type { RegistroDia } from '../../types/diary';
import { fechaLegible } from '../../types/diary';
import {
  QUE_HIZO_LABELS,
  franjaDe,
  patronesDe,
  pausasDe,
  type Cuenta,
  type QueHizo,
} from '../../utils/hambreEmocional';

interface Props {
  registros: RegistroDia[];
}

/**
 * LOS PATRONES, PARA LA CONSULTA
 *
 * Aquí sí hay números, porque ésta es la pantalla de la nutricionista y saber
 * si van a más o a menos es su trabajo. En la de la clienta no aparece ninguno.
 *
 * Lo que se busca no es «cuántas»: es la frase que se le puede devolver en
 * consulta. «Los martes por la tarde, aburrimiento, y lo que te funcionó fue
 * salir a andar». Eso es material; un contador no.
 *
 * LAS SEÑALES SE DICEN, NO SE INTERPRETAN
 * =======================================
 * La app no diagnostica ni pone etiquetas ni calcula ningún riesgo: enseña lo
 * que la clienta marcó, con lo que significa clínicamente al lado, para que se
 * hable en consulta — que es donde se habla.
 */
export function PatronesDePausa({ registros }: Props) {
  const [abierto, setAbierto] = useState(false);
  const pausas = pausasDe(registros);

  if (!pausas.length) return null;

  const p = patronesDe(pausas);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Pausas</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {p.total} {p.total === 1 ? 'pausa registrada' : 'pausas registradas'}
          </p>
        </div>
        <button
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="text-xs text-slate-500 hover:underline"
        >
          {abierto ? 'Cerrar' : 'Ver una a una'}
        </button>
      </div>

      {/*
        Lo primero de todo, porque es lo que no puede esperar a la próxima
        consulta. En ámbar y sin dramatizar: son cuatro cosas que ella escribió.
      */}
      {p.senales.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-semibold text-amber-900">Para hablarlo con ella</p>
          <ul className="mt-1.5 space-y-1">
            {p.senales.map((s) => (
              <li key={s.id} className="text-xs leading-snug text-amber-900">
                <span className="font-medium">«{s.texto}»</span>{' '}
                <span className="tnum">
                  · {s.veces} {s.veces === 1 ? 'vez' : 'veces'}
                </span>
                <span className="block text-[11px] text-amber-700">{s.paraTats}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Lista titulo="Qué siente" filas={p.emociones} />
        <Lista titulo="A qué hora" filas={p.franjas} />
        <Lista titulo="Qué está pasando" filas={p.situaciones} />
        {/*
          Lo más útil del panel: se le puede devolver en consulta y es lo único
          que suena a algo que funcionó, en vez de a algo que salió mal.
        */}
        <Lista titulo="Qué le funcionó" filas={p.loQueFunciono} tono="teal" />
      </div>

      {abierto && (
        <ul className="mt-3 space-y-2">
          {pausas.map((x) => (
            <li key={x.id} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-slate-800">
                  {x.emocion ?? 'Sin nombrar'}
                </span>
                {x.intensidad ? (
                  <span className="tnum text-[11px] text-slate-500">{x.intensidad}/10</span>
                ) : null}
                {x.momento === 'despues' && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500">
                    ya había comido
                  </span>
                )}
                <span className="ml-auto text-[11px] text-slate-400">
                  {fechaLegible(x.hora.slice(0, 10))} · {franjaDe(x.hora)?.toLowerCase()}
                </span>
              </div>
              {x.contexto && (
                <p className="mt-0.5 text-xs leading-snug text-slate-600">{x.contexto}</p>
              )}
              {x.necesidad && (
                <p className="mt-0.5 text-xs leading-snug text-slate-500">
                  Necesitaba: {x.necesidad}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {x.hambre && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-600">
                    {x.hambre === 'fisica'
                      ? 'Hambre física'
                      : x.hambre === 'emocional'
                        ? 'Emocional'
                        : 'No lo sabía'}
                  </span>
                )}
                {x.queHizo && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-600">
                    {QUE_HIZO_LABELS[x.queHizo as QueHizo] ?? x.queHizo}
                  </span>
                )}
                {x.actividad && (
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] text-teal-800">
                    {x.actividad}
                  </span>
                )}
                {(x.senales ?? []).length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-900">
                    {x.senales!.length} señal{x.senales!.length === 1 ? '' : 'es'}
                  </span>
                )}
              </div>
              {x.despues && (
                <p className="mt-1 text-xs leading-snug text-slate-500 italic">
                  Después: {x.despues}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Lista({
  titulo,
  filas,
  tono = 'slate',
}: {
  titulo: string;
  filas: Cuenta[];
  tono?: 'slate' | 'teal';
}) {
  if (!filas.length) return null;
  return (
    <div className={`rounded-xl p-3 ${tono === 'teal' ? 'bg-teal-50/60' : 'bg-slate-50'}`}>
      <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        {titulo}
      </p>
      <ul className="mt-1 space-y-0.5">
        {filas.slice(0, 4).map((f) => (
          <li key={f.que} className="flex items-baseline gap-2 text-xs text-slate-700">
            <span className="min-w-0 flex-1 truncate">{f.que}</span>
            <span className="tnum shrink-0 text-slate-400">{f.veces}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
