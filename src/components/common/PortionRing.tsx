import { fmt } from './ui';

/**
 * ANILLO DE PORCIONES
 *
 * El contador "2/3" en pequeño se leía como un dato; el anillo se lee como
 * progreso. Es la misma información, pero se ve desde el otro lado de la
 * cocina.
 *
 * Colores de marca: el verde de NutriPlan mientras va bien, ámbar cuando se
 * pasa. El anillo nunca se dibuja más allá de la vuelta completa — lo que
 * sobra se cuenta aparte, en el texto.
 */

const VERDE = '#34674e';
const VERDE_CLARO = '#669d80';
const AMBAR = '#d97706';
const PISTA = '#e2e8f0';

export type EstadoAnillo = 'pendiente' | 'completo' | 'excedido';

export function estadoDePorciones(elegido: number, pautado: number): EstadoAnillo {
  if (pautado > 0 && elegido > pautado + 0.01) return 'excedido';
  if (pautado > 0 && Math.abs(elegido - pautado) < 0.01) return 'completo';
  return 'pendiente';
}

interface Props {
  titulo: string;
  elegido: number;
  pautado: number;
  /** Líneas pequeñas de debajo: subgrupos, avisos… */
  detalle?: React.ReactNode;
  /** Anillo más pequeño, para listas densas. */
  compacto?: boolean;
}

export function PortionRing({ titulo, elegido, pautado, detalle, compacto = false }: Props) {
  const estado = estadoDePorciones(elegido, pautado);
  const proporcion = pautado > 0 ? Math.min(1, elegido / pautado) : 0;
  const color = estado === 'excedido' ? AMBAR : estado === 'completo' ? VERDE : VERDE_CLARO;

  // Circunferencia 100 para que el dasharray sea directamente el porcentaje.
  const r = 15.9155;
  const lleno = proporcion * 100;
  const tam = compacto ? 'h-20 w-20' : 'h-28 w-28';

  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className="mb-2 text-sm font-semibold text-slate-800">{titulo}</p>

      <div className={`relative ${tam}`}>
        <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
          <circle cx="20" cy="20" r={r} fill="none" stroke={PISTA} strokeWidth="4.5" />
          {lleno > 0 && (
            <circle
              cx="20"
              cy="20"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={`${lleno} ${100 - lleno}`}
              className="transition-all duration-300"
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`tnum font-semibold ${compacto ? 'text-base' : 'text-xl'}`}
            style={{ color: estado === 'excedido' ? AMBAR : VERDE }}
          >
            {fmt(elegido, elegido % 1 ? 1 : 0)}
            <span className="text-slate-300"> / </span>
            {fmt(pautado, pautado % 1 ? 1 : 0)}
          </span>
          {!compacto && <span className="text-[10px] text-slate-400">porciones</span>}
        </div>
      </div>

      {detalle && <div className="mt-2 w-full">{detalle}</div>}
    </div>
  );
}

/** Barra fina de un subgrupo, para el detalle bajo el anillo. */
export function SubgrupoBarra({
  nombre,
  elegido,
  pautado,
}: {
  nombre: string;
  elegido: number;
  pautado: number;
}) {
  const estado = estadoDePorciones(elegido, pautado);
  const proporcion = pautado > 0 ? Math.min(1, elegido / pautado) : elegido > 0 ? 1 : 0;
  const color = estado === 'excedido' ? AMBAR : estado === 'completo' ? VERDE : VERDE_CLARO;

  return (
    <div>
      <p className="flex items-baseline justify-between gap-2 text-[10px]">
        <span className="truncate text-slate-500">{nombre}</span>
        <span className="tnum shrink-0" style={{ color: estado === 'pendiente' ? '#94a3b8' : color }}>
          {fmt(elegido, elegido % 1 ? 1 : 0)}/{fmt(pautado, pautado % 1 ? 1 : 0)}
        </span>
      </p>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${proporcion * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
