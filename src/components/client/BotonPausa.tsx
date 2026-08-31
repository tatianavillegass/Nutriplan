import { useEffect, useMemo, useState } from 'react';
import type { Pausa } from '../../types/diary';
import {
  EJERCICIOS,
  EMOCIONES,
  QUE_HIZO,
  QUE_HIZO_LABELS,
  SENALES,
  queEjercicio,
  siguientePregunta,
  tresActividades,
  type EjercicioId,
  type QueHizo,
  type Respuestas,
} from '../../utils/hambreEmocional';
import { uid } from '../../utils/storage';
import { Button } from '../common/ui';

interface Props {
  /** Las actividades que escribió su nutricionista. */
  actividades?: string[];
  onGuardar: (pausa: Pausa) => void;
}

/**
 * PARAR UN MOMENTO
 *
 * El árbol de decisión de la guía de hambre emocional, vivo. En papel hay que
 * buscar qué ejercicio toca; aquí se llega a él en dos o tres toques, que es la
 * diferencia entre hacerlo y no hacerlo.
 *
 * SE LLAMA «PAUSA» Y NO «HE TENIDO UN EPISODIO»
 * =============================================
 * Un botón que se llama así es una casilla de confesión, y a las once de la
 * noche —que es justo cuando hace falta— no lo pulsa nadie. Éste es una
 * herramienta que se coge.
 *
 * Y NO SE CUENTA
 * ==============
 * Ni racha, ni «van tres esta semana», ni nada que se parezca a un marcador.
 * Los números los ve la nutricionista, que sabe qué hacer con ellos.
 *
 * LOS CINCO MINUTOS SON DE VERDAD
 * ===============================
 * El temporizador corre en la app. Es lo único de los cinco ejercicios que el
 * papel no puede hacer, y probablemente lo que más sirve: nadie pone un
 * temporizador de cocina para no abrir la nevera.
 */
export function BotonPausa({ actividades, onGuardar }: Props) {
  const [abierta, setAbierta] = useState(false);

  if (!abierta)
    return (
      <button
        onClick={() => setAbierta(true)}
        className="w-full rounded-2xl border border-teal-200 bg-teal-50/60 p-4 text-left transition hover:border-teal-300"
      >
        <p className="text-sm font-semibold text-teal-900">Pausa</p>
        <p className="mt-0.5 text-xs leading-snug text-slate-600">
          Parar un momento antes de decidir. Está aquí siempre que la necesites.
        </p>
      </button>
    );

  return (
    <Dentro
      actividades={actividades}
      onCerrar={() => setAbierta(false)}
      onGuardar={(p) => {
        onGuardar(p);
        setAbierta(false);
      }}
    />
  );
}

type Paso = 'momento' | 'arbol' | 'emocion' | 'ejercicio' | 'cierre';

