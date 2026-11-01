import { useState } from 'react';
import { masDias, nombreDelDia } from '../../utils/menuSemana';

interface Props {
  /** El día que se está viendo: de aquí arrancan los atajos. */
  hoy: string;
  desde: string;
  hasta: string;
  onCambiar: (desde: string, hasta: string) => void;
  /** Cuántos días del rango se han rellenado repitiendo, y el interruptor. */
  repetidos: number;
  repetir: boolean;
  onRepetir: (v: boolean) => void;
  /** Días del rango que se quedan sin menú y no se ha podido copiar. */
  vacios: number;
}

/**
 * PARA CUÁNTOS DÍAS COMPRA
 *
 * La lista salía de lunes a domingo porque de ahí sale el menú, pero **la
 * semana del calendario no es la del supermercado**. Quien compra los jueves
 * compra de jueves a jueves; quien se va el viernes compra para dos días; y
 * quien quiere dejarlo hecho compra para dos semanas y no vuelve.
 *
 * LOS ATAJOS ARRANCAN HOY
 * =======================
 * «Comprar para dos días» es hoy y mañana, no los dos primeros días de una
 * semana que empezó el lunes. Las fechas sueltas están detrás para el resto
 * de los casos, que son los menos: pedir dos fechas a quien sólo quiere
 * comprar para el fin de semana es tres toques de más.
 */
const ATAJOS = [
  { dias: 2, texto: '2 días' },
  { dias: 3, texto: '3 días' },
  { dias: 7, texto: '1 semana' },
  { dias: 14, texto: '2 semanas' },
];

export function ParaCuantosDias({
  hoy,
  desde,
  hasta,
  onCambiar,
  repetidos,
  repetir,
  onRepetir,
  vacios,
}: Props) {
  const [aMano, setAMano] = useState(false);

  /** Cuántos días coge el rango, los dos extremos incluidos. */
  const cuantos =
    Math.round(
      (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000,
    ) + 1;

  const esAtajo = (dias: number) => desde === hoy && cuantos === dias;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
      <p className="mb-1.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        Para cuántos días
      </p>

      <div className="flex flex-wrap gap-1.5">
        {ATAJOS.map((a) => (
          <button
            key={a.dias}
            onClick={() => {
              setAMano(false);
              onCambiar(hoy, masDias(hoy, a.dias - 1));
            }}
            aria-pressed={!aMano && esAtajo(a.dias)}
            className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
              !aMano && esAtajo(a.dias)
                ? 'border-brand-500 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-400'
            }`}
          >
            {a.texto}
          </button>
        ))}
        <button
          onClick={() => setAMano((v) => !v)}
          aria-pressed={aMano}
          className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
            aMano
              ? 'border-brand-500 bg-brand-600 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-400'
          }`}
        >
          Elegir fechas
        </button>
      </div>

      {aMano && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
          <label className="flex items-center gap-1">
            Del
            <input
              type="date"
              value={desde}
              aria-label="Comprar desde"
              onChange={(e) =>
                e.target.value &&
                onCambiar(e.target.value, e.target.value > hasta ? e.target.value : hasta)
              }
              className="rounded border border-slate-200 px-1.5 py-1"
            />
          </label>
          <label className="flex items-center gap-1">
            al
            <input
              type="date"
              value={hasta}
              min={desde}
              aria-label="Comprar hasta"
              onChange={(e) => e.target.value && onCambiar(desde, e.target.value)}
              className="rounded border border-slate-200 px-1.5 py-1"
            />
          </label>
        </div>
      )}

      <p className="mt-1.5 text-[11px] text-slate-500">
        {cuantos === 1
          ? `Sólo el ${nombreDelDia(desde).toLowerCase()}`
          : `${cuantos} días, del ${nombreDelDia(desde).toLowerCase()} al ${nombreDelDia(
              hasta,
            ).toLowerCase()}`}
      </p>

      {/*
        LO QUE SE HA REPETIDO SE DICE
        =============================
        Casi nadie tiene planificada la semana que viene, así que una lista de
        dos semanas saldría a medias justo cuando más falta hace. Se rellena
        repitiendo —el jueves que viene como este jueves— pero rellenar en
        silencio sería inventarle la compra: se dice cuántos días son y se
        puede quitar.
      */}
      {(repetidos > 0 || (!repetir && vacios > 0)) && (
        <label className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-600">
          <input
            type="checkbox"
            checked={repetir}
            onChange={(e) => onRepetir(e.target.checked)}
            className="mt-0.5 h-3 w-3 shrink-0 rounded border-slate-300"
          />
          <span>
            Repetir este menú en los días que aún no has organizado
            {repetir && repetidos > 0 && (
              <span className="text-slate-500">
                {' '}
                — ahora mismo son {repetidos} {repetidos === 1 ? 'día' : 'días'}
              </span>
            )}
          </span>
        </label>
      )}

      {vacios > 0 && (
        <p className="mt-1.5 text-[11px] text-amber-800">
          {vacios === 1
            ? 'Hay 1 día sin menú, así que no entra en la lista.'
            : `Hay ${vacios} días sin menú, así que no entran en la lista.`}
        </p>
      )}
    </div>
  );
}
