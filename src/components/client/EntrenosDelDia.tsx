import { useState } from 'react';
import type { ComoFue, Actividad, RegistroDia, TipoDeEntreno } from '../../types/diary';
import { COMO_FUE_LABELS, TIPOS_DE_ENTRENO, TIPO_DE_ENTRENO_LABELS } from '../../types/diary';
import {
  cuantosEstaSemana,
  duracionLegible,
  nombreDelEntreno,
  semanaDeEntrenos,
} from '../../utils/entrenos';
import { nombreDelDia } from '../../utils/menuSemana';

interface Props {
  /** Todos sus días, para pintar la semana. */
  registros: RegistroDia[];
  fecha: string;
  /** Lo apuntado hoy. */
  entrenos: Actividad[];
  onGuardar: (entrenos: Actividad[]) => void;
  soloLectura?: boolean;
}

/** Sin objetivo que cumplir, tampoco hay nada que se ponga en rojo. */
const CARAS: [ComoFue, string][] = [
  ['flojo', '😮‍💨'],
  ['normal', '🙂'],
  ['fuerte', '💪'],
];

/**
 * LO QUE ENTRENÓ HOY
 *
 * La comida es la mitad del trabajo. Varias clientas pedían llevar también la
 * cuenta de lo que se mueven, y en consulta eso vale: «esta semana tres, las
 * dos anteriores una» explica un estancamiento mucho mejor que el peso.
 *
 * NO ES UNA META, ASÍ QUE NO SE CUMPLE
 * ====================================
 * Las metas tienen su anillo y su «2 de 3» porque dos litros de agua se beben
 * o no se beben. Un entrenamiento no funciona así: tres a la semana es mucho
 * para quien venía de cero y poco para quien prepara una carrera, y quien está
 * lesionada no ha fallado nada. Aquí se cuenta lo que hizo —«3 esta semana»— y
 * no hay objetivo, ni racha, ni ningún día en rojo. La tira de siete días
 * enseña dónde cayeron, que es lo que sirve para repartirlos mejor.
 *
 * SE APUNTA EN DOS TOQUES Y EL RESTO ES OPCIONAL
 * ==============================================
 * Lo único que hace falta es qué hizo. La duración, la cara y la nota se
 * rellenan si le apetece: si para apuntar una salida hay que contestar tres
 * preguntas, se deja de apuntar — y un registro a medias sigue contando.
 */
