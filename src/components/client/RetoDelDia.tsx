import { useState } from 'react';
import type { DayType } from '../../types/plan';
import type { RegistroDia } from '../../types/diary';
import type { EntrenoDeReto, Reto } from '../../types/reto';
import { diaDelReto, entrenosAbiertos, proximaApertura, semanaDeDia } from '../../utils/retos';
import { diaCerrado } from '../../utils/racha';

interface Props {
  reto: Reto;
  hoy: string;
  /** Sus días, para saber cuáles ha cerrado. */
  registros: RegistroDia[];
  dayTypes: DayType[];
  /** Entrenos que ya ha dado por hechos hoy. */
  hechos: string[];
  onEntreno: (entrenoId: string) => void;
}

/** El día del reto al que corresponde una fecha, o 0 si cae fuera. */
function diaDeFecha(reto: Reto, fecha: string): number {
  const d = diaDelReto({ ...reto, fechaInicio: reto.fechaInicio }, fecha);
  return d >= 1 && d <= reto.dias ? d : 0;
}

/**
 * CÓMO VA TU RETO
 *
 * Lo que hace que un reto se sienta como un reto es ver los días caer. Una
 * tira con los treinta días y un ✓ en los cerrados dice de un vistazo por
 * dónde va, y eso es justo lo que se quiere mirar al abrir la app.
 *
 * Se cuentan **días cerrados**, que es lo mismo que la racha: una comida fuera
 * cierra el día igual que una hecha. Si salir a cenar apagara una casilla, la
 * tira estaría enseñando que salir a cenar es un fallo.
 *
 * Las recetas no se repiten aquí: ya salen abajo, en su comida, que es donde
 * se buscan cuando toca comer.
 */
export function RetoDelDia({
  reto,
  hoy,
  registros,
  dayTypes,
  hechos,
  onEntreno,
}: Props) {
  const [verEntrenos, setVerEntrenos] = useState(false);
  const entrenos = entrenosAbiertos(reto, hoy);
  const proxima = proximaApertura(reto, hoy);
  const dia = Math.max(1, diaDelReto(reto, hoy));

  /** Qué días del reto están cerrados, por número de día. */
  const cerrados = new Set<number>();
  for (const r of registros) {
    const n = diaDeFecha(reto, r.fecha);
    if (!n) continue;
    const suTipo = dayTypes.find((d) => d.id === r.dayTypeId) ?? dayTypes[0];
    if (diaCerrado(r, suTipo)) cerrados.add(n);
  }

  const dias = Array.from({ length: reto.dias }, (_, i) => i + 1);

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-4 no-print sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">
          Cómo va tu reto
        </h2>
        <span className="tnum text-xs text-slate-600">
          <strong className="font-semibold text-brand-800">{cerrados.size}</strong> de {dia}{' '}
          {dia === 1 ? 'día cerrado' : 'días cerrados'}
        </span>
      </div>

      {/* La tira de días: un cuadrito por día, con ✓ en los que cerró. */}
      <ol className="mt-2.5 flex flex-wrap gap-1">
        {dias.map((n) => {
          const hecho = cerrados.has(n);
          const esHoy = n === dia;
          const futuro = n > dia;
          return (
            <li
              key={n}
              title={`Día ${n}${hecho ? ' · cerrado' : ''}`}
              className={`tnum flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-medium ${
                hecho
                  ? 'bg-emerald-500 text-white'
                  : futuro
                    ? 'bg-slate-50 text-slate-300'
                    : 'bg-slate-100 text-slate-400'
              } ${esHoy ? 'ring-2 ring-brand-400' : ''}`}
            >
              {hecho ? '✓' : n}
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Un día se cierra cuando marcas todas tus comidas. Comer fuera también lo cierra: salir a
        cenar no es un fallo.
      </p>

      {/* Los entrenos, aparte y plegados: no todos los días toca entrenar. */}
      {entrenos.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            onClick={() => setVerEntrenos((v) => !v)}
            aria-expanded={verEntrenos}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-sm font-medium text-brand-800">
              Entrenos
              <span className="ml-1.5 text-[11px] text-slate-400">
                {entrenos.filter((e) => hechos.includes(e.id)).length} de {entrenos.length} hechos
              </span>
            </span>
            <span aria-hidden className="text-slate-300">
              {verEntrenos ? '⌃' : '⌄'}
            </span>
          </button>

          {verEntrenos && (
            <>
              {proxima && (
                <p className="mt-1 text-[11px] text-slate-500">
                  En la semana {semanaDeDia(proxima.dia)} se abre más
                </p>
              )}
              <ul className="mt-2 space-y-2">
                {entrenos.map((e) => (
                  <EntrenoAbierto
                    key={e.id}
                    entreno={e}
                    hecho={hechos.includes(e.id)}
                    onHecho={() => onEntreno(e.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Un entreno: el vídeo enseña a hacerlo y la lista dice cuántas vueltas van. */
function EntrenoAbierto({
  entreno,
  hecho,
  onHecho,
}: {
  entreno: EntrenoDeReto;
  hecho: boolean;
  onHecho: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <li className="rounded-lg border border-slate-200">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-800">{entreno.nombre}</span>
          {entreno.descripcion && (
            <span className="block text-[11px] leading-snug text-slate-500">
              {entreno.descripcion}
            </span>
          )}
        </span>
        {hecho && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            hecho ✓
          </span>
        )}
        <span aria-hidden className="shrink-0 text-slate-300">
          {abierto ? '⌃' : '⌄'}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-slate-100 px-3 py-2">
          {entreno.videoUrl && (
            <a
              href={entreno.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-2 inline-block text-xs font-medium text-brand-700 underline"
            >
              Ver el vídeo
            </a>
          )}
          {entreno.ejercicios.length > 0 && (
            <ul className="divide-y divide-slate-50">
              {entreno.ejercicios.map((ej) => (
                <li key={ej.id} className="flex flex-wrap items-baseline gap-x-2 py-1 text-xs">
                  <span className="min-w-0 flex-1 text-slate-700">{ej.nombre}</span>
                  <span className="tnum shrink-0 text-slate-500">
                    {[
                      ej.series ? `${ej.series} series` : '',
                      ej.repeticiones ? `× ${ej.repeticiones}` : '',
                      ej.descanso ? `· ${ej.descanso}` : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                  {ej.nota && (
                    <span className="w-full text-[11px] leading-snug text-slate-400">{ej.nota}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Marcarlo es lo que deja ver a la nutricionista si se entrena. */}
          <div className="mt-2 flex justify-end">
            <button
              onClick={onHecho}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                hecho
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100'
              }`}
            >
              {hecho ? 'Hecho ✓' : 'Marcar hecho'}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
