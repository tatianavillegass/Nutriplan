import type { RegistroDia } from '../../types/diary';
import { COMO_FUE_LABELS } from '../../types/diary';
import {
  cuantosEstaSemana,
  duracionLegible,
  entrenosDe,
  mediaPorSemana,
  nombreDelEntreno,
  porSemana,
  porTipo,
} from '../../utils/entrenos';

interface Props {
  registros: RegistroDia[];
  /** Desde qué día se mira. Por defecto hoy; en los tests, uno fijo. */
  fecha?: string;
}

const hoy = () => new Date().toISOString().slice(0, 10);

const CARA: Record<string, string> = { flojo: '😮‍💨', normal: '🙂', fuerte: '💪' };

/** «7 sept» — el lunes de esa semana, que es como se nombra en consulta. */
function lunesLegible(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/**
 * LO QUE ENTRENA, PARA LA CONSULTA
 *
 * Aquí sí hay números, porque es la pantalla de la nutricionista: lo que a la
 * clienta no se le enseña —medias, rachas, comparaciones— a ella le hace falta
 * para preguntar bien. Es lo mismo que con la pausa.
 *
 * Y lo que más sirve no es el total sino **de qué**: alguien que hace cinco
 * clases dirigidas y nada de fuerza tiene una conversación pendiente que un
 * «5 esta semana» no enseña.
 */
export function SusEntrenos({ registros, fecha = hoy() }: Props) {
  const semanas = porSemana(registros, fecha, 8);
  const tipos = porTipo(registros);
  const ultimos = entrenosDe(registros).slice(0, 8);
  const estaSemana = cuantosEstaSemana(registros, fecha);
  const media = mediaPorSemana(registros, fecha);

  if (!ultimos.length)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Entrenos</h3>
        <p className="mt-1.5 text-xs leading-snug text-slate-500">
          Todavía no ha apuntado ninguno. Está encendido en su app, en «Hoy».
        </p>
      </div>
    );

  const tope = Math.max(1, ...semanas.map((s) => s.veces));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Entrenos</h3>
        <span className="tnum text-xs text-slate-500">
          {estaSemana} esta semana
          {/* La media es de semanas cerradas: la de esta iría siempre baja. */}
          {media > 0 && <span className="ml-1.5">· {media}/semana de media</span>}
        </span>
      </div>

      {/* Ocho semanas: si la cosa se sostiene o se apagó, se ve aquí. */}
      <ul className="mt-3 flex items-end gap-1">
        {[...semanas].reverse().map((s) => (
          <li key={s.lunes} className="flex-1 text-center" title={`Semana del ${lunesLegible(s.lunes)}`}>
            <div className="flex h-16 items-end justify-center">
              <div
                className="w-full rounded-t bg-violet-400"
                style={{ height: `${Math.max(3, (s.veces / tope) * 100)}%` }}
              />
            </div>
            <span className="tnum block text-[10px] text-slate-400">{s.veces}</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-slate-400">
        Últimas 8 semanas, de la más antigua a esta.
      </p>

      <p className="mt-3 mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        De qué
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {tipos.slice(0, 8).map((t) => (
          <li
            key={t.nombre}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
          >
            {t.nombre}
            <span className="tnum ml-1 text-slate-400">×{t.veces}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        Los últimos
      </p>
      <ul className="space-y-1">
        {ultimos.map(({ fecha: dia, entreno }) => (
          <li key={entreno.id} className="text-[11px] leading-snug text-slate-600">
            <span className="tnum text-slate-400">{lunesLegible(dia)}</span>{' '}
            <span className="text-slate-800">{nombreDelEntreno(entreno)}</span>
            {duracionLegible(entreno.minutos) && (
              <span className="tnum ml-1 text-slate-500">{duracionLegible(entreno.minutos)}</span>
            )}
            {entreno.comoFue && (
              <span className="ml-1" title={COMO_FUE_LABELS[entreno.comoFue]}>
                {CARA[entreno.comoFue]}
              </span>
            )}
            {entreno.nota && <span className="text-slate-500"> — «{entreno.nota}»</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