export function EntrenosDelDia({
  registros,
  fecha,
  entrenos,
  onGuardar,
  soloLectura = false,
}: Props) {
  const [abriendo, setAbriendo] = useState(false);
  const [tipo, setTipo] = useState<TipoDeEntreno>('fuerza');
  const [otro, setOtro] = useState('');
  const [minutos, setMinutos] = useState('');
  const [comoFue, setComoFue] = useState<ComoFue | undefined>();
  const [nota, setNota] = useState('');

  const semana = semanaDeEntrenos(registros, fecha);
  const enLaSemana = cuantosEstaSemana(registros, fecha);

  const limpiar = () => {
    setAbriendo(false);
    setTipo('fuerza');
    setOtro('');
    setMinutos('');
    setComoFue(undefined);
    setNota('');
  };

  const apuntar = () => {
    const m = Number(minutos.replace(',', '.'));
    onGuardar([
      ...entrenos,
      {
        id: `en_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        tipo,
        otro: tipo === 'otro' ? otro.trim() || undefined : undefined,
        minutos: m > 0 ? Math.round(m) : undefined,
        comoFue,
        nota: nota.trim() || undefined,
        createdAt: new Date().toISOString(),
      },
    ]);
    limpiar();
  };

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 no-print">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-violet-900 uppercase">
          Tus entrenos
        </h2>
        {/* La cuenta, sin «de»: no hay ningún número al que llegar. */}
        <span className="tnum text-xs text-violet-700">
          {enLaSemana === 0
            ? 'ninguno esta semana'
            : `${enLaSemana} esta semana`}
        </span>
      </div>

      {/* La tira: dónde cayeron, que es lo que sirve para repartirlos mejor. */}
      <ul className="mb-3 flex gap-1">
        {semana.map((d) => {
          const hay = d.entrenos.length > 0;
          return (
            <li key={d.fecha} className="flex-1">
              <div
                title={
                  hay ? d.entrenos.map((e) => nombreDelEntreno(e)).join(', ') : undefined
                }
                className={`flex h-8 items-center justify-center rounded-lg border text-[11px] font-medium ${
                  hay
                    ? 'border-violet-400 bg-violet-500 text-white'
                    : /* Lo que no ha llegado no está vacío: está por venir. */
                      d.futuro
                      ? 'border-slate-100 bg-white text-slate-300'
                      : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                {nombreDelDia(d.fecha)}
                {d.entrenos.length > 1 && <span className="ml-0.5">{d.entrenos.length}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      {entrenos.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {entrenos.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-slate-800">
                  {nombreDelEntreno(e)}
                  {duracionLegible(e.minutos) && (
                    <span className="tnum ml-1.5 text-xs text-slate-500">
                      {duracionLegible(e.minutos)}
                    </span>
                  )}
                  {e.comoFue && (
                    <span className="ml-1.5" title={COMO_FUE_LABELS[e.comoFue]}>
                      {CARAS.find(([c]) => c === e.comoFue)?.[1]}
                    </span>
                  )}
                </span>
                {e.nota && (
                  <span className="block text-[11px] leading-snug text-slate-500">{e.nota}</span>
                )}
              </span>
              {!soloLectura && (
                <button
                  onClick={() => onGuardar(entrenos.filter((x) => x.id !== e.id))}
                  aria-label={`Quitar ${nombreDelEntreno(e)}`}
                  className="px-1 text-xs text-slate-300 hover:text-red-600"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {soloLectura ? null : abriendo ? (
        <div className="rounded-xl border border-violet-200 bg-white p-3">
          <p className="mb-1.5 text-[11px] text-slate-500">¿Qué has hecho?</p>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_DE_ENTRENO.map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                aria-pressed={tipo === t}
                className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                  tipo === t
                    ? 'border-violet-500 bg-violet-500 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                }`}
              >
                {TIPO_DE_ENTRENO_LABELS[t]}
              </button>
            ))}
          </div>

          {tipo === 'otro' && (
            <input
              autoFocus
              value={otro}
              onChange={(e) => setOtro(e.target.value)}
              placeholder="Padel, escalada, baile…"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              Duración
              <input
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
                inputMode="numeric"
                placeholder="45"
                className="tnum w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-400"
              />
              min
            </label>

            {/* Tres caras, no del 1 al 10: puntuarse el entreno lleva al mismo
                sitio que puntuarse el día. Flojo tampoco es malo. */}
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              ¿Cómo ha ido?
              {CARAS.map(([c, cara]) => (
                <button
                  key={c}
                  onClick={() => setComoFue(comoFue === c ? undefined : c)}
                  aria-pressed={comoFue === c}
                  aria-label={COMO_FUE_LABELS[c]}
                  title={COMO_FUE_LABELS[c]}
                  className={`rounded-lg border px-2 py-1 text-base transition ${
                    comoFue === c
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-200 bg-white hover:border-violet-300'
                  }`}
                >
                  {cara}
                </button>
              ))}
            </span>
          </div>

          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="¿Algo que contar? (opcional)"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />

          <div className="mt-2.5 flex justify-end gap-2">
            <button onClick={limpiar} className="text-xs text-slate-400 hover:underline">
              Cancelar
            </button>
            <button
              onClick={apuntar}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700"
            >
              Apuntar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAbriendo(true)}
          className="w-full rounded-xl border border-violet-300 bg-white px-3 py-2.5 text-sm font-medium text-violet-800 transition hover:bg-violet-50"
        >
          {entrenos.length ? '+ Apuntar otro entreno' : 'Hoy he entrenado'}
        </button>
      )}

      {/*
        Lo mismo que se dice de las metas, y por lo mismo: que un día sin
        entrenar no se lea como que el plan de comer se ha roto.
      */}
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Van por su cuenta: no cuentan en las comidas, ni en las calorías, ni en tu racha. Es sólo
        para ver cómo va la semana.
      </p>
    </section>
  );
}