function Dentro({
  actividades,
  onCerrar,
  onGuardar,
}: {
  actividades?: string[];
  onCerrar: () => void;
  onGuardar: (p: Pausa) => void;
}) {
  const [paso, setPaso] = useState<Paso>('momento');
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [borrador, setBorrador] = useState<Partial<Pausa>>({});

  const ejercicioId = queEjercicio(respuestas);
  const pregunta = siguientePregunta(respuestas);
  const sugeridas = useMemo(
    () => tresActividades(actividades, new Date().getMinutes()),
    [actividades],
  );

  const poner = (patch: Partial<Pausa>) => setBorrador((b) => ({ ...b, ...patch }));

  const guardar = () =>
    onGuardar({
      id: uid('pa_'),
      hora: new Date().toISOString(),
      momento: respuestas.yaComio ? 'despues' : 'antes',
      ejercicio: ejercicioId,
      ...borrador,
    } as Pausa);

  return (
    <section className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-teal-900">Pausa</p>
        <button onClick={onCerrar} className="text-xs text-slate-500 hover:underline">
          Cerrar
        </button>
      </div>

      {/*
        LO PRIMERO NO ES UNA PREGUNTA SOBRE ELLA
        Es sobre el momento, y las dos respuestas son igual de válidas. Si la
        primera pantalla ya la hace sentir que llega tarde, no hay segunda.
      */}
      {paso === 'momento' && (
        <div className="mt-3">
          <p className="text-sm text-slate-700">¿Dónde estás ahora?</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Opcion
              titulo="Todavía no he comido"
              pie="Vamos a parar un momento"
              onClick={() => {
                setRespuestas({});
                setPaso('arbol');
              }}
            />
            <Opcion
              titulo="Ya he comido"
              pie="Lo apuntamos y ya está"
              onClick={() => {
                setRespuestas({ yaComio: true });
                setPaso('emocion');
              }}
            />
          </div>
        </div>
      )}

      {/* El árbol de Tats, una pregunta cada vez. */}
      {paso === 'arbol' && (
        <div className="mt-3">
          {pregunta ? (
            <>
              <p className="text-sm text-slate-700">{pregunta.texto}</p>
              <div className="mt-2 flex gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setRespuestas((r) => ({ ...r, [pregunta.campo]: v }))}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 transition hover:border-teal-400"
                  >
                    {v ? 'Sí' : 'No'}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Aterriza
              ejercicio={ejercicioId!}
              onSeguir={() => setPaso(ejercicioId === 'emocion' ? 'emocion' : 'ejercicio')}
            />
          )}
        </div>
      )}

      {paso === 'emocion' && (
        <RuedaDeEmociones
          elegida={borrador.emocion}
          intensidad={borrador.intensidad}
          onElegir={(emocion) => poner({ emocion })}
          onIntensidad={(intensidad) => poner({ intensidad })}
          onSeguir={() => setPaso(respuestas.yaComio ? 'cierre' : 'ejercicio')}
        />
      )}

      {paso === 'ejercicio' && ejercicioId && (
        <ElEjercicio
          id={ejercicioId}
          borrador={borrador}
          sugeridas={sugeridas}
          onPoner={poner}
          onTerminar={() => setPaso('cierre')}
        />
      )}

      {paso === 'cierre' && (
        <Cierre borrador={borrador} onPoner={poner} onGuardar={guardar} />
      )}
    </section>
  );
}

function Opcion({
  titulo,
  pie,
  onClick,
}: {
  titulo: string;
  pie: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-teal-400"
    >
      <span className="block text-sm font-medium text-slate-800">{titulo}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{pie}</span>
    </button>
  );
}

/** Qué ejercicio le ha tocado, dicho antes de empezarlo. */
function Aterriza({ ejercicio, onSeguir }: { ejercicio: EjercicioId; onSeguir: () => void }) {
  const e = EJERCICIOS[ejercicio];
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs tracking-wide text-teal-700 uppercase">Ejercicio {e.numero}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{e.nombre}</p>
      <p className="mt-0.5 text-xs leading-snug text-slate-600">{e.para}</p>
      <div className="mt-3">
        <Button onClick={onSeguir}>Empezar</Button>
      </div>
    </div>
  );
}

