import type { Programa } from '../../types/client';
import type { DondeVa, ComoVaElMes } from '../../utils/programa';
import { felicitacionDeMes } from '../../utils/programa';

interface Props {
  programa: Programa;
  donde: DondeVa;
  mes: ComoVaElMes;
  /** Su mejor racha, para poder felicitarla por lo que hizo. */
  mejorRacha: number;
  /** Qué días de este mes ha cerrado, para la tira. */
  cerrados: Set<string>;
  hoy: string;
}

/**
 * TU PROGRAMA
 *
 * Un reto consigo misma: consulta de siempre, pero con principio y final.
 *
 * SE CUENTA POR MESES
 * ===================
 * «Día 1 de 90» el primer día dice *te quedan 89*, que es lo contrario de lo
 * que hace falta al empezar. Por meses el horizonte es corto —«mes 1, día
 * 12»— y el total sólo aparece al cambiar de mes, que es cuando es una buena
 * noticia. Nunca una cuenta atrás.
 *
 * Y LA TIRA ES DE ESTE MES, NO DE LOS NOVENTA DÍAS
 * ================================================
 * Treinta casillas se leen de un vistazo; noventa son un muro. Los días que
 * aún no han llegado se pintan en gris claro, no en rojo: el futuro no está
 * fallado.
 */
export function TuPrograma({ programa, donde, mes, mejorRacha, cerrados, hoy }: Props) {
  if (donde.terminado) {
    return (
      <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
        <p className="text-sm font-semibold text-brand-900">
          Has terminado {programa.nombre}
        </p>
        <p className="mt-1 text-xs leading-snug text-slate-600">
          {programa.dias} días. Habla con tu nutricionista para ver qué viene ahora.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-brand-900">{programa.nombre}</p>
        <p className="tnum text-xs text-slate-600">
          Mes {donde.mes} · día {donde.diaDelMes}
        </p>
      </div>

      {/*
        El mensaje del cambio de mes celebra lo que hizo —días cerrados, su
        mejor racha— y nunca lo que pesa: si felicitara por kilos, el mes que
        no baje se leería como un suspenso.
      */}
      {donde.estrenaMes && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-snug text-brand-900">
          {felicitacionDeMes(donde.mes, mes.cerrados, mejorRacha)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1">
        {donde.diasDelMes.map((fecha) => {
          const pasado = fecha <= hoy;
          const cerrado = cerrados.has(fecha);
          return (
            <span
              key={fecha}
              title={fecha}
              aria-label={cerrado ? `${fecha}, cerrado` : fecha}
              className={`flex h-6 w-6 items-center justify-center rounded text-[10px] ${
                cerrado
                  ? 'bg-brand-600 text-white'
                  : pasado
                    ? 'bg-white text-slate-300'
                    : 'bg-slate-100 text-slate-300'
              } ${fecha === hoy ? 'ring-2 ring-brand-400' : ''}`}
            >
              {cerrado ? '✓' : ''}
            </span>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-snug text-slate-600">
        {mes.cerrados} de {mes.posibles} días cerrados este mes
        {donde.mes < donde.meses ? ` · mes ${donde.mes} de ${donde.meses}` : ''}
      </p>
    </section>
  );
}
