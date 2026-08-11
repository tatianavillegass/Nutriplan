import type { ResumenComida, EstadoComida, FilaCompletitud } from '../../utils/completitud';
import { nombreGrupo } from '../../utils/completitud';
import { fmt } from '../common/ui';

/** Colores del estado global. Uno por concepto, sin medias tintas. */
const TONO: Record<EstadoComida, { chip: string; punto: string; icono: string }> = {
  completa: {
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    punto: 'bg-emerald-500',
    icono: '✓',
  },
  incompleta: {
    chip: 'border-amber-200 bg-amber-50 text-amber-800',
    punto: 'bg-amber-500',
    icono: '!',
  },
  excedida: {
    chip: 'border-rose-200 bg-rose-50 text-rose-800',
    punto: 'bg-rose-500',
    icono: '↑',
  },
  sin_pauta: {
    chip: 'border-slate-200 bg-slate-50 text-slate-500',
    punto: 'bg-slate-300',
    icono: '·',
  },
};

/**
 * BADGE DE ESTADO
 *
 * Va en la cabecera de la receta, donde se mira antes de comer. Dice una sola
 * cosa: si el plato es el que te pautaron o no.
 */
export function CompletenessBadge({
  resumen,
  className = '',
}: {
  resumen: ResumenComida;
  className?: string;
}) {
  const t = TONO[resumen.estado];
  if (resumen.estado === 'sin_pauta') return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${t.chip} ${className}`}
      title={`${resumen.cuadradas} de ${resumen.total} grupos cuadrados`}
    >
      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white ${t.punto}`}>
        {t.icono}
      </span>
      {resumen.mensaje}
      <span className="tnum opacity-60">
        {resumen.cuadradas}/{resumen.total}
      </span>
    </span>
  );
}

/** Texto de la diferencia: "falta 1", "sobra ½", "listo". */
function diferencia(f: FilaCompletitud): string {
  if (f.estado === 'ok') return 'listo';
  const n = Math.abs(f.falta);
  const cantidad = n === 0.5 ? '½' : fmt(n, n % 1 ? 1 : 0);
  return f.estado === 'falta' ? `falta ${cantidad}` : `sobra ${cantidad}`;
}

/**
 * CHECKLIST POR GRUPO
 *
 * Una fila por familia pautada, con una barra que enseña cuánto va cubierto.
 * `onCompletar` conecta cada hueco con el panel de añadir: se pulsa "falta 1
 * fruta" y se elige con qué taparlo, ya con el gramaje calculado.
 */
export function MealCompleteness({
  resumen,
  onCompletar,
}: {
  resumen: ResumenComida;
  onCompletar?: (fila: FilaCompletitud) => void;
}) {
  if (resumen.estado === 'sin_pauta') {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] leading-snug text-slate-500">
        Esta comida no lleva intercambios pautados: come lo que ponga la receta.
      </p>
    );
  }

  const t = TONO[resumen.estado];

  return (
    <div className={`rounded-lg border bg-white p-3 ${t.chip.split(' ')[0]}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold text-brand-800">¿Está completa?</p>
        <CompletenessBadge resumen={resumen} />
      </div>

      <ul className="mt-2 space-y-1.5">
        {resumen.filas.map((f) => {
          const pct = f.pautado > 0 ? Math.min(1, f.cubierto / f.pautado) : 1;
          const exceso = f.estado === 'exceso';
          const marca = f.estado === 'ok' ? '✓' : f.estado === 'falta' ? '○' : '↑';
          const color =
            f.estado === 'ok'
              ? 'text-emerald-700'
              : f.estado === 'falta'
                ? 'text-amber-700'
                : 'text-rose-700';

          return (
            <li key={f.familia}>
              <div className="flex items-baseline gap-1.5 text-[11px]">
                <span className={`w-3 shrink-0 text-center font-bold ${color}`}>{marca}</span>
                <span className="flex-1 truncate text-slate-700">
                  {f.label}
                  {f.pautado === 0 && (
                    <span className="ml-1 text-[10px] text-slate-400">(no pautado)</span>
                  )}
                </span>
                <span className="tnum shrink-0 text-slate-500">
                  {fmt(f.cubierto, f.cubierto % 1 ? 1 : 0)}
                  {f.pautado > 0 && ` / ${fmt(f.pautado, f.pautado % 1 ? 1 : 0)}`}
                </span>
                <span className={`shrink-0 text-[10px] ${color}`}>{diferencia(f)}</span>
              </div>

              <div className="mt-0.5 ml-4.5 h-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-[width] ${
                    exceso ? 'bg-rose-400' : f.estado === 'ok' ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.round(pct * 100)}%` }}
                />
              </div>

              {f.estado === 'falta' && onCompletar && (
                <button
                  onClick={() => onCompletar(f)}
                  className="mt-0.5 ml-4.5 text-[10px] font-medium text-brand-600 underline decoration-dotted underline-offset-2 hover:text-brand-800"
                >
                  Completar con {nombreGrupo(f.grupoObjetivo).toLowerCase()} →
                </button>
              )}

              {f.cubiertoCon.length > 0 && f.estado !== 'falta' && (
                <p className="mt-0.5 ml-4.5 text-[10px] leading-snug text-slate-400">
                  Cubierto con {f.cubiertoCon.map((g) => nombreGrupo(g).toLowerCase()).join(' y ')}.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[10px] leading-snug text-slate-500">
        La verdura no cuenta aquí: es libre y puedes añadir la que quieras.
      </p>
    </div>
  );
}