function RuedaDeEmociones({
  elegida,
  intensidad,
  onElegir,
  onIntensidad,
  onSeguir,
}: {
  elegida?: string;
  intensidad?: number;
  onElegir: (e: string) => void;
  onIntensidad: (n: number) => void;
  onSeguir: () => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-sm text-slate-700">¿Qué estás sintiendo?</p>
      <div className="mt-2 max-h-72 space-y-2.5 overflow-y-auto rounded-xl bg-white p-3">
        {EMOCIONES.map((f) => (
          <div key={f.id}>
            <p className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
              {f.nombre}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {f.emociones.map((e) => (
                <button
                  key={e}
                  onClick={() => onElegir(e)}
                  aria-pressed={elegida === e}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    elegida === e
                      ? 'border-teal-500 bg-teal-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {elegida && (
        <div className="mt-3">
          <p className="text-xs text-slate-700">¿Cuánto, del 1 al 10?</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => onIntensidad(n)}
                aria-label={`Intensidad ${n} de 10`}
                aria-pressed={intensidad === n}
                className={`h-8 w-8 rounded-lg border text-xs transition ${
                  intensidad === n
                    ? 'border-teal-500 bg-teal-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        {/* Se puede seguir sin elegir nada: no saberlo también es un dato. */}
        <Button onClick={onSeguir}>{elegida ? 'Seguir' : 'No sabría decir'}</Button>
      </div>
    </div>
  );
}

function ElEjercicio({
  id,
  borrador,
  sugeridas,
  onPoner,
  onTerminar,
}: {
  id: EjercicioId;
  borrador: Partial<Pausa>;
  sugeridas: string[];
  onPoner: (p: Partial<Pausa>) => void;
  onTerminar: () => void;
}) {
  const e = EJERCICIOS[id];

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl bg-white p-3">
        <p className="text-[10px] tracking-wide text-teal-700 uppercase">
          Ejercicio {e.numero} · {e.nombre}
        </p>
        <ul className="mt-1.5 space-y-1">
          {e.preguntas.map((p) => (
            <li key={p} className="flex gap-2 text-xs leading-snug text-slate-700">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-400" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      {id === 'cinco' && <Temporizador onListo={() => onPoner({ espero: true })} />}

      {id === 'cuerpo' && (
        <ElHambre valor={borrador.hambre} onElegir={(hambre) => onPoner({ hambre })} />
      )}

      {(id === 'pausa' || id === 'cuerpo') && (
        <Campo
          etiqueta="¿Qué necesitas de verdad?"
          valor={borrador.necesidad ?? ''}
          placeholder="Descansar, que me escuchen, salir de aquí…"
          onChange={(necesidad) => onPoner({ necesidad })}
        />
      )}

      {/*
        LA LISTA DE ACTIVIDADES, EN EL MOMENTO
        «¿Qué podrías hacer para cuidarte igual?» delante de una casilla vacía y
        a las once de la noche no se responde. Con tres opciones concretas, sí.
      */}
      {(id === 'pausa' || id === 'cinco') && (
        <div className="rounded-xl bg-white p-3">
          <p className="text-xs text-slate-700">¿Y si haces otra cosa?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sugeridas.map((a) => (
              <button
                key={a}
                onClick={() => onPoner({ actividad: a, queHizo: 'otra-cosa' })}
                aria-pressed={borrador.actividad === a}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  borrador.actividad === a
                    ? 'border-teal-500 bg-teal-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button onClick={onTerminar}>Seguir</Button>
    </div>
  );
}

/**
 * CINCO MINUTOS DE VERDAD
 *
 * No una cuenta atrás que agobie: sólo los minutos que quedan, en grande, y la
 * posibilidad de salir cuando quiera. Las ganas suelen bajar solas en ese rato,
 * y comprobarlo una vez vale más que oírlo diez.
 */
function Temporizador({ onListo }: { onListo: () => void }) {
  const [quedan, setQuedan] = useState<number | null>(null);

  useEffect(() => {
    if (quedan === null || quedan <= 0) return;
    const t = setTimeout(() => setQuedan((q) => (q ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [quedan]);

  useEffect(() => {
    if (quedan === 0) onListo();
    // onListo sólo escribe en el borrador; no hace falta en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quedan]);

  if (quedan === null)
    return (
      <button
        onClick={() => setQuedan(300)}
        className="w-full rounded-xl border border-teal-300 bg-white px-4 py-3 text-sm font-medium text-teal-800 transition hover:bg-teal-50"
      >
        Poner cinco minutos
      </button>
    );

  const m = Math.floor(quedan / 60);
  const s = String(quedan % 60).padStart(2, '0');

  return (
    <div className="rounded-xl bg-white p-4 text-center">
      {quedan > 0 ? (
        <>
          <p className="tnum text-3xl font-semibold text-teal-800">
            {m}:{s}
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-500">
            No tienes que hacer nada. Respira y deja que pase.
          </p>
          <button
            onClick={() => setQuedan(0)}
            className="mt-2 text-[11px] text-slate-400 hover:underline"
          >
            Saltar
          </button>
        </>
      ) : (
        <p className="text-sm text-teal-800">Han pasado. ¿Cómo estás ahora?</p>
      )}
    </div>
  );
}

function ElHambre({
  valor,
  onElegir,
}: {
  valor?: Pausa['hambre'];
  onElegir: (v: NonNullable<Pausa['hambre']>) => void;
}) {
  const opciones: { id: NonNullable<Pausa['hambre']>; texto: string }[] = [
    { id: 'fisica', texto: 'Hambre de verdad' },
    { id: 'emocional', texto: 'Es la emoción' },
    { id: 'no-lo-se', texto: 'No lo sé' },
  ];
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs text-slate-700">¿Qué crees que es?</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button
            key={o.id}
            onClick={() => onElegir(o.id)}
            aria-pressed={valor === o.id}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${
              valor === o.id
                ? 'border-teal-500 bg-teal-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400'
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  placeholder,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-700">{etiqueta}</span>
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
      />
    </label>
  );
}

function Cierre({
  borrador,
  onPoner,
  onGuardar,
}: {
  borrador: Partial<Pausa>;
  onPoner: (p: Partial<Pausa>) => void;
  onGuardar: () => void;
}) {
  const senales = borrador.senales ?? [];
  const alternar = (id: string) =>
    onPoner({
      senales: senales.includes(id) ? senales.filter((x) => x !== id) : [...senales, id],
    });

  return (
    <div className="mt-3 space-y-3">
      <Campo
        etiqueta="¿Qué estaba pasando?"
        valor={borrador.contexto ?? ''}
        placeholder="Discutí con mi pareja, día largo de trabajo, sola en casa…"
        onChange={(contexto) => onPoner({ contexto })}
      />

      {/*
        SIN APROBADO NI SUSPENSO
        A veces comer es la respuesta correcta —tenía hambre—, y poner un
        «resistí / caí» convertiría cada pausa en un examen.
      */}
      <div className="rounded-xl bg-white p-3">
        <p className="text-xs text-slate-700">¿Qué has hecho?</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {QUE_HIZO.map((q) => (
            <button
              key={q}
              onClick={() => onPoner({ queHizo: q })}
              aria-pressed={borrador.queHizo === q}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                borrador.queHizo === q
                  ? 'border-teal-500 bg-teal-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400'
              }`}
            >
              {QUE_HIZO_LABELS[q as QueHizo]}
            </button>
          ))}
        </div>
      </div>

      <Campo
        etiqueta="¿Cómo estás ahora?"
        valor={borrador.despues ?? ''}
        placeholder="Más tranquila, igual, con la sensación de que se me ha pasado…"
        onChange={(despues) => onPoner({ despues })}
      />

      {/*
        LO QUE HAY QUE VER PRONTO
        Se pregunta en primera persona, sin juicio y siendo opcional. Sólo lo
        lee la nutricionista: en ninguna pantalla suya vuelve a aparecer.
      */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs text-slate-700">¿Te ha pasado algo de esto?</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
          Opcional, y lo lee sólo tu nutricionista. No hay respuesta mala.
        </p>
        <div className="mt-2 space-y-1">
          {SENALES.map((s) => (
            <button
              key={s.id}
              onClick={() => alternar(s.id)}
              aria-pressed={senales.includes(s.id)}
              className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-slate-50"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] ${
                  senales.includes(s.id)
                    ? 'border-teal-500 bg-teal-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {senales.includes(s.id) ? '✓' : ''}
              </span>
              <span className="text-xs text-slate-700">{s.texto}</span>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={onGuardar}>Guardar</Button>
    </div>
  );
}
