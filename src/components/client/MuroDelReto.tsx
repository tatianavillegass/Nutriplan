import { useEffect, useState } from 'react';
import type { Reto } from '../../types/reto';
import {
  apuntarEnElMuro,
  comoVaElGrupo,
  enumerar,
  leerMuro,
  type SenalDelMuro,
} from '../../utils/muro';

interface Props {
  reto: Reto;
  hoy: string;
  /** Día del reto en el que vamos. */
  dia: number;
  clienteId: string;
  nombre: string;
  /** Si ella ha cerrado hoy: es lo que se apunta en el muro. */
  cerradoHoy: boolean;
}

/**
 * NO ESTÁS SOLA EN ESTO
 *
 * Dos cosas y nada más: quién ha aparecido hoy y cómo va el grupo entero.
 *
 * No hay publicaciones ni fotos a propósito. En un grupo de nutrición, un muro
 * abierto termina siempre en fotos de cuerpos y en «yo he bajado tres kilos»,
 * que es exactamente lo que se decidió no hacer con el ranking y volvería por
 * la puerta de atrás. Aquí lo único que se enseña es quién ha aparecido, que es
 * lo que de verdad acompaña.
 *
 * Y la meta es común: se gana o se pierde en equipo, así que la que va floja no
 * queda última, queda arropada.
 */
export function MuroDelReto({ reto, hoy, dia, clienteId, nombre, cerradoHoy }: Props) {
  const [senales, setSenales] = useState<SenalDelMuro[] | null>(null);

  /**
   * Se apunta su día y se lee el muro. Se escribe aunque no haya cerrado: la
   * regla del servidor pide tener fila propia en el muro para poder verlo, así
   * que sin esto quien empieza no vería a nadie.
   */
  useEffect(() => {
    let vivo = true;
    const ir = async () => {
      await apuntarEnElMuro({
        retoId: reto.id,
        clienteId,
        nombre,
        fecha: hoy,
        cerrado: cerradoHoy,
      });
      const leidas = await leerMuro(reto.id, reto.fechaInicio);
      if (vivo) setSenales(leidas);
    };
    void ir();
    return () => {
      vivo = false;
    };
  }, [reto.id, reto.fechaInicio, clienteId, nombre, hoy, cerradoHoy]);

  if (!senales?.length) return null;

  const grupo = comoVaElGrupo(senales, hoy, dia);
  const pct = grupo.posibles > 0 ? Math.min(100, (grupo.cerrados / grupo.posibles) * 100) : 0;

  /**
   * Sola en el muro no hay grupo del que hablar, pero esconder la sección sin
   * más deja la duda de si esto funciona. Se dice que faltan las demás.
   */
  if (grupo.cuantas < 2) {
    return (
      <section className="rounded-2xl border border-brand-200 bg-white p-4 no-print sm:p-5">
        <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">
          No estás sola en esto
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-slate-600">
          Todavía eres la única que ha abierto la app. En cuanto entren las demás verás aquí quién
          va cerrando su día.
        </p>
        {reto.whatsapp && (
          <a
            href={reto.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex w-full items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100"
          >
            Abrir el grupo de WhatsApp
          </a>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-4 no-print sm:p-5">
      <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">
        No estás sola en esto
      </h2>

      <p className="mt-1.5 text-sm leading-snug text-slate-700">
        {grupo.hoy.length === 0 ? (
          <>Hoy todavía no ha cerrado el día nadie. Puedes ser la primera.</>
        ) : (
          <>
            Hoy {grupo.hoy.length === 1 ? 'ha cerrado el día' : 'han cerrado el día'}{' '}
            <strong className="font-semibold text-brand-900">{enumerar(grupo.hoy)}</strong>
            {grupo.hoy.length < grupo.cuantas && (
              <span className="text-slate-500">
                {' '}
                — {grupo.hoy.length} de {grupo.cuantas}
              </span>
            )}
            .
          </>
        )}
      </p>

      {/* La meta común: se gana en equipo o no se gana. */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
            Entre todas
          </span>
          <span className="tnum text-xs text-slate-600">
            {grupo.cerrados} de {grupo.posibles} días
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Los días que ha cerrado el grupo entero, de los que se podían cerrar. Cada día que
          aparece una, sube para todas.
        </p>
      </div>

      {reto.whatsapp && (
        <a
          href={reto.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex w-full items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100"
        >
          Abrir el grupo de WhatsApp
        </a>
      )}

      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        Aquí sólo se ve quién ha cerrado su día. Lo que comes, lo que pesas y lo que escribes no lo
        ve nadie más que tu nutricionista.
      </p>
    </section>
  );
}
